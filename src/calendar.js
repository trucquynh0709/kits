// Tính lưới lịch tháng (thuần, không phụ thuộc DOM) để render và unit test.

const pad = (n) => String(n).padStart(2, '0');
export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Trả về 42 ô (6 tuần) bắt đầu từ Thứ Hai, gồm cả ngày cuối tháng trước / đầu tháng sau
// để lưới luôn đủ hàng và không bị nhảy chiều cao khi đổi tháng.
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // 0 = Thứ Hai … 6 = Chủ Nhật
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(year, month, 1 - offset + i);
    return { date: dateKey(d), day: d.getDate(), inMonth: d.getMonth() === month, weekday: (i % 7) + 1 };
  });
}

// Đếm số lịch (chưa hủy) theo ngày bắt đầu, để vẽ chấm trên lịch.
export function countByDate(appointments) {
  const counts = new Map();
  for (const a of appointments) {
    if (a.status === 'cancelled') continue;
    const day = a.start.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return counts;
}
