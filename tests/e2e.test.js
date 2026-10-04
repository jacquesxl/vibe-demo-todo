import { describe, test, expect } from 'vitest';
import request from 'supertest';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { get } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/db.js';
import { createApp } from '../src/server.js';

const PASSWORD = 'a long password';
const TEAM_SIZE = 10;
const REFUSAL = 'Only the person who added this task can delete it.';
const START_TIMEOUT_MS = 10000;

let tokenCounter = 0;

function newMember(app, n) {
  const agent = request.agent(app);
  const done = agent
    .post('/register')
    .type('form')
    .send({ email: `member${n}@example.com`, displayName: `Member ${n}`, password: PASSWORD });
  return done.then((res) => ({ agent, res }));
}

function addTask(agent, { title, owner, dueDate }) {
  tokenCounter += 1;
  const token = `e2e-token-${String(tokenCounter).padStart(8, '0')}`;
  return agent.post('/tasks').type('form').send({ token, title, owner: String(owner), dueDate });
}

// The page is the only source of truth here: rows come from the HTML a member would see.
function rowOf(html, title) {
  return [...html.matchAll(/<li>[\s\S]*?<\/li>/g)].map((m) => m[0]).find((row) => row.includes(title));
}

function sections(html) {
  const [open, done] = html.split('<h2>Done</h2>');
  return { open, done };
}

function idOf(row, action) {
  return row.match(new RegExp(`/tasks/(\\d+)/${action}`))[1];
}

describe('end-to-end: the whiteboard job through the app only', () => {
  test('members register, share tasks, reassign, finish, reopen, and the 11th cannot join', async () => {
    const app = createApp({ db: openDb(':memory:') });
    const members = [];
    for (let n = 1; n <= 3; n += 1) {
      const joined = await newMember(app, n);
      expect(joined.res.status).toBe(303);
      members.push(joined.agent);
    }
    const [ada, sam, kim] = members;

    const empty = await ada.get('/');
    expect(empty.text).toContain('No tasks yet. Add the first one above.');

    expect((await addTask(ada, { title: 'Sweep floor', owner: 2, dueDate: '2030-01-31' })).status).toBe(303);
    expect((await addTask(ada, { title: 'Order screws', owner: 3, dueDate: '2030-02-01' })).status).toBe(303);

    const seenBySam = sections((await sam.get('/')).text).open;
    expect(rowOf(seenBySam, 'Sweep floor')).toContain('Member 2');
    expect(rowOf(seenBySam, 'Sweep floor')).toContain('2030-01-31');
    expect(rowOf(seenBySam, 'Order screws')).toContain('Member 3');

    const sweep = rowOf(seenBySam, 'Sweep floor');
    const handed = await kim.post(`/tasks/${idOf(sweep, 'done')}/owner`).type('form').send({ owner: '3' });
    expect(handed.status).toBe(303);
    const afterHandover = sections((await ada.get('/')).text).open;
    expect(rowOf(afterHandover, 'Sweep floor')).toContain('Member 3');
    expect(rowOf(afterHandover, 'Sweep floor')).toContain('added by Member 1');

    const screwsId = idOf(rowOf(afterHandover, 'Order screws'), 'done');
    await kim.post(`/tasks/${screwsId}/done`);
    const afterDone = sections((await kim.get('/')).text);
    expect(afterDone.open).not.toContain('Order screws');
    expect(afterDone.done).toContain('Order screws');
    await kim.post(`/tasks/${screwsId}/reopen`);
    const afterReopen = sections((await kim.get('/')).text);
    expect(afterReopen.open).toContain('Order screws');
    expect(afterReopen.done).not.toContain('Order screws');

    const refused = await kim.post(`/tasks/${screwsId}/delete`);
    expect(refused.status).toBe(403);
    expect(refused.text).toContain(REFUSAL);
    expect(sections((await ada.get('/')).text).open).toContain('Order screws');
    expect((await ada.post(`/tasks/${screwsId}/delete`)).status).toBe(303);
    expect((await ada.get('/')).text).not.toContain('Order screws');

    for (let n = 4; n <= TEAM_SIZE; n += 1) {
      expect((await newMember(app, n)).res.status).toBe(303);
    }
    const eleventh = await newMember(app, TEAM_SIZE + 1);
    expect(eleventh.res.status).toBe(409);
    expect(eleventh.res.text).toContain('This team is full (10 members).');
    expect((await eleventh.agent.get('/')).status).toBe(302);
  });

  test('npm start runs on the port and database path given in the environment', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'team-todo-'));
    const port = await freePort();
    const child = spawn(process.execPath, ['src/server.js'], {
      env: { ...process.env, PORT: String(port), DATABASE_PATH: join(dir, 'nested', 'tasks.db') },
      stdio: 'ignore',
    });
    try {
      const res = await waitForServer(port);
      expect(res.status).toBe(200);
      expect(res.text).toContain('Log in');
    } finally {
      child.kill();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function getLogin(port) {
  return new Promise((resolve, reject) => {
    get({ host: '127.0.0.1', port, path: '/login' }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        text += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode, text }));
    }).on('error', reject);
  });
}

async function waitForServer(port) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  for (;;) {
    try {
      return await getLogin(port);
    } catch (err) {
      if (Date.now() > deadline) throw err;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}
