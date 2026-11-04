// Logic nghiệp vụ thuần (không phụ thuộc DOM / localStorage) để có thể unit test.
// Thời gian được lưu dạng chuỗi giờ địa phương "YYYY-MM-DDTHH:mm" (đúng định dạng của <input>).

export const STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  DONE: 'done',
  CANCELLED: 'cancelled',
});

export const TITLE_MAX = 100;
export const NOTE_MAX = 500;
export const MAX_DURATION_MIN = 24 * 60;

const MINUTE = 60 * 1000;
const LOCAL_DT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

// Chuyển "YYYY-MM-DDTHH:mm" -> timestamp (ms). Trả NaN nếu sai định dạng
// hoặc ngày không tồn tại (vd 2026-02-30), thay vì để Date tự "lăn" sang tháng sau.
export function toMs(value) {
  const m = LOCAL_DT.exec(value ?? '');
  if (!m) return NaN;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  const valid =
    date.getFullYear() === y &&
    date.getMonth() === mo - 1 &&
    date.getDate() === d &&
    date.getHours() === h &&
    date.getMinutes() === mi;
  return valid ? date.getTime() : NaN;
}

export function fromMs(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Kiểm tra dữ liệu form. Trả về object lỗi theo field; rỗng = hợp lệ.
export function validateAppointment(input, { now = Date.now() } = {}) {
  const errors = {};
  const title = (input.title ?? '').trim();
  const note = input.note ?? '';
  const start = toMs(input.start);
  const end = toMs(input.end);

  if (!title) errors.title = 'Vui lòng nhập tiêu đề.';
  else if (title.length > TITLE_MAX) errors.title = `Tiêu đề tối đa ${TITLE_MAX} ký tự.`;

  if (Number.isNaN(start)) errors.start = 'Ngày/giờ bắt đầu không hợp lệ.';
  else if (start < now) errors.start = 'Không thể đặt lịch trong quá khứ.';

  if (Number.isNaN(end)) errors.end = 'Giờ kết thúc không hợp lệ.';
  else if (!Number.isNaN(start)) {
    if (end <= start) errors.end = 'Giờ kết thúc phải sau giờ bắt đầu.';
    else if (end - start > MAX_DURATION_MIN * MINUTE) errors.end = 'Một lịch hẹn không được dài quá 24 giờ.';
  }

  if (note.length > NOTE_MAX) errors.note = `Ghi chú tối đa ${NOTE_MAX} ký tự.`;

  return errors;
}

// Hai khoảng [start, end) giao nhau khi và chỉ khi A bắt đầu trước khi B kết thúc
// VÀ B bắt đầu trước khi A kết thúc. Dùng khoảng nửa mở nên lịch nối tiếp
// (9:00–10:00 và 10:00–11:00) KHÔNG bị coi là trùng.
export function overlaps(a, b) {
  return toMs(a.start) < toMs(b.end) && toMs(b.start) < toMs(a.end);
}

// Chỉ lịch đang "scheduled" mới chiếm chỗ: lịch đã hủy giải phóng khung giờ,
// lịch đã xong được coi là kết thúc (xem docs/DECISIONS.md).
export function findConflicts(candidate, appointments, { ignoreId } = {}) {
  return appointments
    .filter((a) => a.status === STATUS.SCHEDULED && a.id !== ignoreId && overlaps(candidate, a))
    .sort((a, b) => toMs(a.start) - toMs(b.start));
}

// Gợi ý khung trống sớm nhất (cùng độ dài) bắt đầu từ giờ người dùng chọn:
// cứ gặp lịch trùng thì nhảy tới giờ kết thúc muộn nhất của các lịch trùng, lặp lại.
export function suggestFreeSlot(candidate, appointments, { ignoreId, maxSteps = 200 } = {}) {
  const duration = toMs(candidate.end) - toMs(candidate.start);
  if (!(duration > 0)) return null;
  let start = toMs(candidate.start);
  for (let i = 0; i < maxSteps; i++) {
    const slot = { start: fromMs(start), end: fromMs(start + duration) };
    const conflicts = findConflicts(slot, appointments, { ignoreId });
    if (conflicts.length === 0) return slot;
    start = Math.max(...conflicts.map((c) => toMs(c.end)));
  }
  return null;
}

// Tạo lịch hẹn: validate -> kiểm tra trùng -> trả về danh sách mới (không sửa mảng cũ).
export function createAppointment(input, appointments, { now = Date.now(), id } = {}) {
  const errors = validateAppointment(input, { now });
  if (Object.keys(errors).length > 0) return { ok: false, errors, conflicts: [] };

  const candidate = { start: input.start, end: input.end };
  const conflicts = findConflicts(candidate, appointments);
  if (conflicts.length > 0) {
    return {
      ok: false,
      errors: { start: 'Khung giờ này trùng với lịch hẹn khác.' },
      conflicts,
      suggestion: suggestFreeSlot(candidate, appointments),
    };
  }

  const appointment = {
    id: id ?? `${now}-${Math.random().toString(36).slice(2, 8)}`,
    title: input.title.trim(),
    start: input.start,
    end: input.end,
    note: (input.note ?? '').trim(),
    status: STATUS.SCHEDULED,
    createdAt: now,
  };
  return { ok: true, appointment, appointments: [...appointments, appointment] };
}

const TRANSITIONS = {
  [STATUS.SCHEDULED]: [STATUS.DONE, STATUS.CANCELLED],
  [STATUS.DONE]: [STATUS.SCHEDULED],
  [STATUS.CANCELLED]: [STATUS.SCHEDULED],
};

// Đổi trạng thái. Đưa lịch quay lại "scheduled" (khôi phục lịch đã hủy / bỏ đánh dấu xong)
// phải kiểm tra trùng lại, vì trong lúc nó bị hủy người dùng có thể đã đặt lịch khác vào khung đó.
export function changeStatus(appointments, id, next, { now = Date.now() } = {}) {
  const target = appointments.find((a) => a.id === id);
  if (!target) return { ok: false, error: 'Không tìm thấy lịch hẹn.' };
  if (!TRANSITIONS[target.status]?.includes(next)) {
    return { ok: false, error: `Không thể chuyển từ "${target.status}" sang "${next}".` };
  }
  if (next === STATUS.SCHEDULED) {
    if (toMs(target.end) <= now && target.status === STATUS.CANCELLED) {
      return { ok: false, error: 'Lịch hẹn này đã qua, không thể khôi phục.' };
    }
    const conflicts = findConflicts(target, appointments, { ignoreId: id });
    if (conflicts.length > 0) {
      return { ok: false, error: 'Không thể khôi phục: khung giờ đã bị lịch khác chiếm.', conflicts };
    }
  }
  return {
    ok: true,
    appointments: appointments.map((a) => (a.id === id ? { ...a, status: next } : a)),
  };
}

export function deleteAppointment(appointments, id) {
  return appointments.filter((a) => a.id !== id);
}

// Nhóm theo ngày bắt đầu, ngày tăng dần, trong ngày sắp theo giờ bắt đầu.
export function groupByDate(appointments) {
  const groups = new Map();
  const sorted = [...appointments].sort((a, b) => toMs(a.start) - toMs(b.start));
  for (const a of sorted) {
    const day = a.start.slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(a);
  }
  return [...groups.entries()].map(([date, items]) => ({ date, items }));
}
