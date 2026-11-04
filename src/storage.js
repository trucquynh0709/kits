// Lưu trữ localStorage, mỗi tài khoản một key riêng. Tách riêng để sau này đổi sang API/SQLite chỉ cần sửa file này.
import { STATUS } from './scheduler.js';

const PREFIX = 'lich-hen-mini.v1';
const VALID_STATUS = new Set(Object.values(STATUS));

const keyFor = (userId) => `${PREFIX}:${userId}`;

const isAppointment = (a) =>
  a &&
  typeof a.id === 'string' &&
  typeof a.title === 'string' &&
  typeof a.start === 'string' &&
  typeof a.end === 'string' &&
  VALID_STATUS.has(a.status);

// Dữ liệu hỏng (người dùng sửa tay, phiên bản cũ) thì bỏ qua bản ghi lỗi thay vì làm sập app.
export function loadAppointments(userId) {
  try {
    // Bản trước khi có đăng nhập lưu chung một key; chuyển dữ liệu đó sang tài khoản khách.
    if (userId === 'guest' && localStorage.getItem(PREFIX) && !localStorage.getItem(keyFor(userId))) {
      localStorage.setItem(keyFor(userId), localStorage.getItem(PREFIX));
      localStorage.removeItem(PREFIX);
    }
    const parsed = JSON.parse(localStorage.getItem(keyFor(userId)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isAppointment) : [];
  } catch {
    return [];
  }
}

export function saveAppointments(userId, appointments) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(appointments));
    return true;
  } catch {
    return false;
  }
}
