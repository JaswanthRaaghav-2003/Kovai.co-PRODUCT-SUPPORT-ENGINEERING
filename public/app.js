const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const userNameEl = document.getElementById('user-name');

const createTaskForm = document.getElementById('create-task-form');
const taskTitleInput = document.getElementById('task-title-input');
const addTaskBtn = document.getElementById('add-task-btn');
const formError = document.getElementById('form-error');

const taskList = document.getElementById('task-list');
const emptyState = document.getElementById('empty-state');

const STATUSES = ['Planned', 'In Progress', 'Complete'];

function statusClass(status) {
  return 'status-' + status.toLowerCase().replace(/\s+/g, '-');
}

function showScreen(screen) {
  [loginScreen, dashboardScreen].forEach((el) => el.classList.add('hidden'));
  screen.classList.remove('hidden');
}

function showFormError(message) {
  formError.textContent = message;
  formError.classList.toggle('hidden', !message);
}

async function init() {
  try {
    const res = await fetch('/api/me');

    if (!res.ok) {
      showScreen(loginScreen);
      return;
    }

    const user = await res.json();
    userNameEl.textContent = user.name;
    showScreen(dashboardScreen);
    loadTasks();
  } catch (err) {
    showScreen(loginScreen);
  }
}

async function loadTasks() {
  const res = await fetch('/api/tasks');

  if (!res.ok) {
    showScreen(loginScreen);
    return;
  }

  const tasks = await res.json();
  renderTasks(tasks);
}

function renderTasks(tasks) {
  taskList.innerHTML = '';
  emptyState.classList.toggle('hidden', tasks.length > 0);

  tasks.forEach((task) => {
    const li = document.createElement('li');
    li.className = 'task-item';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'task-title';
    titleSpan.textContent = task.title;

    const select = document.createElement('select');
    select.className = 'task-status ' + statusClass(task.status);

    STATUSES.forEach((status) => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status;
      if (status === task.status) option.selected = true;
      select.appendChild(option);
    });

    select.addEventListener('change', () => updateStatus(task.id, select));

    li.appendChild(titleSpan);
    li.appendChild(select);
    taskList.appendChild(li);
  });
}

async function updateStatus(taskId, selectEl) {
  const status = selectEl.value;
  selectEl.disabled = true;

  try {
    const res = await fetch(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      throw new Error('Update failed');
    }

    await loadTasks();
  } catch (err) {
    showFormError('Unable to update task. Please try again.');
  } finally {
    selectEl.disabled = false;
  }
}

createTaskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = taskTitleInput.value.trim();

  if (!title) {
    showFormError('Task title is required.');
    return;
  }

  showFormError('');
  addTaskBtn.disabled = true;
  addTaskBtn.textContent = 'Adding...';

  try {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Unable to create task.');
    }

    taskTitleInput.value = '';
    await loadTasks();
  } catch (err) {
    showFormError(err.message || 'Unable to create task. Please try again.');
  } finally {
    addTaskBtn.disabled = false;
    addTaskBtn.textContent = 'Add Task';
  }
});

init();
