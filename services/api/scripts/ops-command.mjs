import { createDatabase, migrateWithRetry } from "../src/database.mjs";
import { normalizeEmail } from "../src/auth.mjs";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://algoquest:algoquest@127.0.0.1:5432/algoquest";
const database = createDatabase(databaseUrl);
const [command, ...args] = process.argv.slice(2);

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

try {
  await migrateWithRetry(database, 3);
  if (command === "users") {
    const query = args.join(" ");
    const users = await database.listUsers({ query, limit: 100 });
    print(users.map(({ id, displayName, email, role, emailVerified }) => ({
      id,
      displayName,
      email,
      role,
      emailVerified,
    })));
  } else if (command === "role") {
    const [rawEmail, role] = args;
    if (!rawEmail || !["player", "admin"].includes(role)) {
      throw new Error("usage: role <email> <player|admin>");
    }
    const email = normalizeEmail(rawEmail);
    const users = await database.listUsers({ query: email, limit: 100 });
    const target = users.find((user) => normalizeEmail(user.email) === email);
    if (!target) throw new Error("player not found");
    if (target.role === "owner") throw new Error("site owner role is protected");
    print(await database.updateManagedUser(target.id, {
      displayName: target.displayName,
      emailVerified: target.emailVerified,
      role,
    }));
  } else if (command === "settings") {
    print(await database.getServerSettings());
  } else if (command === "setting") {
    const [name, ...valueParts] = args;
    const value = valueParts.join(" ");
    const settings = await database.getServerSettings();
    if (name === "judge") {
      settings.judgeEnabled = value === "on";
    } else if (name === "registration") {
      settings.registrationEnabled = value === "on";
    } else if (name === "maintenance") {
      settings.maintenanceMessage = value === "clear" ? "" : value.slice(0, 240);
    } else if (name === "cooldown") {
      settings.submissionCooldownSeconds = Math.min(
        300,
        Math.max(5, Math.round(Number(value) || 5)),
      );
    } else {
      throw new Error(
        "usage: setting <judge|registration|maintenance|cooldown> <value>",
      );
    }
    print(await database.updateServerSettings(settings, null));
  } else if (command === "quests") {
    const records = await database.listQuestRecords({ includeArchived: true });
    print(records.map((record) => ({
      id: record.id,
      title: record.publicDefinition.title,
      xp: record.publicDefinition.xp,
      archived: record.archived,
    })));
  } else if (command === "quest-archive") {
    if (!args[0]) throw new Error("usage: quest-archive <quest-id>");
    const archived = await database.archiveQuestRecord(args[0], null);
    print({ archived, questId: args[0] });
  } else {
    throw new Error("unknown operations command");
  }
} finally {
  await database.close();
}
