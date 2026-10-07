# StayHub

Ứng dụng đặt homestay và khách sạn tại TP. Hồ Chí Minh. Giao diện tiếng Việt, cam ấm / kem / trắng; Next.js + TypeScript, NestJS, Prisma 6 và MySQL. Giữ vai trò Guest / Host / Admin và thanh toán cọc giả lập.

**Property là cơ sở lưu trú; RoomType là loại phòng/chỗ ở có thể đặt.** Hotel có nhiều loại phòng và số lượng tồn; homestay có một loại nguyên căn với số lượng 1. [Mô hình, quy tắc, API và migration](docs/booking-model.md).

## Chức năng

- Guest đăng ký hoạt động ngay; Host đăng ký chờ Admin duyệt. Host chỉ quản lý cơ sở và đơn thuộc sở hữu.
- Tìm tên/khu vực, loại cơ sở, tiện ích, khoảng giá; giá “Từ”, lọc và sắp xếp dùng giá thấp nhất của loại phòng đang mở bán.
- Host quản lý nhiều loại phòng, giá, tồn, sức chứa, trạng thái, ảnh, tiện ích, giờ nhận/trả và cửa sổ thanh toán.
- Guest chọn loại phòng, ngày, số phòng và số khách. Lịch trống tính theo từng đêm, checkout exclusive.
- Pending giữ phòng ngay; thanh toán trước deadline xác nhận đơn, quá hạn thành EXPIRED và trả tồn phòng. Khách tối đa 2 đơn pending; 3 lần hết hạn trong 30 ngày tạm khóa đặt 24 giờ.
- Hủy confirmed mất cọc, giữ lịch sử Payment. Giá, tên loại phòng, số lượng và chính sách tại lúc đặt được lưu snapshot.
- Link tên chỗ nghỉ ngắn và ổn định; link UUID cũ được chuyển hướng. Responsive, bàn phím, reduced motion, trạng thái loading/error/empty.
- Lịch có nhãn và màu tồn phòng: xanh từ 5, vàng 3–4, đỏ 1–2; ngày hết phòng bị vô hiệu hóa. Số phòng trên thẻ loại phòng được tính cho kỳ lưu trú đã chọn.
- Khách bổ sung họ tên/số điện thoại tại tài khoản trước khi đặt; xem chỗ nghỉ và lịch không cần hoàn thiện hồ sơ.
- Mã đặt chỗ duy nhất, tra cứu theo quyền; QR cọc demo, hóa đơn snapshot có nút in/lưu PDF; đánh giá sau thời điểm trả phòng của đơn confirmed.
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

| Đăng nhập                 | Mật khẩu    | Vai trò      |
| ------------------------- | ----------- | ------------ |
| admin                     | admin       | Admin        |
| host                      | host        | Host ACTIVE  |
| guest                     | guest       | Guest        |
| pendinghost@stayhub.local | StayHub123! | Host PENDING |
| host.east@stayhub.local   | StayHub123! | Host ACTIVE  |
| host.south@stayhub.local  | StayHub123! | Host ACTIVE  |

Dữ liệu hoàn toàn tổng hợp: **38 cơ sở, 12 hotel, 26 homestay, 62 loại phòng, 254 đơn vị, 14 tiện ích và 8 đơn minh họa**, kèm một đánh giá sau lưu trú. Đa số ở Thủ Đức, Quận 1, Quận 2, Bình Thạnh và Quận 7. Nhãn địa danh dùng cách gọi quen thuộc; không phải thông tin địa giới hiện hành hay tin đăng thật.

Seed không tạo trùng, giữ chỉnh sửa cơ sở/loại phòng và lịch sử. Ba tài khoản demo chính được giữ mật khẩu admin/host/guest. Ngày demo được giữ nguyên sau lần tạo đầu tiên. Ảnh ngoài phụ thuộc nhà cung cấp.

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

[Kết quả kiểm chứng](docs/verification.md). Không có thanh toán thật, email thật, số phòng vật lý, housekeeping hay kết nối OTA.
