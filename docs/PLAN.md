# Kế hoạch & WBS (1 tuần: 04/11 – 10/11/2026)

> Ngày bắt đầu lấy theo ngày khởi tạo repo. Nếu lịch thật của bạn khác, chỉnh lại cột **Ngày**.

## Mục tiêu tuần

Một website đặt lịch hẹn cá nhân, chạy end-to-end, **không cho tạo lịch trùng giờ**, có test tự động, có tài liệu và đã deploy.

## WBS

| ID | Hạng mục / Task | Ngày | Ước lượng | Definition of Done | Trạng thái |
|---|---|---|---|---|---|
| **1** | **Phân tích & thiết kế** | | | | |
| 1.1 | Chốt phạm vi MVP, danh sách ngoài phạm vi | N1 | 1h | Có bảng "giữ / cắt" trong DESIGN.md, mỗi mục có lý do | ✅ |
| 1.2 | Sơ đồ Use Case, Class, State, luồng kiểm tra trùng | N1 | 1.5h | 4 sơ đồ có ảnh PNG trong `docs/diagrams/` | ✅ |
| 1.3 | Chọn công nghệ | N1 | 0.5h | DECISIONS.md có lý do và đánh đổi cho từng lựa chọn | ✅ |
| **2** | **Logic lõi** (`scheduler.js`) | | | | |
| 2.1 | Validation dữ liệu | N2 | 1.5h | Bắt lỗi tiêu đề rỗng/quá dài, ngày sai, end ≤ start, quá khứ, > 24h, ghi chú dài; có unit test cho từng lỗi | ✅ |
| 2.2 | Kiểm tra trùng giờ | N2 | 2h | Đủ 5 kiểu chồng + biên nối tiếp + qua nửa đêm + bỏ qua lịch hủy/xong; test pass | ✅ |
| 2.3 | Đổi trạng thái + kiểm tra trùng khi khôi phục | N3 | 1h | Chặn chuyển trạng thái sai; khôi phục bị chặn khi khung giờ đã có lịch khác; test pass | ✅ |
| 2.4 | Gợi ý khung giờ trống | N3 | 1h | Nhảy qua được chuỗi lịch liền nhau; test pass | ✅ |
| **3** | **Giao diện** | | | | |
| 3.1 | Form tạo lịch + hiển thị lỗi theo từng ô | N3 | 2h | Lỗi hiện dưới đúng ô, ô lỗi viền đỏ | ✅ |
| 3.2 | Danh sách nhóm theo ngày, lọc ngày, ẩn/hiện lịch hủy | N4 | 2h | Ngày và giờ sắp tăng dần; có nhãn "Hôm nay"; có thông báo khi danh sách rỗng | ✅ |
| 3.3 | Nút Xong / Hủy / Khôi phục / Xóa | N4 | 1h | Thao tác xong, reload trang vẫn giữ nguyên trạng thái | ✅ |
| 3.4 | Hộp cảnh báo trùng + nút dùng giờ gợi ý | N4 | 1h | Liệt kê lịch bị trùng, highlight trong danh sách, bấm gợi ý thì form tự điền giờ | ✅ |
| 3.5 | Responsive + giao diện (tông sáng be/cam) | N5 | 1h | Không cuộn ngang ở màn hình 390px | ✅ |
| 3.7 | Lịch tháng kiểu date picker | N5 | 1.5h | Chấm đánh dấu ngày có hẹn; bấm ngày → lọc danh sách; có unit test lưới tháng | ✅ |
| 3.8 | CTA "Tạo lịch hẹn" + form dạng popup; nút "Thêm lịch vào ngày này" | N5 | 1.5h | Action chính luôn thấy ngay không cần cuộn; popup điền sẵn ngày + giờ trống đầu tiên; đóng bằng ✕ / Hủy / Esc / bấm nền | ✅ |
| 3.6 | Đăng nhập Google + chế độ khách *(thêm lại sau khi xem lại R1)* | N5 | 3h | Đăng nhập/đăng xuất được; mỗi tài khoản thấy dữ liệu riêng; token hết hạn/sai app bị từ chối; có unit test | ✅ (luồng Google chờ test với Client ID thật) |
| **4** | **Kiểm thử** | | | | |
| 3.9 | Lọc theo trạng thái (Sắp tới / Đã xong / Đã hủy) kèm số lượng | N5 | 0.5h | Bấm tab → danh sách chỉ còn đúng các lịch được đếm | ✅ |
| 3.10 | Danh sách nhiều ngày: nhãn ngày tương đối + số lịch, lịch sử mới nhất trước, bấm tiêu đề ngày để chọn ngày | N5 | 1h | Lọc "đã xong" trên 3 ngày khác nhau hiện đúng thứ tự mới → cũ; có unit test | ✅ |
| 3.11 | Popup chi tiết lịch hẹn | N5 | 1h | Bấm vào lịch → thấy đủ ngày/giờ/thời lượng/ghi chú/trạng thái; đổi trạng thái ngay trong popup, lỗi khôi phục hiện trong popup | ✅ |
| 3.12 | Tinh gọn giao diện (phản hồi "rối mắt, trông như AI") | N5 | 2h | Bỏ trang kiểu landing, bỏ nút trên từng dòng (thao tác dồn vào popup), gộp lọc thành 1 hàng tab, chỉ 1 màu nhấn | ✅ |
| 3.13 | Thao tác nhanh trên dòng (nút ✓ / 🗑 hiện khi rê chuột) + popup xác nhận riêng thay `confirm()` | N5 | 1h | Đánh dấu xong/xóa không cần mở chi tiết; xóa luôn hỏi lại bằng popup cùng phong cách | ✅ |
| 4.1 | Unit test logic | N2–N3, N5 | (trong 2.x, 3.6) | `npm test` pass 52/52 | ✅ |
| 4.2 | E2E smoke test trên trình duyệt | N5 | 1.5h | `node scripts/e2e-smoke.js` pass 41/41, tự chụp ảnh màn hình | ✅ |
| 4.3 | Test thủ công theo TEST_CASES.md | N5 | 1h | Mọi case có kết quả Pass/Fail | ✅ |
| **5** | **Triển khai & bàn giao** | | | | |
| 5.1 | Đẩy GitHub + CI chạy test | N6 | 0.5h | GitHub Actions xanh | ✅ |
| 5.2 | Deploy Vercel/Netlify + khai báo domain trong Google Console | N6 | 0.5h | Có link công khai trong README; đăng nhập Google chạy trên link đó | ✅ https://kits-opal.vercel.app |
| 5.3 | ~~Quay video demo 1–2 phút~~ → **Trang chủ giới thiệu dự án** (landing + đăng nhập, đổi theo yêu cầu GV) | N6 | 1h | Trang chủ có vấn đề, mục tiêu – kết quả, use case, thiết kế, kiểm thử, ngoài phạm vi, tự đánh giá | ✅ |
| 5.4 | README, daily log, tự đánh giá | N7 | 1.5h | Đủ các mục theo tiêu chí chấm | ✅ |
| 5.5 | Buffer: sửa lỗi phát sinh, rà soát | N7 | 2h | — | ☐ |

**Tổng ước lượng:** ~29h, khoảng 4h/ngày.

## Mốc

- **M1 (cuối N2):** logic trùng giờ có test pass. Đây là mốc quan trọng nhất; nếu trễ thì cắt task 2.4 và 3.5.
- **M2 (cuối N4):** luồng tạo → xem → xong/hủy chạy end-to-end trên UI.
- **M3 (cuối N6):** đã deploy và có video.
- **M4 (N7):** nộp bài.

## Quy tắc cắt phạm vi

Nếu một task trễ quá 50% ước lượng, cắt theo thứ tự ưu tiên thấp đến cao: lịch tháng → gợi ý giờ trống → lọc lịch hủy. **Không bao giờ cắt** kiểm tra trùng và test của nó.
