# Team to-do list

A shared to-do list for one workshop crew (up to 10 people). Every task has a title, an owner and a due date, and can be marked done, handed to another member, reopened, or deleted by the person who added it. It replaces the whiteboard.

It runs fully offline on one machine on the local network. No cloud services, no external calls.

## Run it

Needs Node.js and a checkout of this folder on the machine that will host it.

```
npm install
npm start
```

Then open `http://<machine-address>:3000` in a browser on the same network. The first 10 people who register are the team; the 11th is refused.

Two environment variables change how it starts. Neither is a secret.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | Port the server listens on (all interfaces) |
| `DATABASE_PATH` | `data/tasks.db` | Where the SQLite database file lives; its folder is created if missing |

Example: `PORT=8080 DATABASE_PATH=/srv/todo/tasks.db npm start`

Keeping the server running, for example starting it again after the machine reboots, is up to the owner: use a process manager or a systemd unit.

The connection is plain HTTP, so passwords travel unencrypted on the local network. If the network is not trusted, put a reverse proxy with TLS in front.

## Back up the database

All data is in one file, `data/tasks.db` (or the path in `DATABASE_PATH`). **That file contains every member's e-mail address and password hash.** Keep backups somewhere only the owner can read, do not e-mail them or put them in a shared folder, and delete old copies you no longer need.

To back up, copy the file while nobody is saving a change (or stop the server first, which is always safe):

```
mkdir -p backups
cp data/tasks.db backups/tasks-2026-10-04.db
```

Use the day's date in the file name. Files ending in `.db` are ignored by git, so backups named this way are never committed.

## Restore from a backup

1. Stop the server. It must be stopped first, or the copy can corrupt the database.
2. Copy the backup file over `data/tasks.db` (or your `DATABASE_PATH`):
   `cp backups/tasks-2026-10-04.db data/tasks.db`
3. Start the server again with `npm start`.

Anything added after the backup was made is lost.

## Development

- `npm test` runs the test suite.
- `npm run lint` runs the linter.
