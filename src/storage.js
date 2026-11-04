// Lưu trữ localStorage. Tách riêng để sau này đổi sang API/SQLite chỉ cần sửa file này.
import { STATUS } from './scheduler.js';

const KEY = 'lich-hen-mini.v1';
const VALID_STATUS = new Set(Object.values(STATUS));

const isAppointment = (a) =>
  a &&
  typeof a.id === 'string' &&
  typeof a.title === 'string' &&
  typeof a.start === 'string' &&
  typeof a.end === 'string' &&
  VALID_STATUS.has(a.status);

// Dữ liệu hỏng (người dùng sửa tay, phiên bản cũ) thì bỏ qua bản ghi lỗi thay vì làm sập app.
export function loadAppointments() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isAppointment) : [];
  } catch {
    return [];
  }
}

export function saveAppointments(appointments) {
  try {
    localStorage.setItem(KEY, JSON.stringify(appointments));
    return true;
  } catch {
    return false;
  }
}
