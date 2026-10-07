# Kiểm chứng triển khai

Môi trường kiểm tra ngày 05/10/2026: Windows, Node.js, MySQL 8.0.46 tại cổng 3307, Prisma 6.19.2, NestJS 11, Next.js 16 và Playwright Microsoft Edge headless. Không triển khai ra dịch vụ bên ngoài.

## Phân tách dữ liệu

Database chính `stayhub` chỉ nhận migration cộng thêm và seed bảo toàn dữ liệu. Database riêng `stayhub_inventory_test` dùng cho unit có database, HTTP integration, kiểm tra đồng thời và browser. Guard trong các bộ integration/API từ chối database ngoài tên test được chấp nhận. Không reset database chính hoặc test.

Trước migration đã sao lưu schema và toàn bộ hàng dữ liệu trong thư mục `.local` được ignore. Sau migration đối chiếu từng ID và từng giá trị cột cũ: không mất hoặc thay đổi dữ liệu nghiệp vụ. Trước seed có thêm snapshot; sau lần seed đầu, toàn bộ booking/payment/cơ sở/loại phòng cũ giữ nguyên. Chỉ hai tài khoản demo được nhận diện nhận điện thoại tổng hợp còn thiếu. Seed lần hai không làm đổi bất kỳ hàng dữ liệu nào.

## Các kiểm tra đã chạy

| Kiểm tra                                              | Kết quả                        |
| ----------------------------------------------------- | ------------------------------ |
| Baseline unit không cần database                      | 24 PASS                        |
| Backend unit + database + HTTP integration            | 56 PASS, không skip            |
| API và concurrency end-to-end qua server thật         | 67 kiểm tra PASS               |
| Browser các nghiệp vụ mới và regression               | 29 PASS, không skip            |
| QR thật qua API → giao diện → xác nhận cọc → hóa đơn  | PASS                           |
| Xuất PDF thật bằng trình duyệt headless               | PASS, artifact cục bộ          |
| Backend/frontend lint và typecheck                    | PASS                           |
| Backend/frontend production build                     | PASS                           |
| Prisma validate và migrate status                     | PASS, năm migration đã áp dụng |
| Prisma migrate diff database chính → schema           | PASS, không có khác biệt       |
| Seed database chính chạy hai lần, đối chiếu dữ liệu   | PASS                           |
| Hash inventory engine và mọi migration trước baseline | PASS, không thay đổi           |

Các case backend xác minh màu lịch, phone/profile, scope Guest/Host/Admin, mã unique ở database, QR chứa đúng cọc/mã, snapshot hóa đơn sau sửa hồ sơ/giá, hạn thanh toán, feedback đúng thời điểm và unique, catalog tiện ích active, chuyển Host chờ duyệt, bảo vệ Admin, thống kê/tìm kiếm/lịch sử, tồn từng đêm, race đặt/cọc/hủy và chống lạm dụng. Unit/database chạy tuần tự vì dùng chung một database test; riêng các ca concurrency chủ động tạo request song song.

Browser dùng cả API thật và mock có kiểm soát. Ca mock kiểm chứng nhãn/màu, switching RoomType, homestay, hồ sơ, QR/invoice, feedback và trang Admin ở 1440/768/375px; không chứng minh ghi dữ liệu thực. HTTP integration chứng minh authorization và persistence tương ứng. Ca inventory/guest flow dùng API và database thật. Bộ motion kiểm tra hover, dialog/calendar, focus, touch và reduced motion. Không tắt motion của sản phẩm; chỉ tắt animation khi chụp ảnh ổn định.

Các lần chạy trung gian tìm thấy selector nút thanh toán/tựa homepage cũ, selector ngày khớp tháng đang rời màn hình, ngày fixture bị giữ từ một test dở dang và heading ẩn trong transition. Test đã cập nhật dùng nhãn hiện tại, ngày cụ thể từ availability backend và heading trợ năng; không nới quyền hoặc thay đổi engine tồn phòng để làm test pass.

Ảnh/PDF mới dùng để xem xét ở `.local/live-demo-payment.png`, `.local/live-demo-invoice.png`, `.local/live-demo-invoice.pdf`; không đưa artifact cá nhân/database/token vào git. Các ảnh regression công khai tại `docs/screenshots` được cập nhật bởi test hiện có.

## Chạy lại

Trong backend, cấu hình `DATABASE_URL` và `INVENTORY_TEST_DATABASE_URL` cùng trỏ database MySQL test riêng đã migrate. Để kiểm tra seed, cấu hình thêm `SEED_TEST_DATABASE_URL` theo hướng dẫn README; không dùng database sản phẩm. Build backend trước vì HTTP integration dùng AppModule đã biên dịch để giữ metadata NestJS.

```powershell
npm.cmd run prisma:generate --prefix backend
npm.cmd run prisma:validate --prefix backend
npm.cmd run build --prefix backend
npm.cmd run build:seed --prefix backend
npm.cmd test --prefix backend
npm.cmd run lint
npm.cmd run typecheck --prefix backend
npm.cmd run typecheck --prefix frontend
npm.cmd run build --prefix frontend
```

Chạy server test, rồi API suite với `TEST_API_URL`; frontend phải build/chạy với `NEXT_PUBLIC_API_URL` trỏ đúng API test. Browser dùng `PLAYWRIGHT_BASE_URL` và `TEST_API_URL` cho server tương ứng:

```powershell
npm.cmd run test:e2e --prefix backend
npm.cmd run test:e2e --prefix frontend
```

Nếu Edge chưa có, cấu hình Playwright dùng browser đã cài hoặc cài browser phù hợp. Trên sandbox Windows của phiên này, tsx gặp `uv_os_get_passwd ENOMEM`; các test đã chạy thành công ngoài sandbox qua cơ chế phê duyệt công cụ. Prisma DLL có thể bị khóa nếu server đang dùng client: dừng server do mình khởi tạo trước khi generate, rồi build và khởi động lại.

## Giới hạn

Đã build lại và refresh riêng container API/frontend trong Docker Compose; MySQL giữ nguyên container và volume. Giao diện tại `http://localhost:3000`, API tại `http://localhost:4000/api`. Kiểm tra đọc trên database chính xác nhận các trang Admin mới, Swagger, phản hồi không chứa passwordHash và tổng 38 cơ sở/62 loại phòng/9 booking (8 demo cộng một đơn đã có).

`npm audit` backend báo 6 vấn đề: 2 moderate và 4 high, thuộc `@nestjs/swagger`, `js-yaml`, `prisma`, `@prisma/config`, `effect`, `deepmerge-ts`. Không chạy audit fix/force hoặc đổi major Prisma ngoài phạm vi nghiệp vụ. Cấu hình `package.json#prisma` còn cảnh báo deprecated cho Prisma 7; dự án tiếp tục dùng Prisma 6.19.2. Đây là các vấn đề dependency còn mở, không phải lỗi các bộ kiểm thử nghiệp vụ.

Không kiểm thử chuyển tiền thật, ngân hàng, hóa đơn thuế, production cloud deploy, Safari/Firefox hoặc máy in vật lý. QR hoàn toàn DEMO. Snapshot khách/cơ sở cho đơn legacy chỉ có dữ liệu tại migration, không khôi phục được trạng thái thời điểm đặt mà schema cũ chưa lưu. Ảnh bên ngoài vẫn phụ thuộc nhà cung cấp. Seed không dịch ngày/deadline cũ: dữ liệu pending sẽ hết hạn bình thường và minh họa lịch có thể nằm trong quá khứ khi dùng lâu dài.
