// Smoke test end-to-end trên trình duyệt thật (Chrome/Edge headless qua DevTools Protocol),
// đồng thời chụp ảnh màn hình vào docs/screenshots/. Không cần cài package.
// Cách chạy:  npm start  (một terminal)  rồi  node scripts/e2e-smoke.js
// Đổi trình duyệt: BROWSER="C:\...\chrome.exe" node scripts/e2e-smoke.js
import { spawn } from 'node:child_process';
import { mkdir, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const APP = process.env.APP_URL ?? 'http://localhost:5173/';
const BROWSER =
  process.env.BROWSER ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const shots = resolve(import.meta.dirname, '..', 'docs', 'screenshots');
const PORT = 9333;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = await mkdtemp(join(tmpdir(), 'lichhen-'));
const browser = spawn(BROWSER, [
  '--headless=new',
  '--disable-gpu',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--window-size=1200,900',
  'about:blank',
]);

let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    target = list.find((t) => t.type === 'page');
  } catch {}
}
if (!target) throw new Error('Không kết nối được trình duyệt');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let seq = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (pending.has(msg.id)) pending.get(msg.id)(msg);
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const id = ++seq;
    pending.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text);
  return r.result.result.value;
};
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(shots, name), Buffer.from(r.result.data, 'base64'));
};

await mkdir(shots, { recursive: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: APP });
await sleep(800);
await evaluate('localStorage.clear(); location.reload()');
await sleep(800);
await sleep(2500);
await shot('00-login.png');
// Headless không đăng nhập Google được, nên test luồng chính bằng chế độ khách
await evaluate("document.querySelector('#btn-guest').click()");

// Tạo lịch theo ngày mai để không bị chặn "quá khứ"
const fill = (title, start, end, note = '') => `
  (() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    const day = d.toLocaleDateString('sv-SE');
    if (!document.querySelector('#appt-dialog').open) document.querySelector('#btn-new').click();
    const set = (sel, v) => { const el = document.querySelector(sel); el.value = v; el.dispatchEvent(new Event('input')); };
    set('#f-title', ${JSON.stringify(title)}); set('#f-date', day);
    set('#f-start', '${start}'); set('#f-end', '${end}'); set('#f-note', ${JSON.stringify(note)});
    document.querySelector('#appt-form button[type=submit]').click();
  })()`;
const count = () => evaluate("document.querySelectorAll('#list .item').length");
const results = [];
const check = (name, cond) => {
  results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
};
check('E2E-0 vào app ở chế độ khách', await evaluate("!document.querySelector('#app-view').hidden && document.querySelector('#login-view').hidden"));
const dialogOpen = () => evaluate("document.querySelector('#appt-dialog').open");
await evaluate("document.querySelector('#btn-new').click()");
check('E2E-18 bấm CTA "Tạo lịch hẹn" → mở popup', await dialogOpen());
await evaluate("document.querySelector('#btn-close').click()");
check('E2E-19 bấm nút đóng → popup đóng', !(await dialogOpen()));

await evaluate(fill('', '09:00', '10:00'));
check('E2E-1 bỏ trống tiêu đề → hiện lỗi', (await evaluate("document.querySelector('[data-for=title]').textContent")) !== '');
await sleep(300);
await shot('01-validation.png');

await evaluate(fill('Họp nhóm đồ án', '09:00', '10:00', 'Phòng 302'));
check('E2E-2 tạo lịch hợp lệ → có 1 lịch, popup tự đóng', (await count()) === 1 && !(await dialogOpen()));

await evaluate(fill('Gọi khách hàng', '09:30', '10:15'));
check('E2E-3 tạo lịch trùng → bị chặn, vẫn 1 lịch', (await count()) === 1);
check('E2E-4 hộp cảnh báo trùng hiển thị', await evaluate("!document.querySelector('#conflict-box').hidden"));
check('E2E-4b lịch trùng → popup vẫn mở để sửa', await dialogOpen());
await sleep(300);
await shot('02-conflict.png');

await evaluate("document.querySelector('#conflict-box button').click()");
check('E2E-5 dùng giờ gợi ý → giờ bắt đầu 10:00', (await evaluate("document.querySelector('#f-start').value")) === '10:00');
await evaluate("document.querySelector('#f-title').value = 'Gọi khách hàng'; document.querySelector('#appt-form button[type=submit]').click()");
check('E2E-6 lưu với giờ gợi ý → 2 lịch', (await count()) === 2);

await evaluate("document.querySelector('#btn-seed').click()");
await sleep(200);

await evaluate("document.querySelector('#btn-all').click()");
await evaluate("document.querySelector('.cal-day .dot').parentElement.click()");
await evaluate("document.querySelector('#btn-add-day').click()");
check(
  'E2E-20 "Thêm lịch" ở ngày đã chọn → popup điền sẵn ngày đó + giờ trống đầu tiên (10:45)',
  await evaluate(`document.querySelector('#appt-dialog').open &&
    document.querySelector('#f-date').value === document.querySelector('#filter-date').value &&
    document.querySelector('#f-start').value === '10:45'`),
);
await sleep(300);
await shot('05-add-day.png');
await evaluate("document.querySelector('#btn-cancel').click()");
check(
  'E2E-17 bấm ngày có chấm trên lịch tháng → ngày được chọn, danh sách lọc theo ngày đó',
  await evaluate(`(() => {
    const sel = document.querySelector('.cal-day.selected');
    return !!sel && document.querySelector('#filter-date').value === sel.dataset.date && document.querySelectorAll('#list .item').length > 0;
  })()`),
);

// Thao tác trên một lịch: mở popup chi tiết rồi bấm nút theo nhãn
const act = (findExpr, label) => `(() => {
  ${findExpr}.querySelector('.item-open').click();
  [...document.querySelectorAll('#detail-actions .btn')].find((b) => b.textContent.trim() === ${JSON.stringify(label)}).click();
})()`;
const closeDetail = () => evaluate("document.querySelector('#detail-dialog').open && document.querySelector('#detail-close').click()");

await evaluate(act("document.querySelector('.item')", 'Xong'));
await closeDetail();
check('E2E-7 đánh dấu xong (qua popup chi tiết)', (await evaluate("document.querySelectorAll('.item.is-done').length")) === 1);
await evaluate(act("[...document.querySelectorAll('.item.is-scheduled')].at(-1)", 'Hủy'));
await closeDetail();
check('E2E-8 hủy lịch → lịch biến khỏi danh sách ngày, sang tab "Đã hủy"', await evaluate(
  "document.querySelectorAll('.item.is-cancelled').length === 0 && document.querySelector('.tab[data-filter=cancelled] .n').textContent === '1'",
));
await shot('03-list.png');

const stored = () => evaluate("JSON.parse(localStorage.getItem('lich-hen-mini.v1:guest')).length");
const storedBefore = await stored();
await evaluate('location.reload()');
await sleep(800);
await evaluate("document.querySelector('#btn-all').click()");
check('E2E-9 reload trang → dữ liệu còn nguyên', (await stored()) === storedBefore && (await count()) > 0);

const errorOf = (field) => evaluate(`document.querySelector('[data-for=${field}]').textContent`);
await evaluate(fill('Ngược giờ', '16:00', '15:00'));
check('E2E-10 giờ kết thúc trước giờ bắt đầu → lỗi', (await errorOf('end')) !== '');

await evaluate(`(() => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  if (!document.querySelector('#appt-dialog').open) document.querySelector('#btn-new').click();
  document.querySelector('#f-title').value = 'Hôm qua';
  document.querySelector('#f-date').value = d.toLocaleDateString('sv-SE');
  document.querySelector('#f-start').value = '09:00'; document.querySelector('#f-end').value = '10:00';
  document.querySelector('#appt-form button[type=submit]').click();
})()`);
check('E2E-11 đặt lịch quá khứ → lỗi', (await errorOf('start')).includes('quá khứ'));

const xss = '<img src=x onerror="window.pwned=1">';
await evaluate(fill(xss, '18:00', '18:30'));
check(
  'E2E-12 tiêu đề chứa HTML được hiển thị nguyên văn, không chạy',
  (await evaluate(`[...document.querySelectorAll('.item .title')].some((t) => t.textContent.includes(${JSON.stringify(xss)})) && !window.pwned && !document.querySelector('.item img')`)),
);

await evaluate("document.querySelector('#btn-all').click()");
check('E2E-13 tab "Tất cả" không hiện lịch đã hủy', (await evaluate("document.querySelectorAll('.item.is-cancelled').length")) === 0);

// Hủy lịch 12:00, đặt lịch khác vào đúng giờ đó, rồi khôi phục lịch cũ → phải bị chặn
const titleSel = (t) => `[...document.querySelectorAll('.item')].find((i) => i.querySelector('.title').textContent.startsWith(${JSON.stringify(t)}))`;
await evaluate(act(titleSel('Ăn trưa với Lan'), 'Hủy'));
await closeDetail();
await evaluate(fill('Lịch chen vào', '12:00', '12:30'));
await evaluate("document.querySelector('.tab[data-filter=cancelled]').click()");
await evaluate(act(titleSel('Ăn trưa với Lan'), 'Khôi phục'));
check(
  'E2E-14 khôi phục lịch hủy khi giờ đã bị chiếm → bị chặn, báo lỗi ngay trong popup',
  await evaluate(`!document.querySelector('#detail-error').hidden &&
    document.querySelector('#detail-error').textContent.includes('Lịch chen vào') &&
    document.querySelector('#detail-status').textContent === 'Đã hủy'`),
);
await closeDetail();

// Tab lọc theo trạng thái
const tabCheck = (key, cls) => `(() => {
  document.querySelector('.tab[data-filter=${key}]').click();
  const items = [...document.querySelectorAll('#list .item')];
  const n = parseInt(document.querySelector('.tab[data-filter=${key}] .n').textContent || '0', 10);
  return document.querySelector('.tab[data-filter=${key}]').classList.contains('on') &&
    items.length === n && items.every((i) => i.classList.contains('${cls}'));
})()`;
check('E2E-21 tab "Đã xong" → chỉ hiện lịch đã xong, đúng số lượng', await evaluate(tabCheck('done', 'is-done')));
check('E2E-22 tab "Đã hủy" → chỉ hiện lịch đã hủy, đúng số lượng', await evaluate(tabCheck('cancelled', 'is-cancelled')));
check('E2E-23 tab "Sắp tới" → chỉ hiện lịch chưa diễn ra', await evaluate(tabCheck('upcoming', 'is-scheduled')));
await shot('06-chip-filter.png');
check(
  'E2E-25 bấm tiêu đề nhóm ngày → chọn đúng ngày đó trên lịch, bỏ lọc trạng thái',
  await evaluate(`(() => {
    document.querySelector('.day-link').click();
    const d = document.querySelector('#filter-date').value;
    return !!d && document.querySelector('.cal-day.selected')?.dataset.date === d && !document.querySelector('.tab.on[data-filter]');
  })()`),
);
await evaluate("document.querySelector('#btn-all').click()");
check('E2E-24 bấm "Tất cả" → bỏ mọi bộ lọc', await evaluate("!document.querySelector('.tab.on[data-filter]') && document.querySelector('#btn-all').classList.contains('on')"));

// Popup chi tiết
check(
  'E2E-26 bấm vào một lịch → popup chi tiết đúng tiêu đề, có ngày/giờ/thời lượng',
  await evaluate(`(() => {
    const item = document.querySelector('.item.is-scheduled');
    const title = item.querySelector('.title').textContent;
    item.querySelector('.item-open').click();
    const d = document.querySelector('#detail-dialog');
    return d.open && document.querySelector('#detail-title').textContent === title &&
      document.querySelectorAll('#detail-rows li').length >= 3 && /giờ|phút/.test(document.querySelector('#detail-rows').textContent);
  })()`),
);
await sleep(300);
await shot('08-detail.png');
await evaluate("document.querySelector('#detail-actions .btn.done').click()");
check(
  'E2E-27 bấm "Xong" trong popup → trạng thái cập nhật ngay, popup vẫn mở',
  await evaluate("document.querySelector('#detail-dialog').open && document.querySelector('#detail-status').textContent === 'Đã xong'"),
);
await evaluate("document.querySelector('#detail-actions .btn').click()"); // Bỏ đánh dấu
await evaluate("document.querySelector('#detail-close').click()");
check('E2E-28 đóng popup chi tiết', await evaluate("!document.querySelector('#detail-dialog').open"));

// Thao tác nhanh trên dòng: vòng tròn đánh dấu xong + thùng rác với popup xác nhận riêng
const doneCount = () => evaluate("document.querySelectorAll('.item.is-done').length");
const done0 = await doneCount();
await evaluate("document.querySelector('.item.is-scheduled .quick-done').click()");
check('E2E-29 nút nhanh ✓ trên dòng → đánh dấu xong ngay, không cần mở chi tiết, dòng hiện "Đã xong"', await evaluate(
  "!document.querySelector('#detail-dialog').open && [...document.querySelectorAll('.item.is-done .state')].every((s) => s.textContent.includes('Đã xong'))",
) && (await doneCount()) === done0 + 1);
await evaluate("document.querySelector('.item.is-done .quick-done').click()");
check('E2E-30 nút nhanh ↺ trên dòng đã xong → bỏ đánh dấu', (await doneCount()) === done0);

const rows = () => evaluate("document.querySelectorAll('#list .item').length");
const rowsBefore = await rows();
await evaluate("document.querySelector('.item .trash').click()");
check('E2E-31 bấm thùng rác → mở popup xác nhận của app (không phải confirm của trình duyệt)', await evaluate(
  "document.querySelector('#confirm-dialog').open && document.querySelector('#confirm-message').textContent.includes('xóa vĩnh viễn')",
));
await sleep(300);
await shot('09-confirm-delete.png');
await evaluate("document.querySelector('#confirm-cancel').click()");
check('E2E-32 bấm "Không" → không xóa', !(await evaluate("document.querySelector('#confirm-dialog').open")) && (await rows()) === rowsBefore);
await evaluate("document.querySelector('.item .trash').click()");
await evaluate("document.querySelector('#confirm-ok').click()");
await sleep(100);
check('E2E-33 bấm "Xóa" → xóa đúng 1 lịch', (await rows()) === rowsBefore - 1);
await evaluate("document.querySelector('.item .item-open').click()");
await evaluate("document.querySelector('#detail-actions .btn.delete').click()");
check('E2E-34 xóa từ popup chi tiết → popup xác nhận hiện chồng lên', await evaluate(
  "document.querySelector('#confirm-dialog').open && document.querySelector('#detail-dialog').open",
));
await evaluate("document.querySelector('#confirm-ok').click()");
await sleep(100);
check('E2E-35 xác nhận → đóng cả hai popup, xóa thêm 1 lịch', (await rows()) === rowsBefore - 2 && !(await evaluate(
  "document.querySelector('#confirm-dialog').open || document.querySelector('#detail-dialog').open",
)));

const before = await evaluate("document.querySelectorAll('#list .item').length");
await evaluate("document.querySelector('#btn-logout').click()");
check('E2E-15 đăng xuất → về màn hình đăng nhập, ẩn dữ liệu', await evaluate("!document.querySelector('#login-view').hidden && document.querySelector('#app-view').hidden"));
await evaluate("document.querySelector('#btn-guest').click()");
await evaluate("document.querySelector('#btn-all').click()");
check('E2E-16 vào lại cùng tài khoản → dữ liệu còn', (await count()) >= before);

// Màn hình điện thoại
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 1200, deviceScaleFactor: 1, mobile: true });
await sleep(300);
await shot('04-mobile.png');

console.log(results.join('\n'));
ws.close();
browser.kill();
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
