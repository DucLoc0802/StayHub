# StayHub — tiến độ triển khai

## Mô hình đặt phòng hiện tại

- [x] Kiểm tra schema, API, auth, seed và giao diện có sẵn.
- [x] Chuyển sang Property → RoomType → Booking; giữ Guest / Host / Admin.
- [x] Tồn phòng từng đêm, số lượng, pending giữ phòng và checkout exclusive.
- [x] Snapshot giá/tên/số lượng, deadline cọc, lead time và quy tắc 24 giờ.
- [x] Tối đa 2 đơn unpaid, chặn giữ trùng và tạm khóa do nhiều lần hết hạn.
- [x] Scheduler backend và lazy expiry; payment từ chối vẫn commit hết hạn.
- [x] Host quản lý loại phòng, khách chọn loại/số lượng, lịch sử hiển thị deadline/EXPIRED.
- [x] Migration, seed tổng hợp, unit/integration/API/browser tests.
- [x] Giữ giao diện cam/kem, animation, reduced motion và hỗ trợ bàn phím.
- [x] Màu lịch theo tồn từng loại phòng và chặn ngày hết phòng.
- [x] Hồ sơ khách, số điện thoại và gate đặt phòng phía backend/frontend.
- [x] Mã booking duy nhất, tra cứu có phân quyền và QR thanh toán demo.
- [x] Hóa đơn snapshot, in/xuất PDF bằng trình duyệt.
- [x] Đánh giá duy nhất sau trả phòng; điểm trung bình và đánh giá công khai.
- [x] Admin quản lý tiện ích, người dùng an toàn, lịch sử khách, thống kê và tìm đơn.
- [x] Migration cộng thêm, seed tám tình huống và kiểm tra bảo toàn dữ liệu.

Quy tắc, API, dữ liệu và giới hạn: [booking-model.md](docs/booking-model.md).
Các chức năng bổ sung: [business-features.md](docs/business-features.md).
Lệnh chạy và môi trường: [README.md](README.md).
Kết quả thực tế: [verification.md](docs/verification.md).
