import { randomBytes, scrypt, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import {
  countUsers,
  createSession,
  createUser,
  deleteSession,
  findSession,
  findUserByEmail,
  findUserById,
} from './db.js';

const scryptAsync = promisify(scrypt);

export const TEAM_LIMIT = 10;
export const SESSION_COOKIE = 'sid';
export const SESSION_DAYS = 14;
export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const NAME_MAX = 40;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SALT_BYTES = 16;
const KEY_BYTES = 64;
const TOKEN_BYTES = 32;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_DAYS * MS_PER_DAY,
};

export async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(password, salt, KEY_BYTES);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [saltHex, keyHex] = String(stored).split(':');
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

// Verified against when the e-mail is unknown, so both failures take about the same time.
let dummyHash;
async function getDummyHash() {
  dummyHash ??= await hashPassword(randomBytes(SALT_BYTES).toString('hex'));
  return dummyHash;
}

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isValidEmail(email) {
  if (email.length === 0 || email.length > EMAIL_MAX) return false;
  const parts = email.split('@');
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
}

// Returns { values, errors }. errors is a list of plain sentences, empty when valid.
export function validateRegistration(body) {
  const email = normalizeEmail(body.email);
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const errors = [];
  if (!isValidEmail(email)) errors.push('Enter a valid e-mail address.');
  if (displayName.length < 1 || displayName.length > NAME_MAX) {
    errors.push(`Name must be 1 to ${NAME_MAX} characters.`);
  }
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    errors.push(`Password must be ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`);
  }
  return { values: { email, displayName, password }, errors };
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function newToken() {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

// The count check, the insert and the first session are one immediate transaction:
// either all of them happen or none, and two registrations cannot both take the last place.
export function registerMember(db, { email, displayName, passwordHash, tokenHash }) {
  const run = db.transaction(() => {
    if (countUsers(db) >= TEAM_LIMIT) return { error: 'full' };
    if (findUserByEmail(db, email)) return { error: 'duplicate' };
    const userId = createUser(db, { email, displayName, passwordHash });
    createSession(db, { tokenHash, userId });
    return { userId };
  });
  return run.immediate();
}

export async function checkLogin(db, email, password) {
  const user = findUserByEmail(db, email);
  const valid = await verifyPassword(password, user ? user.password_hash : await getDummyHash());
  return user && valid ? user : null;
}

export function startSession(db, userId) {
  const { token, tokenHash } = newToken();
  createSession(db, { tokenHash, userId });
  return token;
}

export function endSession(db, token) {
  deleteSession(db, hashToken(token));
}

function userForToken(db, token) {
  const tokenHash = hashToken(token);
  const session = findSession(db, tokenHash);
  if (!session) return null;
  const age = Date.now() - new Date(session.created_at).getTime();
  if (!(age < SESSION_DAYS * MS_PER_DAY)) {
    deleteSession(db, tokenHash);
    return null;
  }
  return findUserById(db, session.user_id) ?? null;
}

export function sessionMiddleware(db) {
  return (req, res, next) => {
    const token = req.cookies?.[SESSION_COOKIE];
    req.user = typeof token === 'string' && token ? userForToken(db, token) : null;
    next();
  };
}

export function requireLogin(req, res, next) {
  if (req.user) return next();
  if (SAFE_METHODS.has(req.method)) return res.redirect(302, '/login');
  return res.status(401).type('text/plain').send('Please log in.');
}

function isSameHost(origin, host) {
  try {
    return Boolean(host) && new URL(origin).host === host;
  } catch {
    return false;
  }
}

// A request with no Origin header is allowed; one that names another site is refused.
export function originCheck(req, res, next) {
  const origin = req.get('origin');
  if (SAFE_METHODS.has(req.method) || origin === undefined || isSameHost(origin, req.get('host'))) {
    return next();
  }
  return res.status(403).type('text/plain').send('Cross-site request refused.');
}
