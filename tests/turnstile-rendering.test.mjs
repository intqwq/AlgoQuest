import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("account transitions do not transform or clip the Turnstile iframe", async () => {
  const css = await readFile(
    new URL("../app/turnstile-fix.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /account-panel__body\.page-transition/);
  assert.match(css, /animation: aq-account-panel-enter/);
  assert.doesNotMatch(css, /transform:/);
  assert.doesNotMatch(css, /filter:/);
  assert.match(css, /\.turnstile-frame[\s\S]*overflow: visible/);
});

test("root layout preloads the official explicit-render Turnstile API", async () => {
  const layout = await readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );

  assert.match(layout, /import Script from "next\/script"/);
  assert.match(layout, /import "\.\/turnstile-fix\.css"/);
  assert.match(
    layout,
    /rel="preconnect" href="https:\/\/challenges\.cloudflare\.com"/,
  );
  assert.match(
    layout,
    /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/,
  );
  assert.match(layout, /data-algoquest-turnstile="true"/);
});


test("Turnstile reports lifecycle errors and offers bounded recovery", async () => {
  const [account, client, css] = await Promise.all([
    readFile(new URL("../components/account-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/api-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/turnstile-fix.css", import.meta.url), "utf8"),
  ]);

  assert.match(account, /TURNSTILE_LOAD_TIMEOUT_MS = 12_000/);
  assert.match(account, /SCRIPT_TIMEOUT/);
  assert.match(account, /SCRIPT_LOAD_FAILED/);
  assert.match(account, /"error-callback": \(errorCode\)/);
  assert.match(account, /"timeout-callback"/);
  assert.match(account, /"unsupported-callback"/);
  assert.match(account, /retry: "auto"/);
  assert.match(account, /"retry-interval": 8_000/);
  assert.match(account, /"refresh-expired": "auto"/);
  assert.match(account, /clearFailedTurnstileScript\(\)/);
  assert.match(account, /state\.code/);
  assert.match(account, /retrySecurityConfig/);
  assert.match(client, /retryingFetch\(apiUrl\("\/auth\/config"\)/);
  assert.match(client, /AUTH_CONFIG_UNAVAILABLE/);
  assert.match(css, /\.turnstile-status/);
  assert.match(css, /\.account-security-status/);
});

test("gateway re-resolves recreated Docker services", async () => {
  const nginx = await readFile(
    new URL("../deploy/nginx/default.conf.template", import.meta.url),
    "utf8",
  );

  assert.match(nginx, /resolver 127\.0\.0\.11 valid=10s ipv6=off/);
  assert.match(nginx, /set \$api_upstream "\$\{API_UPSTREAM\}"/);
  assert.match(nginx, /set \$web_upstream "\$\{WEB_UPSTREAM\}"/);
  assert.match(nginx, /rewrite \^\/api\/\(\.\*\)\$ \/\$1 break/);
  assert.match(nginx, /proxy_pass \$api_upstream/);
  assert.match(nginx, /proxy_pass \$web_upstream/);
  assert.doesNotMatch(nginx, /proxy_pass \$\{API_UPSTREAM\}/);
});
