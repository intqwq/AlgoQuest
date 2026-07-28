function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function authEmailHtml({ displayName, title, message, actionLabel, actionUrl }) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#e6e0d2;color:#151515;font-family:Consolas,monospace">
    <div style="max-width:620px;margin:32px auto;border:2px solid #151515;background:#f3f0e8;box-shadow:8px 8px 0 #087a4a">
      <div style="padding:12px 18px;background:#151515;color:#33df91">ALGOQUEST // IDENTITY NODE</div>
      <div style="padding:28px">
        <pre style="color:#087a4a">  /\\_/\\\\
 ( o.o )  &lt; AUTH SIGNAL RECEIVED
  &gt; ^ &lt;</pre>
        <h1 style="font-family:Arial,sans-serif">${escapeHtml(title)}</h1>
        <p>Hello ${escapeHtml(displayName)},</p>
        <p style="line-height:1.7">${escapeHtml(message)}</p>
        <p style="margin:28px 0">
          <a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:13px 18px;background:#151515;color:#f3f0e8;text-decoration:none;box-shadow:5px 5px 0 #33df91">${escapeHtml(actionLabel)}</a>
        </p>
        <p style="font-size:12px;line-height:1.6;color:#53534f">If the button fails, copy this URL:<br>${escapeHtml(actionUrl)}</p>
        <p style="font-size:12px;color:#53534f">If you did not request this, ignore this transmission.</p>
      </div>
    </div>
  </body>
</html>`;
}

export function createEmailService({
  apiKey,
  fromEmail = "AlgoQuest@intqwq.com",
  appUrl,
  mode = "resend",
  fetchImpl = fetch,
}) {
  const origin = appUrl.replace(/\/$/, "");

  async function deliver({ to, subject, html, text, idempotencyKey, devUrl }) {
    if (mode === "log") {
      console.log(`[auth email] ${to}: ${devUrl}`);
      return { id: "local-log" };
    }
    if (!apiKey) throw new Error("RESEND_API_KEY is not configured");

    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        from: `AlgoQuest <${fromEmail}>`,
        to: [to],
        subject,
        html,
        text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.id) {
      throw new Error(`Resend rejected email with HTTP ${response.status}`);
    }
    return result;
  }

  return {
    mode,
    async sendVerification({ email, displayName, token, idempotencyKey }) {
      const url = new URL(origin);
      url.searchParams.set("verify", token);
      const message =
        "Confirm this address to activate cross-device saves and secure account recovery. This link expires in 30 minutes.";
      return deliver({
        to: email,
        subject: "Verify your AlgoQuest account",
        html: authEmailHtml({
          displayName,
          title: "VERIFY YOUR PLAYER ID",
          message,
          actionLabel: "[ VERIFY EMAIL ]",
          actionUrl: url.href,
        }),
        text: `AlgoQuest\n\n${message}\n\n${url.href}`,
        idempotencyKey: `algoquest-verify-${idempotencyKey}`,
        devUrl: url.href,
      });
    },

    async sendPasswordReset({ email, displayName, token, idempotencyKey }) {
      const url = new URL(origin);
      url.searchParams.set("reset", token);
      const message =
        "A password reset was requested for your player ID. This single-use link expires in 20 minutes.";
      return deliver({
        to: email,
        subject: "Reset your AlgoQuest password",
        html: authEmailHtml({
          displayName,
          title: "RESET ACCESS KEY",
          message,
          actionLabel: "[ RESET PASSWORD ]",
          actionUrl: url.href,
        }),
        text: `AlgoQuest\n\n${message}\n\n${url.href}`,
        idempotencyKey: `algoquest-reset-${idempotencyKey}`,
        devUrl: url.href,
      });
    },
  };
}
