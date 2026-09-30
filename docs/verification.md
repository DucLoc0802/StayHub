# Báo cáo kiểm chứng StayHub

Ngày thực hiện: 28/09/2026. Nguồn yêu cầu: task.txt và yêu cầu trực tiếp tạo mới hoàn toàn. Workspace ban đầu trống.

## Môi trường đã chạy

- Windows, Node.js 24.11.1, npm 11.6.2 qua npm.cmd.
- Next.js 16.3.6 và NestJS 11; Prisma Client/CLI 6.19.2.
- MySQL Community 8.4.11 portable chính thức, checksum ZIP đối chiếu với trang tải Oracle/MySQL. Database riêng trong .local/mysql-data, bind 127.0.0.1:3307. Không cài Windows service.
- Docker không được cài/không có trong PATH. docker-compose.yml đã cung cấp nhưng chưa chạy Docker Compose. Cổng 3306 đang bận; không tác động dịch vụ đó.
- Frontend http://localhost:3000; backend http://localhost:4000/api; Swagger /api/docs.

## Kết quả tự động

| Kiểm tra                             | Kết quả                                  |
| ------------------------------------ | ---------------------------------------- |
| Backend ESLint                       | PASS                                     |
| Frontend ESLint                      | PASS                                     |
| Prettier format:check                 | PASS                                     |
| Backend build                        | PASS                                     |
| Frontend production build, 13 routes | PASS                                     |
| Backend typecheck gồm seed/test      | PASS                                     |
| Prisma validate                      | PASS                                     |
| Prisma generate                      | PASS                                     |
| Prisma migrate deploy                | PASS, migration 202609280001_initial     |
| Seed                                 | PASS, 4 users, 4 properties, 8 amenities |
| Unit + validation                    | 8/8 PASS                                 |
| API E2E + concurrency                | 77 kiểm tra PASS                         |
| Playwright Edge headless             | 5/5 PASS                                 |

API E2E kiểm tra đăng ký Guest/Host, tự cấp phiên, email trùng/sai, ADMIN bị chặn, đăng nhập sai/đúng, /auth/me, Host pending/rejected, admin duyệt/từ chối, không duyệt lại rejected, quyền sở hữu, tạo/sửa/tạm ngưng/kích hoạt chỗ nghỉ, thiếu ảnh/tiện ích, giá/cọc/sức chứa, null-update, tìm kiếm/lọc ALL amenities, phân trang/sắp xếp, ngày/sức chứa, giá client giả, snapshot sau thay giá, cạnh tranh thanh toán, tiền cọc giữ sau hủy, mở lại lịch, host chỉ xem đơn sở hữu, Swagger.

Kiểm tra đồng thời thật qua HTTP trên MySQL:

1. Ba lượt hai đơn PENDING_PAYMENT trùng ngày: đúng một request 201, một 409; đúng một CONFIRMED mỗi lượt.
2. Hai request trả cọc cùng đơn: đúng một 201, một 409 và một Payment.
3. Thanh toán cùng lúc hủy: đơn cuối CANCELLED; payment tồn tại đúng khi thanh toán đã thắng trước hủy; không thu cọc sau khi hủy thắng. Mã phản hồi được đối chiếu với dữ liệu.

API test dùng tài khoản/đơn riêng và dọn sau chạy. Đã kiểm tra không còn tài khoản e2e sau lượt chạy. UI test cố ý để lại đơn CANCELLED và Payment SUCCESS của guest demo để kiểm tra lịch sử.

## Giao diện

- Kiểm tra 1440, 768 và 375 px: trang chủ, danh sách, đăng nhập, đăng ký, chi tiết, khu vực Host, tài khoản chờ duyệt, Admin; không tràn ngang ở các trang được kiểm tra.
- Luồng UI hoàn chỉnh: Guest login → chi tiết → chọn ngày → tạo đơn → trả cọc → CONFIRMED → cảnh báo mất cọc → CANCELLED giữ payment → logout xóa token.
- Kiểm tra bộ lọc mobile; empty results; API network error; Escape đóng dialog và trả focus cho nút mở; validation form tạo chỗ nghỉ.
- Ảnh bằng chứng trong [screenshots](screenshots/), gồm trang chủ và chi tiết ở ba kích thước.
- Đã sửa lỗi ID trùng giữa filter desktop/mobile và màu xanh mặc định của lịch. Ảnh Host lỗi URL có ảnh dự phòng.

## Tuân thủ use case

| Use case       | Hiện trạng                                        | Bằng chứng                               |
| -------------- | ------------------------------------------------- | ---------------------------------------- |
| UC-01,02       | Có API/form, tự đăng nhập, đúng trạng thái        | API E2E; form được render trong UI tests |
| UC-03,04,05    | Đăng nhập, thông tin/trạng thái, đăng xuất        | API E2E + Playwright                     |
| UC-06,07       | Tìm kiếm, lọc, phân trang, chi tiết, gallery/lịch | API E2E + Playwright                     |
| UC-08,09,10,11 | Quản lý chỗ nghỉ sở hữu, validation, soft status  | API E2E; UI list/form validation         |
| UC-12,13,14,15 | Snapshot, cọc nguyên tử, lịch sử, hủy giữ cọc     | API E2E/concurrency + UI đầy đủ          |
| UC-16          | Host chỉ xem đơn sở hữu                           | API E2E + UI                             |
| UC-17          | Chỉ PENDING → ACTIVE/REJECTED, Admin-only         | API E2E; UI danh sách                    |

## Giới hạn kiểm chứng

- Chưa chạy Docker Compose vì thiếu Docker. Kiểm tra thay thế dùng đúng MySQL, không SQLite/mock. Trên máy có Docker: `docker compose up -d mysql`, đợi healthy, điều chỉnh DATABASE_URL, chạy migrate/seed và test:e2e.
- Chưa kiểm tra trên thiết bị di động vật lý, Safari hoặc Firefox. Responsive đo bằng Edge headless tại ba viewport; chưa có chứng nhận accessibility toàn diện.
- Chưa chạy Postman Collection Runner; collection có cấu trúc v2.1, biến/token và assertions. Các API tương ứng được kiểm chứng bằng script E2E.
- UI chưa tự động đi hết mọi biến thể form đăng ký/chỉnh sửa và thao tác duyệt; API E2E đã kiểm tra nghiệp vụ tương ứng. Test cases liệt kê các bước để nhóm tiếp tục kiểm tra thủ công.
- Không kiểm thử tải lớn hoặc triển khai production. Mọi thanh toán là giả lập. Ảnh nguồn ngoài và Google Fonts cần mạng khi tải lần đầu/build.

## Chạy lại

Xem README.md để khởi động MySQL local/Docker, backend và frontend. Lệnh:

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd test
npm.cmd run typecheck --prefix backend
npm.cmd run test:e2e --prefix backend
npm.cmd run test:e2e --prefix frontend
npm.cmd run format:check
```
