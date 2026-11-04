# Kịch bản video demo (~1 phút 45 giây)

Gợi ý quay: OBS hoặc Xbox Game Bar (`Win + Alt + R`), cửa sổ trình duyệt 1280×800, mở link deploy thật. Xóa localStorage trước khi quay.

| Thời điểm | Thao tác trên màn hình | Lời nói gợi ý |
|---|---|---|
| 0:00–0:15 | Mở trang → bấm "Đăng nhập bằng Google" → chọn tài khoản → avatar và tên hiện góc phải | "Đây là Lịch Hẹn Mini, app đặt lịch cá nhân có kiểm tra trùng giờ, đã deploy trên Vercel. Đăng nhập bằng Google; mỗi tài khoản có danh sách lịch riêng." |
| 0:10–0:25 | Bấm Lưu khi form trống → hiện lỗi. Chọn giờ kết thúc trước giờ bắt đầu → hiện lỗi | "Form có validation: thiếu tiêu đề, giờ kết thúc trước giờ bắt đầu, đặt lịch trong quá khứ đều bị chặn." |
| 0:25–0:40 | Bấm ngày mai trên lịch tháng → "Thêm lịch vào ngày này" → tạo "Họp nhóm" 09:00–10:00 | "Bấm một ngày trên lịch là thêm lịch được cho ngày đó. Lưu xong, ngày đó có chấm cam." |
| 0:40–1:05 | Tạo "Gọi khách" 09:30–10:15 → hộp cảnh báo, lịch cũ được tô vàng → bấm "Dùng giờ trống gần nhất" → Lưu | "Lịch thứ hai chồng giờ nên bị chặn. App chỉ ra lịch bị trùng và gợi ý khung trống gần nhất có cùng độ dài." |
| 1:05–1:15 | Tạo 10:45–11:15 | "Lịch nối tiếp đúng lúc lịch trước kết thúc thì không tính là trùng." |
| 1:15–1:30 | Bấm vào một lịch → popup chi tiết → Xong; mở lịch khác → Hủy. Hủy "Họp nhóm", tạo lịch khác 09:00, rồi bấm Khôi phục "Họp nhóm" → bị chặn | "Có thể đánh dấu xong hoặc hủy. Lịch đã hủy giải phóng khung giờ, nhưng nếu khung đó đã bị lịch khác chiếm thì không khôi phục được." |
| 1:30–1:40 | Nhấn F5 → dữ liệu còn. Bấm một ngày có chấm trên lịch tháng | "Dữ liệu lưu trong localStorage. Ngày nào có hẹn thì lịch tháng đánh dấu chấm, bấm vào là lọc theo ngày đó." |
| 1:40–1:50 | Chuyển sang terminal chạy `npm test` → 50 pass | "Có 50 unit test, trong đó 13 case dành riêng cho việc tạo lịch trùng." |
