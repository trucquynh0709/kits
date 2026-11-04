import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  STATUS,
  toMs,
  validateAppointment,
  overlaps,
  findConflicts,
  suggestFreeSlot,
  createAppointment,
  changeStatus,
  deleteAppointment,
  groupByDate,
} from '../src/scheduler.js';

// Mốc "hiện tại" cố định để test không phụ thuộc giờ chạy.
const NOW = toMs('2026-11-01T08:00');

const appt = (id, start, end, status = STATUS.SCHEDULED) => ({ id, title: id, start, end, note: '', status });

// Lịch có sẵn: 09:00–10:00 ngày 05/11
const existing = [appt('A', '2026-11-05T09:00', '2026-11-05T10:00')];

const create = (start, end, list = existing, title = 'Lịch mới') =>
  createAppointment({ title, start, end, note: '' }, list, { now: NOW, id: 'NEW' });

describe('Tạo lịch trùng giờ (yêu cầu chính)', () => {
  test('TC-01 trùng hoàn toàn 09:00–10:00 → bị chặn', () => {
    const r = create('2026-11-05T09:00', '2026-11-05T10:00');
    assert.equal(r.ok, false);
    assert.deepEqual(r.conflicts.map((c) => c.id), ['A']);
  });

  test('TC-02 chồng đầu 08:30–09:30 → bị chặn', () => {
    assert.equal(create('2026-11-05T08:30', '2026-11-05T09:30').ok, false);
  });

  test('TC-03 chồng cuối 09:45–10:30 → bị chặn', () => {
    assert.equal(create('2026-11-05T09:45', '2026-11-05T10:30').ok, false);
  });

  test('TC-04 nằm gọn bên trong 09:15–09:45 → bị chặn', () => {
    assert.equal(create('2026-11-05T09:15', '2026-11-05T09:45').ok, false);
  });

  test('TC-05 bao trùm lịch cũ 08:00–11:00 → bị chặn', () => {
    assert.equal(create('2026-11-05T08:00', '2026-11-05T11:00').ok, false);
  });

  test('TC-06 nối tiếp ngay sau 10:00–11:00 → hợp lệ (biên không tính trùng)', () => {
    assert.equal(create('2026-11-05T10:00', '2026-11-05T11:00').ok, true);
  });

  test('TC-07 kết thúc đúng lúc lịch cũ bắt đầu 08:00–09:00 → hợp lệ', () => {
    assert.equal(create('2026-11-05T08:00', '2026-11-05T09:00').ok, true);
  });

  test('TC-08 cùng giờ nhưng khác ngày → hợp lệ', () => {
    assert.equal(create('2026-11-06T09:00', '2026-11-06T10:00').ok, true);
  });

  test('TC-09 lịch cũ đã HỦY không chặn khung giờ', () => {
    const list = [appt('A', '2026-11-05T09:00', '2026-11-05T10:00', STATUS.CANCELLED)];
    assert.equal(create('2026-11-05T09:00', '2026-11-05T10:00', list).ok, true);
  });

  test('TC-10 lịch cũ đã XONG không chặn khung giờ', () => {
    const list = [appt('A', '2026-11-05T09:00', '2026-11-05T10:00', STATUS.DONE)];
    assert.equal(create('2026-11-05T09:30', '2026-11-05T10:30', list).ok, true);
  });

  test('TC-11 trùng nhiều lịch cùng lúc → trả về đủ, sắp theo giờ', () => {
    const list = [
      appt('C', '2026-11-05T11:00', '2026-11-05T12:00'),
      appt('A', '2026-11-05T09:00', '2026-11-05T10:00'),
      appt('B', '2026-11-05T13:00', '2026-11-05T14:00'),
    ];
    const r = create('2026-11-05T09:30', '2026-11-05T11:30', list);
    assert.deepEqual(r.conflicts.map((c) => c.id), ['A', 'C']);
  });

  test('TC-12 lịch qua nửa đêm 23:00–01:00 trùng với 00:30 hôm sau', () => {
    const list = [appt('N', '2026-11-05T23:00', '2026-11-06T01:00')];
    assert.equal(create('2026-11-06T00:30', '2026-11-06T01:30', list).ok, false);
  });

  test('TC-13 bị trùng thì danh sách gốc không bị thay đổi', () => {
    const before = structuredClone(existing);
    create('2026-11-05T09:00', '2026-11-05T10:00');
    assert.deepEqual(existing, before);
  });
});

describe('Gợi ý khung giờ trống', () => {
  test('TC-14 gợi ý ngay sau lịch bị trùng, giữ nguyên độ dài', () => {
    const r = create('2026-11-05T09:30', '2026-11-05T10:00');
    assert.deepEqual(r.suggestion, { start: '2026-11-05T10:00', end: '2026-11-05T10:30' });
  });

  test('TC-15 nhảy qua chuỗi lịch liền nhau', () => {
    const list = [
      appt('A', '2026-11-05T09:00', '2026-11-05T10:00'),
      appt('B', '2026-11-05T10:00', '2026-11-05T10:30'),
      appt('C', '2026-11-05T10:45', '2026-11-05T11:00'),
    ];
    // Cần 30 phút: 10:30–11:00 vướng C → 11:00–11:30
    const s = suggestFreeSlot({ start: '2026-11-05T09:00', end: '2026-11-05T09:30' }, list);
    assert.deepEqual(s, { start: '2026-11-05T11:00', end: '2026-11-05T11:30' });
  });
});

describe('Validation', () => {
  const base = { title: 'Họp', start: '2026-11-05T09:00', end: '2026-11-05T10:00', note: '' };
  const v = (patch) => validateAppointment({ ...base, ...patch }, { now: NOW });

  test('TC-16 dữ liệu hợp lệ → không lỗi', () => assert.deepEqual(v({}), {}));
  test('TC-17 tiêu đề rỗng / chỉ khoảng trắng', () => assert.ok(v({ title: '   ' }).title));
  test('TC-18 tiêu đề quá 100 ký tự', () => assert.ok(v({ title: 'x'.repeat(101) }).title));
  test('TC-19 giờ kết thúc bằng giờ bắt đầu', () => assert.ok(v({ end: base.start }).end));
  test('TC-20 giờ kết thúc trước giờ bắt đầu', () => assert.ok(v({ end: '2026-11-05T08:00' }).end));
  test('TC-21 đặt lịch trong quá khứ', () => assert.ok(v({ start: '2026-10-31T09:00', end: '2026-10-31T10:00' }).start));
  test('TC-22 ngày không tồn tại 30/02', () => assert.ok(v({ start: '2026-02-30T09:00' }).start));
  test('TC-23 thiếu ngày giờ', () => assert.ok(v({ start: '', end: '' }).start));
  test('TC-24 dài hơn 24 giờ', () => assert.ok(v({ end: '2026-11-06T09:01' }).end));
  test('TC-25 ghi chú quá 500 ký tự', () => assert.ok(v({ note: 'x'.repeat(501) }).note));
  test('TC-26 lỗi validation thì không chạy kiểm tra trùng', () => {
    const r = createAppointment({ ...base, title: '' }, existing, { now: NOW });
    assert.equal(r.ok, false);
    assert.deepEqual(r.conflicts, []);
  });
});

describe('Đổi trạng thái', () => {
  test('TC-27 đánh dấu đã xong', () => {
    const r = changeStatus(existing, 'A', STATUS.DONE, { now: NOW });
    assert.equal(r.ok, true);
    assert.equal(r.appointments[0].status, STATUS.DONE);
  });

  test('TC-28 hủy lịch', () => {
    const r = changeStatus(existing, 'A', STATUS.CANCELLED, { now: NOW });
    assert.equal(r.appointments[0].status, STATUS.CANCELLED);
  });

  test('TC-29 không thể chuyển thẳng từ đã hủy sang đã xong', () => {
    const list = [appt('A', '2026-11-05T09:00', '2026-11-05T10:00', STATUS.CANCELLED)];
    assert.equal(changeStatus(list, 'A', STATUS.DONE, { now: NOW }).ok, false);
  });

  test('TC-30 khôi phục lịch đã hủy khi khung giờ đã bị lịch khác chiếm → bị chặn', () => {
    const list = [
      appt('A', '2026-11-05T09:00', '2026-11-05T10:00', STATUS.CANCELLED),
      appt('B', '2026-11-05T09:30', '2026-11-05T10:30'),
    ];
    const r = changeStatus(list, 'A', STATUS.SCHEDULED, { now: NOW });
    assert.equal(r.ok, false);
    assert.deepEqual(r.conflicts.map((c) => c.id), ['B']);
  });

  test('TC-31 khôi phục lịch đã hủy khi khung giờ còn trống → thành công', () => {
    const list = [appt('A', '2026-11-05T09:00', '2026-11-05T10:00', STATUS.CANCELLED)];
    assert.equal(changeStatus(list, 'A', STATUS.SCHEDULED, { now: NOW }).ok, true);
  });

  test('TC-32 không khôi phục lịch đã hủy nằm trong quá khứ', () => {
    const list = [appt('A', '2026-10-30T09:00', '2026-10-30T10:00', STATUS.CANCELLED)];
    assert.equal(changeStatus(list, 'A', STATUS.SCHEDULED, { now: NOW }).ok, false);
  });

  test('TC-33 id không tồn tại', () => {
    assert.equal(changeStatus(existing, 'X', STATUS.DONE, { now: NOW }).ok, false);
  });
});

describe('Danh sách theo ngày', () => {
  test('TC-34 nhóm theo ngày, ngày và giờ đều tăng dần', () => {
    const list = [
      appt('c', '2026-11-06T08:00', '2026-11-06T09:00'),
      appt('b', '2026-11-05T14:00', '2026-11-05T15:00'),
      appt('a', '2026-11-05T09:00', '2026-11-05T10:00'),
    ];
    const g = groupByDate(list);
    assert.deepEqual(g.map((x) => x.date), ['2026-11-05', '2026-11-06']);
    assert.deepEqual(g[0].items.map((x) => x.id), ['a', 'b']);
  });

  test('TC-35 xóa lịch', () => {
    assert.deepEqual(deleteAppointment(existing, 'A'), []);
  });

  test('TC-36 overlaps có tính đối xứng', () => {
    const a = { start: '2026-11-05T09:00', end: '2026-11-05T10:00' };
    const b = { start: '2026-11-05T09:59', end: '2026-11-05T12:00' };
    assert.equal(overlaps(a, b), overlaps(b, a));
    assert.equal(findConflicts(b, [{ ...a, id: 'a', status: STATUS.SCHEDULED }]).length, 1);
  });
});
