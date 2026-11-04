import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { monthGrid, countByDate } from '../src/calendar.js';

describe('Lịch tháng', () => {
  test('CA-01 tháng 11/2026 (bắt đầu Chủ Nhật) → ô đầu là Thứ Hai 26/10', () => {
    const g = monthGrid(2026, 10);
    assert.equal(g.length, 42);
    assert.equal(g[0].date, '2026-10-26');
    assert.equal(g[0].inMonth, false);
    assert.equal(g.find((c) => c.inMonth).date, '2026-11-01');
    assert.equal(g.find((c) => c.inMonth).weekday, 7); // Chủ Nhật
  });

  test('CA-02 tháng bắt đầu đúng Thứ Hai (06/2026) → không có ô tháng trước', () => {
    assert.equal(monthGrid(2026, 5)[0].date, '2026-06-01');
  });

  test('CA-03 tháng 2 năm nhuận 2028 có đủ 29 ngày', () => {
    assert.equal(monthGrid(2028, 1).filter((c) => c.inMonth).length, 29);
  });

  test('CA-04 tháng 12 → các ô cuối thuộc tháng 1 năm sau', () => {
    assert.equal(monthGrid(2026, 11).at(-1).date, '2027-01-10');
  });

  test('CA-05 đếm lịch theo ngày, bỏ qua lịch đã hủy', () => {
    const c = countByDate([
      { start: '2026-11-05T09:00', status: 'scheduled' },
      { start: '2026-11-05T14:00', status: 'done' },
      { start: '2026-11-05T16:00', status: 'cancelled' },
      { start: '2026-11-06T09:00', status: 'scheduled' },
    ]);
    assert.equal(c.get('2026-11-05'), 2);
    assert.equal(c.get('2026-11-06'), 1);
  });
});
