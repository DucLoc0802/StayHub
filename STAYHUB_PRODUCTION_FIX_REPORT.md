# StayHub production fix report — 17/10/2026

## Trạng thái

- Local: backend, API và browser đã kiểm chứng trên MySQL riêng; không tạo giao dịch production để thử nghiệm.
- Aiven: đã áp dụng 3 migration còn thiếu, đồng bộ đúng danh mục theo yêu cầu mới nhất; kiểm tra lịch sử và quan hệ thành công.
- Vercel: backend và frontend đã lên production thành công; 29 request smoke trên API thật đạt, kiểm tra browser trên domain thật đạt và đã chụp 18 ảnh ở ba kích thước.

## Chẩn đoán production trước sửa

Frontend thật: https://pentabug2-stayhub.vercel.app. Backend xác định từ cấu hình repository: https://pentabug-stayhub.vercel.app/api.

Commit ban đầu `5a437bce3b98bc9b9076f6e01b34beacac7ff54b`: GitHub báo frontend triển khai thành công nhưng backend thất bại. Swagger trên domain backend vẫn là phiên bản cũ. `backend/vercel.json` có cron `*/10 * * * *`; Vercel Hobby chỉ hỗ trợ một lần/ngày. Đã đổi sang `0 0 * * *`. [Tài liệu chính thức](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Aiven `defaultdb`, MySQL 8.4.11, kết nối TLS `TLS_AES_256_GCM_SHA384`: chỉ có 5 migration ban đầu. Thiếu `202610160001_booking_audit`, `202610160002_manual_payment_verification`; thiếu bảng BookingEvent/PaymentAttempt. Trước sửa có 7 user, 38 property, 62 room type, 14 booking, 10 payment và 1 feedback. Không in thông tin xác thực vào báo cáo.

| Vấn đề                       | Triệu chứng và nguyên nhân thực tế                                                                              | Sửa / API / file chính                                                                                                                                                                                                                                       | Kiểm chứng local                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Admin cơ sở                  | GET `/admin/properties` 404 vì backend production cũ, dữ liệu Aiven vẫn là 38 fixture cũ                        | `backend/src/admin/management.module.ts`: danh sách và chi tiết Admin; `frontend/src/components/admin-properties.tsx`: một thẻ chữ nhật trắng/cơ sở, tên 24px desktop, Host/địa chỉ/loại/sức chứa/trạng thái, tìm kiếm gọn, chi tiết và liên kết lọc booking | API thật và browser 375/768/1440; tìm kiếm, pagination, chi tiết và điều hướng lọc                               |
| Admin booking                | Danh sách 200 (14 bản ghi) nhưng `/admin/booking-filters` 404 độc lập                                           | Backend được triển khai đủ route; `admin-management.tsx` giữ danh sách khi bộ lọc phụ lỗi, có thông báo và retry riêng; `app/admin/bookings/page.tsx` đọc async searchParams để deep-link hoạt động cả client navigation                                     | Browser mô phỏng chỉ bộ lọc lỗi; kiểm tra danh sách vẫn dùng được; lọc theo cơ sở qua trang chi tiết             |
| Bỏ màn hình thanh toán riêng | `/admin/payments` đã có UI riêng nhưng backend cũ không phục vụ                                                 | Bỏ menu/module danh sách; URL cũ chuyển `/admin/bookings`. `booking-reconciliation.tsx` gắn đối chiếu vào chi tiết booking; POST `/admin/bookings/:bookingId/payment-claims/:id/reconcile` chỉ Admin và kiểm tra claim thuộc booking                         | Guest/Host bị 403; Admin gắn claim qua booking khác bị 404; kiểm tra mã, số tiền, người duyệt và audit           |
| Bỏ đánh giá                  | Menu/UI/API đánh giá nằm ngoài phạm vi hiện tại                                                                 | Bỏ nav, submit, rating công khai, frontend API và FeedbackModule trong AppModule; URL Admin cũ redirect. Model/bảng/lịch sử được giữ                                                                                                                         | Route feedback 404; browser không gọi feedback, không hiển thị review/rating giả                                 |
| Checkout Guest               | GET booking payment 404 dù booking tồn tại vì backend thiếu endpoint, không phải lỗi async params hiện tại      | Triển khai payment endpoints; `payment-screen.tsx`, `payment-error.tsx`, `payment-state.ts`: hai khối trắng, số tiền nổi bật, không QR, dialog “Tôi đã thanh toán”, trạng thái/lỗi và hướng phục hồi riêng                                                   | Guest tạo booking → đọc đúng ID/cọc → báo chuyển → Admin từ chối → gửi lại → đối chiếu → kết quả; database riêng |
| Pending payments             | GET `/bookings/pending-payments` 400: backend cũ bắt chuỗi pending-payments vào route `:id` rồi UUID validation | Triển khai static route trước route ID; danh sách dùng chung state, không mời thanh toán đơn hủy/hết hạn/đang đối chiếu                                                                                                                                      | Phiên hợp lệ, danh sách rỗng/hợp lệ, refresh/recovery, hết hạn giải phóng inventory                              |
| Tên và chủ sở hữu mẫu        | Aiven còn tên demo cũ và chưa có host04/host05; seed đổi trong Git không tự sửa production                      | Migration archival; script `sync-production-catalog.ts` mặc định preview, fingerprint/ID rõ ràng, idempotent; tên hiện hành admin01, guest01, host01–host05                                                                                                  | Diễn tập bản sao Aiven và database seed; lần preview sau apply không thay đổi                                    |
| Lỗi chung                    | Nhiều trường hợp được gom thông báo 404/invalid khó chẩn đoán                                                   | `common/errors.ts`, `validation.ts`, `production-logger.ts`, frontend `api.ts`/`payment-error.tsx`: mã invalid ID/missing route/resource/auth/forbidden/database/schema unavailable; requestId và log trường an toàn                                         | Unit/HTTP và browser từng mã lỗi; không đưa SQL, token hoặc kết nối vào response/log                             |

## An toàn Aiven và kết quả đồng bộ

Yêu cầu mới nhất của chủ dự án: **5 cơ sở tương ứng 5 Host, 1 Admin và 1 Guest**. Thay thế danh mục hoạt động bằng lưu trữ có thể phục hồi, không xóa booking/payment/feedback cũ.

Bản sao trước thay đổi: `.local/aiven-production-verified.sql`, manifest và `.restore-verified.json` cùng thư mục. SHA-256:

`84951095424a0457a2982611fa480d74bc7cde4eb144d6348753f1d1ed1e6aa8`

Backup giữ DDL, SQL mode của Aiven (có ANSI_QUOTES), dữ liệu và hash từng bảng trong consistent snapshot chỉ đọc. Đã phục hồi sang MySQL Docker riêng port 3310, database `stayhub_production2_rehearsal_test`; so sánh đủ 10 bảng/hash/số dòng. Hai migration thanh toán/audit và migration archival được áp dụng trên bản phục hồi trước production. Không dùng reset, db push hoặc development seed trên Aiven.

Các script reviewable trong `backend/scripts/`:

- `production-snapshot.mjs`: backup chỉ đọc và manifest/checksum.
- `rehearse-snapshot.mjs`: chỉ phục hồi vào DB loopback có tên rehearsal, từ chối DB đã tồn tại, kiểm chứng mọi hash.
- `sync-production-catalog.ts`: preview mặc định; production apply yêu cầu dump + manifest + bằng chứng restore khớp target/checksum; transaction, fingerprint fixture, không sửa tài chính.
- `verify-snapshot-history.mjs --financial-only`: kiểm chứng nguyên vẹn Booking/Payment/Feedback và orphan.

Kết quả Aiven sau apply:

| Chỉ tiêu               | Kết quả                                                                          |
| ---------------------- | -------------------------------------------------------------------------------- |
| Migration              | 8/8 applied; `prisma migrate status` up to date                                  |
| Tài khoản hiện hành    | ADMIN 1, HOST 5, GUEST 1                                                         |
| Cơ sở hiện hành        | 5 cơ sở / 5 chủ sở hữu                                                           |
| Fixture cũ             | 38 property INACTIVE + archivedAt; 2 user archivedAt; bản ghi vẫn giữ            |
| Booking                | 14, hash toàn bộ dữ liệu giữ nguyên                                              |
| Payment                | 10, hash toàn bộ dữ liệu giữ nguyên                                              |
| Feedback               | 1, hash toàn bộ dữ liệu giữ nguyên                                               |
| PaymentAttempt         | 10 được migration backfill từ payment cũ; method FAKE vẫn rõ là lịch sử mô phỏng |
| BookingEvent           | 0, không dựng sự kiện thanh toán lịch sử giả                                     |
| Orphan booking/payment | 0 / 0                                                                            |
| Đồng bộ chạy lại       | Preview không có dòng cần thay đổi                                               |

Danh mục:

| Host   | Cơ sở                   |
| ------ | ----------------------- |
| host01 | Homestay An Nhiên       |
| host02 | Khách sạn Minh Châu     |
| host03 | Nhà nghỉ Bình An        |
| host04 | Khách sạn Hoàng Thành 1 |
| host05 | Khách sạn Hoàng Thành 2 |

Email/ID/mật khẩu các tài khoản hiện có giữ nguyên. Hai tài khoản mới host04/host05 dùng mật khẩu ngẫu nhiên riêng, băm bcrypt12; thông tin được lưu riêng tại `.local/production-fixture-credentials.json` (ignored, không commit). Bộ dữ liệu local mới dùng DEMO_PASSWORD; không lấy mật khẩu test làm mật khẩu production.

Booking và hóa đơn cũ giữ snapshot tên khách/cơ sở lúc đặt. Bộ lọc lịch sử Admin vẫn có thể liệt kê cơ sở đã lưu trữ để tìm booking cũ; danh sách quản lý/public/Host hiện hành chỉ có 5 cơ sở mới.

Đối chiếu schema Aiven thật với Prisma bằng `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code`: **No difference detected**, exit0.

## Kiểm thử

Tất cả thao tác tạo/sửa booking, payment claim, xác minh hoặc hủy trong kiểm thử đều dùng MySQL riêng port 3310, không dùng Aiven.

- Prisma validate: đạt. Migration rehearsal và status: đạt.
- Backend unit/integration: **85/85**, không skip. Sau thay đổi điều kiện archival cuối và bổ sung kiểm tra quyền: chạy lại nhóm liên quan **18/18** đạt.
- API standalone end-to-end: **70 kiểm tra đạt**.
- Frontend cấu hình API: **3/3** đạt.
- Browser cuối: **59/59** đạt (1 worker), gồm API thật và mock tình huống lỗi.
- Backend/frontend lint: đạt. Backend typecheck và frontend TypeScript trong production build: đạt.
- Backend build, build:seed và frontend production build: đạt. Frontend build dùng domain production và build riêng trỏ API test đều thành công.
- Seed idempotency, bảo toàn chỉnh sửa Host/inventory/history: đạt.
- Git diff whitespace check: đạt.

Một lượt browser trung gian dùng nhầm cấu hình API production cho build local; đã dừng, build lại với API test đúng và chạy lại đầy đủ 59 bài đạt. Không tạo booking/thanh toán trên production trong lượt đó.

## Giao diện / Impeccable

Dùng skill Impeccable, giữ nền kem/cam StayHub và chế độ Operate. Đã có critique độc lập và detector một lượt (0 findings / 30 TSX). Kiểm tra render theo đợt 375/768/1440: danh sách cơ sở, Admin booking, review đặt phòng, checkout/dialog, pending recovery, đối chiếu trong booking và kết quả. Sau quan sát, ẩn ảnh trang trí trên thẻ cơ sở mobile và thu gọn nút copy để tránh mã chuyển tiền xuống dòng; xác nhận trong lượt browser cuối. Không có overflow hoặc thanh hành động cố định che nội dung. Các bộ test keyboard/reduced-motion và quyền được giữ.

Contrast token đã đo: body 14.01:1; secondary 5.74:1; primary button 6.43:1; input border 3.01:1; focus 3.61:1.

Ảnh trước production: `.local/production-before--admin-properties-{375,768,1440}.png`, Admin bookings, pending và existing booking payment cùng prefix.

Ảnh sau local: `.local/production-fixed-properties-{375,768,1440}.png`, `.local/production-fixed-review-{375,768,1440}.png`, `.local/production-fixed-pending-{375,768,1440}.png`, `.local/momo-payment-{375,768,1440}.png`, `.local/momo-booking-reconciliation-{375,768,1440}.png`, `.local/momo-verified-result-{375,768,1440}.png`. Screenshot chỉ là bằng chứng render; các thông tin người nhận trong local là dữ liệu test.

## Triển khai / kiểm chứng domain thật

Backend release commit: `3a38eae219d7f7a36e75e327dc5fae86423404cb`. Đẩy qua Git integration hiện có, không cần thay tài khoản Vercel hoặc làm lộ secret.

Backend Vercel đã success: https://vercel.com/stay-hub1/pentabug-stayhub/FKmGSXKpYunDrK9R6k8kWv4bbnM9 . Read-only smoke lúc 03:14–03:15 UTC ngày 17/10/2026: **29 request đạt** trên domain backend thật; artifact riêng `.local/production-api-after.json`.

| Kiểm tra production                           | Kết quả                                                                     |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| Swagger                                       | Có đủ Admin properties, booking filters, static pending và checkout         |
| Admin properties + 5 chi tiết                 | 200; đúng 5 cơ sở / 5 Host                                                  |
| Admin bookings                                | 200, 14 booking lịch sử                                                     |
| Admin booking filters                         | 200; 43 cơ sở gồm 38 lưu trữ để tìm lịch sử                                 |
| Admin users                                   | 200; đúng 7 tài khoản hiện hành và tên mới                                  |
| Pending Guest                                 | 200, 1 đơn phục hồi; không còn UUID error                                   |
| Checkout booking có sẵn                       | 200, đúng ID/cọc; không QR; payment FAKE lịch sử không biến thành MoMo thật |
| Invalid / missing booking                     | 400 INVALID_BOOKING_ID / 404 RESOURCE_NOT_FOUND                             |
| Module cũ và feedback                         | 404 API_ROUTE_NOT_FOUND                                                     |
| Guest / Host gọi Admin                        | 403 FORBIDDEN                                                               |
| Admin gọi pending Guest                       | 403 FORBIDDEN                                                               |
| Public catalog                                | 200, đúng 5 cơ sở                                                           |
| host04 / host05 đăng nhập và danh sách sở hữu | Thành công, mỗi tài khoản đúng 1 cơ sở                                      |

Production xác nhận recipientAvailable=false: chưa có người nhận MoMo được cấu hình. Chặn gửi claim là trạng thái có chủ ý. Không dùng nút khách để tạo kết quả thành công giả.

Frontend release commit: `5acf74a6b12627815d7058f8043f14e8bac88ad2`. Cả hai project báo **success**:

- [Frontend deployment](https://vercel.com/stay-hub1/pentabug2-stayhub/3vDdgaxEiuVixrT5SzFA7uzdPv6w).
- [Backend deployment cùng phiên bản](https://vercel.com/stay-hub1/pentabug-stayhub/FqYD2WkX3vgWe6TKjjTbtDKER5r6).

Git integration tự build cả hai project mỗi commit; frontend thay đổi được đẩy sau khi backend đã success và API thật đạt smoke. CORS/auth và API origin trong bundle đã được chứng minh bằng request browser từ frontend thật sang backend thật.

Browser production **đạt**, artifact `.local/production-ui-after.json`: Admin có 5 thẻ và đúng chủ sở hữu, tìm kiếm Hoàng Thành ra 2 cơ sở, chi tiết đọc được, liên kết sang bộ lọc booking qua client navigation giữ đúng propertyId; danh sách booking và bộ lọc hoạt động; đối chiếu nằm trong booking detail; URL module cũ redirect đúng. Guest mở pending, checkout booking có sẵn và result; không có QR. **0 lỗi API bất ngờ, 0 pageerror và 0 request mutation** trong lượt browser này. Không có lỗi overflow tại 375/768/1440.

Đã chụp **18 ảnh production**: mỗi nhóm 3 kích thước tại `.local/production-after-{admin-properties,admin-bookings,admin-booking-detail,pending,payment,payment-result}-{375,768,1440}.png`. Đã mở ảnh thực tế để kiểm tra desktop/mobile. Sau smoke, kiểm tra hash Aiven lần nữa: Booking14, Payment10, Feedback1 vẫn nguyên vẹn, orphan0.

| Đối chiếu ảnh 375px | Trước                                                                                                | Sau                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Admin cơ sở         | [Ảnh trước](.local/production-before--admin-properties-375.png)                                      | [Ảnh sau](.local/production-after-admin-properties-375.png) |
| Pending             | [Ảnh trước](.local/production-before--bookings-pending-payments-375.png)                             | [Ảnh sau](.local/production-after-pending-375.png)          |
| Checkout            | [Ảnh trước](.local/production-before--bookings-069910ce-24a0-4449-bc48-cfe42ef4784c-payment-375.png) | [Ảnh sau](.local/production-after-payment-375.png)          |

Ảnh và session/backup nằm trong thư mục riêng ignored, không đẩy dữ liệu cá nhân hay token lên GitHub. Các booking snapshot cũ vẫn hiện tên/cơ sở tại thời điểm đặt; tài khoản hiện hành đã đổi đúng tên.

Không có quyền truy cập trực tiếp Vercel Runtime Logs qua CLI/API/connector trong phiên này. Do đó **chưa kiểm tra trực tiếp Runtime Logs**; bằng chứng vận hành là trạng thái deployment thực, OpenAPI, HTTP và browser production. Không tuyên bố đã đọc log khi chưa có quyền truy cập.

## Cấu hình còn cần và giới hạn

Không có merchant MoMo integration: nút khách chỉ ghi nhận claim, không đánh dấu đã nhận tiền. Chỉ Admin đối chiếu thực thu, mã và số tiền trong booking mới xác nhận. Chuyển muộn/giữ phòng hết hạn/booking hủy không tự khôi phục hoặc tự hoàn tiền. Muốn xác nhận tự động cần merchant credentials và callback/IPN được xác thực của provider.

Nếu production chưa cấu hình `MOMO_RECEIVER_NAME` và `MOMO_RECEIVER_PHONE`, checkout báo phương thức tạm chưa sẵn sàng và chặn gửi claim; không dùng thông tin test làm người nhận thật. Quyết định không QR được giữ.

Cron daily tương thích Hobby. Timestamp expiry trong truy vấn và transaction vẫn loại hold hết hạn ngay, không đợi cron; cần CRON_SECRET được cấu hình để bảo vệ cron. Không công khai giá trị secret.

Không rollback schema bằng cách drop bảng audit/payment attempt. Nếu cần phục hồi, giữ backup riêng, review delta sau thời điểm backup và bảo toàn giao dịch phát sinh; restore rehearsal chứng minh bản sao phục hồi được, không tự động ghi đè production.
