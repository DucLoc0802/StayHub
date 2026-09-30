# StayHub — kế hoạch triển khai

Người dùng đã yêu cầu tạo mới hoàn toàn ngày 28/09/2026. Thư mục ban đầu trống. Phạm vi nghiệp vụ dựa trên task.txt; yêu cầu tạo mới thay thế giả định dự án có sẵn trong tài liệu.

- [x] Kiểm tra workspace, đọc yêu cầu 17 use case.
- [x] Xác định kiến trúc Next.js / NestJS / Prisma / MySQL.
- [x] Schema, migration, dữ liệu demo.
- [x] Xác thực, phân quyền, duyệt người cho thuê.
- [x] Quản lý và tìm kiếm chỗ nghỉ.
- [x] Đặt chỗ, thanh toán cọc nguyên tử, hủy đặt chỗ.
- [x] Giao diện tiếng Việt, cam ấm / kem / trắng, responsive.
- [x] Tài liệu nghiệp vụ, Postman, kiểm thử.
- [x] Lint, build, Prisma, kiểm tra tích hợp và giao diện.

Môi trường: Node.js 24, npm qua npm.cmd. Docker chưa có. Đã tải MySQL portable chính thức vào .local, chạy riêng trên 127.0.0.1:3307, không cài dịch vụ Windows. Migration và seed đã chạy trên MySQL thật. Kết quả, giới hạn và lệnh tái kiểm chứng: docs/verification.md.
