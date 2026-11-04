import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { parseGoogleCredential } from '../src/auth.js';
import { loadAppointments, saveAppointments } from '../src/storage.js';

const CLIENT = 'test-client.apps.googleusercontent.com';
const NOW = Date.parse('2026-11-04T10:00:00Z');

// Tạo JWT giả có cấu trúc giống ID token của Google (chữ ký không được kiểm phía client).
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const token = (patch = {}) =>
  [
    b64url({ alg: 'RS256', typ: 'JWT' }),
    b64url({
      iss: 'https://accounts.google.com',
      aud: CLIENT,
      sub: '1234567890',
      email: 'quynh@example.com',
      name: 'Trúc Quỳnh',
      picture: 'https://example.com/a.png',
      exp: NOW / 1000 + 3600,
      ...patch,
    }),
    'signature',
  ].join('.');

const parse = (t) => parseGoogleCredential(t, { clientId: CLIENT, now: NOW });

describe('Đăng nhập Google: đọc ID token', () => {
  test('AU-01 token hợp lệ → lấy được user, tên tiếng Việt có dấu giữ nguyên', () => {
    const r = parse(token());
    assert.equal(r.ok, true);
    assert.deepEqual(r.user, {
      id: 'google:1234567890',
      name: 'Trúc Quỳnh',
      email: 'quynh@example.com',
      picture: 'https://example.com/a.png',
      guest: false,
    });
  });

  test('AU-02 token hết hạn → từ chối', () => {
    assert.equal(parse(token({ exp: NOW / 1000 - 1 })).ok, false);
  });

  test('AU-03 token cấp cho ứng dụng khác (sai aud) → từ chối', () => {
    assert.equal(parse(token({ aud: 'other-app' })).ok, false);
  });

  test('AU-04 token không phải do Google cấp (sai iss) → từ chối', () => {
    assert.equal(parse(token({ iss: 'https://evil.example' })).ok, false);
  });

  test('AU-05 token sai định dạng / rác → từ chối, không throw', () => {
    for (const bad of ['', 'abc', 'a.b', 'a.!!!.c', null, undefined]) assert.equal(parse(bad).ok, false);
  });

  test('AU-06 thiếu tên thì dùng email làm tên hiển thị', () => {
    assert.equal(parse(token({ name: undefined })).user.name, 'quynh@example.com');
  });
});

describe('Dữ liệu tách theo tài khoản', () => {
  beforeEach(() => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
  });

  const a = { id: '1', title: 'Họp', start: '2026-11-05T09:00', end: '2026-11-05T10:00', status: 'scheduled' };

  test('AU-07 hai tài khoản không thấy lịch của nhau', () => {
    saveAppointments('google:A', [a]);
    assert.equal(loadAppointments('google:A').length, 1);
    assert.equal(loadAppointments('google:B').length, 0);
  });

  test('AU-08 dữ liệu bản cũ (chưa có đăng nhập) được chuyển sang tài khoản khách', () => {
    localStorage.setItem('lich-hen-mini.v1', JSON.stringify([a]));
    assert.equal(loadAppointments('guest').length, 1);
    assert.equal(localStorage.getItem('lich-hen-mini.v1'), null);
  });

  test('AU-09 dữ liệu hỏng trong localStorage → trả mảng rỗng, không sập', () => {
    localStorage.setItem('lich-hen-mini.v1:guest', '{not json');
    assert.deepEqual(loadAppointments('guest'), []);
  });
});
