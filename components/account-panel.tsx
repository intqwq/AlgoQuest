"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  AuthApiError,
  AuthConfig,
  loadAuthConfig,
  loginAccount,
  logoutAccount,
  Player,
  registerAccount,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  updatePlayerProfile,
  verifyEmail,
} from "@/lib/api-client";
import type { Locale } from "@/lib/i18n";

type AuthView =
  | "login"
  | "register"
  | "forgot"
  | "reset"
  | "profile"
  | "verify_pending";

type TurnstileApi = {
  render(
    target: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "light";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileLoader: Promise<void> | undefined;

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  turnstileLoader ??= new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-algoquest-turnstile="true"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("load failed")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.defer = true;
    script.dataset.algoquestTurnstile = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("load failed"));
    document.head.appendChild(script);
  });
  return turnstileLoader;
}

function TurnstileBox({
  siteKey,
  action,
  resetKey,
  onToken,
}: {
  siteKey: string;
  action: string;
  resetKey: number;
  onToken: (token: string) => void;
}) {
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let widgetId: string | undefined;
    onToken("");
    void loadTurnstileScript()
      .then(() => {
        if (!active || !targetRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(targetRef.current, {
          sitekey: siteKey,
          action,
          theme: "light",
          callback: onToken,
          "expired-callback": () => onToken(""),
          "error-callback": () => onToken(""),
        });
      })
      .catch(() => onToken(""));
    return () => {
      active = false;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [action, onToken, resetKey, siteKey]);

  return (
    <div className="turnstile-frame">
      <div ref={targetRef} />
    </div>
  );
}

const errorMessages: Record<Locale, Record<string, string>> = {
  en: {
    INVALID_EMAIL: "Enter a valid email address.",
    DISPLAY_NAME_REQUIRED: "Choose a player name.",
    PASSWORD_TOO_SHORT: "Password needs at least 10 characters.",
    PASSWORD_TOO_LONG: "Password must be 128 characters or fewer.",
    PASSWORD_NEEDS_LETTER_AND_NUMBER: "Password needs at least one letter and one number.",
    INVALID_CREDENTIALS: "Email or password is incorrect.",
    EMAIL_NOT_VERIFIED: "Verify this email before logging in.",
    HUMAN_VERIFICATION_FAILED: "Security check failed. Please retry it.",
    HUMAN_VERIFICATION_UNAVAILABLE: "Security check is temporarily unavailable.",
    EMAIL_DELIVERY_FAILED: "Email delivery failed. You can retry in a moment.",
    INVALID_OR_EXPIRED_TOKEN: "This link is invalid, expired, or already used.",
    RATE_LIMITED: "Too many attempts. Pause before trying again.",
    REGISTRATION_DISABLED: "New player registration is temporarily disabled.",
  },
  "zh-CN": {
    INVALID_EMAIL: "请输入有效的邮箱地址。",
    DISPLAY_NAME_REQUIRED: "请填写玩家名。",
    PASSWORD_TOO_SHORT: "密码至少需要 10 个字符。",
    PASSWORD_TOO_LONG: "密码不能超过 128 个字符。",
    PASSWORD_NEEDS_LETTER_AND_NUMBER: "密码至少需要一个字母和一个数字。",
    INVALID_CREDENTIALS: "邮箱或密码错误。",
    EMAIL_NOT_VERIFIED: "登录前请先验证邮箱。",
    HUMAN_VERIFICATION_FAILED: "安全验证失败，请重试。",
    HUMAN_VERIFICATION_UNAVAILABLE: "安全验证暂时不可用。",
    EMAIL_DELIVERY_FAILED: "邮件发送失败，请稍后重试。",
    INVALID_OR_EXPIRED_TOKEN: "链接无效、已过期或已经使用。",
    RATE_LIMITED: "尝试次数过多，请稍后再试。",
    REGISTRATION_DISABLED: "新玩家注册暂时关闭。",
  },
  ja: {
    INVALID_EMAIL: "有効なメールアドレスを入力してください。",
    DISPLAY_NAME_REQUIRED: "プレイヤー名を入力してください。",
    PASSWORD_TOO_SHORT: "パスワードは10文字以上必要です。",
    PASSWORD_TOO_LONG: "パスワードは128文字以下にしてください。",
    PASSWORD_NEEDS_LETTER_AND_NUMBER: "文字と数字を最低1つずつ含めてください。",
    INVALID_CREDENTIALS: "メールまたはパスワードが違います。",
    EMAIL_NOT_VERIFIED: "ログイン前にメール認証を完了してください。",
    HUMAN_VERIFICATION_FAILED: "セキュリティ確認に失敗しました。",
    HUMAN_VERIFICATION_UNAVAILABLE: "セキュリティ確認は一時利用できません。",
    EMAIL_DELIVERY_FAILED: "メール送信に失敗しました。後でもう一度お試しください。",
    INVALID_OR_EXPIRED_TOKEN: "リンクが無効、期限切れ、または使用済みです。",
    RATE_LIMITED: "試行回数が多すぎます。しばらくお待ちください。",
    REGISTRATION_DISABLED: "新規登録は一時停止中です。",
  },
};

const accountMessages = {
  en: {
    loginRegister: "LOGIN / REGISTER",
    guarded: "IDENTITY NODE // CLOUDFLARE GUARDED",
    titles: {
      register: "CREATE PLAYER",
      login: "RESTORE PLAYER",
      forgot: "RECOVER ACCESS",
      reset: "NEW ACCESS KEY",
      profile: "PLAYER DATABASE",
      verify_pending: "VERIFY EMAIL",
    },
    playerName: "PLAYER NAME",
    displayName: "DISPLAY NAME",
    email: "EMAIL",
    password: "PASSWORD",
    newPassword: "NEW PASSWORD",
    confirmPassword: "CONFIRM PASSWORD",
    update: "UPDATE PROFILE",
    execute: "EXECUTE",
    transmitting: "TRANSMITTING...",
    login: "LOGIN",
    register: "REGISTER",
    forgot: "FORGOT PASSWORD",
    logout: "LOGOUT",
    verified: "VERIFIED",
    saveMode: "SAVE MODE",
    role: "ROLE",
    playerRole: "PLAYER",
    adminRole: "ADMIN",
    ownerRole: "SITE OWNER",
    controlDeck: "CONTROL DECK",
  },
  "zh-CN": {
    loginRegister: "登录 / 注册",
    guarded: "身份节点 // CLOUDFLARE 安全验证",
    titles: {
      register: "创建玩家",
      login: "登录玩家",
      forgot: "找回账号",
      reset: "设置新密码",
      profile: "玩家数据库",
      verify_pending: "验证邮箱",
    },
    playerName: "玩家名",
    displayName: "显示名称",
    email: "邮箱",
    password: "密码",
    newPassword: "新密码",
    confirmPassword: "确认密码",
    update: "更新资料",
    execute: "执行",
    transmitting: "传输中……",
    login: "登录",
    register: "注册",
    forgot: "忘记密码",
    logout: "退出登录",
    verified: "已验证",
    saveMode: "存档模式",
    role: "身份",
    playerRole: "玩家",
    adminRole: "管理员",
    ownerRole: "站长",
    controlDeck: "管理控制台",
  },
  ja: {
    loginRegister: "ログイン / 登録",
    guarded: "ID ノード // CLOUDFLARE 保護",
    titles: {
      register: "プレイヤー作成",
      login: "プレイヤー復元",
      forgot: "アクセス回復",
      reset: "新しいパスワード",
      profile: "プレイヤーデータベース",
      verify_pending: "メール認証",
    },
    playerName: "プレイヤー名",
    displayName: "表示名",
    email: "メール",
    password: "パスワード",
    newPassword: "新しいパスワード",
    confirmPassword: "パスワード確認",
    update: "プロフィール更新",
    execute: "実行",
    transmitting: "送信中…",
    login: "ログイン",
    register: "登録",
    forgot: "パスワードを忘れた",
    logout: "ログアウト",
    verified: "認証済み",
    saveMode: "セーブモード",
    role: "権限",
    playerRole: "プレイヤー",
    adminRole: "管理者",
    ownerRole: "サイトオーナー",
    controlDeck: "管理コンソール",
  },
} as const;

function messageFor(error: unknown, locale: Locale) {
  if (error instanceof AuthApiError) {
    return (
      errorMessages[locale][error.code] ??
      errorMessages.en[error.code] ??
      `Account request failed: ${error.code}`
    );
  }
  return error instanceof Error ? error.message : "Account request failed.";
}

export function AccountPanel({
  player,
  level,
  onPlayerChange,
  onAccountSync,
  locale,
}: {
  player?: Player;
  level: number;
  onPlayerChange: (player: Player | undefined) => void;
  onAccountSync: () => void;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<AuthView>("login");
  const [config, setConfig] = useState<AuthConfig>();
  const [turnstileToken, setTurnstileToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const linkHandledRef = useRef(false);
  const copy = accountMessages[locale];

  const action =
    view === "register"
      ? "register"
      : view === "forgot"
        ? "forgot_password"
        : view === "reset"
          ? "reset_password"
          : view === "verify_pending"
            ? "resend_verification"
            : "login";

  const selectView = (next: AuthView) => {
    setView(next);
    setMessage("");
    setTurnstileToken("");
    setResetKey((value) => value + 1);
  };

  useEffect(() => {
    const openAccount = (event: Event) => {
      const requested = (event as CustomEvent<{ view?: AuthView }>).detail?.view;
      setView(
        requested === "register"
          ? "register"
          : player && !player.isGuest
            ? player.emailVerified
              ? "profile"
              : "verify_pending"
            : "login",
      );
      setMessage("");
      setTurnstileToken("");
      setResetKey((value) => value + 1);
      setOpen(true);
    };
    window.addEventListener("algoquest:open-account", openAccount);
    return () =>
      window.removeEventListener("algoquest:open-account", openAccount);
  }, [player]);

  useEffect(() => {
    if (!open) return;
    void loadAuthConfig()
      .then(setConfig)
      .catch((error) => setMessage(messageFor(error, locale)));
  }, [locale, open]);

  useEffect(() => {
    if (linkHandledRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const verification = params.get("verify");
    const reset = params.get("reset");
    if (verification) {
      linkHandledRef.current = true;
      queueMicrotask(() => {
        setOpen(true);
        setBusy(true);
        setMessage("VERIFYING PLAYER ID...");
        void verifyEmail(verification)
          .then((verifiedPlayer) => {
            onPlayerChange(verifiedPlayer);
            onAccountSync();
            setView("profile");
            setMessage("EMAIL VERIFIED // ACCOUNT ONLINE");
            window.history.replaceState(null, "", window.location.pathname);
          })
          .catch((error) => setMessage(messageFor(error, locale)))
          .finally(() => setBusy(false));
      });
    } else if (reset) {
      linkHandledRef.current = true;
      queueMicrotask(() => {
        setResetToken(reset);
        setView("reset");
        setOpen(true);
      });
    }
  }, [locale, onAccountSync, onPlayerChange]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      if (view === "register") {
        const email = String(form.get("email") ?? "");
        const nextPlayer = await registerAccount({
          displayName: String(form.get("displayName") ?? ""),
          email,
          password: String(form.get("password") ?? ""),
          turnstileToken,
        });
        setPendingEmail(email);
        onPlayerChange(nextPlayer);
        setView("verify_pending");
        setMessage("VERIFICATION EMAIL TRANSMITTED");
      } else if (view === "login") {
        const nextPlayer = await loginAccount({
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          turnstileToken,
        });
        onPlayerChange(nextPlayer);
        onAccountSync();
        setView("profile");
        setMessage("LOGIN ACCEPTED // SAVE CHECK STARTED");
      } else if (view === "forgot") {
        await requestPasswordReset({
          email: String(form.get("email") ?? ""),
          turnstileToken,
        });
        setMessage("IF THAT PLAYER EXISTS, A RESET LINK WAS SENT");
      } else if (view === "verify_pending") {
        await resendVerification({
          email: String(form.get("email") ?? player?.email ?? pendingEmail),
          turnstileToken,
        });
        setMessage("VERIFICATION EMAIL RETRANSMITTED");
      } else if (view === "reset") {
        const password = String(form.get("password") ?? "");
        const confirmation = String(form.get("passwordConfirmation") ?? "");
        if (password !== confirmation) {
          throw new Error("Passwords do not match.");
        }
        const nextPlayer = await resetPassword({
          token: resetToken,
          password,
          turnstileToken,
        });
        onPlayerChange(nextPlayer);
        onAccountSync();
        setView("profile");
        setMessage("ACCESS KEY REPLACED // ALL OLD SESSIONS REVOKED");
        window.history.replaceState(null, "", window.location.pathname);
      } else if (view === "profile") {
        const nextPlayer = await updatePlayerProfile(
          String(form.get("displayName") ?? ""),
        );
        onPlayerChange(nextPlayer);
        setMessage("PLAYER PROFILE UPDATED");
      }
    } catch (error) {
      setMessage(messageFor(error, locale));
    } finally {
      setBusy(false);
      setTurnstileToken("");
      setResetKey((value) => value + 1);
    }
  };

  const needsTurnstile = view !== "profile";

  return (
    <>
      <button
        className={`player-chip player-chip--${player?.role ?? "player"}`}
        type="button"
        onClick={() => {
          setView(
            player && !player.isGuest
              ? player.emailVerified
                ? "profile"
                : "verify_pending"
              : "login",
          );
          setOpen(true);
        }}
        aria-label="Open player account"
      >
        <span className={`online-dot ${player ? "" : "is-offline"}`} />
        {player && !player.isGuest
          ? `${player.displayName.toUpperCase()} // ${
              player.role === "owner"
                ? copy.ownerRole
                : player.role === "admin"
                  ? copy.adminRole
                  : copy.playerRole
            } // LV.${String(level).padStart(2, "0")}`
          : copy.loginRegister}
      </button>

      {open && (
        <div className="account-overlay" role="presentation">
          <section
            className="account-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-title"
          >
            <div className="account-panel__bar">
              <span>PLAYER_AUTH.exe</span>
              <button type="button" onClick={() => setOpen(false)}>
                [ X ]
              </button>
            </div>
            <div className="account-panel__body">
              <p className="eyebrow">{copy.guarded}</p>
              <h2 id="account-title">
                {copy.titles[view]}
              </h2>

              {view === "profile" && player ? (
                <form onSubmit={submit}>
                  <div className="account-record">
                    <span>PLAYER_ID</span>
                    <code>{player.id}</code>
                    <span>{copy.email}</span>
                    <code>{player.email ?? "NOT_LINKED"}</code>
                    <span>{copy.verified}</span>
                    <code>{player.emailVerified ? "YES" : "NO"}</code>
                    <span>{copy.saveMode}</span>
                    <code>CROSS_DEVICE</code>
                    <span>{copy.role}</span>
                    <code>
                      {player.role === "owner"
                        ? copy.ownerRole
                        : player.role === "admin"
                          ? copy.adminRole
                          : copy.playerRole}
                    </code>
                  </div>
                  <label>
                    {copy.displayName}
                    <input
                      name="displayName"
                      defaultValue={player.displayName}
                      maxLength={64}
                      required
                    />
                  </label>
                  <button className="account-submit" disabled={busy}>
                    [ {copy.update} ]
                  </button>
                </form>
              ) : (
                <form onSubmit={submit}>
                  {view === "register" && (
                    <label>
                      {copy.playerName}
                      <input
                        name="displayName"
                        autoComplete="nickname"
                        maxLength={64}
                        required
                      />
                    </label>
                  )}
                  {view !== "reset" && (
                    <label>
                      {copy.email}
                      <input
                        name="email"
                        type="email"
                        autoComplete="email"
                        defaultValue={
                          view === "verify_pending"
                            ? (player?.email ?? pendingEmail)
                            : undefined
                        }
                        readOnly={view === "verify_pending" && Boolean(player?.email)}
                        required
                      />
                    </label>
                  )}
                  {["login", "register", "reset"].includes(view) && (
                    <label>
                      {view === "reset" ? copy.newPassword : copy.password}
                      <input
                        name="password"
                        type="password"
                        minLength={10}
                        maxLength={128}
                        autoComplete={
                          view === "login" ? "current-password" : "new-password"
                        }
                        required
                      />
                    </label>
                  )}
                  {view === "reset" && (
                    <label>
                      {copy.confirmPassword}
                      <input
                        name="passwordConfirmation"
                        type="password"
                        minLength={10}
                        maxLength={128}
                        autoComplete="new-password"
                        required
                      />
                    </label>
                  )}

                  {needsTurnstile && config?.turnstileSiteKey && (
                    <TurnstileBox
                      siteKey={config.turnstileSiteKey}
                      action={action}
                      resetKey={resetKey}
                      onToken={setTurnstileToken}
                    />
                  )}

                  <button
                    className="account-submit"
                    disabled={
                      busy ||
                      !config?.turnstileSiteKey ||
                      (needsTurnstile && !turnstileToken)
                    }
                  >
                    {busy
                      ? `[ ${copy.transmitting} ]`
                      : `[ ${copy.execute} ]`}
                  </button>
                </form>
              )}

              {message && <p className="account-message">{message}</p>}
              {config?.emailDelivery === "local-log" && (
                <p className="account-dev-note">
                  DEV MAIL MODE // verification links appear in Core API logs
                </p>
              )}

              <div className="account-switches">
                {view === "profile" &&
                  player &&
                  ["admin", "owner"].includes(player.role) && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        window.dispatchEvent(
                          new CustomEvent("algoquest:open-admin"),
                        );
                      }}
                    >
                      [ {copy.controlDeck} ]
                    </button>
                  )}
                {view !== "login" && (
                  <button type="button" onClick={() => selectView("login")}>
                    [ {copy.login} ]
                  </button>
                )}
                {view !== "register" && (!player || player.isGuest) && (
                  <button type="button" onClick={() => selectView("register")}>
                    [ {copy.register} ]
                  </button>
                )}
                {view === "login" && (
                  <button type="button" onClick={() => selectView("forgot")}>
                    [ {copy.forgot} ]
                  </button>
                )}
                {view === "profile" && player && !player.isGuest && (
                  <button
                    type="button"
                    onClick={() => {
                      void logoutAccount().finally(() => {
                        onPlayerChange(undefined);
                        setOpen(false);
                        onAccountSync();
                      });
                    }}
                  >
                    [ {copy.logout} ]
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
