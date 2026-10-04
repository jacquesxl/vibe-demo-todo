import express from 'express';
import cookieParser from 'cookie-parser';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { countUsers, openDb } from './db.js';
import {
  COOKIE_OPTIONS,
  EMAIL_MAX,
  NAME_MAX,
  PASSWORD_MAX,
  SESSION_COOKIE,
  TEAM_LIMIT,
  checkLogin,
  endSession,
  hashPassword,
  newToken,
  normalizeEmail,
  originCheck,
  registerMember,
  requireLogin,
  sessionMiddleware,
  startSession,
  validateRegistration,
} from './auth.js';

const DEFAULT_PORT = 3000;
const DEFAULT_DB_PATH = 'data/tasks.db';
const BODY_LIMIT = '10kb';
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_CONFLICT = 409;
const HTTP_SEE_OTHER = 303;

const MSG_DUPLICATE = 'An account with this e-mail already exists.';
const MSG_BAD_LOGIN = 'Wrong e-mail or password.';
const MSG_FULL = `This team is full (${TEAM_LIMIT} members).`;
const MSG_LOGGED_OUT = 'You are logged out.';
const MSG_FAILURE = 'Something went wrong. Nothing was saved.';
const MSG_BAD_REQUEST = 'Bad request.';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title></head>
<body>
<main>
<h1>${esc(title)}</h1>
${body}
</main>
</body>
</html>`;
}

function messages(list, role = 'alert') {
  return list.map((text) => `<p role="${role}">${esc(text)}</p>`).join('\n');
}

function loginPage({ notes = [], errors = [], email = '' } = {}) {
  return page(
    'Log in',
    `${messages(notes, 'status')}${messages(errors)}
<form method="post" action="/login">
<p><label>E-mail <input type="email" name="email" value="${esc(email)}" maxlength="${EMAIL_MAX}" required autocomplete="username"></label></p>
<p><label>Password <input type="password" name="password" maxlength="${PASSWORD_MAX}" required autocomplete="current-password"></label></p>
<p><button type="submit">Log in</button></p>
</form>
<p><a href="/register">Register</a></p>`,
  );
}

function registerPage({ errors = [], email = '', displayName = '' } = {}) {
  return page(
    'Register',
    `${messages(errors)}
<form method="post" action="/register">
<p><label>Name <input type="text" name="displayName" value="${esc(displayName)}" maxlength="${NAME_MAX}" required></label></p>
<p><label>E-mail <input type="email" name="email" value="${esc(email)}" maxlength="${EMAIL_MAX}" required autocomplete="username"></label></p>
<p><label>Password <input type="password" name="password" maxlength="${PASSWORD_MAX}" required autocomplete="new-password"></label></p>
<p><button type="submit">Register</button></p>
</form>
<p><a href="/login">Log in</a></p>`,
  );
}

function fullPage() {
  return page('Register', `${messages([MSG_FULL])}<p><a href="/login">Log in</a></p>`);
}

function homePage(user) {
  return page(
    'Tasks',
    `<p>Logged in as ${esc(user.display_name)}.</p>
<form method="post" action="/logout"><button type="submit">Log out</button></form>`,
  );
}

function loginSuccess(db, res, userId) {
  res.cookie(SESSION_COOKIE, startSession(db, userId), COOKIE_OPTIONS);
  res.redirect(HTTP_SEE_OTHER, '/');
}

function authRoutes(app, db) {
  app.get('/login', (req, res) => {
    if (req.user) return res.redirect('/');
    const notes = req.query.loggedout === '1' ? [MSG_LOGGED_OUT] : [];
    return res.send(loginPage({ notes }));
  });

  app.post('/login', async (req, res) => {
    const body = req.body ?? {};
    const email = normalizeEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';
    const plausible = email.length > 0 && email.length <= EMAIL_MAX && password.length <= PASSWORD_MAX;
    const user = plausible ? await checkLogin(db, email, password) : null;
    if (!user) {
      return res.status(HTTP_UNAUTHORIZED).send(loginPage({ errors: [MSG_BAD_LOGIN], email }));
    }
    return loginSuccess(db, res, user.id);
  });

  app.get('/register', (req, res) => {
    if (req.user) return res.redirect('/');
    return res.send(countUsers(db) >= TEAM_LIMIT ? fullPage() : registerPage());
  });

  app.post('/register', async (req, res) => {
    if (req.user) return res.redirect(HTTP_SEE_OTHER, '/');
    const { values, errors } = validateRegistration(req.body ?? {});
    if (errors.length > 0) {
      return res.status(HTTP_BAD_REQUEST).send(registerPage({ ...values, errors }));
    }
    const { token, tokenHash } = newToken();
    const passwordHash = await hashPassword(values.password);
    const result = registerMember(db, { ...values, passwordHash, tokenHash });
    if (result.error === 'full') return res.status(HTTP_CONFLICT).send(fullPage());
    if (result.error === 'duplicate') {
      return res.status(HTTP_CONFLICT).send(registerPage({ ...values, errors: [MSG_DUPLICATE] }));
    }
    res.cookie(SESSION_COOKIE, token, COOKIE_OPTIONS);
    return res.redirect(HTTP_SEE_OTHER, '/');
  });

  app.post('/logout', (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string' && token) endSession(db, token);
    res.clearCookie(SESSION_COOKIE, COOKIE_OPTIONS);
    res.redirect(HTTP_SEE_OTHER, '/login?loggedout=1');
  });

  app.get('/', requireLogin, (req, res) => res.send(homePage(req.user)));
}

// Logs the detail on the server only; the client gets a fixed sentence.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).type('text/plain').send(status === 500 ? MSG_FAILURE : MSG_BAD_REQUEST);
}

export function createApp({ db }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(originCheck);
  app.use(express.urlencoded({ extended: false, limit: BODY_LIMIT }));
  app.use(cookieParser());
  app.use(sessionMiddleware(db));
  authRoutes(app, db);
  app.use(errorHandler);
  return app;
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  const dbPath = process.env.DATABASE_PATH || DEFAULT_DB_PATH;
  mkdirSync(dirname(dbPath), { recursive: true });
  const app = createApp({ db: openDb(dbPath) });
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  app.listen(port, () => console.log(`Listening on port ${port}`));
}
