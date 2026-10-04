// PROTECTED ACCEPTANCE TESTS. One per success criterion in docs/PRD.md.
// Later steps may only un-skip a test (and fill in its body) or add new tests.
// Never weaken, rename or delete these. Each skip reason names the step that makes it pass.
import { describe, test, expect } from 'vitest';
import request from 'supertest';
import { openDb, countUsers } from '../../src/db.js';
import { createApp } from '../../src/server.js';

const TEAM_SIZE = 10;

describe('acceptance criteria', () => {
  test('C1 [step 3] up to 10 people register and the 11th is refused', async () => {
    const db = openDb(':memory:');
    const app = createApp({ db });
    const join = (n) =>
      request(app)
        .post('/register')
        .type('form')
        .send({ email: `person${n}@example.com`, displayName: `Person ${n}`, password: 'a long password' });
    for (let n = 1; n <= TEAM_SIZE; n += 1) {
      expect((await join(n)).status).toBe(303);
    }
    const eleventh = await join(TEAM_SIZE + 1);
    expect(eleventh.status).toBe(409);
    expect(eleventh.text).toContain('This team is full (10 members).');
    expect(countUsers(db)).toBe(TEAM_SIZE);
  });

  test('C2 [step 5] a task has title, owner and due date and can be marked done', async () => {
    const db = openDb(':memory:');
    const app = createApp({ db });
    const agent = request.agent(app);
    await agent
      .post('/register')
      .type('form')
      .send({ email: 'ada@example.com', displayName: 'Ada', password: 'a long password' });
    await agent
      .post('/tasks')
      .type('form')
      .send({ token: 'c2-token-aaaaaaaaaaaa', title: 'Sweep floor', owner: '1', dueDate: '2030-01-31' });
    const task = db.prepare('SELECT * FROM tasks').get();
    expect(task).toMatchObject({ title: 'Sweep floor', owner_id: 1, due_date: '2030-01-31', done: 0 });
    const res = await agent.post(`/tasks/${task.id}/done`);
    expect(res.status).toBe(303);
    const done = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id);
    expect(done.done).toBe(1);
    expect(done.completed_at).not.toBeNull();
  });

  test('C3 [step 6] reassigning changes the owner, and the owner is unchanged until then', async () => {
    const db = openDb(':memory:');
    const app = createApp({ db });
    const agent = request.agent(app);
    for (const [email, displayName] of [['ada@example.com', 'Ada'], ['sam@example.com', 'Sam']]) {
      await agent.post('/logout');
      await agent.post('/register').type('form').send({ email, displayName, password: 'a long password' });
    }
    await agent
      .post('/tasks')
      .type('form')
      .send({ token: 'c3-token-aaaaaaaaaaaa', title: 'Sweep floor', owner: '1', dueDate: '2030-01-31' });
    const id = db.prepare('SELECT id FROM tasks').get().id;
    await agent.get('/');
    expect(db.prepare('SELECT owner_id FROM tasks WHERE id = ?').get(id).owner_id).toBe(1);
    const res = await agent.post(`/tasks/${id}/owner`).type('form').send({ owner: '2' });
    expect(res.status).toBe(303);
    expect(db.prepare('SELECT owner_id FROM tasks WHERE id = ?').get(id).owner_id).toBe(2);
  });

  test('C4 [step 8] done tasks are listed apart from open ones, newest first, can be reopened, and only the creator can delete', async () => {
    const db = openDb(':memory:');
    const app = createApp({ db });
    const ada = request.agent(app);
    const sam = request.agent(app);
    await ada.post('/register').type('form').send({ email: 'ada@example.com', displayName: 'Ada', password: 'a long password' });
    await sam.post('/register').type('form').send({ email: 'sam@example.com', displayName: 'Sam', password: 'a long password' });
    for (const [n, title] of [['1', 'Older'], ['2', 'Newer'], ['3', 'Open one']]) {
      await ada.post('/tasks').type('form').send({ token: `c4-token-aaaaaaaaaa${n}`, title, owner: '1', dueDate: '2030-01-31' });
    }
    const id = (title) => db.prepare('SELECT id FROM tasks WHERE title = ?').get(title).id;
    await ada.post(`/tasks/${id('Older')}/done`);
    await ada.post(`/tasks/${id('Newer')}/done`);
    db.prepare('UPDATE tasks SET completed_at = ? WHERE title = ?').run('2030-01-01T10:00:00.000Z', 'Older');
    db.prepare('UPDATE tasks SET completed_at = ? WHERE title = ?').run('2030-01-02T10:00:00.000Z', 'Newer');
    const [open, done] = (await ada.get('/')).text.split('<h2>Done</h2>');
    expect(open).toContain('Open one');
    expect(open).not.toContain('Newer');
    expect(done.indexOf('Newer')).toBeGreaterThan(-1);
    expect(done.indexOf('Newer')).toBeLessThan(done.indexOf('Older'));
    await ada.post(`/tasks/${id('Newer')}/reopen`);
    expect(db.prepare('SELECT done FROM tasks WHERE title = ?').get('Newer').done).toBe(0);
    const refused = await sam.post(`/tasks/${id('Older')}/delete`);
    expect(refused.status).toBe(403);
    expect(db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n).toBe(3);
    expect((await ada.post(`/tasks/${id('Older')}/delete`)).status).toBe(303);
    expect(db.prepare('SELECT COUNT(*) AS n FROM tasks').get().n).toBe(2);
  });

  test('C5 [step 9] end-to-end: several members register, add, reassign, finish and reopen tasks using only the app', async () => {
    const app = createApp({ db: openDb(':memory:') });
    const join = async (n) => {
      const agent = request.agent(app);
      const res = await agent
        .post('/register')
        .type('form')
        .send({ email: `crew${n}@example.com`, displayName: `Crew ${n}`, password: 'a long password' });
      expect(res.status).toBe(303);
      return agent;
    };
    const [ada, sam] = [await join(1), await join(2)];
    await ada
      .post('/tasks')
      .type('form')
      .send({ token: 'c5-token-aaaaaaaaaa', title: 'Sweep floor', owner: '1', dueDate: '2030-01-31' });
    const row = (html) => html.match(/<li>[^<]*Sweep floor[\s\S]*?<\/li>/)[0];
    const taskId = row((await sam.get('/')).text).match(/\/tasks\/(\d+)\//)[1];
    await sam.post(`/tasks/${taskId}/owner`).type('form').send({ owner: '2' });
    expect(row((await ada.get('/')).text)).toContain('Crew 2');
    await sam.post(`/tasks/${taskId}/done`);
    expect((await ada.get('/')).text.split('<h2>Done</h2>')[1]).toContain('Sweep floor');
    await sam.post(`/tasks/${taskId}/reopen`);
    expect((await ada.get('/')).text.split('<h2>Done</h2>')[0]).toContain('Sweep floor');
    expect((await sam.post(`/tasks/${taskId}/delete`)).status).toBe(403);
  });
});
