export const TITLE_MAX = 200;

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const MSG_EMPTY_LIST = 'No tasks yet. Add the first one above.';

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

export function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title></head>
<body>
<main>
<h1>${esc(title)}</h1>
${body}
</main>
</body>
</html>`;
}

export function messages(list, role = 'alert') {
  return list.map((text) => `<p role="${role}">${esc(text)}</p>`).join('\n');
}

function ownerOptions(members, selectedId) {
  return members
    .map((m) => {
      const selected = m.id === selectedId ? ' selected' : '';
      return `<option value="${m.id}"${selected}>${esc(m.label)}</option>`;
    })
    .join('\n');
}

function addForm({ members, values, token }) {
  return `<form method="post" action="/tasks">
<input type="hidden" name="token" value="${esc(token)}">
<p><label>Title <input type="text" name="title" value="${esc(values.title)}" maxlength="${TITLE_MAX}" required></label></p>
<p><label>Owner <select name="owner">
${ownerOptions(members, values.owner)}
</select></label></p>
<p><label>Due date <input type="date" name="dueDate" value="${esc(values.dueDate)}"></label></p>
<p><button type="submit">Add task</button></p>
</form>`;
}

function reassignForm(task, members) {
  return `<form method="post" action="/tasks/${Number(task.id)}/owner"><select name="owner" aria-label="New owner">
${ownerOptions(members, task.owner_id)}
</select> <button type="submit">Reassign</button></form>`;
}

function taskRow(task, today, members) {
  const due = task.due_date ? esc(task.due_date) : 'no due date';
  const overdue = task.due_date && task.due_date < today ? ' <strong>overdue</strong>' : '';
  const doneForm = `<form method="post" action="/tasks/${Number(task.id)}/done"><button type="submit">Mark done</button></form>`;
  return `<li>${esc(task.title)} &middot; ${esc(task.owner_name)} &middot; ${due}${overdue} &middot; added by ${esc(task.creator_name)} ${reassignForm(task, members)} ${doneForm}</li>`;
}

export function notFoundPage() {
  return page('Not found', '<p>Task not found.</p>\n<p><a href="/">Back to the list</a></p>');
}

function taskList(tasks, today, members) {
  if (tasks.length === 0) return `<p>${esc(MSG_EMPTY_LIST)}</p>`;
  return `<ul>\n${tasks.map((task) => taskRow(task, today, members)).join('\n')}\n</ul>`;
}

export function taskListPage({ user, members, tasks, today, token, errors = [], values }) {
  return page(
    'Tasks',
    `<p>Logged in as ${esc(user.display_name)}.</p>
<form method="post" action="/logout"><button type="submit">Log out</button></form>
${messages(errors)}
${addForm({ members, values, token })}
${taskList(tasks, today, members)}`,
  );
}
