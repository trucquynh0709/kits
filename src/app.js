// Tầng giao diện: đọc form, gọi logic trong scheduler.js, render danh sách.
import {
  STATUS,
  NOTE_MAX,
  toMs,
  fromMs,
  createAppointment,
  suggestFreeSlot,
  changeStatus,
  deleteAppointment,
  groupByDate,
} from './scheduler.js';
import { loadAppointments, saveAppointments } from './storage.js';
import { guestUser, loadSession, saveSession, renderGoogleButton, signOutGoogle } from './auth.js';
import { GOOGLE_CLIENT_ID } from './config.js';
import { monthGrid, countByDate, relativeDay } from './calendar.js';
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
const dialog = $('#appt-dialog');
const listEl = $('#list');
const filterDate = $('#filter-date');

let user = null;
let appointments = [];
let highlightIds = new Set();
// Lọc theo trạng thái khi bấm badge thống kê: null | 'upcoming' | 'done' | 'cancelled'
let statusFilter = null;

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

// ---------- form (popup) ----------
const SLOT_MIN = 30;

// Giờ mặc định = khung trống 30 phút đầu tiên của ngày: hôm nay thì tính từ nửa giờ kế tiếp,
// ngày khác thì từ 09:00. Người dùng mở popup là thấy ngay một giờ đặt được.
function setSmartTimes(date) {
  let start;
  if (date === todayStr()) {
    const next = new Date();
    next.setMinutes(Math.ceil((next.getMinutes() + 1) / 30) * 30, 0, 0);
    start = next.getTime();
  } else {
    start = toMs(`${date}T09:00`);
  }
  const candidate = { start: fromMs(start), end: fromMs(start + SLOT_MIN * 60 * 1000) };
  const slot = suggestFreeSlot(candidate, appointments) ?? candidate;
  const fits = slot.start.slice(0, 10) === date && slot.end.slice(0, 10) === date;
  const chosen = fits ? slot : candidate.end.slice(0, 10) === date ? candidate : null;
  fields.date.value = date;
  fields.start.value = chosen ? hhmm(chosen.start) : '23:00';
  fields.end.value = chosen ? hhmm(chosen.end) : '23:30';
}

function openForm(date) {
  const today = todayStr();
  const day = date && date >= today ? date : today;
  form.reset();
  showErrors();
  showConflicts();
  updateNoteCount();
  setSmartTimes(day);
  $('#form-sub').textContent = formatDay(day);
  if (!dialog.open) dialog.showModal();
  fields.title.focus();
}

function closeForm() {
  if (dialog.open) dialog.close();
}

dialog.addEventListener('close', () => {
  if (highlightIds.size) {
    highlightIds = new Set();
    render();
  }
});
// Bấm ra vùng tối bên ngoài popup thì đóng
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) closeForm();
});
$('#btn-close').addEventListener('click', closeForm);
$('#btn-cancel').addEventListener('click', closeForm);
$('#btn-new').addEventListener('click', () => openForm(filterDate.value));
$('#btn-add-day').addEventListener('click', () => openForm(filterDate.value));
fields.date.addEventListener('change', () => {
  if (fields.date.value) $('#form-sub').textContent = formatDay(fields.date.value);
});

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

  highlightIds = new Set();
  closeForm();
  statusFilter = null;
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
  const b = el('button', { type: 'button', className: `btn ${className}`.trim() }, label);
  b.addEventListener('click', onClick);
  return b;
}

const conflictText = (r) =>
  r.conflicts?.length ? ` (${r.conflicts.map((c) => `${formatRange(c)} ${c.title}`).join('; ')})` : '';

// Đổi trạng thái; báo lỗi bằng toast, hoặc bằng onError khi gọi từ popup (toast bị popup che).
function updateStatus(id, next, okMessage, { onError } = {}) {
  const r = changeStatus(appointments, id, next);
  if (!r.ok) {
    highlightIds = new Set((r.conflicts ?? []).map((c) => c.id));
    render();
    if (onError) onError(r.error + conflictText(r));
    else toast(r.error + conflictText(r), true);
    return false;
  }
  highlightIds = new Set();
  persist(r.appointments);
  toast(okMessage);
  return true;
}

// Popup xác nhận riêng thay cho confirm() của trình duyệt ("localhost says…").
const confirmDialogEl = $('#confirm-dialog');
function askConfirm({ title, message, ok = 'Xóa' }) {
  return new Promise((resolve) => {
    $('#confirm-title').textContent = title;
    $('#confirm-message').textContent = message;
    $('#confirm-ok').textContent = ok;
    const finish = (value) => {
      confirmDialogEl.removeEventListener('close', onClose);
      if (confirmDialogEl.open) confirmDialogEl.close();
      resolve(value);
    };
    const onClose = () => finish(false); // Esc
    confirmDialogEl.addEventListener('close', onClose);
    $('#confirm-ok').onclick = () => finish(true);
    $('#confirm-cancel').onclick = () => finish(false);
    confirmDialogEl.onclick = (e) => e.target === confirmDialogEl && finish(false);
    confirmDialogEl.showModal();
    $('#confirm-cancel').focus();
  });
}

async function confirmDelete(a) {
  const ok = await askConfirm({
    title: 'Xóa lịch hẹn?',
    message: `"${a.title}" (${formatRange(a)}) sẽ bị xóa vĩnh viễn, không khôi phục được.`,
  });
  if (!ok) return false;
  persist(deleteAppointment(appointments, a.id));
  toast('Đã xóa lịch hẹn.');
  return true;
}

// Các nút thao tác theo trạng thái, hiển thị trong popup chi tiết.
function statusActions(a, opts = {}) {
  const after = opts.after ?? (() => {});
  const run = (next, msg) => () => updateStatus(a.id, next, msg, opts) && after();
  const buttons =
    a.status === STATUS.SCHEDULED
      ? [
          actionButton('Xong', 'done primary', 'check', run(STATUS.DONE, 'Đã đánh dấu hoàn thành.')),
          actionButton('Hủy', 'danger', 'x', run(STATUS.CANCELLED, 'Đã hủy lịch hẹn, khung giờ được giải phóng.')),
        ]
      : [
          actionButton(
            a.status === STATUS.DONE ? 'Bỏ đánh dấu' : 'Khôi phục',
            '',
            'rotate-ccw',
            run(STATUS.SCHEDULED, 'Đã khôi phục lịch hẹn.'),
          ),
        ];
  buttons.push(actionButton('Xóa', 'danger delete', 'trash', async () => (await confirmDelete(a)) && opts.onDeleted?.()));
  return buttons;
}

function itemState(a) {
  if (a.status === STATUS.DONE) return el('span', { className: 'state done' }, icon('check', { size: 14 }), 'Đã xong');
  if (a.status === STATUS.CANCELLED) return el('span', { className: 'state cancelled', textContent: 'Đã hủy' });
  if (toMs(a.end) <= Date.now()) return el('span', { className: 'state', textContent: 'Đã qua' });
  return el('span', { className: 'state' });
}

function quickButton(iconName, cls, label, onClick) {
  const b = el('button', { type: 'button', className: `icon-btn quick ${cls}`, title: label }, icon(iconName, { size: 16 }));
  b.setAttribute('aria-label', label);
  b.addEventListener('click', onClick);
  return b;
}

// Dòng lịch: giờ + tiêu đề + trạng thái (bấm để xem chi tiết) | nút nhanh hiện khi rê chuột.
function renderItem(a) {
  const open = el(
    'button',
    { type: 'button', className: 'item-open', title: 'Xem chi tiết' },
    el('span', { className: 'time', textContent: formatRange(a) }),
    el(
      'span',
      { className: 'item-body' },
      el('span', { className: 'title', textContent: a.title }),
      a.note ? el('span', { className: 'note', textContent: a.note }) : null,
    ),
    itemState(a),
  );
  open.addEventListener('click', () => openDetail(a.id));

  const quick = el('div', { className: 'quick-actions' });
  if (a.status === STATUS.SCHEDULED) {
    quick.append(
      quickButton('check', 'quick-done', `Đánh dấu đã xong "${a.title}"`, () =>
        updateStatus(a.id, STATUS.DONE, 'Đã đánh dấu hoàn thành.'),
      ),
    );
  } else if (a.status === STATUS.DONE) {
    quick.append(
      quickButton('rotate-ccw', 'quick-done', `Bỏ đánh dấu xong "${a.title}"`, () =>
        updateStatus(a.id, STATUS.SCHEDULED, 'Đã bỏ đánh dấu xong.'),
      ),
    );
  }
  quick.append(quickButton('trash', 'trash', `Xóa "${a.title}"`, () => confirmDelete(a)));

  return el(
    'div',
    { className: `item is-${a.status}${highlightIds.has(a.id) ? ' highlight' : ''}` },
    open,
    quick,
  );
}

// ---------- popup chi tiết ----------
const detailDialog = $('#detail-dialog');
let detailId = null;

function formatDuration(a) {
  const min = Math.round((toMs(a.end) - toMs(a.start)) / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} giờ` : '', m ? `${m} phút` : ''].filter(Boolean).join(' ');
}

function statusInfo(a) {
  if (a.status === STATUS.DONE) return { text: 'Đã xong', tone: 'ok' };
  if (a.status === STATUS.CANCELLED) return { text: 'Đã hủy', tone: 'no' };
  if (toMs(a.end) <= Date.now()) return { text: 'Đã qua, chưa đánh dấu xong', tone: 'past' };
  if (toMs(a.start) <= Date.now()) return { text: 'Đang diễn ra', tone: 'up' };
  return { text: 'Sắp tới', tone: 'up' };
}

function detailRow(iconName, main, sub) {
  return el(
    'li',
    {},
    el('span', { className: 'd-ic' }, icon(iconName, { size: 18 })),
    el('span', { className: 'd-text' }, el('span', { textContent: main }), sub ? el('small', { textContent: sub }) : null),
  );
}

function openDetail(id) {
  detailId = id;
  $('#detail-error').hidden = true;
  renderDetail();
  if (!detailDialog.open) detailDialog.showModal();
}

function renderDetail() {
  const a = appointments.find((x) => x.id === detailId);
  if (!a) {
    if (detailDialog.open) detailDialog.close();
    return;
  }
  const day = a.start.slice(0, 10);
  const st = statusInfo(a);
  $('#detail-status').textContent = st.text;
  $('#detail-status').className = `status ${st.tone}`;
  $('#detail-title').textContent = a.title;
  $('#detail-title').classList.toggle('struck', a.status !== STATUS.SCHEDULED);

  const rows = [
    detailRow('calendar-days', formatDay(day), relativeDay(day, todayStr())),
    detailRow('clock', formatRange(a), formatDuration(a)),
    detailRow('file-text', a.note || 'Không có ghi chú', a.note ? 'Ghi chú' : ''),
  ];
  if (a.createdAt) {
    const c = fromMs(a.createdAt);
    const meta = detailRow('history', `Tạo lúc ${hhmm(c)} ngày ${c.slice(8, 10)}/${c.slice(5, 7)}/${c.slice(0, 4)}`);
    meta.classList.add('meta');
    rows.push(meta);
  }
  $('#detail-rows').replaceChildren(...rows);

  $('#detail-actions').replaceChildren(
    ...statusActions(a, {
      after: () => {
        $('#detail-error').hidden = true;
        renderDetail();
      },
      onError: (msg) => {
        const box = $('#detail-error');
        box.replaceChildren(el('strong', {}, icon('triangle-alert', { size: 16 }), msg));
        box.hidden = false;
      },
      onDeleted: () => detailDialog.close(),
    }),
  );
}

detailDialog.addEventListener('click', (e) => {
  if (e.target === detailDialog) detailDialog.close();
});
$('#detail-close').addEventListener('click', () => detailDialog.close());
detailDialog.addEventListener('close', () => {
  detailId = null;
  if (highlightIds.size) {
    highlightIds = new Set();
    render();
  }
});

function render() {
  const scheduled = appointments.filter((a) => a.status === STATUS.SCHEDULED);
  const upcoming = scheduled.filter((a) => toMs(a.end) > Date.now()).length;
  const done = appointments.filter((a) => a.status === STATUS.DONE).length;
  const cancelled = appointments.filter((a) => a.status === STATUS.CANCELLED).length;
  renderCalendar();
  const today0 = todayStr();
  const isToday = !statusFilter && filterDate.value === today0;
  $('#btn-today').classList.toggle('on', isToday);
  $('#btn-all').classList.toggle('on', !statusFilter && !filterDate.value);
  const counts = { upcoming, done, cancelled };
  for (const tab of document.querySelectorAll('.tab[data-filter]')) {
    tab.classList.toggle('on', statusFilter === tab.dataset.filter);
    tab.querySelector('.n').textContent = counts[tab.dataset.filter] || '';
  }
  // Đang xem một ngày khác hôm nay (chọn trên lịch) thì ghi rõ ngày + cách bỏ chọn
  const showContext = !statusFilter && filterDate.value && !isToday;
  $('#list-context').hidden = !showContext;
  if (showContext) $('#list-sub').textContent = formatDay(filterDate.value);

  const visible = appointments.filter((a) =>
    statusFilter
      ? STATUS_FILTERS[statusFilter].match(a)
      : a.status !== STATUS.CANCELLED && (!filterDate.value || a.start.startsWith(filterDate.value)),
  );

  // Lịch sử (đã xong / đã hủy) xem mới nhất trước; còn lại xem theo thời gian tới.
  const groups = groupByDate(visible, { newestFirst: statusFilter === 'done' || statusFilter === 'cancelled' });
  const today = todayStr();
  if (groups.length === 0) {
    const msg = statusFilter
      ? `Không có lịch hẹn nào ${STATUS_FILTERS[statusFilter].label}.`
      : filterDate.value
        ? `Không có lịch hẹn nào vào ${formatDay(filterDate.value)}.`
        : 'Chưa có lịch hẹn nào. Hãy tạo lịch hẹn đầu tiên.';
    const canAdd = !statusFilter && (!filterDate.value || filterDate.value >= today);
    const cta = canAdd ? el('button', { type: 'button', className: 'link-btn accent', textContent: '+ Tạo lịch hẹn' }) : null;
    cta?.addEventListener('click', () => openForm(filterDate.value));
    listEl.replaceChildren(el('div', { className: 'empty' }, el('p', { textContent: msg }), cta));
    return;
  }

  listEl.replaceChildren(
    ...groups.map(({ date, items }) =>
      el(
        'section',
        { className: 'day' },
        // Đang xem đúng một ngày thì ngày đã ghi ở trên, không lặp tiêu đề nhóm
        filterDate.value && !statusFilter ? null : dayHeading(date, today),
        ...items.map(renderItem),
      ),
    ),
  );
}

const STATUS_FILTERS = {
  upcoming: {
    label: 'sắp tới',
    title: 'Lịch sắp tới',
    match: (a) => a.status === STATUS.SCHEDULED && toMs(a.end) > Date.now(),
  },
  done: { label: 'đã xong', title: 'Lịch đã xong', match: (a) => a.status === STATUS.DONE },
  cancelled: { label: 'đã hủy', title: 'Lịch đã hủy', match: (a) => a.status === STATUS.CANCELLED },
};

for (const tab of document.querySelectorAll('.tab[data-filter]')) {
  tab.addEventListener('click', () => {
    statusFilter = tab.dataset.filter;
    filterDate.value = '';
    render();
  });
}

// Tiêu đề nhóm ngày: bấm để chọn ngày đó trên lịch (tiện khi danh sách trải dài nhiều ngày).
function dayHeading(date, today) {
  const btn = el(
    'button',
    { type: 'button', className: 'day-link', title: 'Xem ngày này trên lịch' },
    formatDay(date),
    el('span', { className: 'rel', textContent: ` · ${relativeDay(date, today)}` }),
  );
  btn.addEventListener('click', () => {
    statusFilter = null;
    filterDate.value = date;
    render();
  });
  return el('h3', {}, btn);
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
        statusFilter = null;
        render();
      });
      return btn;
    }),
  );
  renderDayPanel(counts, today);
}

// Khung dưới lịch: ngày đang chọn + nút thêm lịch vào đúng ngày đó.
function renderDayPanel(counts, today) {
  const day = filterDate.value;
  const addBtn = $('#btn-add-day');
  if (!day) {
    $('#day-title').textContent = 'Chọn một ngày';
    $('#day-meta').textContent = 'để xem và thêm lịch cho ngày đó';
    addBtn.hidden = true;
    return;
  }
  const n = counts.get(day) ?? 0;
  const past = day < today;
  $('#day-title').textContent = formatDay(day);
  $('#day-meta').textContent = `${n ? `${n} lịch hẹn` : 'Chưa có lịch hẹn'}${past ? ' · đã qua' : ''}`;
  addBtn.hidden = false;
  addBtn.disabled = past;
  addBtn.title = past ? 'Không thể thêm lịch vào ngày đã qua' : '';
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

$('#btn-clear-day').addEventListener('click', () => {
  filterDate.value = '';
  render();
});
$('#btn-today').addEventListener('click', () => {
  statusFilter = null;
  filterDate.value = todayStr();
  render();
});
$('#btn-all').addEventListener('click', () => {
  statusFilter = null;
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
  statusFilter = null;
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
  closeForm();
  statusFilter = null;
  filterDate.value = '';

  $('#user-name').textContent = user.guest ? 'Khách' : user.name;
  $('#user-name').title = user.email;
  const avatar = $('#user-avatar');
  avatar.hidden = !user.picture;
  if (user.picture) avatar.src = user.picture;
  $('#user-initial').hidden = !!user.picture;
  if (user.guest) $('#user-initial').replaceChildren(icon('user', { size: 16 }));
  else $('#user-initial').textContent = user.name.trim().charAt(0).toUpperCase();
  $('#user-chip').hidden = false;
  $('#btn-new').hidden = false;
  $('#btn-intro').hidden = false;
  $('#nav-start').hidden = true;
  $('#login-view').hidden = true;
  $('#app-view').hidden = false;
  render();
}

// Trang chủ khi chưa đăng nhập là landing giới thiệu dự án, thẻ đăng nhập nằm ngay phần đầu.
function showLogin() {
  user = null;
  appointments = [];
  $('#login-options').hidden = false;
  $('#continue-options').hidden = true;
  $('#nav-start').hidden = false;
  $('#btn-intro').hidden = true;
  $('#user-chip').hidden = true;
  $('#btn-new').hidden = true;
  closeForm();
  if (detailDialog.open) detailDialog.close();
  $('#app-view').hidden = true;
  $('#login-view').hidden = false;
  $('#login-error').textContent = '';
}

$('#btn-guest').addEventListener('click', () => showApp(guestUser()));

// Đang đăng nhập vẫn xem lại được landing; thẻ đăng nhập đổi thành "Vào ứng dụng".
$('#btn-intro').addEventListener('click', () => {
  $('#app-view').hidden = true;
  $('#login-view').hidden = false;
  $('#login-options').hidden = true;
  $('#continue-options').hidden = false;
  $('#btn-new').hidden = true;
  $('#btn-intro').hidden = true;
  scrollTo(0, 0);
});
$('#btn-continue').addEventListener('click', () => showApp(user));
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
