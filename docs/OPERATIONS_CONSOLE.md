# AlgoQuest operations console

An interactive console opens after a successful full Windows or Raspberry Pi
deployment when the command is attached to a terminal. It is intentionally a
small command whitelist rather than a general remote shell.

Run it again without rebuilding:

```powershell
node scripts/ops-console.mjs --env-file .env.windows
```

```bash
node scripts/ops-console.mjs --env-file .env.pi
```

Useful commands:

- `status`
- `logs api`
- `users <name-or-email>`
- `role <email> <player|admin>`
- `quests`
- `quest archive <quest-id>`
- `settings`
- `judge on|off`
- `registration on|off`
- `maintenance <message|clear>`
- `cooldown <seconds>`
- `restart [gateway|web|api|judge|db]`
- `update`
- `quit`

`update` refuses to run when the Git working tree has local changes. Otherwise
it performs a fast-forward-only synchronization from `origin/main`, rebuilds
the runner and services, and runs both Judge and Core API smoke tests.

The console cannot create or demote the site owner, execute arbitrary SQL, or
run arbitrary shell commands.
