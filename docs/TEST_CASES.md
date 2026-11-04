# Danh sách test case

Có 3 lớp kiểm thử:

| Lớp | Cách chạy | Kết quả |
|---|---|---|
| Unit test (`tests/scheduler.test.js`, `tests/auth.test.js`) | `npm test` | **45/45 pass** |
| E2E smoke test trên trình duyệt thật (tự động hoá phần lớn bảng A) | `npm start` rồi `node scripts/e2e-smoke.js` | **17/17 pass** |
| Test thủ công (bảng dưới) | Theo các bước trong bảng | **22/25 pass**, 3 case chờ test với Google Client ID thật |

## A. Test thủ công

**Môi trường:** Edge/Chrome trên Windows 11, desktop 1200px và mobile 390px. Trước khi test: mở DevTools → Application → Local Storage → xóa các key bắt đầu bằng `lich-hen-mini`, rồi bấm "Dùng thử không đăng nhập" (trừ nhóm A4).
**Dữ liệu chuẩn bị:** tạo trước lịch **"Họp nhóm" 09:00–10:00 ngày mai** (gọi tắt là lịch A).

### A1. Tạo lịch trùng giờ (trọng tâm)

| ID | Bước thực hiện | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| TC-T01 | Tạo lịch 09:00–10:00 cùng ngày với A | Bị chặn; dưới ô giờ hiện "Khung giờ này trùng với lịch hẹn khác"; hộp vàng liệt kê A; A được viền vàng trong danh sách | ✅ Pass |
| TC-T02 | Tạo lịch 08:30–09:30 (chồng đầu) | Bị chặn như T01 | ✅ Pass |
| TC-T03 | Tạo lịch 09:45–10:30 (chồng cuối) | Bị chặn | ✅ Pass |
| TC-T04 | Tạo lịch 09:15–09:45 (nằm trong A) | Bị chặn | ✅ Pass |
| TC-T05 | Tạo lịch 08:00–11:00 (bao trùm A) | Bị chặn | ✅ Pass |
| TC-T06 | Tạo lịch 10:00–11:00 (nối tiếp ngay sau A) | **Lưu thành công** | ✅ Pass |
| TC-T07 | Tạo lịch 09:00–10:00 vào **ngày kia** | Lưu thành công | ✅ Pass |
| TC-T08 | Hủy A, rồi tạo lịch 09:00–10:00 | Lưu thành công (lịch hủy không chiếm giờ) | ✅ Pass |
| TC-T09 | Tiếp T08: bấm **Khôi phục** lịch A | Bị chặn; toast đỏ "Không thể khôi phục: khung giờ đã bị lịch khác chiếm" và nêu lịch đang chiếm | ✅ Pass |
| TC-T10 | Tạo lịch 09:30–10:15 (trùng A), bấm "Dùng giờ trống gần nhất" | Form tự điền 10:00–10:45; bấm Lưu thì thành công | ✅ Pass |

### A2. Validation

| ID | Bước thực hiện | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| TC-T11 | Để trống tiêu đề, bấm Lưu | "Vui lòng nhập tiêu đề."; ô viền đỏ; không tạo lịch | ✅ Pass |
| TC-T12 | Tiêu đề chỉ có dấu cách | Lỗi như T11 | ✅ Pass |
| TC-T13 | Giờ kết thúc 09:00, giờ bắt đầu 10:00 | "Giờ kết thúc phải sau giờ bắt đầu." | ✅ Pass |
| TC-T14 | Chọn ngày hôm qua | "Không thể đặt lịch trong quá khứ." | ✅ Pass |
| TC-T15 | Ghi chú dán 510 ký tự | Bộ đếm chuyển đỏ; lỗi "Ghi chú tối đa 500 ký tự." | ✅ Pass |
| TC-T16 | Tiêu đề chứa `<img src=x onerror=alert(1)>` | Hiển thị đúng nguyên văn chuỗi, không chạy script | ✅ Pass |

### A3. Danh sách & trạng thái

| ID | Bước thực hiện | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| TC-T17 | Bấm "Nạp dữ liệu mẫu", rồi "Tất cả" | Các lịch nhóm theo ngày, ngày và giờ tăng dần; ngày hôm nay có nhãn "Hôm nay" | ✅ Pass |
| TC-T18 | Bấm "✓ Xong" trên một lịch | Tiêu đề gạch ngang, có nhãn "Đã xong"; thống kê cập nhật | ✅ Pass |
| TC-T19 | Bỏ tick "Hiện lịch đã hủy" | Lịch hủy biến mất khỏi danh sách; tick lại thì hiện lại | ✅ Pass |
| TC-T20 | Tạo/hủy vài lịch rồi F5 | Dữ liệu và trạng thái giữ nguyên | ✅ Pass |

### A4. Đăng nhập

| ID | Bước thực hiện | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| TC-T21 | Mở trang lần đầu, bấm "Dùng thử không đăng nhập" | Vào app; góc phải hiện "Khách (chưa đăng nhập)" | ✅ Pass |
| TC-T22 | Bấm "Đăng xuất", rồi vào lại chế độ khách | Về màn hình đăng nhập, danh sách bị ẩn; vào lại thì lịch cũ vẫn còn | ✅ Pass |
| TC-T23 | Đã cấu hình Client ID: bấm "Đăng nhập bằng Google", chọn tài khoản A | Vào app, hiện avatar và tên tài khoản A; toast "Xin chào…" | ⏳ Chờ test |
| TC-T24 | Tài khoản A tạo 1 lịch → Đăng xuất → đăng nhập tài khoản B | B không thấy lịch của A; đăng nhập lại A thì thấy lại (logic đã có unit test AU-07) | ⏳ Chờ test |
| TC-T25 | Đang đăng nhập Google, nhấn F5 | Vẫn ở trong app, không phải đăng nhập lại | ⏳ Chờ test |

## B. Unit test tự động: tạo lịch trùng

Trích từ `tests/scheduler.test.js` (mốc "hiện tại" cố định 01/11/2026 08:00; lịch có sẵn A = 05/11 09:00–10:00):

| ID | Đầu vào | Mong đợi |
|---|---|---|
| TC-01 | 09:00–10:00 | Trùng (A) |
| TC-02 | 08:30–09:30 | Trùng |
| TC-03 | 09:45–10:30 | Trùng |
| TC-04 | 09:15–09:45 | Trùng |
| TC-05 | 08:00–11:00 | Trùng |
| TC-06 | 10:00–11:00 | Không trùng (biên) |
| TC-07 | 08:00–09:00 | Không trùng (biên) |
| TC-08 | 06/11 09:00–10:00 | Không trùng (khác ngày) |
| TC-09 | A đã hủy, 09:00–10:00 | Không trùng |
| TC-10 | A đã xong, 09:30–10:30 | Không trùng |
| TC-11 | 09:30–11:30 với 3 lịch A, B, C | Trùng A và C, sắp theo giờ |
| TC-12 | Lịch 23:00–01:00, tạo 00:30–01:30 hôm sau | Trùng (qua nửa đêm) |
| TC-13 | Tạo trùng | Mảng gốc không bị thay đổi |
| TC-30 | Khôi phục lịch hủy khi đã có lịch khác chiếm | Bị chặn |

Các test còn lại: gợi ý giờ trống (TC-14, 15), validation (TC-16 → 26), trạng thái (TC-27 → 33), danh sách (TC-34 → 36).

Đăng nhập (`tests/auth.test.js`): AU-01 token hợp lệ, giữ tên tiếng Việt có dấu · AU-02 token hết hạn · AU-03 sai `aud` · AU-04 sai `iss` · AU-05 token rác · AU-06 thiếu tên thì dùng email · AU-07 hai tài khoản tách dữ liệu · AU-08 chuyển dữ liệu bản cũ sang tài khoản khách · AU-09 dữ liệu hỏng không làm sập app.

Kết quả chạy:

```
$ npm test
# tests 45
# suites 7
# pass 45
# fail 0
```
