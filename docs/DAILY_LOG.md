# Nhật ký công việc (Daily log)

Mỗi ngày gồm: **Hôm qua** đã làm gì · **Hôm nay** làm gì · **Vướng mắc** · **Rủi ro / quyết định**.

---

### Ngày 1 — 04/11/2026
- **Hôm qua:** Nhận đề bài.
- **Hôm nay:** Đọc tiêu chí chấm, chốt MVP. Vẽ sơ đồ use case, class, state. Chọn stack (JS thuần + localStorage + `node:test`).
- **Vướng mắc:** Đề chỉ ghi "ngày giờ", nhưng chỉ có một mốc giờ thì không kiểm tra trùng được. → Thêm trường **giờ kết thúc**.
- **Rủi ro:** R1 (scope creep: social login).

### Ngày 2 — 05/11/2026
- **Hôm qua:** Xong thiết kế và phạm vi.
- **Hôm nay:** Viết `validateAppointment`, `overlaps`, `findConflicts` cùng unit test cho 13 case tạo lịch trùng.
- **Vướng mắc:** `new Date(2026, 1, 30)` không báo lỗi mà tự thành 02/03. → Viết `toMs` so lại từng thành phần ngày/giờ (TC-22).
- **Rủi ro:** R3 (công cụ test). Bỏ Jest, chuyển sang `node:test`.

### Ngày 3 — 06/11/2026
- **Hôm qua:** Logic trùng giờ pass test (đạt M1).
- **Hôm nay:** `changeStatus`, `suggestFreeSlot`, form tạo lịch.
- **Vướng mắc:** Phát hiện bug thiết kế: hủy lịch A → đặt B vào giờ đó → khôi phục A thì A trùng B. → Kiểm tra trùng lại khi khôi phục (TC-30).
- **Rủi ro:** R2 (định nghĩa trùng): chốt là lịch đã xong không chiếm giờ (D6).

### Ngày 4 — 07/11/2026
- **Hôm qua:** Form + validation hiển thị đúng.
- **Hôm nay:** Danh sách theo ngày, bộ lọc, các nút trạng thái, hộp cảnh báo trùng + gợi ý giờ (đạt M2).
- **Vướng mắc:** Không có.

### Ngày 5 — 08/11/2026
- **Hôm qua:** Luồng chính chạy end-to-end.
- **Hôm nay:** Responsive, dark mode, script e2e smoke test, chạy test thủ công.
- **Vướng mắc:** Ảnh chụp headless hiển thị ngày theo định dạng en-US vì locale của trình duyệt headless. Trình duyệt thật dùng locale của máy nên không phải lỗi.

### Ngày 6 — 09/11/2026
- **Hôm qua:** Test thủ công pass toàn bộ.
- **Hôm nay:** Push GitHub, bật CI, deploy Vercel, quay video demo.
- **Vướng mắc:** _(điền)_

### Ngày 7 — 10/11/2026
- **Hôm qua:** _(điền)_
- **Hôm nay:** Hoàn thiện README, tự đánh giá, rà soát lần cuối, nộp bài.
- **Vướng mắc:** _(điền)_

---

## Nhật ký rủi ro & thay đổi

| ID | Rủi ro | Phát hiện | Ảnh hưởng | Hành động ứng phó | Kết quả |
|---|---|---|---|---|---|
| R1 | **Scope creep:** social login (được khuyến nghị) | N1 | Cao: cần thêm backend + OAuth mới có ý nghĩa, ước tính 1,5–2 ngày | **Cắt**, ghi vào Ngoài phạm vi kèm lý do (D9) | Giữ được thời gian cho logic lõi + test |
| R2 | Định nghĩa "trùng" chưa rõ: lịch nối tiếp, lịch đã xong/hủy | N1–N3 | Trung bình: sai định nghĩa thì người dùng khó chịu | Chọn khoảng nửa mở; chỉ lịch `scheduled` chiếm giờ; viết test cho từng quy tắc | TC-06, 07, 09, 10 |
| R3 | **Thư viện:** Jest + ES modules cần thêm cấu hình | N2 | Thấp–Trung bình: mất thời gian cấu hình | **Đổi thư viện** sang `node:test` có sẵn | 0 dependency, CI đơn giản |
| R4 | Bug khôi phục lịch đã hủy gây trùng | N3 | Cao: phá vỡ đúng tính năng chính | Kiểm tra trùng lại mỗi khi chuyển về `scheduled` | TC-30, TC-T09 |
| R5 | Không có thời gian quay video / deploy cuối tuần | N1 | Trung bình | Dành N6 riêng cho việc này, N7 làm buffer | _(cập nhật)_ |
