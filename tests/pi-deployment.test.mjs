import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Pi bootstrap echoes account credentials and installs compatible Docker packages", async () => {
  const bootstrap = await read("deploy/pi/bootstrap-ubuntu.sh");
  assert.match(bootstrap, /read -r -p "\$\{label\}: " value/);
  assert.doesNotMatch(bootstrap, /read -r -s -p/);
  assert.match(bootstrap, /docker-compose-v2 docker-doc podman-docker containerd runc/);
  assert.match(bootstrap, /compose up --help/);
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
  assert.match(status, /get_env_value WEB_PORT 8080/);
  assert.match(status, /get_env_value API_PORT 8787/);
  assert.match(status, /get_env_value JUDGE_PORT 8788/);
  assert.doesNotMatch(compose, /\[200,503\]\.includes/);
  assert.match(compose, /fetch\('http:\/\/127\.0\.0\.1:8787\/health'\).*if\(!r\.ok\)/);
});
