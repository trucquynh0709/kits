// Tầng giao diện: đọc form, gọi logic trong scheduler.js, render danh sách.
import {
  STATUS,
  NOTE_MAX,
  toMs,
  fromMs,
  createAppointment,
  changeStatus,
  deleteAppointment,
  groupByDate,
} from './scheduler.js';
import { loadAppointments, saveAppointments } from './storage.js';
import { guestUser, loadSession, saveSession, renderGoogleButton, signOutGoogle } from './auth.js';
import { GOOGLE_CLIENT_ID } from './config.js';
import { monthGrid, countByDate } from './calendar.js';
import { icon, hydrateIcons } from './icons.js';

hydrateIcons();

const $ = (sel) => document.querySelector(sel);
const form = $('#appt-form');
const fields = {
  title: $('#f-title'),
  date: $('#f-date'),
  start: $('#f-start'),
  end: $('#f-end'),
  note: $('#f-note'),
};
const conflictBox = $('#conflict-box');
const listEl = $('#list');
const filterDate = $('#filter-date');
const filterCancelled = $('#filter-cancelled');

let user = null;
let appointments = [];
let highlightIds = new Set();

// ---------- tiện ích hiển thị ----------
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of children) if (child != null) node.append(child);
  return node;
}

const hhmm = (local) => local.slice(11, 16);
const todayStr = () => fromMs(Date.now()).slice(0, 10);

function formatDay(date) {
  const [y, m, d] = date.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Lịch kết thúc ở ngày khác thì hiển thị kèm ngày, vd "23:00 – 01:00 (+1)".
function formatRange(a) {
  const sameDay = a.start.slice(0, 10) === a.end.slice(0, 10);
  return `${hhmm(a.start)} – ${hhmm(a.end)}${sameDay ? '' : ' (+1)'}`;
}

let toastTimer;
function toast(message, isError = false) {
  const t = $('#toast');
  t.replaceChildren(icon(isError ? 'circle-alert' : 'circle-check'), el('span', { textContent: message }));
  t.className = isError ? 'toast error' : 'toast';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3500);
}

function persist(next) {
  appointments = next;
  if (!saveAppointments(user.id, appointments)) toast('Không lưu được vào trình duyệt (bộ nhớ đầy hoặc bị chặn).', true);
  render();
}

// ---------- form ----------
function setDefaultTimes() {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(Math.ceil((now.getMinutes() + 1) / 30) * 30, 0, 0);
  const start = fromMs(next.getTime());
  const end = fromMs(next.getTime() + 30 * 60 * 1000);
  fields.date.value = start.slice(0, 10);
  fields.start.value = hhmm(start);
  fields.end.value = start.slice(0, 10) === end.slice(0, 10) ? hhmm(end) : '23:59';
}

function readForm() {
  const date = fields.date.value;
  return {
    title: fields.title.value,
    start: date && fields.start.value ? `${date}T${fields.start.value}` : '',
    end: date && fields.end.value ? `${date}T${fields.end.value}` : '',
    note: fields.note.value,
  };
}

function showErrors(errors = {}) {
  for (const small of form.querySelectorAll('.error')) small.textContent = errors[small.dataset.for] ?? '';
  fields.title.setAttribute('aria-invalid', String(!!errors.title));
  fields.date.setAttribute('aria-invalid', String(!!errors.start));
  fields.start.setAttribute('aria-invalid', String(!!errors.start));
  fields.end.setAttribute('aria-invalid', String(!!errors.end));
  fields.note.setAttribute('aria-invalid', String(!!errors.note));
}

function showConflicts(conflicts = [], suggestion = null) {
  conflictBox.replaceChildren();
  conflictBox.hidden = conflicts.length === 0;
  if (conflicts.length === 0) return;

  conflictBox.append(
    el('strong', {}, icon('triangle-alert', { size: 16 }), `Trùng giờ với ${conflicts.length} lịch hẹn:`),
    el('ul', {}, ...conflicts.map((c) => el('li', { textContent: `${formatRange(c)} · ${c.title}` }))),
  );

  if (suggestion) {
    const sameDay = suggestion.start.slice(0, 10) === suggestion.end.slice(0, 10);
    if (sameDay) {
      const btn = el(
        'button',
        { type: 'button', className: 'btn small' },
        icon('clock', { size: 15 }),
        `Dùng giờ trống gần nhất: ${formatRange(suggestion)}`,
      );
      btn.addEventListener('click', () => {
        fields.date.value = suggestion.start.slice(0, 10);
        fields.start.value = hhmm(suggestion.start);
        fields.end.value = hhmm(suggestion.end);
        showErrors();
        showConflicts();
        fields.title.focus();
      });
      conflictBox.append(btn);
    } else {
      conflictBox.append(el('div', { textContent: 'Không còn khung trống cùng độ dài trong ngày này.' }));
    }
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const result = createAppointment(readForm(), appointments);

  if (!result.ok) {
    showErrors(result.errors);
    showConflicts(result.conflicts, result.suggestion);
    highlightIds = new Set(result.conflicts.map((c) => c.id));
    render();
    return;
  }

  showErrors();
  showConflicts();
  highlightIds = new Set();
  fields.title.value = '';
  fields.note.value = '';
  updateNoteCount();
  filterDate.value = result.appointment.start.slice(0, 10);
  persist(result.appointments);
  toast(`Đã lưu "${result.appointment.title}" lúc ${formatRange(result.appointment)}.`);
});

function updateNoteCount() {
  $('#note-count').textContent = fields.note.value.length;
  $('#note-count').parentElement.style.color = fields.note.value.length > NOTE_MAX ? 'var(--cancel)' : '';
}
fields.note.addEventListener('input', updateNoteCount);

// ---------- danh sách ----------
function actionButton(label, className, iconName, onClick) {
  const b = el('button', { type: 'button', className: `btn small ${className}` }, icon(iconName, { size: 15 }), label);
  b.addEventListener('click', onClick);
  return b;
}

function updateStatus(id, next, okMessage) {
  const r = changeStatus(appointments, id, next);
  if (!r.ok) {
    highlightIds = new Set((r.conflicts ?? []).map((c) => c.id));
    render();
    const detail = r.conflicts?.length ? ` (${r.conflicts.map((c) => `${formatRange(c)} ${c.title}`).join('; ')})` : '';
    toast(r.error + detail, true);
    return;
  }
  highlightIds = new Set();
  persist(r.appointments);
  toast(okMessage);
}

function renderItem(a) {
  const badge =
    a.status === STATUS.DONE
      ? el('span', { className: 'badge done', textContent: 'Đã xong' })
      : a.status === STATUS.CANCELLED
        ? el('span', { className: 'badge cancelled', textContent: 'Đã hủy' })
        : null;

  const actions = el('div', { className: 'actions' });
  if (a.status === STATUS.SCHEDULED) {
    actions.append(
      actionButton('Xong', 'done', 'check', () => updateStatus(a.id, STATUS.DONE, 'Đã đánh dấu hoàn thành.')),
      actionButton('Hủy', 'danger', 'x', () => updateStatus(a.id, STATUS.CANCELLED, 'Đã hủy lịch hẹn, khung giờ được giải phóng.')),
    );
  } else {
    const label = a.status === STATUS.DONE ? 'Bỏ đánh dấu' : 'Khôi phục';
    actions.append(actionButton(label, '', 'rotate-ccw', () => updateStatus(a.id, STATUS.SCHEDULED, 'Đã khôi phục lịch hẹn.')));
  }
  actions.append(
    actionButton('Xóa', 'danger', 'trash', () => {
      if (confirm(`Xóa vĩnh viễn "${a.title}"?`)) {
        persist(deleteAppointment(appointments, a.id));
        toast('Đã xóa lịch hẹn.');
      }
    }),
  );

  return el(
    'article',
    { className: `item is-${a.status}${highlightIds.has(a.id) ? ' highlight' : ''}` },
    el('div', { className: 'time', textContent: formatRange(a) }),
    el(
      'div',
      {},
      el('div', { className: 'title' }, a.title, badge),
      a.note ? el('div', { className: 'note', textContent: a.note }) : null,
    ),
    actions,
  );
}

function render() {
  const scheduled = appointments.filter((a) => a.status === STATUS.SCHEDULED);
  const upcoming = scheduled.filter((a) => toMs(a.end) > Date.now()).length;
  const done = appointments.filter((a) => a.status === STATUS.DONE).length;
  const cancelled = appointments.filter((a) => a.status === STATUS.CANCELLED).length;
  renderCalendar();
  $('#list-sub').textContent = filterDate.value ? formatDay(filterDate.value) : 'Tất cả các ngày';
  $('#btn-today').classList.toggle('on', filterDate.value === todayStr());
  $('#btn-all').classList.toggle('on', !filterDate.value);
  $('#stats').replaceChildren(
    el('span', { className: 'chip up', textContent: `${upcoming} sắp tới` }),
    el('span', { className: 'chip ok', textContent: `${done} đã xong` }),
    el('span', { className: 'chip no', textContent: `${cancelled} đã hủy` }),
  );

  const visible = appointments.filter(
    (a) =>
      (filterCancelled.checked || a.status !== STATUS.CANCELLED) &&
      (!filterDate.value || a.start.startsWith(filterDate.value)),
  );

  const groups = groupByDate(visible);
  if (groups.length === 0) {
    const msg = filterDate.value
      ? `Không có lịch hẹn nào vào ${formatDay(filterDate.value)}.`
      : 'Chưa có lịch hẹn nào. Hãy tạo lịch đầu tiên ở form bên trái.';
    listEl.replaceChildren(el('div', { className: 'empty' }, icon('calendar-days', { size: 36 }), el('p', { textContent: msg })));
    return;
  }

  const today = todayStr();
  listEl.replaceChildren(
    ...groups.map(({ date, items }) =>
      el(
        'section',
        { className: 'day' },
        el(
          'h3',
          {},
          formatDay(date),
          date === today ? el('span', { className: 'tag', textContent: 'Hôm nay' }) : null,
        ),
        ...items.map(renderItem),
      ),
    ),
  );
}

// ---------- lịch tháng ----------
const now0 = new Date();
let calMonth = { y: now0.getFullYear(), m: now0.getMonth() };
let lastFilter = '';

function renderCalendar() {
  // Khi bộ lọc ngày đổi (bấm Hôm nay, vừa lưu lịch…) thì lịch nhảy tới tháng của ngày đó.
  if (filterDate.value && filterDate.value !== lastFilter) {
    const [y, m] = filterDate.value.split('-').map(Number);
    calMonth = { y, m: m - 1 };
  }
  lastFilter = filterDate.value;

  $('#cal-label').textContent = `Tháng ${calMonth.m + 1}, ${calMonth.y}`;
  const counts = countByDate(appointments);
  const today = todayStr();
  $('#cal-days').replaceChildren(
    ...monthGrid(calMonth.y, calMonth.m).map((c) => {
      const n = counts.get(c.date) ?? 0;
      const cls = ['cal-day'];
      if (!c.inMonth) cls.push('out');
      else if (c.weekday === 7) cls.push('sun');
      if (c.date === today) cls.push('today');
      if (c.date === filterDate.value) cls.push('selected');
      const btn = el(
        'button',
        {
          type: 'button',
          className: cls.join(' '),
          textContent: String(c.day).padStart(2, '0'),
          title: n ? `${n} lịch hẹn` : '',
        },
        n ? el('span', { className: 'dot' }) : null,
      );
      btn.dataset.date = c.date;
      btn.setAttribute('aria-label', `${formatDay(c.date)}${n ? `, ${n} lịch hẹn` : ''}`);
      btn.setAttribute('aria-pressed', String(c.date === filterDate.value));
      btn.addEventListener('click', () => {
        const same = filterDate.value === c.date;
        filterDate.value = same ? '' : c.date;
        // Chọn ngày chưa qua thì điền sẵn vào form để tạo lịch nhanh
        if (!same && c.date >= today) fields.date.value = c.date;
        render();
      });
      return btn;
    }),
  );
}

const shiftMonth = (delta) => {
  const d = new Date(calMonth.y, calMonth.m + delta, 1);
  calMonth = { y: d.getFullYear(), m: d.getMonth() };
  renderCalendar();
};
$('#cal-prev').addEventListener('click', () => shiftMonth(-1));
$('#cal-next').addEventListener('click', () => shiftMonth(1));

const dayNum = String(now0.getDate()).padStart(2, '0');
$('#logo-day').textContent = dayNum;
$('#login-day').textContent = dayNum;

filterCancelled.addEventListener('change', render);
$('#btn-today').addEventListener('click', () => {
  filterDate.value = todayStr();
  render();
});
$('#btn-all').addEventListener('click', () => {
  filterDate.value = '';
  render();
});

// Dữ liệu mẫu cho demo: đi qua createAppointment như người dùng thật, nên lịch trùng tự bị loại.
$('#btn-seed').addEventListener('click', () => {
  const base = new Date();
  base.setDate(base.getDate() + 1);
  const day = fromMs(base.getTime()).slice(0, 10);
  const samples = [
    ['Họp nhóm đồ án', '09:00', '10:00', 'Phòng 302, mang laptop'],
    ['Khám răng định kỳ', '10:30', '11:00', 'Nha khoa Minh An'],
    ['Ăn trưa với Lan', '12:00', '13:00', ''],
    ['Gọi điện tư vấn bảo hiểm', '15:00', '15:30', ''],
  ];
  let next = appointments;
  let added = 0;
  for (const [title, s, e, note] of samples) {
    const r = createAppointment({ title, start: `${day}T${s}`, end: `${day}T${e}`, note }, next);
    if (r.ok) {
      next = r.appointments;
      added++;
    }
  }
  filterDate.value = day;
  persist(next);
  toast(added ? `Đã thêm ${added} lịch mẫu vào ngày mai.` : 'Lịch mẫu đã có sẵn (trùng giờ nên không thêm lại).');
});

// ---------- đăng nhập ----------
function showApp(nextUser) {
  user = nextUser;
  saveSession(user);
  appointments = loadAppointments(user.id);
  highlightIds = new Set();
  form.reset();
  showErrors();
  showConflicts();
  updateNoteCount();
  setDefaultTimes();
  filterDate.value = '';

  $('#user-name').textContent = user.guest ? 'Khách (chưa đăng nhập)' : user.name;
  $('#user-name').title = user.email;
  const avatar = $('#user-avatar');
  avatar.hidden = !user.picture;
  if (user.picture) avatar.src = user.picture;
  $('#user-initial').hidden = !!user.picture;
  if (user.guest) $('#user-initial').replaceChildren(icon('user', { size: 16 }));
  else $('#user-initial').textContent = user.name.trim().charAt(0).toUpperCase();
  $('#user-chip').hidden = false;
  $('#login-view').hidden = true;
  $('#app-view').hidden = false;
  render();
}

function showLogin() {
  user = null;
  appointments = [];
  $('#user-chip').hidden = true;
  $('#app-view').hidden = true;
  $('#login-view').hidden = false;
  $('#login-error').textContent = '';
}

$('#btn-guest').addEventListener('click', () => showApp(guestUser()));
$('#btn-logout').addEventListener('click', () => {
  signOutGoogle();
  saveSession(null);
  showLogin();
});

if (GOOGLE_CLIENT_ID) {
  renderGoogleButton($('#google-btn'), {
    clientId: GOOGLE_CLIENT_ID,
    onLogin: (u) => {
      showApp(u);
      toast(`Xin chào ${u.name}!`);
    },
    onError: (msg) => ($('#login-error').textContent = msg),
  });
} else {
  // Chưa có Client ID: chỉ hiện chế độ khách, không làm người dùng bối rối bằng thông báo cấu hình.
  $('#google-btn').hidden = true;
  $('#login-divider').hidden = true;
  console.info('[Lịch Hẹn Mini] Chưa đặt GOOGLE_CLIENT_ID trong src/config.js → nút Đăng nhập Google bị ẩn.');
}

const session = loadSession();
if (session) showApp(session);
else showLogin();
