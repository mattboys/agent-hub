import { createAppShell } from '../shared/appShell.js';
import './styles.css';

const ACCENT = '#4f46e5';
const STORAGE_KEY = 'taskTracker-v1';
const STATES = ['backlog', 'sprint', 'in progress', 'in validation', 'done'];

const { body } = createAppShell({
  title: 'Task Tracker',
  description: 'A lightweight Jira-style board. Drag tickets across columns, track points, and keep everything local.',
  accent: ACCENT
});

// ─── Data ─────────────────────────────────────────────────────────────────
let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw);
    return {
      tickets: parsed.tickets ?? [],
      users: parsed.users?.length ? parsed.users : ['Unassigned'],
      nextId: parsed.nextId ?? 1
    };
  } catch {
    return getDefaultState();
  }
}

function getDefaultState() {
  return {
    tickets: [],
    users: ['Unassigned'],
    nextId: 1
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function isToday(d) {
  const today = new Date();
  return d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
}

function isThisFortnight(d) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 14);
  return d >= start && d <= now;
}

function getStats() {
  const done = state.tickets.filter(t => t.state === 'done');
  const today = done.filter(t => t.completedAt && isToday(new Date(t.completedAt)));
  const fortnight = done.filter(t => t.completedAt && isThisFortnight(new Date(t.completedAt)));

  const pointsToday = today.reduce((s, t) => s + (t.actualPoints ?? 0), 0);
  const pointsFortnight = fortnight.reduce((s, t) => s + (t.actualPoints ?? 0), 0);
  const plannedFortnight = fortnight.reduce((s, t) => s + (t.plannedPoints ?? 0), 0);

  return {
    pointsToday,
    pointsFortnight,
    plannedFortnight,
    actualVsPlanned: plannedFortnight > 0 ? ((pointsFortnight / plannedFortnight) * 100).toFixed(0) : 0
  };
}

// ─── UI Build ──────────────────────────────────────────────────────────────
const app = document.createElement('div');
app.className = 'task-tracker';

// Stats bar
const statsBar = document.createElement('div');
statsBar.className = 'stats-bar';
statsBar.innerHTML = `
  <div class="stat-card">
    <span class="stat-label">Points banked today</span>
    <span class="stat-value" data-stat="today">0</span>
  </div>
  <div class="stat-card">
    <span class="stat-label">Points banked this fortnight</span>
    <span class="stat-value" data-stat="fortnight">0</span>
  </div>
  <div class="stat-card">
    <span class="stat-label">Actual vs planned (fortnight)</span>
    <span class="stat-value" data-stat="ratio">—</span>
  </div>
`;

// View toggle
const viewToggle = document.createElement('div');
viewToggle.className = 'view-toggle';
viewToggle.innerHTML = `
  <button type="button" class="view-btn active" data-view="kanban">Kanban</button>
  <button type="button" class="view-btn" data-view="backlog">Backlog</button>
`;

// User management
const userSection = document.createElement('div');
userSection.className = 'user-section';
userSection.innerHTML = `
  <div class="user-form">
    <input type="text" class="user-input" placeholder="Add team member…" maxlength="32" />
    <button type="button" class="primary-btn add-user-btn">Add</button>
  </div>
  <div class="user-chips"></div>
`;

// Add ticket
const addTicketSection = document.createElement('div');
addTicketSection.className = 'add-ticket-section';
addTicketSection.innerHTML = `
  <input type="text" class="ticket-title-input" placeholder="New ticket title…" maxlength="120" />
  <select class="ticket-assignee-select"></select>
  <input type="number" class="ticket-points-input" placeholder="Points" min="0" step="0.5" title="Planned points" />
  <button type="button" class="primary-btn add-ticket-btn">Add ticket</button>
`;

// Content area
const contentArea = document.createElement('div');
contentArea.className = 'content-area';

// Kanban view
const kanbanView = document.createElement('div');
kanbanView.className = 'kanban-view';
kanbanView.hidden = false;

// Backlog view
const backlogView = document.createElement('div');
backlogView.className = 'backlog-view';
backlogView.hidden = true;

contentArea.append(kanbanView, backlogView);
app.append(statsBar, viewToggle, userSection, addTicketSection, contentArea);
body.appendChild(app);

// ─── Modal for Actual Points ───────────────────────────────────────────────
let pendingDoneTicketId = null;

function showActualPointsModal(ticket) {
  pendingDoneTicketId = ticket.id;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>Complete ticket</h3>
      <p class="modal-ticket-title">${escapeHtml(ticket.title)}</p>
      <p class="modal-hint">Enter actual points delivered (planned: ${ticket.plannedPoints ?? 0})</p>
      <input type="number" class="modal-input" placeholder="Actual points" min="0" step="0.5" value="${ticket.plannedPoints ?? ''}" />
      <div class="modal-actions">
        <button type="button" class="secondary-btn cancel-modal-btn">Cancel</button>
        <button type="button" class="primary-btn confirm-modal-btn">Complete</button>
      </div>
    </div>
  `;

  const input = overlay.querySelector('.modal-input');
  const cancel = overlay.querySelector('.cancel-modal-btn');
  const confirm = overlay.querySelector('.confirm-modal-btn');

  const close = () => {
    overlay.remove();
    pendingDoneTicketId = null;
  };

  cancel.addEventListener('click', close);
  confirm.addEventListener('click', () => {
    const val = parseFloat(input.value);
    const actual = Number.isFinite(val) && val >= 0 ? val : (ticket.plannedPoints ?? 0);
    moveTicketToDone(ticket.id, actual);
    close();
  });

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => input.focus());
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function moveTicketToDone(id, actualPoints) {
  const t = state.tickets.find(x => x.id === id);
  if (!t) return;
  t.state = 'done';
  t.actualPoints = actualPoints;
  t.completedAt = new Date().toISOString();
  saveState();
  render();
}

// ─── Ticket movement ───────────────────────────────────────────────────────
function moveTicket(id, newState, newAssignee = null) {
  const t = state.tickets.find(x => x.id === id);
  if (!t) return;

  if (newState === 'done') {
    showActualPointsModal(t);
    return;
  }

  t.state = newState;
  if (newAssignee !== null) t.assignee = newAssignee;
  if (t.state !== 'done') {
    t.actualPoints = null;
    t.completedAt = null;
  }
  saveState();
  render();
}

// ─── Render ───────────────────────────────────────────────────────────────
function renderStats() {
  const s = getStats();
  statsBar.querySelector('[data-stat="today"]').textContent = s.pointsToday;
  statsBar.querySelector('[data-stat="fortnight"]').textContent = s.pointsFortnight;
  const ratioEl = statsBar.querySelector('[data-stat="ratio"]');
  if (s.plannedFortnight > 0) {
    ratioEl.textContent = `${s.actualVsPlanned}%`;
    ratioEl.dataset.over = s.pointsFortnight >= s.plannedFortnight ? 'yes' : 'no';
  } else {
    ratioEl.textContent = '—';
    ratioEl.dataset.over = '';
  }
}

function renderUserChips() {
  const chips = userSection.querySelector('.user-chips');
  chips.innerHTML = '';
  state.users.forEach(u => {
    if (u === 'Unassigned') return;
    const chip = document.createElement('span');
    chip.className = 'user-chip';
    chip.textContent = u;
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'chip-remove';
    rm.setAttribute('aria-label', `Remove ${u}`);
    rm.textContent = '×';
    rm.addEventListener('click', () => {
      state.users = state.users.filter(x => x !== u);
      state.tickets.forEach(t => { if (t.assignee === u) t.assignee = 'Unassigned'; });
      saveState();
      render();
    });
    chip.appendChild(rm);
    chips.appendChild(chip);
  });
}

function renderAddTicketForm() {
  const assigneeSelect = addTicketSection.querySelector('.ticket-assignee-select');
  assigneeSelect.innerHTML = state.users.map(u => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join('');
}

function renderKanban() {
  kanbanView.innerHTML = '';

  const byUser = new Map();
  state.users.forEach(u => byUser.set(u, []));
  state.tickets.forEach(t => {
    const assignee = t.assignee || 'Unassigned';
    if (!byUser.has(assignee)) byUser.set(assignee, []);
    byUser.get(assignee).push(t);
  });

  const columns = ['backlog', 'sprint', 'in progress', 'in validation', 'done'];

  byUser.forEach((tickets, user) => {
    const userCol = document.createElement('div');
    userCol.className = 'kanban-user-column';
    userCol.dataset.user = user;
    userCol.innerHTML = `<h4 class="kanban-user-header">${escapeHtml(user)}</h4>`;

    columns.forEach(colState => {
      const col = document.createElement('div');
      col.className = 'kanban-column';
      col.dataset.state = colState;
      col.dataset.user = user;

      const header = document.createElement('div');
      header.className = 'kanban-column-header';
      header.textContent = colState.charAt(0).toUpperCase() + colState.slice(1);
      col.appendChild(header);

      const dropZone = document.createElement('div');
      dropZone.className = 'kanban-drop-zone';
      dropZone.dataset.state = colState;
      dropZone.dataset.user = user;

      const colTickets = tickets.filter(t => t.state === colState);
      colTickets.forEach(t => dropZone.appendChild(createTicketCard(t, true)));

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        if (id) moveTicket(parseInt(id, 10), colState, user);
      });

      col.appendChild(dropZone);
      userCol.appendChild(col);
    });

    kanbanView.appendChild(userCol);
  });
}

function createTicketCard(ticket, draggable = false) {
  const card = document.createElement('div');
  card.className = 'ticket-card';
  card.draggable = draggable;
  card.dataset.id = ticket.id;

  const pts = ticket.state === 'done'
    ? (ticket.actualPoints != null ? `✓ ${ticket.actualPoints}` : '—')
    : (ticket.plannedPoints != null ? ticket.plannedPoints : '—');

  card.innerHTML = `
    <span class="ticket-id">#${ticket.id}</span>
    <span class="ticket-points">${pts} pts</span>
    <span class="ticket-title">${escapeHtml(ticket.title)}</span>
    <span class="ticket-meta">${escapeHtml(ticket.assignee || 'Unassigned')}</span>
  `;

  if (draggable) {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', String(ticket.id));
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  }

  card.addEventListener('dblclick', () => {
    const newTitle = prompt('Edit title:', ticket.title);
    if (newTitle != null && newTitle.trim()) {
      ticket.title = newTitle.trim();
      saveState();
      render();
    }
  });

  return card;
}

function renderBacklog() {
  backlogView.innerHTML = '';
  const backlog = state.tickets.filter(t => t.state === 'backlog');

  if (!backlog.length) {
    backlogView.innerHTML = '<p class="backlog-empty">No tickets in backlog.</p>';
    return;
  }

  const list = document.createElement('div');
  list.className = 'backlog-list';

  backlog.forEach(t => {
    const row = document.createElement('div');
    row.className = 'backlog-row';
    row.appendChild(createTicketCard(t, false));

    const assignSelect = document.createElement('select');
    assignSelect.className = 'backlog-assign';
    state.users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      if (t.assignee === u) opt.selected = true;
      assignSelect.appendChild(opt);
    });
    assignSelect.addEventListener('change', () => {
      t.assignee = assignSelect.value;
      saveState();
      render();
    });

    const toSprintBtn = document.createElement('button');
    toSprintBtn.type = 'button';
    toSprintBtn.className = 'secondary-btn small';
    toSprintBtn.textContent = 'To Sprint';
    toSprintBtn.addEventListener('click', () => moveTicket(t.id, 'sprint'));

    const rmBtn = document.createElement('button');
    rmBtn.type = 'button';
    rmBtn.className = 'danger-btn small';
    rmBtn.textContent = 'Remove';
    rmBtn.addEventListener('click', () => {
      state.tickets = state.tickets.filter(x => x.id !== t.id);
      saveState();
      render();
    });

    row.append(assignSelect, toSprintBtn, rmBtn);
    list.appendChild(row);
  });

  backlogView.appendChild(list);
}

function render() {
  renderStats();
  renderUserChips();
  renderAddTicketForm();
  renderKanban();
  renderBacklog();
}

// ─── Event handlers ───────────────────────────────────────────────────────
userSection.querySelector('.add-user-btn').addEventListener('click', () => {
  const input = userSection.querySelector('.user-input');
  const name = input.value.trim();
  if (!name || state.users.includes(name)) return;
  state.users.push(name);
  input.value = '';
  saveState();
  render();
});

userSection.querySelector('.user-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') userSection.querySelector('.add-user-btn').click();
});

addTicketSection.querySelector('.add-ticket-btn').addEventListener('click', () => {
  const titleInput = addTicketSection.querySelector('.ticket-title-input');
  const assignSelect = addTicketSection.querySelector('.ticket-assignee-select');
  const pointsInput = addTicketSection.querySelector('.ticket-points-input');
  const title = titleInput.value.trim();
  if (!title) return;
  const ticket = {
    id: state.nextId++,
    title,
    state: 'backlog',
    assignee: assignSelect.value,
    plannedPoints: parseFloat(pointsInput.value) || 0,
    actualPoints: null,
    completedAt: null
  };
  state.tickets.push(ticket);
  titleInput.value = '';
  pointsInput.value = '';
  saveState();
  render();
});

addTicketSection.querySelector('.ticket-title-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addTicketSection.querySelector('.add-ticket-btn').click();
});

viewToggle.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    viewToggle.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    kanbanView.hidden = view !== 'kanban';
    backlogView.hidden = view !== 'backlog';
  });
});

render();
