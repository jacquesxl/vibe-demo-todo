import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { openDb, countUsers, findSession, findUserByEmail } from '../src/db.js';
import { createApp } from '../src/server.js';
import { TEAM_LIMIT, hashToken } from '../src/auth.js';

const MEMORY = ':memory:';
const PASSWORD = 'correct horse';
const FOREIGN_ORIGIN = 'http://evil.example';

let db;
let server;
let origin;

beforeEach(async () => {
  db = openDb(MEMORY);
  server = createApp({ db }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => {
  server.close();
});

function member(n) {
  return { email: `m${n}@example.com`, displayName: `Member ${n}`, password: PASSWORD };
}

function register(fields, headers = {}) {
  return request(server).post('/register').set(headers).type('form').send(fields);
}

function login(fields, headers = {}) {
  return request(server).post('/login').set(headers).type('form').send(fields);
}

function sessionCookie(res) {
  return res.headers['set-cookie'].find((c) => c.startsWith('sid=')).split(';')[0];
}

function fillTeam(count) {
  return Promise.all(Array.from({ length: count }, (_, i) => register(member(i + 1))));
}

describe('register and login', () => {
  test('registering logs the new member in and lands on the task list', async () => {
    const res = await register(member(1));
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/');
    const home = await request(server).get('/').set('Cookie', sessionCookie(res));
    expect(home.status).toBe(200);
    expect(home.text).toContain('Member 1');
  });

  test('a registered member can log in again', async () => {
    await register(member(1));
    const res = await login({ email: 'M1@Example.com ', password: PASSWORD });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/');
    const home = await request(server).get('/').set('Cookie', sessionCookie(res));
    expect(home.status).toBe(200);
  });

  test('the password is stored as a salted scrypt hash, not as text', async () => {
    await register(member(1));
    await register(member(2));
    const one = findUserByEmail(db, 'm1@example.com').password_hash;
    const two = findUserByEmail(db, 'm2@example.com').password_hash;
    expect(one).not.toContain(PASSWORD);
    expect(one).not.toBe(two);
  });

  test('a wrong password fails with 401 and keeps the typed e-mail', async () => {
    await register(member(1));
    const res = await login({ email: 'm1@example.com', password: 'wrong password' });
    expect(res.status).toBe(401);
    expect(res.text).toContain('Wrong e-mail or password.');
    expect(res.text).toContain('value="m1@example.com"');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  test('an unknown e-mail gets the same status and message as a wrong password', async () => {
    await register(member(1));
    const wrong = await login({ email: 'm1@example.com', password: 'wrong password' });
    const unknown = await login({ email: 'nobody@example.com', password: PASSWORD });
    expect(unknown.status).toBe(wrong.status);
    expect(unknown.text).toContain('Wrong e-mail or password.');
  });

  test('a typed e-mail is escaped when the form is shown again', async () => {
    const res = await login({ email: '"><script>x</script>@a', password: 'x' });
    expect(res.text).not.toContain('<script>x</script>');
    expect(res.text).toContain('&lt;script&gt;');
  });

  test('a duplicate e-mail is refused with 409, whatever its case', async () => {
    await register(member(1));
    const res = await register({ ...member(2), email: ' M1@EXAMPLE.com' });
    expect(res.status).toBe(409);
    expect(res.text).toContain('An account with this e-mail already exists.');
    expect(countUsers(db)).toBe(1);
  });

  test('invalid input is refused with 400 and creates no user', async () => {
    const bad = [
      { ...member(1), email: 'no-at-sign' },
      { ...member(1), email: '@example.com' },
      { ...member(1), email: `${'a'.repeat(250)}@example.com` },
      { ...member(1), password: 'short' },
      { ...member(1), password: 'x'.repeat(129) },
      { ...member(1), displayName: '   ' },
      { ...member(1), displayName: 'n'.repeat(41) },
    ];
    for (const fields of bad) {
      expect((await register(fields)).status).toBe(400);
    }
    expect((await request(server).post('/register')).status).toBe(400);
    expect(countUsers(db)).toBe(0);
  });

  test('a logged-in person is sent to the task list from /login and /register', async () => {
    const cookie = sessionCookie(await register(member(1)));
    for (const path of ['/login', '/register']) {
      const res = await request(server).get(path).set('Cookie', cookie);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/');
    }
  });

  test('the session cookie is httpOnly and SameSite=Lax', async () => {
    const res = await register(member(1));
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('sid='));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });
});

describe('sessions', () => {
  test('only the SHA-256 of the session token is stored', async () => {
    const res = await register(member(1));
    const token = sessionCookie(res).slice('sid='.length);
    expect(findSession(db, hashToken(token))).toBeDefined();
    expect(findSession(db, token)).toBeUndefined();
  });

  test('no session means a redirect to the login page', async () => {
    const res = await request(server).get('/');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  test('a made-up cookie is not a session', async () => {
    const res = await request(server).get('/').set('Cookie', 'sid=not-a-real-token');
    expect(res.status).toBe(302);
  });

  test('logout ends the session, clears the cookie and says so on the login page', async () => {
    const cookie = sessionCookie(await register(member(1)));
    const out = await request(server).post('/logout').set('Cookie', cookie);
    expect(out.status).toBe(303);
    expect(out.headers.location).toBe('/login?loggedout=1');
    const reuse = await request(server).get('/').set('Cookie', cookie);
    expect(reuse.status).toBe(302);
    const page = await request(server).get('/login?loggedout=1');
    expect(page.text).toContain('You are logged out.');
  });

  test('logout without a session is harmless', async () => {
    const res = await request(server).post('/logout');
    expect(res.status).toBe(303);
  });
});

describe('the 10-member cap', () => {
  test('the 11th registration is refused and creates no user and no session', async () => {
    await fillTeam(TEAM_LIMIT);
    expect(countUsers(db)).toBe(TEAM_LIMIT);
    const res = await register(member(TEAM_LIMIT + 1));
    expect(res.status).toBe(409);
    expect(res.text).toContain('This team is full (10 members).');
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(countUsers(db)).toBe(TEAM_LIMIT);
    expect(findUserByEmail(db, member(TEAM_LIMIT + 1).email)).toBeUndefined();
    expect(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n).toBe(TEAM_LIMIT);
  });

  test('the register page shows the full message instead of the form', async () => {
    await fillTeam(TEAM_LIMIT);
    const res = await request(server).get('/register');
    expect(res.status).toBe(200);
    expect(res.text).toContain('This team is full (10 members).');
    expect(res.text).not.toContain('<form');
  });

  test('two concurrent registrations for the last place cannot both succeed', async () => {
    await fillTeam(TEAM_LIMIT - 1);
    const results = await Promise.all([
      register(member(TEAM_LIMIT)),
      register(member(TEAM_LIMIT + 1)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([303, 409]);
    expect(countUsers(db)).toBe(TEAM_LIMIT);
  });

  test('an existing member can still log in when the team is full', async () => {
    await fillTeam(TEAM_LIMIT);
    const res = await login({ email: member(1).email, password: PASSWORD });
    expect(res.status).toBe(303);
  });
});

describe('Origin check on POST', () => {
  test('a foreign Origin is refused with 403 and changes nothing', async () => {
    const res = await register(member(1), { Origin: FOREIGN_ORIGIN });
    expect(res.status).toBe(403);
    expect(res.text).toBe('Cross-site request refused.');
    expect(countUsers(db)).toBe(0);
  });

  test('a foreign Origin is refused on login and logout too', async () => {
    const cookie = sessionCookie(await register(member(1)));
    expect((await login({ ...member(1) }, { Origin: FOREIGN_ORIGIN })).status).toBe(403);
    const out = await request(server).post('/logout').set('Cookie', cookie).set('Origin', FOREIGN_ORIGIN);
    expect(out.status).toBe(403);
    expect((await request(server).get('/').set('Cookie', cookie)).status).toBe(200);
  });

  test('an Origin of null is refused', async () => {
    expect((await register(member(1), { Origin: 'null' })).status).toBe(403);
  });

  test('the same Origin is allowed', async () => {
    expect((await register(member(1), { Origin: origin })).status).toBe(303);
  });

  test('a POST with no Origin header is allowed', async () => {
    expect((await register(member(1))).status).toBe(303);
  });
});
