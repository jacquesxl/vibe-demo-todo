import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { openDb } from '../src/db.js';
import { createApp } from '../src/server.js';

const PASSWORD = 'correct horse';
const TOKEN_A = 'token-aaaaaaaaaaaaaaaa';
const TOKEN_B = 'token-bbbbbbbbbbbbbbbb';
const TITLE_MAX = 200;

let db;
let app;

beforeEach(() => {
  db = openDb(':memory:');
  app = createApp({ db });
});

async function join(n, name = `Member ${n}`) {
  const agent = request.agent(app);
  const res = await agent
    .post('/register')
    .type('form')
    .send({ email: `m${n}@example.com`, displayName: name, password: PASSWORD });
  expect(res.status).toBe(303);
  return agent;
}

function addTask(agent, fields) {
  return agent.post('/tasks').type('form').send({ token: TOKEN_A, owner: '1', ...fields });
}

function taskRows() {
  return db.prepare('SELECT * FROM tasks ORDER BY id').all();
}

describe('shared list', () => {
  test('member A adds a task and member B sees it', async () => {
    const a = await join(1, 'Ada');
    const b = await join(2, 'Bo');
    const res = await addTask(a, { title: 'Sweep floor', owner: '2', dueDate: '2030-01-31' });
    expect(res.status).toBe(303);
    const list = await b.get('/');
    expect(list.status).toBe(200);
    expect(list.text).toContain('Sweep floor');
    expect(list.text).toContain('Bo');
    expect(list.text).toContain('2030-01-31');
    expect(list.text).toContain('added by Ada');
  });

  test('the creator comes from the session, not the form', async () => {
    const a = await join(1);
    await join(2);
    await addTask(a, { title: 'Mine', owner: '2', createdBy: '2', created_by: '2' });
    expect(taskRows()[0].created_by).toBe(1);
  });

  test('the logged-in member is preselected as owner', async () => {
    await join(1);
    const b = await join(2);
    const list = await b.get('/');
    expect(list.text).toMatch(/<option value="2" selected>/);
  });

  test('a task without a due date shows "no due date"; a past due date shows overdue', async () => {
    const a = await join(1);
    await addTask(a, { title: 'Undated', dueDate: '' });
    await addTask(a, { title: 'Late', dueDate: '2000-01-01', token: TOKEN_B });
    const list = await a.get('/');
    expect(list.text).toContain('no due date');
    expect(list.text).toContain('<strong>overdue</strong>');
    expect(list.text.match(/overdue/g)).toHaveLength(1);
  });

  test('an empty list shows the empty-state line and the form', async () => {
    const a = await join(1);
    const list = await a.get('/');
    expect(list.text).toContain('No tasks yet. Add the first one above.');
    expect(list.text).toContain('<form method="post" action="/tasks">');
  });

  test('output is HTML-escaped', async () => {
    const a = await join(1, '<b>Ada</b>');
    await addTask(a, { title: '<script>alert(1)</script>' });
    const list = await a.get('/');
    expect(list.text).not.toContain('<script>alert(1)</script>');
    expect(list.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(list.text).not.toContain('<b>Ada</b>');
  });

  test('colliding display names get the e-mail local part in the picker', async () => {
    await join(1, 'Sam');
    const b = await join(2, 'Sam');
    const list = await b.get('/');
    expect(list.text).toContain('Sam (m1)');
    expect(list.text).toContain('Sam (m2)');
  });
});

describe('refused tasks', () => {
  test.each([
    ['empty title', { title: '' }, 'Title is required.'],
    ['spaces-only title', { title: '   ' }, 'Title is required.'],
    ['too long title', { title: 'x'.repeat(TITLE_MAX + 1) }, 'Title is required.'],
    ['malformed date', { title: 'T', dueDate: '31/01/2030' }, 'Due date must be a calendar date (YYYY-MM-DD).'],
    ['impossible date', { title: 'T', dueDate: '2030-02-30' }, 'Due date must be a calendar date (YYYY-MM-DD).'],
    ['unknown owner', { title: 'T', owner: '99' }, 'Owner must be a member.'],
    ['non-numeric owner', { title: 'T', owner: '1 OR 1=1' }, 'Owner must be a member.'],
    ['missing owner', { title: 'T', owner: '' }, 'Owner must be a member.'],
  ])('%s gets 400, a message, and nothing is stored', async (_name, fields, message) => {
    const a = await join(1);
    await addTask(a, { title: 'Existing', token: TOKEN_B });
    const res = await addTask(a, fields);
    expect(res.status).toBe(400);
    expect(res.text).toContain(message);
    expect(res.text).toContain('Existing');
    expect(taskRows()).toHaveLength(1);
  });

  test('typed values come back in the form', async () => {
    const a = await join(1);
    const res = await addTask(a, { title: 'Keep "me"', dueDate: 'nonsense' });
    expect(res.text).toContain('value="Keep &quot;me&quot;"');
    expect(res.text).toContain('value="nonsense"');
  });

  test('a refused submit does not use up the form token', async () => {
    const a = await join(1);
    await addTask(a, { title: '' });
    await addTask(a, { title: 'Now valid' });
    expect(taskRows()).toHaveLength(1);
  });

  test('a missing or malformed form token is refused', async () => {
    const a = await join(1);
    const res = await a.post('/tasks').type('form').send({ title: 'T', owner: '1' });
    expect(res.status).toBe(400);
    const bad = await addTask(a, { title: 'T', token: "x'; --" });
    expect(bad.status).toBe(400);
    expect(taskRows()).toHaveLength(0);
  });
});

describe('duplicate submit', () => {
  test('the same form token adds one task and shows the normal list', async () => {
    const a = await join(1);
    const first = await addTask(a, { title: 'Once' });
    const second = await addTask(a, { title: 'Once' });
    expect(second.status).toBe(first.status);
    expect(second.headers.location).toBe(first.headers.location);
    expect(taskRows()).toHaveLength(1);
  });

  test('a token older than 10 minutes can be used again', async () => {
    const a = await join(1);
    await addTask(a, { title: 'Once' });
    db.prepare("UPDATE form_tokens SET created_at = '2000-01-01T00:00:00.000Z'").run();
    await addTask(a, { title: 'Twice' });
    expect(taskRows()).toHaveLength(2);
  });
});

describe('no session', () => {
  test('the list redirects to login and shows no task data', async () => {
    const a = await join(1);
    await addTask(a, { title: 'Secret task' });
    const res = await request(app).get('/');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
    expect(res.text).not.toContain('Secret task');
  });

  test('adding a task without a session gets 401 and stores nothing', async () => {
    await join(1);
    const res = await request(app).post('/tasks').type('form').send({ token: TOKEN_A, title: 'X', owner: '1' });
    expect(res.status).toBe(401);
    expect(taskRows()).toHaveLength(0);
  });
});
