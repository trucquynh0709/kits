# 📅 Lịch Hẹn Mini

Website đặt và quản lý lịch hẹn cá nhân, **tự động chặn lịch trùng giờ và gợi ý khung giờ trống gần nhất**.

- 🔗 **Bản chạy thực tế:** `<dán link Vercel/Netlify>`
- 🎬 **Video demo (1–2 phút):** `<dán link video>`, kịch bản ở [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)
- 💻 **Repository:** `<dán link GitHub>`

---

## 1. Vấn đề cần giải quyết

Người dùng ghi lịch hẹn rải rác ở giấy note, tin nhắn, ứng dụng ghi chú, nên dễ **hẹn hai việc vào cùng một giờ** mà không biết cho tới khi quá muộn. Google Calendar thì quá nặng cho nhu cầu cá nhân đơn giản, và mặc định vẫn cho tạo sự kiện chồng giờ.

**Lịch Hẹn Mini** giải quyết đúng một việc: ghi lịch hẹn nhanh và **không cho phép hai lịch chồng lên nhau**. Khi bị trùng, app chỉ ra lịch nào đang chiếm giờ và đề xuất giờ trống gần nhất.

## 2. Mục tiêu và kết quả đạt được

| Mục tiêu (đề bài) | Kết quả | Minh chứng |
|---|---|---|
| Form tạo lịch: tiêu đề, ngày giờ, ghi chú | ✅ Có thêm **giờ kết thúc**, vì không có thời lượng thì không kiểm tra trùng được | [index.html](index.html) |
| Danh sách lịch hẹn theo ngày | ✅ Nhóm theo ngày, lọc theo ngày, nhãn "Hôm nay", ẩn/hiện lịch hủy | ảnh 03 |
| Đánh dấu đã xong / hủy | ✅ Thêm Khôi phục, Bỏ đánh dấu, Xóa | ảnh 03 |
| Kiểm tra trùng giờ | ✅ Chặn trùng, liệt kê và highlight lịch bị trùng, **gợi ý giờ trống** | ảnh 02 |
| Test case cho tạo lịch trùng | ✅ 13 unit test riêng cho tạo lịch trùng (tổng 36) + 14 e2e + 20 test thủ công | [docs/TEST_CASES.md](docs/TEST_CASES.md) |
| README + log công việc | ✅ | file này, [docs/DAILY_LOG.md](docs/DAILY_LOG.md) |
| Demo chức năng chính | ✅ Ảnh chụp bên dưới + video | [docs/screenshots/](docs/screenshots/) |
| Deploy miễn phí | ⏳ Hướng dẫn ở mục 5 | link ở đầu trang |

## 3. Ảnh chụp màn hình

| Phát hiện trùng giờ + gợi ý | Danh sách theo ngày, trạng thái |
|---|---|
| ![Trùng giờ](docs/screenshots/02-conflict.png) | ![Danh sách](docs/screenshots/03-list.png) |
| **Validation** | **Mobile** |
| ![Validation](docs/screenshots/01-validation.png) | ![Mobile](docs/screenshots/04-mobile.png) |

## 4. Chức năng

1. **Tạo lịch hẹn:** tiêu đề (bắt buộc, ≤100 ký tự), ngày, giờ bắt đầu, giờ kết thúc, ghi chú (≤500 ký tự).
2. **Validation theo từng ô:** thiếu tiêu đề, ngày không tồn tại, giờ kết thúc ≤ giờ bắt đầu, lịch trong quá khứ, lịch dài quá 24h, ghi chú quá dài.
3. **Kiểm tra trùng giờ:**
   - Chặn lịch giao nhau với bất kỳ lịch *đang hoạt động* nào.
   - Lịch nối tiếp (09–10 rồi 10–11) **được phép**.
   - Lịch đã hủy hoặc đã xong **không chiếm giờ**.
   - Khi **khôi phục** một lịch đã hủy, app kiểm tra trùng lại.
4. **Gợi ý giờ trống gần nhất** có cùng độ dài, bấm một lần là form tự điền.
5. **Danh sách theo ngày:** sắp theo ngày và giờ, lọc theo một ngày cụ thể, thống kê sắp tới / đã xong / đã hủy.
6. **Trạng thái:** Xong, Hủy, Khôi phục, Bỏ đánh dấu, Xóa (có xác nhận).
7. Lưu tự động vào localStorage; giao diện responsive, có dark mode theo hệ thống.

### Thuật toán trùng giờ (tóm tắt)

Hai lịch `[s1, e1)` và `[s2, e2)` trùng nhau **khi và chỉ khi** `s1 < e2 && s2 < e1`. Một điều kiện này bao trọn 5 kiểu chồng giờ (trùng khít, chồng đầu, chồng cuối, nằm trong, bao ngoài), đồng thời cho phép lịch nối tiếp. Chi tiết và sơ đồ luồng ở [docs/DESIGN.md](docs/DESIGN.md#5-thuật-toán-kiểm-tra-trùng-giờ).

## 5. Cài đặt và chạy

Yêu cầu: **Node.js ≥ 20**. Project **không có dependency**, không cần `npm install`.

```bash
git clone <repo-url>
cd lich-hen-mini
npm start          # mở http://localhost:5173
npm test           # chạy 36 unit test
```

Chạy e2e trên trình duyệt thật (Edge/Chrome headless; script tự chụp lại ảnh vào `docs/screenshots/`):

```bash
npm start                      # terminal 1
node scripts/e2e-smoke.js      # terminal 2. Dùng Chrome: đặt biến BROWSER=<đường dẫn chrome.exe>
```

> Không có Node? Có thể mở trực tiếp bằng bất kỳ static server nào, ví dụ `python -m http.server`. Mở file `index.html` bằng `file://` sẽ không chạy vì trình duyệt chặn ES modules.

**Deploy (miễn phí):**

- **Vercel:** Import repo → Framework Preset: *Other* → bỏ trống Build Command → Deploy.
- **Netlify:** Add new site → Import from Git → bỏ trống Build command, Publish directory là `.` → Deploy.

## 6. Cấu trúc thư mục

```
lich-hen-mini/
├── index.html              # giao diện
├── css/style.css
├── src/
│   ├── scheduler.js        # ⭐ logic thuần: validate, trùng giờ, gợi ý, trạng thái
│   ├── storage.js          # đọc/ghi localStorage (có chống dữ liệu hỏng)
│   └── app.js              # DOM, sự kiện, render
├── tests/scheduler.test.js # 36 unit test (node:test)
├── scripts/
│   ├── serve.js            # static server, không dependency
│   └── e2e-smoke.js        # e2e qua DevTools Protocol
├── docs/
│   ├── DESIGN.md           # phạm vi MVP, Use Case, Class, State, luồng trùng giờ
│   ├── diagrams/*.png
│   ├── DECISIONS.md        # quyết định kỹ thuật + đánh đổi
│   ├── PLAN.md             # WBS, Definition of Done, mốc thời gian
│   ├── DAILY_LOG.md        # nhật ký hằng ngày + nhật ký rủi ro
│   ├── TEST_CASES.md       # test case thủ công (pass/fail) + unit test
│   ├── DEMO_SCRIPT.md      # kịch bản video
│   └── screenshots/
└── .github/workflows/test.yml  # CI chạy unit test mỗi lần push
```

## 7. Quyết định kỹ thuật (tóm tắt)

- **JS thuần, không framework, không build:** app chỉ có 1 màn hình; bỏ được thời gian cấu hình, deploy static ở đâu cũng chạy.
- **localStorage thay vì SQLite/backend:** app dùng cá nhân trên một thiết bị, không cần server, chạy được offline. Lớp `storage.js` tách riêng để sau này dễ thay.
- **Tách logic thuần khỏi UI:** phần quan trọng nhất (trùng giờ) test được mà không cần trình duyệt, và hàm nhận `now` làm tham số nên test luôn cho cùng kết quả.
- **`node:test` thay vì Jest:** có sẵn trong Node, không cần cấu hình ES modules, 0 dependency.

Đầy đủ 10 quyết định và đánh đổi ở [docs/DECISIONS.md](docs/DECISIONS.md).

## 8. Ngoài phạm vi

Những mục dưới đây **cố ý không làm** để luồng chính chạy trọn vẹn trong 1 tuần:

| Hạng mục | Lý do |
|---|---|
| Gửi email / thông báo nhắc hẹn | Đề bài ghi rõ không cần; cần backend và job hẹn giờ |
| Tích hợp Google Calendar | Đề bài ghi rõ không cần |
| **Social login** | Đề chỉ khuyến nghị. Dữ liệu đang ở localStorage nên đăng nhập không đồng bộ được gì nếu không có thêm backend (Firebase Auth + Firestore), ước tính tốn 1,5–2 ngày. Xem rủi ro R1 |
| Sửa lịch hẹn đã tạo | Hiện làm bằng cách xóa rồi tạo lại. Logic đã sẵn sàng (`findConflicts` có `ignoreId`), chỉ thiếu UI |
| Lịch lặp lại (hằng tuần...) | Làm thuật toán trùng giờ phức tạp hơn nhiều |
| Đồng bộ nhiều thiết bị, chia sẻ lịch | Cần backend |
| Chế độ xem lịch tháng/tuần dạng lưới | Danh sách theo ngày đã đáp ứng yêu cầu |
| Nhập lịch qua nửa đêm trên form | Logic **đã hỗ trợ** (có test TC-12), nhưng form chỉ có một ô ngày |

## 9. Hạn chế hiện tại

- Dữ liệu chỉ nằm trong trình duyệt đang dùng; xóa dữ liệu trình duyệt là mất. Chưa có xuất/nhập file.
- Không lưu múi giờ: nếu đổi múi giờ máy thì giờ hiển thị giữ nguyên theo giờ đã nhập.
- Không cho cố ý đặt chồng lịch, ví dụ hai việc có thể làm song song.
- Kiểm tra trùng là O(n) mỗi lần tạo; đủ nhanh cho vài nghìn lịch nhưng không tối ưu cho dữ liệu lớn.
- E2E script mặc định trỏ tới Edge trên Windows; dùng máy khác thì phải đặt biến `BROWSER`.

## 10. Tự đánh giá

**Điểm mạnh**
- Phần lõi (trùng giờ) được thiết kế có lý do rõ ràng: khoảng nửa mở, quy tắc lịch nào chiếm giờ. Mỗi quy tắc đều có test.
- Xử lý được một **case khó** dễ bỏ sót: khôi phục lịch đã hủy khi khung giờ đã bị chiếm (TC-30, E2E-14).
- Có thêm **gợi ý giờ trống**, nên app không chỉ báo lỗi mà còn giúp người dùng đặt được lịch.
- 3 lớp kiểm thử (36 unit, 14 e2e, 20 thủ công), có CI. Project 0 dependency nên ai clone về cũng chạy được ngay.
- Phạm vi được quản lý chủ động: phần cắt đều có lý do, rủi ro được ghi lại.

**Điểm yếu**
- Chưa có sửa lịch, chưa có xuất/nhập dữ liệu.
- UI render lại toàn bộ danh sách mỗi lần thay đổi (chấp nhận được ở quy mô cá nhân).
- Chưa kiểm tra accessibility bằng công cụ chuyên dụng (đã có `aria-invalid`, `aria-live`, `role=alert`).

**Nếu có thêm 1 tuần**
1. Sửa lịch hẹn, kiểm tra trùng có loại trừ chính nó (logic đã sẵn).
2. Xuất/nhập JSON hoặc `.ics` để sao lưu.
3. Social login + Firestore để đồng bộ nhiều thiết bị.
4. Chế độ xem tuần dạng lưới, kéo thả để đổi giờ.
5. Tùy chọn "vẫn lưu dù trùng" cho các việc làm song song.

## 11. Lessons Learned

- **Làm rõ đề trước khi code:** đề chỉ ghi "ngày giờ", nhưng muốn kiểm tra trùng thì phải có khoảng thời gian. Phát hiện điều này ngay ngày 1 nên tránh được việc phải làm lại.
- **Viết test cho trường hợp biên làm lộ lỗi thiết kế:** khi viết test chuyển trạng thái mới thấy lỗi khôi phục lịch gây trùng (R4).
- **`Date` của JavaScript dễ sai ngầm:** `new Date(2026, 1, 30)` không báo lỗi. Cần tự kiểm tra lại.
- **Cắt sớm tốt hơn làm dở:** bỏ social login từ ngày 1 nên có đủ thời gian cho test và tài liệu.

## 12. Tài liệu

[Thiết kế & sơ đồ](docs/DESIGN.md) · [Quyết định kỹ thuật](docs/DECISIONS.md) · [Kế hoạch WBS](docs/PLAN.md) · [Daily log & rủi ro](docs/DAILY_LOG.md) · [Test case](docs/TEST_CASES.md) · [Kịch bản demo](docs/DEMO_SCRIPT.md)
