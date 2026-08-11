import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("root Pi installer echoes account credentials and installs compatible Docker packages", async () => {
  const [install, compatibilityBootstrap] = await Promise.all([
    read("install.sh"),
    read("deploy/pi/bootstrap-ubuntu.sh"),
  ]);
  assert.match(install, /read -r -p "\$\{label\}: " value/);
  assert.doesNotMatch(install, /read -r -s -p/);
  assert.match(install, /docker-compose-v2 docker-doc podman-docker containerd runc/);
  assert.match(install, /compose up --help/);
  assert.match(compatibilityBootstrap, /exec bash "\$\{project_root\}\/install\.sh" "\$@"/);
  assert.doesNotMatch(compatibilityBootstrap, /apt-get|docker compose up|cloudflared/);
});

test("Pi deploy validates actual credential values and waits for readiness", async () => {
  const deploy = await read("deploy/pi/deploy.sh");
  assert.match(
    deploy,
    /for key in RESEND_API_KEY TURNSTILE_SITE_KEY TURNSTILE_SECRET_KEY/,
  );
  assert.match(deploy, /"\$\{value\}" == CHANGE_ME_\*/);
  assert.doesNotMatch(deploy, /\^RESEND_API_KEY=\(\|CHANGE_ME_\)/);
  assert.match(deploy, /--wait-timeout "\$\{wait_timeout\}"/);
});

test("Pi service and status checks honor readiness and configured ports", async () => {
  const [systemd, status, compose] = await Promise.all([
    read("deploy/pi/install-systemd.sh"),
    read("deploy/pi/status.sh"),
    read("compose.yml"),
  ]);
  assert.match(systemd, /--wait --wait-timeout \$\{wait_timeout\}/);
  assert.match(systemd, /WorkingDirectory=\$\{project_root\}/);
  assert.doesNotMatch(systemd, /WorkingDirectory="\$\{project_root\}"/);
  assert.match(systemd, /systemd-analyze verify "\$\{unit_path\}"/);
  assert.match(systemd, /ALGOQUEST_SYSTEMD_DRY_RUN/);
  assert.match(status, /get_env_value WEB_PORT 18081/);
  assert.match(status, /get_env_value API_PORT 8787/);
  assert.match(status, /get_env_value JUDGE_PORT 8788/);
  assert.doesNotMatch(compose, /\[200,503\]\.includes/);
  assert.match(compose, /fetch\('http:\/\/127\.0\.0\.1:8787\/health'\).*if\(!r\.ok\)/);
});

test("root Pi installer leaves shared routing to Bridge", async () => {
  const [install, env] = await Promise.all([
    read("install.sh"),
    read(".env.pi.example"),
  ]);
  assert.match(install, /ALGOQUEST_WEB_PORT:-18081/);
  assert.match(install, /github\.com\/intqwq\/Bridge/);
  assert.doesNotMatch(install, /tunnel create|algoquest-cloudflared\.service/);
  assert.match(env, /^WEB_BIND_ADDRESS=127\.0\.0\.1$/m);
  assert.match(env, /^WEB_PORT=18081$/m);
});

test("uninstaller erases AlgoQuest state but preserves Bridge", async () => {
  const uninstall = await read("uninstall.sh");
  assert.match(uninstall, /ERASE-ALGOQUEST/);
  assert.match(uninstall, /--plan/);
  assert.match(uninstall, /algoquest-postgres-data/);
  assert.match(uninstall, /algoquest-judge-work/);
  assert.match(uninstall, /algoquest-judge-cache/);
  assert.match(uninstall, /algoquest-judge-queue/);
  assert.match(uninstall, /algoquest-cloudflared\.service/);
  assert.match(uninstall, /\/var\/lib\/algoquest/);
  assert.match(uninstall, /algoquest-runner:/);
  assert.doesNotMatch(uninstall, /docker system prune/);
  assert.doesNotMatch(uninstall, /systemctl .*bridge-edge/);
  assert.doesNotMatch(uninstall, /systemctl .*bridge-cloudflared/);
  assert.doesNotMatch(uninstall, /tunnel delete -f bridge/);
});

test("Nginx quotes regex locations that contain repetition braces", async () => {
  const nginx = await read("deploy/nginx/default.conf.template");
  assert.match(
    nginx,
    /location ~ "\^\/api\/v1\/oj\/\(problems\$\|drafts\/\[0-9a-f-\]\{36\}\$\)" \{/,
  );
  assert.doesNotMatch(
    nginx,
    /location ~ \^\/api\/v1\/oj\/\(problems\$\|drafts\/\[0-9a-f-\]\{36\}\$\) \{/,
  );
});
