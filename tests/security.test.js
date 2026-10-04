import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { openDb } from '../src/db.js';
import { createApp } from '../src/server.js';

const PASSWORD = 'correct horse';
const TOKEN = 'token-aaaaaaaaaaaaaaaa';
const MINUTE_MS = 60 * 1000;
const THROTTLE_MSG = 'Too many attempts. Try again in 15 minutes.';

let db;
let app;
let clock;

beforeEach(() => {
  clock = 1_000_000;
  db = openDb(':memory:');
  app = createApp({ db, now: () => clock });
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function join(n = 1) {
  const agent = request.agent(app);
  await agent
    .post('/register')
    .type('form')
    .send({ email: `m${n}@example.com`, displayName: `Member ${n}`, password: PASSWORD });
  return agent;
}

function login(email, password) {
  return request(app).post('/login').type('form').send({ email, password });
}

describe('security headers', () => {
  test.each(['/login', '/register', '/nowhere'])('%s carries the headers', async (path) => {
    const res = await request(app).get(path);
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('a refused cross-site post carries them too', async () => {
    const res = await request(app).post('/login').set('Origin', 'http://evil.example').type('form').send({});
    expect(res.status).toBe(403);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('the policy names no other host', async () => {
    const res = await request(app).get('/login');
    expect(res.headers['content-security-policy']).not.toMatch(/https?:|\*/);
  });
});

describe('output escaping and offline pages', () => {
  test('a title with script tags is rendered escaped', async () => {
    const a = await join();
    const title = '<script>alert(1)</script>';
    await a.post('/tasks').type('form').send({ token: TOKEN, title, owner: '1', dueDate: '2030-01-31' });
    const html = (await a.get('/')).text;
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('pages contain no http(s) URLs and no external resources', async () => {
    const a = await join();
    const pages = [(await request(app).get('/login')).text, (await a.get('/')).text, (await a.get('/nowhere')).text];
    for (const html of pages) {
      expect(html).not.toMatch(/https?:\/\//);
      expect(html).not.toMatch(/<(script|link|img|iframe)\b/);
    }
  });

  test('every form field has a label and every page a heading', async () => {
    const a = await join();
    await a.post('/tasks').type('form').send({ token: TOKEN, title: 'Sweep', owner: '1', dueDate: '2030-01-31' });
    await a.post('/tasks/1/done');
    const pages = [(await request(app).get('/login')).text, (await a.get('/')).text];
    for (const html of pages) {
      expect(html).toMatch(/<h1>/);
      const unlabelled = html.replace(/<label>[\s\S]*?<\/label>/g, '');
      const controls = unlabelled.match(/<(input|select|textarea)\b[^>]*>/g) ?? [];
      for (const control of controls) {
        expect(control.includes('type="hidden"') || control.includes('aria-label=')).toBe(true);
      }
    }
    const registerHtml = (await request(app).get('/register')).text;
    expect(registerHtml.match(/<label>/g)).toHaveLength(3);
  });
});

describe('errors leak nothing', () => {
  test('an unknown address answers 404 with a link to the list', async () => {
    const res = await request(app).get('/nowhere');
    expect(res.status).toBe(404);
    expect(res.text).toContain('Page not found.');
    expect(res.text).toContain('href="/"');
  });

  test('an unexpected failure answers 500 with a fixed sentence and no internals', async () => {
    const a = await join();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    db.close();
    const res = await a.get('/');
    expect(res.status).toBe(500);
    expect(res.text).toContain('Something went wrong. Nothing was saved.');
    expect(res.text).toContain('href="/"');
    expect(res.text).not.toMatch(/\bat\s+\S+\s*\(|node_modules|\.js:\d|better-sqlite3|SqliteError|Error:/);
  });

  test('a malformed body is a plain 400, not a stack trace', async () => {
    const res = await request(app).post('/login').type('form').send('a=%E0%A4%A');
    expect(res.status).toBeLessThan(500);
    expect(res.text).not.toMatch(/node_modules|\.js:\d/);
  });
});

describe('unauthenticated task routes are refused', () => {
  test('GET pages redirect to /login with 302', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  test.each([
    ['/tasks'],
    ['/tasks/1/done'],
    ['/tasks/1/reopen'],
    ['/tasks/1/owner'],
    ['/tasks/1/delete'],
  ])('POST %s answers 401 Please log in.', async (path) => {
    const res = await request(app).post(path).type('form').send({ owner: '1' });
    expect(res.status).toBe(401);
    expect(res.text).toBe('Please log in.');
  });

  test('a refused submit changes nothing', async () => {
    await join();
    await request(app).post('/tasks').type('form').send({ token: TOKEN, title: 'Sneaky', owner: '1' });
    expect(db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n).toBe(0);
  });
});

describe('login throttle', () => {
  test('the 6th attempt for an e-mail is refused with 429, even with the right password', async () => {
    await join();
    for (let i = 0; i < 5; i += 1) {
      expect((await login('m1@example.com', 'wrong password')).status).toBe(401);
    }
    const blocked = await login('m1@example.com', PASSWORD);
    expect(blocked.status).toBe(429);
    expect(blocked.text).toContain(THROTTLE_MSG);
  });

  test('another e-mail is not affected', async () => {
    await join(1);
    await join(2);
    for (let i = 0; i < 5; i += 1) await login('m1@example.com', 'wrong password');
    expect((await login('m2@example.com', PASSWORD)).status).toBe(303);
  });

  test('the block lifts after 15 minutes', async () => {
    await join();
    for (let i = 0; i < 5; i += 1) await login('m1@example.com', 'wrong password');
    clock += 14 * MINUTE_MS;
    expect((await login('m1@example.com', PASSWORD)).status).toBe(429);
    clock += 2 * MINUTE_MS;
    expect((await login('m1@example.com', PASSWORD)).status).toBe(303);
  });

  test('failures older than 15 minutes do not add up, and a success clears the count', async () => {
    await join();
    for (let i = 0; i < 4; i += 1) await login('m1@example.com', 'wrong password');
    clock += 16 * MINUTE_MS;
    for (let i = 0; i < 4; i += 1) await login('m1@example.com', 'wrong password');
    expect((await login('m1@example.com', PASSWORD)).status).toBe(303);
    for (let i = 0; i < 4; i += 1) await login('m1@example.com', 'wrong password');
    expect((await login('m1@example.com', PASSWORD)).status).toBe(303);
  });
});
