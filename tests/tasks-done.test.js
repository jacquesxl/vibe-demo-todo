import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { openDb } from '../src/db.js';
import { createApp } from '../src/server.js';

const PASSWORD = 'correct horse';
const TOKEN = 'token-aaaaaaaaaaaaaaaa';

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

async function addTask(agent, title = 'Sweep floor') {
  await agent.post('/tasks').type('form').send({ token: `${TOKEN}${title.length}`, title, owner: '1', dueDate: '2030-01-31' });
  return db.prepare('SELECT id FROM tasks ORDER BY id DESC').get().id;
}

function task(id) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

describe('mark done', () => {
  test('sets done, completed_at and completed_by, and lands on the list', async () => {
    const a = await join(1);
    const b = await join(2);
    const id = await addTask(a);
    const res = await b.post(`/tasks/${id}/done`);
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/');
    const row = task(id);
    expect(row.done).toBe(1);
    expect(row.completed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(row.completed_by).toBe(2);
  });

  test('a done task leaves the open list', async () => {
    const a = await join(1);
    const id = await addTask(a, 'Gone soon');
    await a.post(`/tasks/${id}/done`);
    const list = await a.get('/');
    expect(list.text).not.toContain('Gone soon');
  });

  test('the open list offers a Mark done button', async () => {
    const a = await join(1);
    const id = await addTask(a);
    const list = await a.get('/');
    expect(list.text).toContain(`action="/tasks/${id}/done"`);
    expect(list.text).toContain('Mark done');
  });

  test('a second submit succeeds and keeps the first completed_at and completed_by', async () => {
    const a = await join(1);
    const b = await join(2);
    const id = await addTask(a);
    await a.post(`/tasks/${id}/done`);
    db.prepare("UPDATE tasks SET completed_at = '2020-01-01T00:00:00.000Z' WHERE id = ?").run(id);
    const again = await b.post(`/tasks/${id}/done`);
    expect(again.status).toBe(303);
    const row = task(id);
    expect(row.done).toBe(1);
    expect(row.completed_at).toBe('2020-01-01T00:00:00.000Z');
    expect(row.completed_by).toBe(1);
  });
});

describe('reopen', () => {
  test('clears done, completed_at and completed_by, and the task is open again', async () => {
    const a = await join(1);
    const id = await addTask(a, 'Back again');
    await a.post(`/tasks/${id}/done`);
    const res = await a.post(`/tasks/${id}/reopen`);
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/');
    const row = task(id);
    expect(row.done).toBe(0);
    expect(row.completed_at).toBeNull();
    expect(row.completed_by).toBeNull();
    expect((await a.get('/')).text).toContain('Back again');
  });

  test('reopening an open task twice changes nothing', async () => {
    const a = await join(1);
    const id = await addTask(a);
    expect((await a.post(`/tasks/${id}/reopen`)).status).toBe(303);
    expect((await a.post(`/tasks/${id}/reopen`)).status).toBe(303);
    expect(task(id).done).toBe(0);
  });
});

describe('unknown or malformed id', () => {
  test.each(['done', 'reopen'])('%s gives 404 "Task not found." with a link back', async (action) => {
    const a = await join(1);
    for (const id of ['999', 'abc', '1%20OR%201%3D1', '99999999999999999999']) {
      const res = await a.post(`/tasks/${id}/${action}`);
      expect(res.status).toBe(404);
      expect(res.text).toContain('Task not found.');
      expect(res.text).toContain('href="/"');
    }
  });
});

describe('no session and cross-site', () => {
  test.each(['done', 'reopen'])('%s without a session gets 401 and changes nothing', async (action) => {
    const a = await join(1);
    const id = await addTask(a);
    if (action === 'reopen') await a.post(`/tasks/${id}/done`);
    const before = task(id);
    const res = await request(app).post(`/tasks/${id}/${action}`);
    expect(res.status).toBe(401);
    expect(task(id)).toEqual(before);
  });

  test('a foreign Origin is refused with 403 and changes nothing', async () => {
    const a = await join(1);
    const id = await addTask(a);
    const res = await a.post(`/tasks/${id}/done`).set('Origin', 'http://evil.example');
    expect(res.status).toBe(403);
    expect(task(id).done).toBe(0);
  });

  test('an unknown id without a session is 401, not 404', async () => {
    const res = await request(app).post('/tasks/999/done');
    expect(res.status).toBe(401);
  });
});
