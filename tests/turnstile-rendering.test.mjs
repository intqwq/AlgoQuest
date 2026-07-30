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
