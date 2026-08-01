import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import process from "node:process";

const args = process.argv.slice(2);
const envIndex = args.indexOf("--env-file");
const envFile = envIndex >= 0 ? args[envIndex + 1] : ".env.windows";
const composeBase = ["compose", "--env-file", envFile];
const allowedServices = new Set([
  "gateway",
  "web",
  "api",
  "judge",
  "judge-worker",
  "redis",
  "db",
]);

function run(command, commandArgs, { inherit = true } = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: inherit ? "inherit" : "pipe",
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
  return result.stdout?.trim() ?? "";
}

function docker(...commandArgs) {
  return run("docker", [...composeBase, ...commandArgs]);
}

function apiOps(...commandArgs) {
  return docker(
    "exec",
    "-T",
    "api",
    "node",
    "scripts/ops-command.mjs",
    ...commandArgs,
  );
}

function help() {
  console.log(`
AlgoQuest operations commands
  help
  status
  logs [gateway|web|api|judge|judge-worker|redis|db]
  users [name-or-email]
  role <email> <player|admin>
  quests
  quest archive <quest-id>
  settings
  judge <on|off>
  registration <on|off>
  maintenance <message|clear>
  cooldown <seconds>
  restart [service]
  update
  quit
`);
}

async function execute(line) {
  const parts = line.trim().match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) =>
    part.startsWith('"') && part.endsWith('"') ? part.slice(1, -1) : part
  ) ?? [];
  const [command, ...rest] = parts;
  if (!command) return true;
  if (command === "help") help();
  else if (command === "status") docker("ps");
  else if (command === "logs") {
    const service = rest[0];
    if (service && !allowedServices.has(service)) {
      throw new Error("unknown service");
    }
    docker("logs", "--tail", "120", ...(service ? [service] : []));
  } else if (command === "users") apiOps("users", ...rest);
  else if (command === "role") apiOps("role", ...rest);
  else if (command === "quests") apiOps("quests");
  else if (command === "quest" && rest[0] === "archive") {
    apiOps("quest-archive", rest[1] ?? "");
  } else if (command === "settings") apiOps("settings");
  else if (command === "judge") apiOps("setting", "judge", rest[0] ?? "");
  else if (command === "registration") {
    apiOps("setting", "registration", rest[0] ?? "");
  } else if (command === "maintenance") {
    apiOps("setting", "maintenance", rest.join(" "));
  } else if (command === "cooldown") {
    apiOps("setting", "cooldown", rest[0] ?? "");
  } else if (command === "restart") {
    const service = rest[0];
    if (service && !allowedServices.has(service)) {
      throw new Error("unknown service");
    }
    docker("restart", ...(service ? [service] : []));
  } else if (command === "update") {
    const dirty = run("git", ["status", "--porcelain"], { inherit: false });
    if (dirty) {
      throw new Error("working tree has local changes; commit or stash them first");
    }
    run("git", ["pull", "--ff-only", "origin", "main"]);
    run("docker", [
      "build",
      "-f",
      "judge/Dockerfile.runner",
      "-t",
      "algoquest-runner:cpp14",
      "judge",
    ]);
    docker("--profile", "all", "up", "-d", "--build", "--remove-orphans");
    docker("exec", "-T", "judge", "node", "scripts/smoke.mjs");
    docker("exec", "-T", "api", "node", "scripts/smoke.mjs");
    console.log("UPDATE COMPLETE // GitHub synchronized and smoke tests passed.");
  } else if (command === "quit" || command === "exit") return false;
  else throw new Error("unknown command; type help");
  return true;
}

console.log("ALGOQUEST_OPS ONLINE // type help");
const terminal = createInterface({ input: process.stdin, output: process.stdout });
try {
  let running = true;
  while (running) {
    const line = await terminal.question("algoquest> ");
    try {
      running = await execute(line);
    } catch (error) {
      console.error(`ERROR // ${error instanceof Error ? error.message : error}`);
    }
  }
} finally {
  terminal.close();
}
