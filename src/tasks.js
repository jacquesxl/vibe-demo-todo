import { randomBytes } from 'node:crypto';
import { createTask, findTask, findUserById } from './db.js';
import { requireLogin } from './auth.js';
import { TITLE_MAX, notFoundPage, taskListPage } from './views.js';

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_SEE_OTHER = 303;
const TOKEN_BYTES = 16;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const TOKEN_TTL_MS = 10 * 60 * 1000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ID_PATTERN = /^\d{1,15}$/;

const MSG_TITLE = 'Title is required.';
const MSG_DUE_DATE = 'Due date must be a calendar date (YYYY-MM-DD).';
const MSG_OWNER = 'Owner must be a member.';
const MSG_BAD_FORM = 'Bad request.';

function pad(n) {
  return String(n).padStart(2, '0');
}

// The server's local calendar date as YYYY-MM-DD.
function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function isCalendarDate(text) {
  const match = DATE_PATTERN.exec(text);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function memberLabels(users) {
  const counts = new Map();
  for (const u of users) counts.set(u.display_name, (counts.get(u.display_name) ?? 0) + 1);
  return users.map((u) => {
    const clash = counts.get(u.display_name) > 1;
    return { id: u.id, label: clash ? `${u.display_name} (${u.email.split('@')[0]})` : u.display_name };
  });
}

export function listMembers(db) {
  const users = db.prepare('SELECT id, email, display_name FROM users ORDER BY display_name, id').all();
  return memberLabels(users);
}

export function listOpenTasks(db) {
  return db
    .prepare(
      `SELECT t.id, t.title, t.due_date, o.display_name AS owner_name, c.display_name AS creator_name
       FROM tasks t
       JOIN users o ON o.id = t.owner_id
       JOIN users c ON c.id = t.created_by
       WHERE t.done = 0
       ORDER BY t.id`,
    )
    .all();
}

// Returns { values, errors }. values.owner is a member id, or null when it is not one.
export function validateNewTask(db, body) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const dueDate = typeof body.dueDate === 'string' ? body.dueDate.trim() : '';
  const ownerText = typeof body.owner === 'string' ? body.owner.trim() : '';
  const ownerId = ID_PATTERN.test(ownerText) && findUserById(db, Number(ownerText)) ? Number(ownerText) : null;
  const errors = [];
  if (title.length < 1 || title.length > TITLE_MAX) errors.push(MSG_TITLE);
  if (dueDate !== '' && !isCalendarDate(dueDate)) errors.push(MSG_DUE_DATE);
  if (ownerId === null) errors.push(MSG_OWNER);
  return { values: { title, dueDate, owner: ownerId }, errors };
}

// The token claim and the insert are one transaction: a repeated token adds nothing,
// and a failure leaves neither a used token nor a half-written task.
export function addTaskOnce(db, { token, title, ownerId, createdBy, dueDate }) {
  const run = db.transaction(() => {
    const cutoff = new Date(Date.now() - TOKEN_TTL_MS).toISOString();
    db.prepare('DELETE FROM form_tokens WHERE created_at < ?').run(cutoff);
    const claim = db
      .prepare('INSERT OR IGNORE INTO form_tokens (user_id, token) VALUES (?, ?)')
      .run(createdBy, token);
    if (claim.changes === 0) return null;
    return createTask(db, { title, ownerId, createdBy, dueDate: dueDate || null });
  });
  return run.immediate();
}

const NOW_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

// Sets the state rather than toggling it. Marking done an already done task changes nothing,
// so the first completed_at and completed_by stay. Returns false when the task does not exist.
export function markDone(db, id, userId) {
  const run = db.transaction(() => {
    db.prepare(
      `UPDATE tasks SET done = 1, completed_at = ${NOW_SQL}, completed_by = ? WHERE id = ? AND done = 0`,
    ).run(userId, id);
    return findTask(db, id) !== undefined;
  });
  return run.immediate();
}

// Reopening an already open task changes nothing. Returns false when the task does not exist.
export function reopenTask(db, id) {
  const run = db.transaction(() => {
    db.prepare('UPDATE tasks SET done = 0, completed_at = NULL, completed_by = NULL WHERE id = ? AND done = 1').run(id);
    return findTask(db, id) !== undefined;
  });
  return run.immediate();
}

function changeState(db, change) {
  return (req, res) => {
    const found = ID_PATTERN.test(req.params.id) && change(Number(req.params.id), req.user.id);
    if (!found) return res.status(HTTP_NOT_FOUND).send(notFoundPage());
    return res.redirect(HTTP_SEE_OTHER, '/');
  };
}

function renderList(db, req, { errors = [], values = {}, status = 200 } = {}, res) {
  const form = { title: '', dueDate: '', ...values, owner: values.owner ?? req.user.id };
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const html = taskListPage({
    user: req.user,
    members: listMembers(db),
    tasks: listOpenTasks(db),
    today: localToday(),
    token,
    errors,
    values: form,
  });
  return res.status(status).send(html);
}

export function taskRoutes(app, db) {
  app.get('/', requireLogin, (req, res) => renderList(db, req, {}, res));

  app.post('/tasks', requireLogin, (req, res) => {
    const body = req.body ?? {};
    if (typeof body.token !== 'string' || !TOKEN_PATTERN.test(body.token)) {
      return res.status(HTTP_BAD_REQUEST).type('text/plain').send(MSG_BAD_FORM);
    }
    const { values, errors } = validateNewTask(db, body);
    if (errors.length > 0) {
      return renderList(db, req, { errors, values, status: HTTP_BAD_REQUEST }, res);
    }
    addTaskOnce(db, {
      token: body.token,
      title: values.title,
      ownerId: values.owner,
      createdBy: req.user.id,
      dueDate: values.dueDate,
    });
    return res.redirect(HTTP_SEE_OTHER, '/');
  });

  app.post('/tasks/:id/done', requireLogin, changeState(db, (id, userId) => markDone(db, id, userId)));
  app.post('/tasks/:id/reopen', requireLogin, changeState(db, (id) => reopenTask(db, id)));
}
