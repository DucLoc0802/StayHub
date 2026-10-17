# StayHub

Ứng dụng đặt homestay và khách sạn tại TP. Hồ Chí Minh. Giao diện tiếng Việt, cam ấm / kem / trắng; Next.js + TypeScript, NestJS, Prisma 6 và MySQL. Giữ vai trò Guest / Host / Admin và xác minh cọc MoMo thủ công. [Thay đổi vai trò và thanh toán](ROLE_PAYMENT_CHANGES.md).

**Property là cơ sở lưu trú; RoomType là loại phòng/chỗ ở có thể đặt.** Hotel có nhiều loại phòng và số lượng tồn; homestay có một loại nguyên căn với số lượng 1. [Mô hình, quy tắc, API và migration](docs/booking-model.md).

Triển khai frontend và backend trên Vercel: [cấu hình domain, biến môi trường và MySQL](VERCEL_DEPLOYMENT.md).

## Chức năng

- Guest đăng ký hoạt động ngay; Host đăng ký chờ Admin duyệt. Host chỉ quản lý cơ sở và đơn thuộc sở hữu.
- Tìm tên/khu vực, loại cơ sở, tiện ích, khoảng giá; giá “Từ”, lọc và sắp xếp dùng giá thấp nhất của loại phòng đang mở bán.
- Host quản lý nhiều loại phòng, giá, tồn, sức chứa, trạng thái, ảnh, tiện ích, giờ nhận/trả và cửa sổ thanh toán.
- Guest chọn loại phòng, ngày, số phòng và số khách. Lịch trống tính theo từng đêm, checkout exclusive.
- Pending giữ phòng ngay; xem lại thông tin → trang thanh toán riêng → kết quả do backend xác thực. My Bookings chỉ hiển thị đơn đã trả cọc; tiếp tục đơn chưa trả tại `/bookings/pending-payments`. Quá hạn thành EXPIRED và trả tồn phòng. Khách tối đa 2 đơn pending; 3 lần hết hạn trong 30 ngày tạm khóa đặt 24 giờ.
- Hủy confirmed mất cọc, giữ lịch sử Payment. Giá, tên loại phòng, số lượng và chính sách tại lúc đặt được lưu snapshot.
- Link tên chỗ nghỉ ngắn và ổn định; link UUID cũ được chuyển hướng. Responsive, bàn phím, reduced motion, trạng thái loading/error/empty.
- Lịch có nhãn và màu tồn phòng: xanh từ 5, vàng 3–4, đỏ 1–2; ngày hết phòng bị vô hiệu hóa. Số phòng trên thẻ loại phòng được tính cho kỳ lưu trú đã chọn.
- Khách bổ sung họ tên/số điện thoại tại tài khoản trước khi đặt; xem chỗ nghỉ và lịch không cần hoàn thiện hồ sơ.
- Mã đặt chỗ duy nhất, tra cứu theo quyền; thanh toán MoMo không QR, thông báo “Tôi đã thanh toán” chờ Admin xác minh; biên nhận snapshot có nút in/lưu PDF; chỉ công khai đánh giá từ đơn đã xác minh tiền và qua giờ trả phòng.
- Admin có thống kê, tìm đơn, danh sách người dùng, lịch sử khách, quản lý tiện ích và xem đánh giá. [Hướng dẫn các chức năng mới](docs/business-features.md).

## Chạy bằng Docker

Chuẩn bị `.env`, `backend/.env`, `frontend/.env` theo file mẫu. Trong backend, DATABASE_URL dùng host `mysql:3306`; từ máy Windows dùng `127.0.0.1:3307` theo cổng Compose. JWT_SECRET cần chuỗi ngẫu nhiên ít nhất 32 ký tự.

```powershell
docker compose up -d --build
docker compose logs -f server
```

Backend chờ MySQL healthy, chạy `prisma migrate deploy`, seed JavaScript đã biên dịch rồi mở API. Không dùng `db push` cho cập nhật schema.

- Giao diện: http://localhost:3000
- API: http://localhost:4000/api
- Swagger: http://localhost:4000/api/docs
- Host: http://localhost:3000/host
- Admin: http://localhost:3000/admin (duyệt Host tại `/admin/hosts`)

Seed riêng: `docker compose exec server node dist/seed/prisma/seed.js`. Volume `mysql_data` giữ dữ liệu.

### Database cũ

Sao lưu trước khi chuyển mô hình và dừng backend cũ trong lúc migrate. Nếu database từng tạo bằng `db push`, phải đối chiếu schema với ba migration đầu rồi dùng `prisma migrate resolve --applied <tên>` để baseline các migration đã có; sau đó `prisma migrate deploy`. Không đánh dấu migration chưa thực thi là đã áp dụng. Nếu có migration failed, xem `_prisma_migrations.logs`, sửa nguyên nhân và chỉ `resolve --rolled-back` khi đã kiểm tra không còn thay đổi dở dang.

Migration inventory giữ lịch sử nhưng hết hạn các pending cũ vốn chưa giữ phòng. Chi tiết và lý do trong [tài liệu nghiệp vụ](docs/booking-model.md#8-migration-và-dữ-liệu-mẫu).

## Chạy trực tiếp trên máy

Cần Node.js 22.12+ hoặc 24, npm và MySQL. Trên PowerShell dùng `npm.cmd` nếu `npm.ps1` bị chặn.

```powershell
npm.cmd ci
npm.cmd ci --prefix backend
npm.cmd ci --prefix frontend
# Cấu hình backend/.env: MySQL local và FRONTEND_URL=http://localhost:3000
npm.cmd run prisma:generate --prefix backend
npm.cmd run prisma:validate --prefix backend
npm.cmd run prisma:migrate --prefix backend
npm.cmd run build:seed --prefix backend
npm.cmd run prisma:seed --prefix backend
npm.cmd run dev --prefix backend
# Terminal khác
npm.cmd run dev --prefix frontend
```

Các biến cấu hình lead time/chống lạm dụng nằm trong `backend/.env.example`; quy tắc tập trung tại `backend/src/bookings/booking-policy.ts`. API và frontend phải trỏ cùng database/backend; `NEXT_PUBLIC_API_URL` được đóng gói lúc build frontend.

## Demo

Đặt `DEMO_PASSWORD` (ít nhất 8 ký tự, tối đa 72 byte UTF-8) trong môi trường backend trước khi chạy seed. Tài khoản mới dùng mật khẩu này, băm bcrypt; tài khoản đã tồn tại giữ nguyên mật khẩu và chỉnh sửa. Không chạy seed trên production.

| Tài khoản Host                         | Cơ sở tổng hợp          |
| -------------------------------------- | ----------------------- |
| host01 — host@stayhub.local            | Homestay An Nhiên       |
| host02 — host.east@stayhub.local       | Khách sạn Minh Châu     |
| host03 — host.south@stayhub.local      | Nhà nghỉ Bình An        |
| host04 — host.hoangthanh@stayhub.local | Khách sạn Hoàng Thành 1 |
| host05 — host.hoanggia@stayhub.local   | Khách sạn Hoàng Thành 2 |

Thêm `admin01` (`admin@stayhub.local`) và `guest01` (`guest@stayhub.local`). Bộ dữ liệu mới có **5 Host, mỗi Host một cơ sở; 1 Admin; 1 Guest; 13 loại phòng, 37 đơn vị và 14 tiện ích**. Email/ID/mật khẩu tài khoản hiện có được giữ nguyên. Lịch sử booking/thanh toán cũ được bảo toàn; các fixture cũ được lưu trữ thay vì xóa. Không tạo đánh giá công khai hoặc chỉ số phổ biến giả.

Seed dùng ID cố định, giữ lịch sử và chỉnh sửa. Chỉ ngừng bán các fixture cũ khớp đầy đủ dấu vân tay; cơ sở đã chỉnh sửa và dữ liệu người dùng được giữ. Database nâng cấp có thể còn cơ sở cũ để bảo toàn lịch sử. Địa chỉ, giá và ảnh đều là minh họa. [Thay đổi marketplace, API, migration và triển khai lịch hết hạn](MARKETPLACE_CHANGES.md).

## Kiểm thử

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run typecheck --prefix backend
npm.cmd test --prefix backend
```

Kiểm tra MySQL cần database riêng đã migrate và seed: đặt `INVENTORY_TEST_DATABASE_URL` có tên `stayhub_inventory_test` (hoặc `stayhub_seed_test`), rồi chạy backend tests. Test không có biến này sẽ bỏ qua nhóm tích hợp; unit test vẫn chạy. Chạy `npm run build:seed --prefix backend` trước nhóm kiểm tra seed.

API end-to-end: đặt `DATABASE_URL` và `TEST_API_URL` trỏ database/API test tương ứng, chạy `npm.cmd run test:e2e --prefix backend`. Suite giữ kiểm tra auth và dọn dữ liệu tự tạo.

Browser: frontend/backend test đang chạy, đặt `PLAYWRIGHT_BASE_URL`, `TEST_API_URL`; đặt thêm `INVENTORY_TEST_DATABASE_URL` để chạy ba bài live inventory (tự dọn dữ liệu). Chạy `npm.cmd run test:e2e --prefix frontend`. Playwright mặc định Microsoft Edge; có thể đổi cấu hình trình duyệt trên máy khác.

[Kết quả kiểm chứng](docs/verification.md). MoMo được đối chiếu thủ công: không có merchant API, xác nhận tự động, hoàn tiền tự động hoặc chi trả tự động cho Host. Chưa có email, số phòng vật lý, housekeeping hay kết nối OTA.

Bản sửa production ngày 17/10/2026: [báo cáo triển khai và đồng bộ Aiven](STAYHUB_PRODUCTION_FIX_REPORT.md). Admin đối chiếu giao dịch trong chi tiết booking; `/admin/payments` chuyển về `/admin/bookings`. Giao diện và API đánh giá đã ngừng sử dụng; lịch sử trong database được giữ lại. Cron Vercel chạy hằng ngày, còn kiểm tra hết hạn theo timestamp vẫn áp dụng ngay khi truy vấn/đặt phòng.
