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

// Tạo lịch theo ngày mai để không bị chặn "quá khứ"
const fill = (title, start, end, note = '') => `
  (() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    const day = d.toLocaleDateString('sv-SE');
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

await evaluate(fill('', '09:00', '10:00'));
check('E2E-1 bỏ trống tiêu đề → hiện lỗi', (await evaluate("document.querySelector('[data-for=title]').textContent")) !== '');
await shot('01-validation.png');

await evaluate(fill('Họp nhóm đồ án', '09:00', '10:00', 'Phòng 302'));
check('E2E-2 tạo lịch hợp lệ → có 1 lịch', (await count()) === 1);

await evaluate(fill('Gọi khách hàng', '09:30', '10:15'));
check('E2E-3 tạo lịch trùng → bị chặn, vẫn 1 lịch', (await count()) === 1);
check('E2E-4 hộp cảnh báo trùng hiển thị', await evaluate("!document.querySelector('#conflict-box').hidden"));
await shot('02-conflict.png');

await evaluate("document.querySelector('#conflict-box button').click()");
check('E2E-5 dùng giờ gợi ý → giờ bắt đầu 10:00', (await evaluate("document.querySelector('#f-start').value")) === '10:00');
await evaluate("document.querySelector('#f-title').value = 'Gọi khách hàng'; document.querySelector('#appt-form button[type=submit]').click()");
check('E2E-6 lưu với giờ gợi ý → 2 lịch', (await count()) === 2);

await evaluate("document.querySelector('#btn-seed').click()");
await sleep(200);
const afterSeed = await count();

await evaluate("[...document.querySelectorAll('.item')][0].querySelector('.btn.done').click()");
check('E2E-7 đánh dấu xong', (await evaluate("document.querySelectorAll('.item.is-done').length")) === 1);
await evaluate("[...document.querySelectorAll('.item.is-scheduled')].at(-1).querySelector('.btn.danger').click()");
check('E2E-8 hủy lịch', (await evaluate("document.querySelectorAll('.item.is-cancelled').length")) === 1);
await shot('03-list.png');

await evaluate('location.reload()');
await sleep(800);
await evaluate("document.querySelector('#btn-all').click()");
check('E2E-9 reload trang → dữ liệu còn nguyên', (await count()) === afterSeed);

// Màn hình điện thoại
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 1200, deviceScaleFactor: 1, mobile: true });
await sleep(300);
await shot('04-mobile.png');

console.log(results.join('\n'));
ws.close();
browser.kill();
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
