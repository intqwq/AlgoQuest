import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("root Pi installer treats Bridge as its networking prerequisite", async () => {
  const [install, compatibilityBootstrap, register] = await Promise.all([
    read("install.sh"),
    read("deploy/pi/bootstrap-ubuntu.sh"),
    read("deploy/pi/register-bridge.sh"),
  ]);
  assert.match(install, /command -v bridge/);
  assert.match(install, /bridge-edge\.service/);
  assert.match(install, /bridge-cloudflared\.service/);
  assert.doesNotMatch(install, /download\.docker\.com|pkg\.cloudflare\.com|cloudflared tunnel/);
  assert.match(install, /apt-get install -y openssl/);
  assert.match(install, /register-bridge\.sh/);
  assert.match(compatibilityBootstrap, /exec bash "\$\{project_root\}\/install\.sh" "\$@"/);
  assert.match(register, /service: "algoquest"/);
  assert.match(register, /bridge register/);
  assert.match(register, /client_max_body_size: "8m"/);
});

test("Pi deploy validates credentials, private bindings, and readiness", async () => {
  const [deploy, boundary] = await Promise.all([
    read("deploy/pi/deploy.sh"),
    read("deploy/pi/check-network-boundary.sh"),
  ]);
  assert.match(deploy, /for key in RESEND_API_KEY TURNSTILE_SITE_KEY TURNSTILE_SECRET_KEY/);
  assert.match(deploy, /"\$\{value\}" == CHANGE_ME_\*/);
  assert.match(deploy, /check-network-boundary\.sh/);
  assert.match(deploy, /--wait-timeout "\$\{wait_timeout\}"/);
  assert.match(boundary, /WEB_BIND_ADDRESS API_BIND_ADDRESS JUDGE_BIND_ADDRESS DB_BIND_ADDRESS/);
  assert.match(boundary, /must be 127\.0\.0\.1/);
});

test("Pi systemd starts after Bridge and keeps all host ports private", async () => {
  const [systemd, status, compose] = await Promise.all([
    read("deploy/pi/install-systemd.sh"),
    read("deploy/pi/status.sh"),
    read("compose.yml"),
  ]);
  assert.match(systemd, /Requires=docker\.service bridge-edge\.service/);
  assert.match(systemd, /After=docker\.service bridge-edge\.service/);
  assert.match(systemd, /ExecStartPre=.*check-network-boundary\.sh/);
  assert.match(systemd, /--wait --wait-timeout \$\{wait_timeout\}/);
  assert.match(status, /get_env_value WEB_PORT 18081/);
  assert.match(status, /get_env_value API_PORT 8787/);
  assert.match(status, /get_env_value JUDGE_PORT 8788/);
  assert.match(compose, /\$\{WEB_BIND_ADDRESS:-127\.0\.0\.1\}:\$\{WEB_PORT:-8080\}:80/);
});

test("AlgoQuest owns its hostname and registers it rather than configuring Bridge", async () => {
  const [install, env, register] = await Promise.all([
    read("install.sh"),
    read(".env.pi.example"),
    read("deploy/pi/register-bridge.sh"),
  ]);
  assert.match(install, /set_env PUBLIC_HOSTNAME "\$\{domain\}"/);
  assert.match(env, /^PUBLIC_HOSTNAME=game\.intqwq\.com$/m);
  assert.match(register, /PUBLIC_HOSTNAME/);
  assert.match(register, /http:\/\/127\.0\.0\.1:\$\{web_port\}/);
  assert.doesNotMatch(install, /cloudflared tunnel|tunnel route dns|nginx\/default/);
});

test("uninstaller unregisters only AlgoQuest and preserves the Bridge platform", async () => {
  const uninstall = await read("uninstall.sh");
  assert.match(uninstall, /ERASE-ALGOQUEST/);
  assert.match(uninstall, /bridge unregister algoquest/);
  assert.match(uninstall, /algoquest-postgres-data/);
  assert.match(uninstall, /algoquest-judge-work/);
  assert.match(uninstall, /algoquest-judge-cache/);
  assert.match(uninstall, /algoquest-judge-queue/);
  assert.doesNotMatch(uninstall, /systemctl .*bridge-edge/);
  assert.doesNotMatch(uninstall, /systemctl .*bridge-cloudflared/);
  assert.doesNotMatch(uninstall, /tunnel delete -f bridge/);
});

test("Nginx quotes regex locations that contain repetition braces", async () => {
  const nginx = await read("deploy/nginx/default.conf.template");
  assert.match(nginx, /location ~ "\^\/api\/v1\/oj\/\(problems\$\|drafts\/\[0-9a-f-\]\{36\}\$\)" \{/);
  assert.doesNotMatch(nginx, /location ~ \^\/api\/v1\/oj\/\(problems\$\|drafts\/\[0-9a-f-\]\{36\}\$\) \{/);
});
