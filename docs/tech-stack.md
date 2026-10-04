# Tech stack

Chosen by the guide from the problem page. Why: The user asked for fully offline, SQLite and plain Node or Next.js. Express with server-rendered forms is the smallest option that meets this. There is no client build step and no real-time layer, and a page refresh is enough, as the founder said. Everything is one process and one file database, so it is easy to run and back up. Access control lives in server-side checks because SQLite has no row-level security. Every task query and mutation goes through one data module that checks the session user.

| Layer | Choice | Why | Rejected |
|---|---|---|---|
| language | JavaScript (Node.js, ES modules) |  |  |
| framework | Express with server-rendered HTML pages and plain HTML forms |  |  |
| database | SQLite file via better-sqlite3 |  |  |
| auth | Local e-mail and password. Passwords are hashed with Node's built-in crypto.scrypt. Sessions are random tokens in an httpOnly cookie, and only their SHA-256 hash is stored in SQLite. Managed auth is not used because the product must work fully offline. |  |  |
| hosting | One machine on the local network running `node`, with the SQLite file on local disk. No cloud services, CDNs or external calls. |  |  |
