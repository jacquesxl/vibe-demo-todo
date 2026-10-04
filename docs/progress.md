# Progress

Append one entry per completed step. Newest at the bottom. Written by the agent, reviewed by you.

## 2026-10-04, Step 3: Registration, login, logout and the 10-member cap
- What was done: Register, login and logout pages and routes; session middleware (random token in an httpOnly SameSite=Lax cookie, only its SHA-256 stored, 14-day expiry from creation); Origin check on every non-GET request; scrypt password hashing with a per-user salt and constant-time compare; the 10-member cap, enforced by one immediate transaction that counts, inserts the user and creates the first session. A minimal `/` page (login required, shows a log-out button) exists so redirects have a target; step 4 replaces it.
- Files touched: src/auth.js, src/server.js, tests/auth.test.js, tests/acceptance/criteria.test.js (C1 un-skipped), package.json and package-lock.json (express 5.2.1, cookie-parser 1.4.7, supertest 7.3.1, exact pins)
- Tests added: tests/auth.test.js (register, login, wrong password, logout, cap, concurrent last place, duplicate e-mail, validation, Origin check); C1.
- Open questions: wording and status of validation errors on the register form are UNDECIDED (placeholder sentences, HTTP 400); sessions expire 14 days after login, not sliding, because sliding needs a new column in sessions.

## 2026-10-04, Step 4: Shared task list and add task
- What was done: `GET /` shows the open tasks (title, owner name, due date or 'no due date', 'overdue', 'added by <creator>') and the add form (title, owner picker with the logged-in member preselected, due date). `POST /tasks` validates on the server, takes the creator from the session, and adds the task in one transaction together with the claim of the form token.
- Files touched: src/tasks.js, src/views.js, tests/tasks-create.test.js; also src/server.js (routes wired, `esc`/`page`/`messages` moved to views.js) and src/schema.sql (new `form_tokens` table); step 3 tests stay green.
- Tests added: tests/tasks-create.test.js (shared list, creator from session, preselect, validation refusals, escaping, duplicate submit, token expiry, no session).
- Open questions: empty-state wording is still UNDECIDED (placeholder 'No tasks yet. Add the first one above.'); the answer to a POST with a missing or malformed form token (plain 400 'Bad request.') was not decided; open tasks are listed in creation order until step 7 sets the order.

## 2026-10-04, Step 5: Mark done and reopen
- What was done: `POST /tasks/:id/done` and `POST /tasks/:id/reopen` set the state (not a toggle) inside one immediate transaction and send the member back to `/` with 303. Marking done records `completed_at` and `completed_by`; a second mark-done keeps the first values. Reopen clears both. Unknown or malformed id: 404 'Task not found.' with a link to the list. Open rows have a 'Mark done' button.
- Files touched: src/tasks.js, src/views.js, tests/tasks-done.test.js, tests/acceptance/criteria.test.js (C2 un-skipped); also src/schema.sql (new `tasks.completed_by` column) and src/db.js (`applySchema` adds the column to an existing database file); step 2 to 4 tests stay green.
- Tests added: tests/tasks-done.test.js (done, double submit, reopen, 404, no session, foreign Origin); C2.
- Open questions: the 'Reopen' button has no place on the page until step 7 adds the Done section; the route and tests exist now.
