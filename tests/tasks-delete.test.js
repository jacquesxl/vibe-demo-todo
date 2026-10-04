import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { openDb } from '../src/db.js';
import { createApp } from '../src/server.js';

const PASSWORD = 'correct horse';
const TOKEN = 'token-aaaaaaaaaaaaaaaa';
const REFUSAL = 'Only the person who added this task can delete it.';

let db;
let app;

beforeEach(() => {
  db = openDb(':memory:');
  app = createApp({ db });
});

async function join(n) {
  const agent = request.agent(app);
  await agent
    .post('/register')
    .type('form')
    .send({ email: `m${n}@example.com`, displayName: `Member ${n}`, password: PASSWORD });
  return agent;
}

async function addTask(agent, owner = '1') {
  await agent.post('/tasks').type('form').send({ token: TOKEN, title: 'Sweep floor', owner, dueDate: '2030-01-31' });
  return db.prepare('SELECT id FROM tasks ORDER BY id DESC').get().id;
}

function count() {
  return db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n;
}

describe('delete', () => {
  test('the creator deletes an open task and lands on the list with no message', async () => {
    const a = await join(1);
    const id = await addTask(a);
    const res = await a.post(`/tasks/${id}/delete`);
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/');
    expect(count()).toBe(0);
    expect((await a.get('/')).text).not.toContain(REFUSAL);
  });

  test('the creator deletes a done task', async () => {
    const a = await join(1);
    const id = await addTask(a);
    await a.post(`/tasks/${id}/done`);
    expect((await a.post(`/tasks/${id}/delete`)).status).toBe(303);
    expect(count()).toBe(0);
  });

  test('the creator can delete a task that someone else owns', async () => {
    const a = await join(1);
    await join(2);
    const id = await addTask(a, '2');
    expect((await a.post(`/tasks/${id}/delete`)).status).toBe(303);
    expect(count()).toBe(0);
  });

  test('another member gets 403 with the refusal text and the task remains', async () => {
    const a = await join(1);
    const b = await join(2);
    const id = await addTask(a, '2');
    const res = await b.post(`/tasks/${id}/delete`);
    expect(res.status).toBe(403);
    expect(res.text).toContain(REFUSAL);
    expect(count()).toBe(1);
  });

  test('the current owner who is not the creator is also refused', async () => {
    const a = await join(1);
    const b = await join(2);
    const id = await addTask(a, '1');
    await a.post(`/tasks/${id}/owner`).type('form').send({ owner: '2' });
    expect((await b.post(`/tasks/${id}/delete`)).status).toBe(403);
    expect(count()).toBe(1);
  });

  test('deleting twice is harmless', async () => {
    const a = await join(1);
    const id = await addTask(a);
    await a.post(`/tasks/${id}/delete`);
    const again = await a.post(`/tasks/${id}/delete`);
    expect(again.status).toBe(303);
    expect(count()).toBe(0);
  });

  test('delete buttons show only on rows the member created', async () => {
    const a = await join(1);
    const b = await join(2);
    const id = await addTask(a);
    expect((await a.get('/')).text).toContain(`action="/tasks/${id}/delete"`);
    expect((await b.get('/')).text).not.toContain(`action="/tasks/${id}/delete"`);
  });

  test('malformed id gives 404', async () => {
    const a = await join(1);
    const res = await a.post('/tasks/abc/delete');
    expect(res.status).toBe(404);
    expect(res.text).toContain('Task not found.');
  });

  test('without a session it is 401 and nothing is deleted', async () => {
    const a = await join(1);
    const id = await addTask(a);
    const res = await request(app).post(`/tasks/${id}/delete`);
    expect(res.status).toBe(401);
    expect(count()).toBe(1);
  });

  test('a foreign Origin is refused with 403 and nothing is deleted', async () => {
    const a = await join(1);
    const id = await addTask(a);
    const res = await a.post(`/tasks/${id}/delete`).set('Origin', 'http://evil.example');
    expect(res.status).toBe(403);
    expect(count()).toBe(1);
  });

  test('GET does not delete', async () => {
    const a = await join(1);
    const id = await addTask(a);
    await a.get(`/tasks/${id}/delete`);
    expect(count()).toBe(1);
  });
});
