# Quyết định kỹ thuật

| # | Quyết định | Lý do | Đánh đổi |
|---|---|---|---|
| D1 | **HTML/CSS/JS thuần (ES modules), không framework, không build** | App chỉ có 1 màn hình, 1 form và 1 danh sách. React/Vite sẽ tốn thời gian cài đặt và cấu hình mà không giúp gì cho bài toán trùng giờ. Deploy static ở mọi nơi, không có bước build nào có thể hỏng. | Render lại toàn bộ danh sách mỗi lần thay đổi. Với vài trăm lịch cá nhân thì không đáng kể. |
| D2 | **localStorage thay vì SQLite/backend** | Dùng cá nhân, một thiết bị. Không cần server, không tốn chi phí, chạy được offline. `storage.js` tách riêng nên sau này đổi sang API chỉ cần sửa một file. | Dữ liệu không đồng bộ giữa các máy, mất khi xóa dữ liệu trình duyệt. |
| D3 | **Tách logic thuần (`scheduler.js`) khỏi UI (`app.js`)** | Logic trùng giờ là phần quan trọng nhất, nên phải test được mà không cần trình duyệt. Hàm nhận `now` làm tham số nên test luôn cho cùng một kết quả. | Thêm một lớp truyền dữ liệu qua lại, nhưng code nhỏ nên không đáng kể. |
| D4 | **Test bằng `node:test` có sẵn trong Node ≥ 20** | Không cần `npm install`. Ban đầu định dùng Jest, nhưng Jest cần thêm cấu hình mới chạy được ES modules (xem Rủi ro R3). | Báo cáo ít đẹp hơn Jest/Vitest. |
| D5 | **Khoảng thời gian nửa mở `[start, end)`** | Đúng với cách người dùng hiểu: họp 9–10 rồi họp 10–11 là hợp lệ. Chỉ cần một phép so sánh `s1 < e2 && s2 < e1`. | — |
| D6 | **Chỉ lịch `scheduled` chiếm khung giờ** | Lịch đã hủy phải giải phóng khung giờ. Lịch đã xong nghĩa là việc đã kết thúc: nếu cuộc họp 9–10 xong lúc 9:30 thì người dùng nên đặt được lịch mới lúc 9:30. | Khi "bỏ đánh dấu xong" thì phải kiểm tra trùng lại. Đã xử lý trong `changeStatus`. |
| D7 | **Lưu giờ dạng chuỗi địa phương `YYYY-MM-DDTHH:mm`** | Giống hệt giá trị của `<input type=date/time>`, đọc được bằng mắt trong localStorage, và so sánh ngày chỉ cần `startsWith`. | Không lưu múi giờ. Chấp nhận vì app chỉ dùng cá nhân trên một thiết bị (ghi ở phần Hạn chế). |
| D8 | **Chặn trùng giờ (không chỉ cảnh báo) + gợi ý giờ trống** | Đề bài yêu cầu kiểm tra trùng. Chặn hẳn thì dữ liệu luôn nhất quán, còn nút gợi ý giúp người dùng không phải tự dò giờ trống. | Không cho cố ý đặt chồng lịch, ví dụ hai việc làm song song. Ghi ở phần Future work: tùy chọn "vẫn lưu". |
| D9 | **Không làm social login** | Đề chỉ *khuyến nghị*. Dữ liệu đang nằm trong localStorage nên đăng nhập không đồng bộ được gì nếu không có backend. Muốn có ý nghĩa thì phải thêm Firebase Auth + Firestore, tức là thêm hạ tầng và cấu hình OAuth domain, vượt quỹ thời gian 1 tuần mà không phục vụ bài toán trùng giờ. | Ghi rõ ở phần Ngoài phạm vi. |
| D10 | **Deploy static lên Vercel/Netlify** | Miễn phí, không cần build, có HTTPS. | — |
