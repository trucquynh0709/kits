# Thiết kế — Lịch Hẹn Mini

Ảnh PNG của các sơ đồ nằm trong [`docs/diagrams/`](diagrams/). Mã nguồn sơ đồ (Mermaid) ở ngay dưới, GitHub tự hiển thị.

## 1. Phạm vi MVP và lý do chọn

Bài toán gốc là *"tạo lịch hẹn mà không bị chồng giờ"*. MVP chỉ giữ những gì cần để luồng đó chạy trọn vẹn:

| Giữ lại (trong MVP) | Lý do |
|---|---|
| Form tạo lịch: tiêu đề, ngày, giờ bắt đầu/kết thúc, ghi chú | Đầu vào bắt buộc của bài toán. Cần **giờ kết thúc** vì không có khoảng thời gian thì không thể kiểm tra trùng. |
| Validation + kiểm tra trùng giờ | Đây là phần "giải quyết vấn đề" của đề bài. |
| Danh sách nhóm theo ngày + lọc theo ngày | Người dùng cần thấy ngày nào đã kín. |
| Đánh dấu xong / hủy / khôi phục / xóa | Vòng đời tối thiểu của một lịch hẹn. |
| Lưu localStorage | Đủ cho dùng cá nhân, không cần server. |

Những thứ bị cắt có lý do ghi ở [README › Ngoài phạm vi](../README.md#ngoài-phạm-vi).

## 2. Sơ đồ Use Case

![Use case](diagrams/use-case.png)

```mermaid
flowchart LR
    U(("👤 Người dùng"))
    subgraph SYS["Hệ thống Lịch Hẹn Mini"]
        UC1([Tạo lịch hẹn])
        UC1a([Kiểm tra dữ liệu hợp lệ])
        UC1b([Kiểm tra trùng giờ])
        UC1c([Gợi ý khung giờ trống])
        UC2([Xem danh sách theo ngày])
        UC3([Đánh dấu đã xong])
        UC4([Hủy lịch hẹn])
        UC5([Khôi phục lịch hẹn])
        UC6([Xóa lịch hẹn])
    end
    U --- UC1
    U --- UC2
    U --- UC3
    U --- UC4
    U --- UC5
    U --- UC6
    UC1 -. include .-> UC1a
    UC1 -. include .-> UC1b
    UC5 -. include .-> UC1b
    UC1b -. extend .-> UC1c
```

## 3. Sơ đồ lớp / dữ liệu

Chỉ có **một thực thể** `Appointment`, nên ERD đơn giản hoá thành sơ đồ lớp kèm các module xử lý.

![Class diagram](diagrams/class.png)

```mermaid
classDiagram
    class Appointment {
        +string id
        +string title  ≤100 ký tự
        +string start  "YYYY-MM-DDTHH:mm"
        +string end    "YYYY-MM-DDTHH:mm"
        +string note   ≤500 ký tự
        +Status status
        +number createdAt
    }
    class Status {
        <<enumeration>>
        scheduled
        done
        cancelled
    }
    class scheduler_js {
        <<module — logic thuần, có unit test>>
        +validateAppointment(input, now) errors
        +overlaps(a, b) bool
        +findConflicts(candidate, list, ignoreId) Appointment[]
        +suggestFreeSlot(candidate, list) Slot
        +createAppointment(input, list, now) Result
        +changeStatus(list, id, next, now) Result
        +deleteAppointment(list, id) Appointment[]
        +groupByDate(list) DayGroup[]
    }
    class storage_js {
        <<module>>
        +loadAppointments() Appointment[]
        +saveAppointments(list) bool
    }
    class app_js {
        <<module — UI/DOM>>
    }
    Appointment --> Status
    app_js ..> scheduler_js : gọi
    app_js ..> storage_js : gọi
    storage_js ..> Appointment : JSON trong localStorage
```

## 4. Vòng đời trạng thái

![State diagram](diagrams/state.png)

```mermaid
stateDiagram-v2
    [*] --> scheduled : Tạo (hợp lệ & không trùng)
    scheduled --> done : Đánh dấu xong
    scheduled --> cancelled : Hủy
    done --> scheduled : Bỏ đánh dấu<br/>(kiểm tra trùng lại)
    cancelled --> scheduled : Khôi phục<br/>(kiểm tra trùng lại, chưa qua giờ)
    scheduled --> [*] : Xóa
    done --> [*] : Xóa
    cancelled --> [*] : Xóa
```

Chuyển `cancelled → done` bị chặn: một lịch đã hủy thì không thể "hoàn thành".

## 5. Thuật toán kiểm tra trùng giờ

![Conflict flow](diagrams/conflict-flow.png)

```mermaid
flowchart TD
    A[Người dùng bấm Lưu] --> B{validateAppointment<br/>có lỗi?}
    B -- có --> E1[Hiện lỗi dưới từng ô<br/>KHÔNG kiểm tra trùng]
    B -- không --> C[Lọc các lịch status = scheduled]
    C --> D{"Tồn tại lịch X:<br/>new.start &lt; X.end<br/>VÀ X.start &lt; new.end ?"}
    D -- có --> F[Trả về danh sách lịch trùng<br/>+ highlight trong danh sách]
    F --> G[suggestFreeSlot: nhảy tới end muộn nhất<br/>của các lịch trùng, lặp đến khi trống]
    G --> H[Nút 'Dùng giờ trống gần nhất']
    D -- không --> I[Thêm lịch, lưu localStorage, render]
```

**Điều kiện trùng:** hai khoảng nửa mở `[s1, e1)` và `[s2, e2)` giao nhau ⇔ `s1 < e2 && s2 < e1`.

- Một điều kiện duy nhất bao được cả 5 trường hợp: trùng khít, chồng đầu, chồng cuối, nằm trong, bao ngoài.
- Dùng khoảng **nửa mở** nên lịch nối tiếp (09:00–10:00 rồi 10:00–11:00) **không** tính là trùng.
- So sánh bằng timestamp đầy đủ (ngày + giờ) nên lịch qua nửa đêm (23:00–01:00) vẫn đúng.
- Độ phức tạp O(n) mỗi lần tạo, đủ cho vài nghìn lịch cá nhân.

**Các trường hợp khó đã xử lý:**

1. **Khôi phục lịch đã hủy.** Khi lịch A bị hủy, khung giờ của nó được giải phóng và người dùng có thể đặt lịch B vào đó. Nếu sau đó khôi phục A mà không kiểm tra thì hai lịch sẽ trùng nhau. `changeStatus` vì vậy chạy lại `findConflicts` mỗi khi đưa một lịch về `scheduled` (TC-30).
2. **Ngày không tồn tại.** `new Date(2026, 1, 30)` tự "lăn" sang 02/03. `toMs` so lại từng thành phần để từ chối 30/02 (TC-22).
3. **Gợi ý qua chuỗi lịch liền nhau.** Nhảy một bước là chưa đủ, vì slot mới có thể đụng tiếp lịch kế bên. Thuật toán lặp đến khi tìm được chỗ trống (TC-15).
