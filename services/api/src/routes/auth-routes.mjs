export async function handleAuthRoutes(context) {
  const {
    request, response, url, database, json, turnstileSiteKey, emailService,
    applyAuthRateLimit, readJson, ApiError, validateAccountInput, requireHuman,
    authenticate, hashPassword, siteOwnerEmail, verifyPassword,
    passwordPolicyError, sessionPayload, cleanDisplayName,
  } = context;

  if (request.method === "GET" && url.pathname === "/v1/auth/config") {
    const settings = await database.getServerSettings();
    return json(response, 200, {
      turnstileSiteKey,
      emailDelivery: emailService.mode === "resend" ? "resend" : "local-log",
      registrationEnabled: settings.registrationEnabled,
      maintenanceMessage: settings.maintenanceMessage,
    });
  }
  
  if (request.method === "POST" && url.pathname === "/v1/sessions") {
    await applyAuthRateLimit(request, "guest_session", undefined, 30, 3600);
    const body = await readJson(request, 4 * 1024);
    const session = await database.createSession(
      cleanDisplayName(body.displayName),
    );
    return json(response, 201, sessionPayload(session));
  }
  
  if (request.method === "POST" && url.pathname === "/v1/auth/register") {
    const body = await readJson(request, 12 * 1024);
    const settings = await database.getServerSettings();
    if (!settings.registrationEnabled) {
      throw new ApiError(503, "REGISTRATION_DISABLED");
    }
    const input = validateAccountInput(body, {
      password: true,
      displayName: true,
    });
    await applyAuthRateLimit(request, "register", input.email, 5, 15 * 60);
    await requireHuman(request, body, "register");
    const currentPlayer = await authenticate(request);
    const passwordHash = await hashPassword(body.password);
    const registration = await database.registerAccount({
      anonymousUserId: currentPlayer?.isGuest ? currentPlayer.id : undefined,
      displayName: input.displayName,
      email: input.email,
      passwordHash,
      hasCppFoundation: body.hasCppFoundation === true,
      hasAlgorithmFoundation: body.hasAlgorithmFoundation === true,
    });
    const verification = registration.created
      ? registration
      : !registration.verified
        ? await database.createVerificationToken(input.email)
        : undefined;
    if (verification) {
      try {
        await emailService.sendVerification({
          email: verification.email,
          displayName: verification.displayName,
          token: verification.token,
          idempotencyKey: verification.tokenHash.slice(0, 32),
        });
      } catch (error) {
        console.error("Verification email delivery failed:", error.message);
        throw new ApiError(502, "EMAIL_DELIVERY_FAILED");
      }
    }
    return json(response, 202, { status: "VERIFICATION_SENT" });
  }
  
  if (
    request.method === "POST" &&
    url.pathname === "/v1/auth/resend-verification"
  ) {
    const body = await readJson(request, 8 * 1024);
    const { email } = validateAccountInput(body, { password: false });
    await applyAuthRateLimit(
      request,
      "resend_verification",
      email,
      3,
      30 * 60,
    );
    await requireHuman(request, body, "resend_verification");
    const verification = await database.createVerificationToken(email);
    if (verification) {
      try {
        await emailService.sendVerification({
          ...verification,
          idempotencyKey: verification.tokenHash.slice(0, 32),
        });
      } catch (error) {
        console.error("Verification email delivery failed:", error.message);
        throw new ApiError(502, "EMAIL_DELIVERY_FAILED");
      }
    }
    return json(response, 202, { status: "VERIFICATION_SENT" });
  }
  
  if (request.method === "POST" && url.pathname === "/v1/auth/verify-email") {
    const body = await readJson(request, 4 * 1024);
    if (
      typeof body.token !== "string" ||
      !/^[A-Za-z0-9_-]{40,}$/.test(body.token)
    ) {
      throw new ApiError(400, "INVALID_OR_EXPIRED_TOKEN");
    }
    let session = await database.verifyEmail(body.token);
    if (!session) throw new ApiError(400, "INVALID_OR_EXPIRED_TOKEN");
    const owner = await database.ensureSiteOwner(siteOwnerEmail);
    if (owner?.id === session.player.id) {
      session = { ...session, player: owner };
    }
    return json(response, 200, sessionPayload(session));
  }
  
  if (request.method === "POST" && url.pathname === "/v1/auth/login") {
    const body = await readJson(request, 8 * 1024);
    const { email } = validateAccountInput(body, { password: true });
    await applyAuthRateLimit(request, "login", email, 10, 15 * 60);
    await requireHuman(request, body, "login");
    const account = await database.findAccountForLogin(email);
    const validPassword = account
      ? await verifyPassword(body.password, account.passwordHash)
      : (await hashPassword(body.password), false);
    if (!account || !validPassword) {
      throw new ApiError(401, "INVALID_CREDENTIALS");
    }
    if (!account.emailVerified) {
      throw new ApiError(403, "EMAIL_NOT_VERIFIED");
    }
    await database.ensureSiteOwner(siteOwnerEmail);
    const session = await database.loginAccount(account.id);
    return json(response, 200, sessionPayload(session));
  }
  
  if (
    request.method === "POST" &&
    url.pathname === "/v1/auth/forgot-password"
  ) {
    const body = await readJson(request, 8 * 1024);
    const { email } = validateAccountInput(body, { password: false });
    await applyAuthRateLimit(
      request,
      "forgot_password",
      email,
      4,
      30 * 60,
    );
    await requireHuman(request, body, "forgot_password");
    const reset = await database.createPasswordResetToken(email);
    if (reset) {
      try {
        await emailService.sendPasswordReset({
          ...reset,
          idempotencyKey: reset.tokenHash.slice(0, 32),
        });
      } catch (error) {
        console.error("Password reset email delivery failed:", error.message);
        throw new ApiError(502, "EMAIL_DELIVERY_FAILED");
      }
    }
    return json(response, 202, { status: "RESET_SENT" });
  }
  
  if (request.method === "POST" && url.pathname === "/v1/auth/reset-password") {
    const body = await readJson(request, 8 * 1024);
    const policyError = passwordPolicyError(body.password);
    if (policyError) throw new ApiError(400, policyError);
    if (
      typeof body.token !== "string" ||
      !/^[A-Za-z0-9_-]{40,}$/.test(body.token)
    ) {
      throw new ApiError(400, "INVALID_OR_EXPIRED_TOKEN");
    }
    await applyAuthRateLimit(request, "reset_password", undefined, 5, 30 * 60);
    await requireHuman(request, body, "reset_password");
    const passwordHash = await hashPassword(body.password);
    const session = await database.resetPassword(body.token, passwordHash);
    if (!session) throw new ApiError(400, "INVALID_OR_EXPIRED_TOKEN");
    return json(response, 200, sessionPayload(session));
  }
  return false;
}

