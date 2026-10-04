import { describe, test, expect, beforeEach } from 'vitest';
import * as dbModule from '../src/db.js';
import {
  openDb,
  applySchema,
  createUser,
  findUserByEmail,
  createSession,
  findSession,
  createTask,
  findTask,
} from '../src/db.js';

const MEMORY = ':memory:';
const NO_SUCH_USER = 9999;

let db;
let userId;

beforeEach(() => {
  db = openDb(MEMORY);
  userId = createUser(db, { email: 'ann@example.com', displayName: 'Ann', passwordHash: 'h' });
});

describe('schema', () => {
  test('applies twice without error', () => {
    expect(() => applySchema(db)).not.toThrow();
    expect(() => applySchema(db)).not.toThrow();
  });

  test('foreign keys are enforced', () => {
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });
});

describe('users', () => {
  test('a duplicate e-mail is rejected', () => {
    expect(() =>
      createUser(db, { email: 'ann@example.com', displayName: 'Other', passwordHash: 'h' }),
    ).toThrow(/UNIQUE/);
  });

  test('an e-mail that is not lower-cased is rejected', () => {
    expect(() =>
      createUser(db, { email: 'Bob@Example.com', displayName: 'Bob', passwordHash: 'h' }),
    ).toThrow(/CHECK/);
  });

  test('two members may share a display name', () => {
    expect(() =>
      createUser(db, { email: 'ann2@example.com', displayName: 'Ann', passwordHash: 'h' }),
    ).not.toThrow();
  });

  test('a user can be found by e-mail', () => {
    expect(findUserByEmail(db, 'ann@example.com').id).toBe(userId);
    expect(findUserByEmail(db, 'nobody@example.com')).toBeUndefined();
  });
});

describe('sessions', () => {
  test('a session needs an existing user', () => {
    expect(() => createSession(db, { tokenHash: 'x', userId: NO_SUCH_USER })).toThrow(/FOREIGN KEY/);
  });

  test('a session is stored by token hash', () => {
    createSession(db, { tokenHash: 'abc', userId });
    expect(findSession(db, 'abc').user_id).toBe(userId);
  });
});

describe('tasks', () => {
  test('a task is stored open with its owner and creator', () => {
    const id = createTask(db, { title: 'Sweep floor', ownerId: userId, createdBy: userId });
    const task = findTask(db, id);
    expect(task).toMatchObject({ title: 'Sweep floor', owner_id: userId, created_by: userId, done: 0 });
    expect(task.due_date).toBeNull();
    expect(task.completed_at).toBeNull();
  });

  test('a due date is optional but kept when given', () => {
    const id = createTask(db, { title: 'Order wood', ownerId: userId, createdBy: userId, dueDate: '2026-11-01' });
    expect(findTask(db, id).due_date).toBe('2026-11-01');
  });

  test('a missing title is rejected', () => {
    expect(() => createTask(db, { title: null, ownerId: userId, createdBy: userId })).toThrow(/NOT NULL/);
  });

  test('a missing owner is rejected', () => {
    expect(() => createTask(db, { title: 'T', ownerId: null, createdBy: userId })).toThrow(/NOT NULL/);
  });

  test('an owner who does not exist is rejected by the foreign key', () => {
    expect(() => createTask(db, { title: 'T', ownerId: NO_SUCH_USER, createdBy: userId })).toThrow(
      /FOREIGN KEY/,
    );
  });
});

describe('members are never deleted', () => {
  test('the module exports no function that deletes a member', () => {
    const names = Object.keys(dbModule).filter((n) => /delete|remove|drop/i.test(n));
    expect(names).toEqual(['deleteSession']);
  });
});
