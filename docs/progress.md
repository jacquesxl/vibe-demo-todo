# Progress

Append one entry per completed step. Newest at the bottom. Written by the agent, reviewed by you.

## 2026-10-04, Step 3: Registration, login, logout and the 10-member cap
- What was done: Register, login and logout pages and routes; session middleware (random token in an httpOnly SameSite=Lax cookie, only its SHA-256 stored, 14-day expiry from creation); Origin check on every non-GET request; scrypt password hashing with a per-user salt and constant-time compare; the 10-member cap, enforced by one immediate transaction that counts, inserts the user and creates the first session. A minimal `/` page (login required, shows a log-out button) exists so redirects have a target; step 4 replaces it.
- Files touched: src/auth.js, src/server.js, tests/auth.test.js, tests/acceptance/criteria.test.js (C1 un-skipped), package.json and package-lock.json (express 5.2.1, cookie-parser 1.4.7, supertest 7.3.1, exact pins)
- Tests added: tests/auth.test.js (register, login, wrong password, logout, cap, concurrent last place, duplicate e-mail, validation, Origin check); C1.
- Open questions: wording and status of validation errors on the register form are UNDECIDED (placeholder sentences, HTTP 400); sessions expire 14 days after login, not sliding, because sliding needs a new column in sessions.
