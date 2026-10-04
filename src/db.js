import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';

const SCHEMA_PATH = new URL('./schema.sql', import.meta.url);

// There is deliberately no function here that deletes a member.
export function openDb(path) {
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  applySchema(db);
  return db;
}

export function applySchema(db) {
  db.exec(readFileSync(SCHEMA_PATH, 'utf8'));
  addCompletedByColumn(db);
}

// Step 5 added tasks.completed_by; a database file made by an earlier step does not have it yet.
function addCompletedByColumn(db) {
  const columns = db.prepare("SELECT name FROM pragma_table_info('tasks')").all();
  if (columns.some((c) => c.name === 'completed_by')) return;
  db.exec('ALTER TABLE tasks ADD COLUMN completed_by INTEGER REFERENCES users(id)');
}

export function createUser(db, { email, displayName, passwordHash }) {
  const result = db
    .prepare('INSERT INTO users (email, display_name, password_hash) VALUES (?, ?, ?)')
    .run(email, displayName, passwordHash);
  return Number(result.lastInsertRowid);
}

export function findUserByEmail(db, email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function findUserById(db, id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function countUsers(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
}

export function createSession(db, { tokenHash, userId }) {
  db.prepare('INSERT INTO sessions (token_hash, user_id) VALUES (?, ?)').run(tokenHash, userId);
}

export function findSession(db, tokenHash) {
  return db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(tokenHash);
}

export function deleteSession(db, tokenHash) {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

export function createTask(db, { title, ownerId, createdBy, dueDate = null }) {
  const result = db
    .prepare('INSERT INTO tasks (title, owner_id, created_by, due_date) VALUES (?, ?, ?, ?)')
    .run(title, ownerId, createdBy, dueDate);
  return Number(result.lastInsertRowid);
}

export function findTask(db, id) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}
