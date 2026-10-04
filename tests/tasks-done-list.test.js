import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { openDb } from '../src/db.js';
import { createApp } from '../src/server.js';

const PASSWORD = 'correct horse';

let db;
let app;
let tokenCount;

beforeEach(() => {
  db = openDb(':memory:');
  app = createApp({ db });
  tokenCount = 0;
});

async function join(n) {
  const agent = request.agent(app);
  await agent
    .post('/register')
    .type('form')
    .send({ email: `m${n}@example.com`, displayName: `Member ${n}`, password: PASSWORD });
  return agent;
}

async function addTask(agent, title, dueDate = '') {
  tokenCount += 1;
  await agent
    .post('/tasks')
    .type('form')
    .send({ token: `list-token-${String(tokenCount).padStart(8, '0')}`, title, owner: '1', dueDate });
  return db.prepare('SELECT id FROM tasks ORDER BY id DESC').get().id;
}

function sections(html) {
  const [open, done] = html.split('<h2>Done</h2>');
  return { open, done };
}

function titlesIn(html) {
  return [...html.matchAll(/<li>([^<&]*?) &middot;/g)].map((m) => m[1]);
}

describe('done section', () => {
  test('is always shown, with a line when nothing is done', async () => {
    const a = await join(1);
    const { text } = await a.get('/');
    expect(sections(text).done).toContain('Nothing done yet.');
  });

  test('open and done tasks are in separate sections', async () => {
    const a = await join(1);
    const open = await addTask(a, 'Still open');
    const done = await addTask(a, 'Finished');
    await a.post(`/tasks/${done}/done`);
    const { text } = await a.get('/');
    const s = sections(text);
    expect(s.open).toContain('Still open');
    expect(s.open).not.toContain('Finished');
    expect(s.done).toContain('Finished');
    expect(s.done).not.toContain('Still open');
    expect(s.done).not.toContain('Nothing done yet.');
    expect(s.done).toContain(`action="/tasks/${done}/reopen"`);
    expect(s.open).toContain(`action="/tasks/${open}/done"`);
  });

  test('done rows show owner, due date, done time and who finished it', async () => {
    const a = await join(1);
    const b = await join(2);
    const id = await addTask(a, 'Finished', '2030-01-31');
    await b.post(`/tasks/${id}/done`);
    const { done } = sections((await a.get('/')).text);
    expect(done).toMatch(/Finished &middot; Member 1 &middot; 2030-01-31 &middot; done \d{4}-\d{2}-\d{2} \d{2}:\d{2} by Member 2/);
  });

  test('a done task without a due date says so', async () => {
    const a = await join(1);
    const id = await addTask(a, 'Finished');
    await a.post(`/tasks/${id}/done`);
    expect(sections((await a.get('/')).text).done).toContain('no due date');
  });

  test('done tasks are ordered by completion time, newest first', async () => {
    const a = await join(1);
    const first = await addTask(a, 'Completed first');
    const second = await addTask(a, 'Completed second');
    const third = await addTask(a, 'Completed third');
    for (const id of [first, second, third]) await a.post(`/tasks/${id}/done`);
    const stamp = db.prepare('UPDATE tasks SET completed_at = ? WHERE id = ?');
    stamp.run('2030-01-01T10:00:00.000Z', second);
    stamp.run('2030-01-03T10:00:00.000Z', first);
    stamp.run('2030-01-02T10:00:00.000Z', third);
    const { done } = sections((await a.get('/')).text);
    expect(titlesIn(done)).toEqual(['Completed first', 'Completed third', 'Completed second']);
  });

  test('open tasks: soonest due first, no due date last, ties oldest first', async () => {
    const a = await join(1);
    await addTask(a, 'No date');
    await addTask(a, 'Late', '2030-03-01');
    await addTask(a, 'Soon A', '2030-01-01');
    await addTask(a, 'Soon B', '2030-01-01');
    const { open } = sections((await a.get('/')).text);
    expect(titlesIn(open)).toEqual(['Soon A', 'Soon B', 'Late', 'No date']);
  });

  test('reopening moves a task back to the open section', async () => {
    const a = await join(1);
    const id = await addTask(a, 'Back again');
    await a.post(`/tasks/${id}/done`);
    const res = await a.post(`/tasks/${id}/reopen`);
    expect(res.status).toBe(303);
    const s = sections((await a.get('/')).text);
    expect(s.open).toContain('Back again');
    expect(s.done).not.toContain('Back again');
    expect(s.done).toContain('Nothing done yet.');
  });

  test('no task is removed by listing or by passing time', async () => {
    const a = await join(1);
    const id = await addTask(a, 'Old one');
    await a.post(`/tasks/${id}/done`);
    db.prepare('UPDATE tasks SET completed_at = ? WHERE id = ?').run('2000-01-01T00:00:00.000Z', id);
    await a.get('/');
    await a.get('/');
    expect(db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n).toBe(1);
  });

  test('titles are escaped in the done section', async () => {
    const a = await join(1);
    const id = await addTask(a, '<script>alert(1)</script>');
    await a.post(`/tasks/${id}/done`);
    const { text } = await a.get('/');
    expect(text).not.toContain('<script>alert(1)</script>');
    expect(text).toContain('&lt;script&gt;');
  });
});
