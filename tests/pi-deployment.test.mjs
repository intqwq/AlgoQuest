import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("Raspberry Pi deployment scripts pass Bash syntax validation", async () => {
  for (const path of [
    "deploy/pi/bootstrap-ubuntu.sh",
    "deploy/pi/deploy.sh",
    "deploy/pi/install-systemd.sh",
    "deploy/pi/status.sh",
  ]) {
    await execFileAsync("bash", ["-n", new URL(path, root).pathname]);
  }
});

test("bootstrap echoes credential input and handles official Docker conflicts", async () => {
  const source = await read("deploy/pi/bootstrap-ubuntu.sh");
  assert.match(source, /read -r -p "\$\{label\}: " value/);
  assert.doesNotMatch(source, /read -r -s/);
  assert.match(source, /docker-compose-v2/);
  assert.match(source, /apt-get remove -y/);
  assert.match(source, /UBUNTU_CODENAME/);
});

test("Pi deployment validates effective configuration and waits for health", async () => {
  const source = await read("deploy/pi/deploy.sh");
  assert.match(source, /require_config RESEND_API_KEY/);
  assert.match(source, /require_config TURNSTILE_SECRET_KEY/);
  assert.doesNotMatch(source, /\^\w+=\(\|CHANGE_ME_\)/);
  assert.match(source, /--wait --wait-timeout/);
  assert.match(source, /config --quiet/);
});

test("Pi example environment keeps every host port on loopback", async () => {
  const source = await read(".env.pi.example");
  for (const key of [
    "WEB_BIND_ADDRESS",
    "API_BIND_ADDRESS",
    "JUDGE_BIND_ADDRESS",
    "DB_BIND_ADDRESS",
  ]) {
    assert.match(source, new RegExp(`^${key}=127\\.0\\.0\\.1$`, "m"));
  }
  assert.match(source, /^WEB_PORT=8080$/m);
});

test("Compose rejects a degraded API health response", async () => {
  const source = await read("compose.yml");
  assert.match(source, /if\(!r\.ok\)process\.exit\(1\)/);
  assert.doesNotMatch(source, /\[200,503\]/);
});

test("status checks use configured ports and deployment profiles", async () => {
  const source = await read("deploy/pi/status.sh");
  assert.match(source, /all\|web\|api\|judge\|database/);
  assert.match(source, /expected_services=\(gateway web api judge judge-worker redis db\)/);
  assert.match(source, /docker inspect --format/);
  assert.match(source, /get_env WEB_PORT/);
  assert.match(source, /get_env API_PORT/);
  assert.match(source, /get_env JUDGE_PORT/);
  assert.doesNotMatch(source, /http:\/\/127\.0\.0\.1\/healthz/);
});

test("systemd installation validates Compose and waits for container health", async () => {
  const source = await read("deploy/pi/install-systemd.sh");
  assert.match(source, /config --quiet/);
  assert.match(source, /--wait --wait-timeout/);
  assert.match(source, /systemd-analyze verify/);
  assert.match(source, /cmp -s/);
});
