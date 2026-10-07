# Chức năng nghiệp vụ bổ sung

Giữ nguyên Property → RoomType → Booking → Payment, transaction tồn phòng, deadline, chống lạm dụng và giao diện cam/kem. Không có cổng thanh toán thật.

## Khách và lịch phòng

Tại `/account`, khách cập nhật họ tên (2–100 ký tự) và số điện thoại di động Việt Nam bắt đầu `0` hoặc `+84`. Giao diện và API chấp nhận `0901234567`, `090 123 4567`, `090-123-4567`, `+84 90 123 4567`; loại dấu cách, chấm, gạch ngang và chuyển `+84` thành `0`, lưu thống nhất `0901234567`. Giao diện dùng Zod kiểm tra sau chuẩn hóa, backend tiếp tục kiểm tra độc lập và từ chối số sai hoặc văn bản. Chỉ chủ tài khoản được sửa hai trường này; không nhận role/status từ hồ sơ. Email lấy từ tài khoản đã đăng ký. Hồ sơ cũ được giữ nguyên với điện thoại null, không tự điền thông tin cá nhân giả.

Khách có thể duyệt trang và lịch trước khi hoàn thiện hồ sơ. Khi bấm đặt, giao diện dẫn về tài khoản và có link quay lại chỗ nghỉ; API cũng từ chối tạo đơn nếu hồ sơ thiếu. Khách chọn lại kỳ lưu trú sau khi quay về.

Ô ngày giữ nền lịch thông thường; giá nhỏ bên dưới ngày mang màu xanh khi còn từ 5 phòng, vàng khi còn 3–4, đỏ khi còn 1–2. Không hiển thị số phòng trong ô ngày. Trước khi chọn RoomType, `GET /properties/:id/calendar` chọn giá thấp nhất trong các RoomType ACTIVE thực sự còn chỗ mỗi đêm; màu lấy từ chính RoomType cung cấp giá đó. Endpoint dùng hai truy vấn theo Property và tái sử dụng `availabilityByNight`, không có thuật toán tồn phòng mới.

Sau khi chọn RoomType, lịch dùng availability hiện có của RoomType đó và số phòng đã chọn. Ngày không đủ số phòng bị khóa và không hiện giá; nhãn trợ năng phân biệt hết phòng với không đủ số phòng đã chọn, đồng thời nêu giá và mức tồn khi còn đặt được. Số phòng còn lại dưới RoomType là mức tồn thấp nhất qua tất cả đêm của kỳ lưu trú, kể cả khi số phòng yêu cầu không đủ; truy vấn được dùng chung cache với nhãn RoomType.

Homestay vẫn dùng cùng thuật toán với một căn: giá ngày còn chỗ mang mức đỏ, ngày đã giữ/đặt bị khóa. Không cho chọn một khoảng đi qua đêm thiếu phòng. Backend vẫn tính checkout exclusive và kiểm tra lại quote/create khi dữ liệu giao diện cũ. Vì lịch khóa ngày hết phòng, giao diện cũng không cho bấm ngày đó làm checkout.

## Mã đặt chỗ và quyền truy cập

Booking mới dùng `STB-` + 16 ký tự hex ngẫu nhiên viết hoa, có unique index. Mã không phải mật khẩu truy cập: chi tiết riêng tư và hóa đơn cần đăng nhập. Quyền sở hữu cá nhân dựa trên `booking.guestId = user.id`; chuyển Guest thành Host không xóa quyền đọc lịch sử, chi tiết, hóa đơn đã thanh toán hoặc gửi đánh giá hợp lệ của chính người đó. Host ACTIVE còn đọc đơn thuộc cơ sở mình; Admin ACTIVE đọc toàn hệ thống. Host PENDING chỉ có quyền lịch sử cá nhân và không được dùng API quản lý Host hay đọc đơn của cơ sở. Không tìm thấy hoặc ngoài phạm vi sở hữu đều trả 404.

`/bookings` và lịch sử Host có tra cứu mã. `/bookings/:id` hiển thị chi tiết; mã cũng xuất hiện ở lịch sử, QR, hóa đơn và tìm kiếm Admin.

## Tra cứu booking công khai

Navbar luôn có “Tra cứu booking” cho người chưa đăng nhập và mọi vai trò; trang `/booking-lookup` không yêu cầu đăng nhập. `POST /booking-lookup` nhận mã booking viết hoa sau trim và email viết thường sau trim, kiểm tra email snapshot lúc đặt. Không dùng UUID và không thay quyền của endpoint chi tiết riêng tư.

Kết quả chỉ gồm mã, trạng thái, tên cơ sở/RoomType snapshot, ngày lưu trú, số phòng/khách, trạng thái đã/chưa cọc và deadline nếu còn pending. Không trả email, điện thoại, tên khách, ID nội bộ, địa chỉ riêng tư, số tiền, Payment record, transaction hoặc hóa đơn. Mã sai và email sai trả cùng 404 chung, với cùng truy vấn và độ trễ tối thiểu 100ms. Pending quá hạn được trình bày EXPIRED, không sửa dữ liệu từ lookup công khai.

Guard giới hạn 5 lần/phút/IP và 5 lần/15 phút/mã đã chuẩn hóa, áp dụng cả yêu cầu không hợp lệ. Bộ đếm giới hạn bộ nhớ, mã được hash và không ghi log email/mã. IP lấy từ kết nối Express, không tin trực tiếp header forwarded. Bảo vệ này chạy trong một process và reset khi restart; triển khai nhiều instance cần bộ đếm chia sẻ. Code + email chỉ dành cho thông tin trạng thái tối thiểu, không mở hóa đơn công khai.

## QR cọc demo và hóa đơn

`/bookings/:id/payment` hiển thị PNG QR do backend sinh, tiền cọc, mã tham chiếu, nội dung `STAYHUB <mã>`, hạn và bộ đếm. QR chứa JSON `mode: DEMO`, `currency: VND`, số cọc và mã; không chứa tài khoản ngân hàng. Đây không phải VietQR chuyển khoản. Bấm “Tôi đã thanh toán” gọi luồng thanh toán giả lập hiện có.

Backend chỉ cho lấy QR cho đơn pending của chính khách, còn hạn và chưa có Payment. Thanh toán được kiểm tra lại trong transaction hiện có; đúng deadline là quá hạn. Đơn quá hạn chuyển EXPIRED và trả tồn kể cả khi API trả lỗi. Không thanh toán lần hai, đơn canceled hoặc expired. Thông báo hết hạn: “Đơn đặt phòng đã hết thời gian thanh toán.”

`/bookings/:id/invoice` chỉ cho đơn CONFIRMED có Payment SUCCESS và cùng phạm vi phân quyền tra cứu. Hóa đơn dùng snapshot họ tên, điện thoại, email, tên/địa chỉ cơ sở, loại phòng, số phòng, số khách, ngày/giờ, giá đêm, số đêm, tổng, tỷ lệ cọc, cọc, còn lại; cùng thời điểm Payment và trạng thái. Sửa hồ sơ hoặc giá cơ sở về sau không làm đổi hóa đơn đã tạo.

Nút “In / Xuất PDF” gọi chức năng in trình duyệt; chọn Save as PDF/Lưu dưới dạng PDF. CSS print chỉ hiện nội dung hóa đơn, ẩn điều hướng/nút. Đây là phiếu xác nhận thanh toán demo, không phải hóa đơn thuế. Không tích hợp dịch vụ PDF bên ngoài.

## Đánh giá

Khách chỉ gửi một đánh giá cho đơn của mình, CONFIRMED và đã qua ngày/giờ checkout snapshot theo UTC+7. Điểm nguyên 1–5, nội dung 5–2000 ký tự sau trim. Backend kiểm tra quyền, trạng thái, thời gian và unique bookingId; không nhận propertyId từ khách. Đơn pending/canceled/expired và khách khác không được gửi.

Form ở lịch sử đơn sau trả phòng. Trang chi tiết chỗ nghỉ có điểm trung bình, số đánh giá và 10 đánh giá mới nhất; chỉ công khai tên khách, không email/điện thoại. Admin xem 100 đánh giá mới nhất tại `/admin/feedback`. Không có sửa/xóa/moderation vì không thuộc phạm vi yêu cầu.

## Quản trị

| Trang                  | Chức năng                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `/admin`               | Tổng Guest, Host, cơ sở, loại phòng, booking; bốn trạng thái và tổng cọc SUCCESS          |
| `/admin/users`         | Tìm tên/email, lọc role/trạng thái, phân trang; xem lịch sử Guest                         |
| `/admin/customers/:id` | Hồ sơ, tổng đơn, từng trạng thái, tổng cọc đã trả, 20 đơn gần nhất                        |
| `/admin/bookings`      | Tìm mã/tên khách/email/chỗ nghỉ/loại phòng, lọc trạng thái và ngày nhận phòng, phân trang |
| `/admin/amenities`     | Tạo, sửa mã/tên và bật/tắt tiện ích                                                       |
| `/admin/hosts`         | Quy trình duyệt Host hiện có                                                              |

Tổng cọc SUCCESS bao gồm cọc bị mất khi hủy confirmed, không phải doanh thu tiền phòng hoặc số tiền hoàn. Bộ lọc ngày từ/đến áp dụng ngày checkIn, bao gồm hai đầu. API còn hỗ trợ propertyId, roomTypeId và bookingCode chính xác.

Admin không tự đổi tài khoản mình, không sửa tài khoản ADMIN, không tạo/nâng thành ADMIN qua API này. Guest chuyển Host luôn PENDING, bắt buộc qua duyệt Host; Guest có pending còn hạn phải xử lý trước. Host hiện có giữ quy trình duyệt, không đổi vai trò/trạng thái qua API người dùng. Guest có thể được khóa bằng REJECTED hoặc mở lại ACTIVE. Mỗi request tiếp tục dùng guard kiểm tra tài khoản và role hiện tại.

Tiện ích ngừng hoạt động biến mất khỏi catalog công khai và lựa chọn mới của Host. Quan hệ tiện ích cũ được giữ để không mất thông tin cơ sở. Khi sửa, Host được giữ lựa chọn cũ đã ngừng, không được gán mới tiện ích ngừng hoạt động. Không hard-delete tiện ích đang liên kết.

## API bổ sung

| API (prefix `/api`)                                                   | Quyền                                          |
| --------------------------------------------------------------------- | ---------------------------------------------- |
| `PATCH /auth/profile`                                                 | Chủ tài khoản, hồ sơ an toàn                   |
| `GET /properties/:id/calendar`                                       | Công khai, Property ACTIVE                    |
| `POST /booking-lookup`                                               | Công khai, code + email snapshot, giới hạn thử |
| `GET /bookings/lookup/:code`, `GET /bookings/:id`                     | Guest/Host/Admin theo sở hữu                   |
| `GET /bookings/:id/payment-demo`                                      | Guest sở hữu, pending còn hạn                  |
| `GET /bookings/:id/invoice`                                           | Guest/Host/Admin theo sở hữu, confirmed đã cọc |
| `POST /bookings/:id/feedback`                                         | Chủ booking sau trả phòng, kể cả Host PENDING  |
| `GET /properties/:id/feedback`                                        | Công khai, cơ sở ACTIVE                        |
| `GET/PATCH /admin/users[/:id]`                                        | Admin                                          |
| `GET /admin/customers/:id/history`                                    | Admin                                          |
| `GET /admin/statistics`, `GET /admin/bookings`, `GET /admin/feedback` | Admin                                          |
| `GET/POST/PATCH /admin/amenities[/:id]`                               | Admin                                          |

## Migration và seed an toàn

`202610050001_business_features` chỉ cộng thêm User.phoneNumber nullable, Amenity.active mặc định true, mã/snapshot Booking và bảng Feedback với foreign keys/indexes. Không sửa migration đã áp dụng; không reset, truncate hoặc dùng db push. Sao lưu và dừng ghi trước triển khai; chạy `prisma migrate deploy`, generate client và build lại ứng dụng.

Booking cũ nhận mã `STB-<UUID đầy đủ viết hoa>` để backfill ổn định và không trùng; vẫn hợp lệ khi tra cứu. Snapshot khách/cơ sở cũ lấy dữ liệu hiện tại ở thời điểm migration vì lịch sử gốc không có các trường này. Hóa đơn giải thích giới hạn đó; không giả vờ khôi phục dữ liệu tại lúc đặt. Điện thoại snapshot cũ có thể trống. Booking mới lưu đủ snapshot trong transaction.

Seed dùng ID/mã cố định, chỉ tạo thiếu; không ghi đè chỉnh sửa cơ sở, lịch sử booking/payment/feedback. Chỉ bổ sung điện thoại tổng hợp còn thiếu cho tài khoản demo được nhận diện. Tám đơn minh họa gồm các màu tồn phòng, hotel/homestay hết chỗ, kỳ sát nhau, pending có deadline và confirmed quá khứ có một đánh giá. Chạy lại không thay ngày/deadline hoặc mở lại booking expired. Dữ liệu hoàn toàn tổng hợp, không phải tin đăng thật.

Hướng dẫn chạy tại [README](../README.md); kết quả và giới hạn kiểm thử tại [verification](verification.md).
