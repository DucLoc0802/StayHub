# StayHub: phân quyền và xác minh cọc MoMo

Thay đổi ngày 17/10/2026. QR đã được bỏ theo yêu cầu bổ sung của chủ ứng dụng. Bấm **Thanh toán cọc** mở hộp thoại có nút **Tôi đã thanh toán**; thao tác này chỉ gửi thông báo, chưa xác nhận đặt phòng.

## Tài khoản và quyền truy cập

| Tên đăng nhập / tên hiển thị mẫu | Email giữ nguyên              | Khu vực                                 |
| -------------------------------- | ----------------------------- | --------------------------------------- |
| admin01                          | admin@stayhub.local           | /admin                                  |
| host01                           | host@stayhub.local            | /host — Homestay An Nhiên               |
| host02                           | host.east@stayhub.local       | /host — Khách sạn Minh Châu             |
| host03                           | host.south@stayhub.local      | /host — Nhà nghỉ Bình An                |
| host04                           | host.hoangthanh@stayhub.local | /host — Khách sạn Hoàng Thành 1 và 2    |
| guest01                          | guest@stayhub.local           | /properties hoặc đích khách hàng hợp lệ |
| guest02                          | guest.lan@stayhub.local       | /properties hoặc đích khách hàng hợp lệ |

Seed chỉ đổi tên cũ thuộc danh sách fixture nhận diện được; tên đã tùy chỉnh, ID, email, mật khẩu, quyết định về vai trò và lịch sử được giữ. Chạy lại không nhân bản dữ liệu, dịch ngày hoặc mở lại đơn đã hết hạn. `DEMO_PASSWORD` chỉ dùng khi tạo tài khoản mẫu mới; seed từ chối `NODE_ENV=production`. Phân bố bốn Host / năm cơ sở vẫn là 1/1/1/2.

Điều hướng tập trung tại `frontend/src/lib/role-routes.ts`; RoleBoundary chặn render trước khi chuyển về đúng khu vực. Admin và Host có header, tài khoản, đăng xuất riêng và không có điều hướng đặt phòng khách hàng. Host chờ duyệt xem trạng thái tại `/host`. API kiểm tra vai trò và trạng thái hiện tại trong database trên từng request; Host chỉ đọc dữ liệu cơ sở mình sở hữu.

## Quy trình thanh toán

1. Guest xem đơn, số cọc chính xác, người nhận và mã đặt phòng. Có nút sao chép số điện thoại, số tiền, nội dung chuyển tiền. Không tạo hoặc hiển thị QR.
2. Guest chuyển tiền trong MoMo, bấm **Thanh toán cọc**, nhập mã giao dịch thực tế và ghi chú tùy chọn rồi bấm **Tôi đã thanh toán**. Không tải lên ảnh biên lai; ghi chú và mã giao dịch chỉ nằm trong dữ liệu đặt phòng được bảo vệ.
3. Backend lưu `PaymentAttempt` phương thức `MOMO_MANUAL`, trạng thái `SUBMITTED`, mã giao dịch chuẩn hóa, số tiền, người nhận và Host tại thời điểm gửi. Chưa có Payment thành công; đơn còn `PENDING_PAYMENT`, chưa xuất hiện trong danh sách đã trả cọc.
4. Admin vào `/admin/payments`, đối chiếu tài khoản nhận tiền thực tế. Khi xác nhận phải nhập số tiền thực nhận, mã giao dịch trong tài khoản và đánh dấu đã kiểm tra. Backend yêu cầu số tiền/mã khớp; kiểm tra lại hạn, trạng thái cơ sở/phòng và tồn phòng trong transaction.
5. Xác minh hợp lệ tạo một Payment `MOMO_MANUAL/SUCCESS`, chuyển booking thành `CONFIRMED`, ghi reviewer, thời điểm và các sự kiện. Thao tác lặp lại hoặc đồng thời không thu xếp hai lần. Mã giao dịch là duy nhất trên toàn database, kể cả mã từng bị từ chối.
6. Admin có thể từ chối với lý do (`FAILED`); Guest được gửi mã mới nếu đơn còn hạn. Mã/lý do cũ vẫn được giữ. Chọn `RESOLUTION_REQUIRED` cho trường hợp tranh chấp hoặc không thể xác nhận phòng.

Khoản cọc được thu tập trung về tài khoản cấu hình, không trả trực tiếp hoặc tự động cho từng Host. Không có merchant API, callback MoMo, hoàn tiền tự động hoặc chi trả Host tự động. Query `?success=true` không có tác dụng xác nhận tiền.

Hạn xác minh bằng thời điểm sớm hơn giữa **hạn giữ phòng gốc** và **thời điểm gửi + MOMO_VERIFICATION_WINDOW_MINUTES** (mặc định 60 phút). Không gia hạn giữ phòng vì một thông báo chưa xác minh. Khi hết hạn/hủy, thông báo chuyển sang `RESOLUTION_REQUIRED`, vẫn xem được trong khu vực đơn chờ và Admin; tồn phòng được giải phóng. Báo chuyển tiền sau hạn/hủy được lưu để xử lý riêng, không xác nhận phòng lại. Admin liên hệ khách và đối chiếu ngoài hệ thống khi cần hoàn trả.

Giao dịch FAKE trong lịch sử giữ nguyên dữ liệu và được ghi rõ là **mô phỏng, không thu tiền thật**. Thống kê khoản cọc thực chỉ cộng MoMo thành công. Đánh giá công khai cần đơn confirmed qua giờ trả phòng, Payment MoMo thành công và attempt đã có reviewer/time; đánh giá từ giao dịch mô phỏng không xuất hiện công khai.

## Routes

| Phạm vi   | Giao diện / API (API có tiền tố `/api`)                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Admin     | `/admin`, `/admin/account`, `/admin/properties`, `/admin/payments`, và các màn quản lý hiện có                                                                     |
| Host      | `/host`, `/host/account`, `/host/bookings/[id]`, quản lý cơ sở/phòng và bộ chọn chi nhánh hiện có                                                                  |
| Guest     | `/account`, `/bookings`, `/bookings/pending-payments`, `/bookings/[id]`, `/bookings/[id]/payment`, `/bookings/[id]/payment/result`, `/bookings/[id]/invoice`       |
| Guest API | `GET /bookings/:id/payment`, `POST /bookings/:id/payment-claims` (`transactionRef`, `evidenceNote?`)                                                               |
| Admin API | `GET /admin/properties`, `GET /admin/payments`, `POST /admin/payments/:id/review` (`decision`, `reason?`, `receivedAmount` và `verifiedTransactionRef` khi VERIFY) |
| Host API  | `GET /host/bookings/:id`; bộ lọc chi nhánh giao với quyền sở hữu                                                                                                   |
| Đã bỏ     | `POST /bookings/:id/pay`, `GET /bookings/:id/payment-demo`; không còn kết quả SUCCESS/FAILED do Guest lựa chọn                                                     |

## Migration và cấu hình triển khai

Migration mới: `backend/prisma/migrations/202610160002_manual_payment_verification/migration.sql`. Mở rộng enum và thêm trường đối chiếu/index duy nhất/reviewer vào PaymentAttempt. Giữ Booking, Payment, PaymentAttempt và BookingEvent cũ; không reset hoặc sửa trạng thái lịch sử.

Chỉ migration trên database MySQL test riêng đã được áp dụng trong lượt này. Chưa migrate, seed hoặc deploy Production. Khi phát hành, sao lưu database, áp dụng migration trước backend mới, rồi deploy backend và frontend tương ứng. Chạy bằng môi trường triển khai được cấp quyền:

```powershell
npm.cmd ci --prefix backend
npm.cmd run prisma:generate --prefix backend
npm.cmd run prisma:migrate --prefix backend
npm.cmd run build:vercel --prefix backend
npm.cmd run build --prefix frontend
```

`DATABASE_URL` phải trỏ đúng database của môi trường triển khai. `prisma:migrate` dùng `prisma migrate deploy`; không dùng `db push`, reset hoặc seed production. [Hướng dẫn migration của Prisma](https://www.prisma.io/docs/orm/migrations/applying-a-migration).

Thêm vào **backend** Vercel Environment Variables, rồi redeploy:

```dotenv
MOMO_RECEIVER_NAME=
MOMO_RECEIVER_PHONE=
MOMO_VERIFICATION_WINDOW_MINUTES=60
```

Tên/số điện thoại phải do chủ tài khoản xác nhận. Chấp nhận số di động Việt Nam; các ví dụ môi trường để trống có chủ đích. Thiếu/sai cấu hình sẽ hiển thị “Thanh toán đang tạm ngừng”, vô hiệu hóa nút và API gửi trả 503. Không cần `MOMO_QR_IMAGE_URL`. Không đưa cấu hình server/secrets vào biến `NEXT_PUBLIC_`.

Giữ `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `CRON_SECRET`. `backend/vercel.json` có endpoint hết hạn mỗi 10 phút; kiểm tra gói Vercel hỗ trợ lịch này, hoặc dùng scheduler ngoài với Bearer CRON_SECRET. Endpoint cập nhật trạng thái bền vững, không dựa vào timer trong bộ nhớ; thời hạn tồn phòng luôn dựa timestamp kể cả khi scheduler chậm. [Bảo vệ Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Giao diện và kiểm chứng

Đã dùng Impeccable critique, audit và polish: đối chiếu đánh giá độc lập với detector, giữ nền kem/cam, dùng vùng trắng/border mảnh/radius 8–12px, padding 20–24px cho form, bộ lọc, danh sách và thanh toán. Thanh điều hướng quản trị cuộn ngang trên màn nhỏ; hộp thoại dùng component chung có focus/đóng bằng Escape. Không thêm card cho từng đoạn văn.

Kết quả đã chạy trên MySQL test riêng và Edge, không có nhóm tích hợp bị bỏ qua:

| Kiểm tra                                           | Kết quả                                                               |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| Prisma validate / migrate status                   | Hợp lệ; 7 migration đã áp dụng trên database test                     |
| Backend TypeScript / lint / build / build:seed     | Đạt                                                                   |
| Backend unit + MySQL/HTTP integration              | 83/83 đạt                                                             |
| Standalone API / concurrency                       | 70 lượt đạt                                                           |
| Frontend TypeScript / lint / production build      | Đạt                                                                   |
| Frontend API configuration                         | 3/3 đạt                                                               |
| Browser regression đầy đủ                          | 52/52 đạt, khoảng 1,8 phút                                            |
| Browser tập trung sau sửa copy và vị trí tab Admin | 8/8 đạt, gồm cả 7 tên đăng nhập và luồng gửi/từ chối/thử lại/xác minh |

Đã xem render desktop 1440px và mobile 375px; bộ regression còn kiểm tra 768px, keyboard, touch giả lập, reduced motion và print. Ảnh test ở `.local/momo-*.png`; các ảnh cũ được test ghi đè đã được khôi phục. [Chi tiết critique/audit và giới hạn kiểm chứng](ROLE_PAYMENT_UI_REVIEW.md).

Lần chạy đầu có lỗi do script local cũ dùng nhầm cổng database và các expectation còn theo UI fake; đã sửa và chạy lại đạt như bảng trên. Cảnh báo có sẵn: cấu hình Prisma `package.json#prisma` deprecated; Node cảnh báo module type khi test config; Next start cảnh báo standalone trong máy test. Các cảnh báo này không làm fail build/tests. Chưa kiểm chứng nhận tiền MoMo thực hoặc deployment Vercel mới.

Các bước còn lại: cung cấp tên/số MoMo thật, áp dụng migration và biến môi trường lên môi trường triển khai, xác nhận lịch chạy, redeploy rồi kiểm tra một giao dịch thực do chủ tài khoản đối chiếu. Các bài test chỉ dùng tài khoản nhận giả định và database test; chưa chuyển tiền thật.
