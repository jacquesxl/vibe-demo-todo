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

async function join(n) {
  const agent = request.agent(app);
  const res = await agent
    .post('/register')
    .type('form')
    .send({ email: `m${n}@example.com`, displayName: `Member ${n}`, password: PASSWORD });
  expect(res.status).toBe(303);
  return agent;
}

async function addTask(agent, owner = '1') {
  await agent.post('/tasks').type('form').send({ token: TOKEN, title: 'Sweep floor', owner, dueDate: '2030-01-31' });
  return db.prepare('SELECT id FROM tasks ORDER BY id DESC').get().id;
}

function task(id) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

describe('reassign', () => {
  test('changes only the owner and lands on the list', async () => {
    const a = await join(1);
    await join(2);
    const id = await addTask(a);
    const before = task(id);
    const res = await a.post(`/tasks/${id}/owner`).type('form').send({ owner: '2' });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/');
    expect(task(id)).toEqual({ ...before, owner_id: 2 });
  });

  test('a task with no action keeps its owner', async () => {
    const a = await join(1);
    await join(2);
    const id = await addTask(a);
    await a.get('/');
    expect(task(id).owner_id).toBe(1);
  });

  test('a member who is neither creator nor owner can reassign', async () => {
    const a = await join(1);
    await join(2);
    const c = await join(3);
    const id = await addTask(a);
    const res = await c.post(`/tasks/${id}/owner`).type('form').send({ owner: '3' });
    expect(res.status).toBe(303);
    expect(task(id).owner_id).toBe(3);
  });

  test('the same owner is harmless', async () => {
    const a = await join(1);
    const id = await addTask(a);
    const before = task(id);
    const res = await a.post(`/tasks/${id}/owner`).type('form').send({ owner: '1' });
    expect(res.status).toBe(303);
    expect(task(id)).toEqual(before);
  });

  test('a done task can be reassigned and stays done', async () => {
    const a = await join(1);
    await join(2);
    const id = await addTask(a);
    await a.post(`/tasks/${id}/done`);
    const res = await a.post(`/tasks/${id}/owner`).type('form').send({ owner: '2' });
    expect(res.status).toBe(303);
    expect(task(id)).toMatchObject({ owner_id: 2, done: 1 });
  });

  test.each(['999', 'abc', '', '1 OR 1=1', '-1'])('non-member %j is refused with 400 and nothing changes', async (owner) => {
    const a = await join(1);
    const id = await addTask(a);
    const before = task(id);
    const res = await a.post(`/tasks/${id}/owner`).type('form').send({ owner });
    expect(res.status).toBe(400);
    expect(res.text).toContain('Owner must be a member.');
    expect(task(id)).toEqual(before);
  });

  test('a missing owner field is refused', async () => {
    const a = await join(1);
    const id = await addTask(a);
    const res = await a.post(`/tasks/${id}/owner`);
    expect(res.status).toBe(400);
    expect(task(id).owner_id).toBe(1);
  });

  test('the list shows a picker with the current owner preselected and a Reassign button', async () => {
    const a = await join(1);
    await join(2);
    const id = await addTask(a, '2');
    const list = await a.get('/');
    expect(list.text).toContain(`action="/tasks/${id}/owner"`);
    expect(list.text).toContain('Reassign');
    expect(list.text).toContain('<option value="2" selected>');
  });

  test('unknown or malformed task id gives 404', async () => {
    const a = await join(1);
    for (const id of ['999', 'abc', '99999999999999999999']) {
      const res = await a.post(`/tasks/${id}/owner`).type('form').send({ owner: '1' });
      expect(res.status).toBe(404);
      expect(res.text).toContain('Task not found.');
    }
  });

  test('without a session it is 401 and changes nothing', async () => {
    const a = await join(1);
    await join(2);
    const id = await addTask(a);
    const res = await request(app).post(`/tasks/${id}/owner`).type('form').send({ owner: '2' });
    expect(res.status).toBe(401);
    expect(task(id).owner_id).toBe(1);
  });

  test('a foreign Origin is refused with 403 and changes nothing', async () => {
    const a = await join(1);
    await join(2);
    const id = await addTask(a);
    const res = await a.post(`/tasks/${id}/owner`).set('Origin', 'http://evil.example').type('form').send({ owner: '2' });
    expect(res.status).toBe(403);
    expect(task(id).owner_id).toBe(1);
  });
});
