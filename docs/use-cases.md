# Đặc tả 17 use case StayHub

Tài liệu nghiệp vụ được xây dựng từ task.txt theo yêu cầu tạo mới của người dùng. Chưa có tài liệu use case riêng do nhóm cung cấp; không coi tài liệu này là biên bản phê duyệt của nhóm.

Tác nhân: Khách truy cập, Khách thuê, Người cho thuê, Quản trị viên. Phạm vi: TP. Hồ Chí Minh; mỗi chỗ nghỉ là một đơn vị đặt độc lập.

## UC-01 — Đăng ký tài khoản Khách thuê

- **Tác nhân:** Khách truy cập.
- **Tiền điều kiện:** Chưa đăng nhập.
- **Luồng chính:**
  1. Khách truy cập thực hiện: Nhập họ tên, email, mật khẩu và chọn Khách thuê.
  2. Hệ thống: Kiểm tra thông tin và email duy nhất; tạo tài khoản đang hoạt động và đăng nhập tự động.
  3. Hệ thống thông báo kết quả cho tác nhân.
- **Ngoại lệ:** Thông tin sai hoặc email đã tồn tại: thông báo để sửa, không tạo tài khoản.
- **Hậu điều kiện:** Khách thuê có tài khoản ACTIVE và phiên đăng nhập.

## UC-02 — Đăng ký tài khoản Người cho thuê

- **Tác nhân:** Khách truy cập.
- **Tiền điều kiện:** Chưa đăng nhập.
- **Luồng chính:**
  1. Khách truy cập thực hiện: Nhập họ tên, email, mật khẩu và chọn Người cho thuê.
  2. Hệ thống: Kiểm tra thông tin; tạo tài khoản chờ phê duyệt; đăng nhập và hiển thị trạng thái.
  3. Hệ thống thông báo kết quả cho tác nhân.
- **Ngoại lệ:** Thông tin không hợp lệ hoặc trùng email: không tạo tài khoản.
- **Hậu điều kiện:** Người cho thuê PENDING, chưa được quản lý chỗ nghỉ.

## UC-03 — Đăng nhập

- **Tác nhân:** Khách thuê, Người cho thuê, Quản trị viên.
- **Tiền điều kiện:** Đã có tài khoản.
- **Luồng chính:**
  1. Khách thuê thực hiện: Cung cấp email và mật khẩu.
  2. Hệ thống: Kiểm tra thông tin; tạo phiên đăng nhập và đưa đến khu vực phù hợp vai trò/trạng thái.
  3. Hệ thống thông báo kết quả cho tác nhân.
- **Ngoại lệ:** Sai thông tin: báo “Email hoặc mật khẩu không đúng.”; không tiết lộ email tồn tại hay không.
- **Hậu điều kiện:** Người dùng được xác thực. Người cho thuê PENDING/REJECTED vẫn được đăng nhập.

## UC-04 — Xem thông tin và trạng thái tài khoản

- **Tác nhân:** Khách thuê, Người cho thuê, Quản trị viên.
- **Tiền điều kiện:** Đã đăng nhập.
- **Luồng chính:**
  1. Khách thuê thực hiện: Mở trang Tài khoản.
  2. Hệ thống: Hiển thị họ tên, email, vai trò và trạng thái hiện tại.
  3. Hệ thống thông báo kết quả cho tác nhân.
- **Ngoại lệ:** Phiên hết hạn: yêu cầu đăng nhập lại.
- **Hậu điều kiện:** Người dùng biết trạng thái tài khoản; không có chỉnh sửa hồ sơ trong phạm vi này.

## UC-05 — Đăng xuất

- **Tác nhân:** Khách thuê, Người cho thuê, Quản trị viên.
- **Tiền điều kiện:** Đã đăng nhập.
- **Luồng chính:**
  1. Khách thuê thực hiện: Chọn Đăng xuất từ menu tài khoản.
  2. Hệ thống: Xóa phiên trên thiết bị và dữ liệu riêng tư đã tải; đưa về trang công khai.
  3. Hệ thống thông báo kết quả cho tác nhân.
- **Ngoại lệ:** Nếu phiên đã hết hạn thì vẫn trở về trạng thái chưa đăng nhập.
- **Hậu điều kiện:** Không còn truy cập giao diện riêng tư với phiên trên thiết bị.

## UC-06 — Tìm kiếm, lọc và duyệt danh sách chỗ nghỉ

- **Tác nhân:** Khách truy cập, Khách thuê.
- **Tiền điều kiện:** Không yêu cầu đăng nhập.
- **Luồng chính:**
  1. Khách truy cập thực hiện: Nhập tên/khu vực, chọn ngân sách, tiện ích, sắp xếp và trang kết quả.
  2. Hệ thống: Hiển thị chỗ nghỉ ACTIVE phù hợp tại TP. Hồ Chí Minh; mọi tiện ích đã chọn đều phải có. Mặc định mới nhất.
  3. Hệ thống thông báo kết quả cho tác nhân.
- **Ngoại lệ:** Không có kết quả: hiển thị trạng thái trống; khoảng giá sai: yêu cầu sửa.
- **Hậu điều kiện:** Có danh sách phân trang theo điều kiện; không hiển thị đánh giá/sao.

## UC-07 — Xem chi tiết chỗ nghỉ

- **Tác nhân:** Khách truy cập, Khách thuê.
- **Tiền điều kiện:** Chỗ nghỉ đang hoạt động.
- **Luồng chính:**
  1. Khách truy cập thực hiện: Chọn một chỗ nghỉ.
  2. Hệ thống: Hiển thị ảnh, địa chỉ, mô tả, sức chứa, tiện ích, giá, tỷ lệ cọc và lịch lưu trú.
  3. Hệ thống thông báo kết quả cho tác nhân.
- **Ngoại lệ:** Không tồn tại hoặc tạm ngưng: thông báo không tìm thấy.
- **Hậu điều kiện:** Có đủ thông tin để lựa chọn đặt chỗ.

## UC-08 — Xem danh sách chỗ nghỉ của mình

- **Tác nhân:** Người cho thuê.
- **Tiền điều kiện:** Đăng nhập với tài khoản ACTIVE.
- **Luồng chính:**
  1. Người cho thuê thực hiện: Mở Chỗ nghỉ của tôi.
  2. Hệ thống: Hiển thị chỉ các chỗ nghỉ thuộc sở hữu, gồm trạng thái hiện tại.
  3. Hệ thống thông báo kết quả cho tác nhân.
- **Ngoại lệ:** Chưa có chỗ nghỉ: thông báo và cho phép tạo. Tài khoản chưa được duyệt: từ chối.
- **Hậu điều kiện:** Người cho thuê biết các chỗ nghỉ đang quản lý.

## UC-09 — Tạo chỗ nghỉ

- **Tác nhân:** Người cho thuê.
- **Tiền điều kiện:** Đã đăng nhập, tài khoản ACTIVE.
- **Luồng chính:**
  1. Người cho thuê thực hiện: Nhập loại, tên, mô tả, khu vực, địa chỉ, giá, cọc, sức chứa, tiện ích và URL ảnh.
  2. Hệ thống: Kiểm tra dữ liệu; lưu một đơn vị đặt độc lập gắn với người cho thuê; chỗ nghỉ bắt đầu ACTIVE.
  3. Hệ thống thông báo kết quả cho tác nhân.
- **Ngoại lệ:** Thiếu ảnh/tiện ích, giá/cọc/sức chứa sai: thông báo, không lưu.
- **Hậu điều kiện:** Chỗ nghỉ mới có thể được tìm kiếm và đặt.

## UC-10 — Cập nhật chỗ nghỉ

- **Tác nhân:** Người cho thuê.
- **Tiền điều kiện:** Tài khoản ACTIVE và sở hữu chỗ nghỉ.
- **Luồng chính:**
  1. Người cho thuê thực hiện: Mở chỉnh sửa, thay thông tin và lưu.
  2. Hệ thống: Kiểm tra quyền sở hữu và dữ liệu; cập nhật thông tin cùng thứ tự ảnh.
  3. Hệ thống thông báo kết quả cho tác nhân.
- **Ngoại lệ:** Không sở hữu: không tìm thấy. Dữ liệu sai: không cập nhật.
- **Hậu điều kiện:** Thông tin mới được lưu; giá/cọc trong đơn cũ không đổi.

## UC-11 — Kích hoạt hoặc tạm ngưng chỗ nghỉ

- **Tác nhân:** Người cho thuê.
- **Tiền điều kiện:** Tài khoản ACTIVE, sở hữu chỗ nghỉ.
- **Luồng chính:**
  1. Người cho thuê thực hiện: Chọn Tạm ngưng hoặc Kích hoạt.
  2. Hệ thống: Cập nhật trạng thái; chỗ nghỉ tạm ngưng bị ẩn công khai và không nhận đơn mới.
  3. Hệ thống thông báo kết quả cho tác nhân.
- **Ngoại lệ:** Không sở hữu hoặc chưa được duyệt: từ chối.
- **Hậu điều kiện:** Lịch sử đặt chỗ vẫn nguyên vẹn, không xóa chỗ nghỉ.

## UC-12 — Tạo đặt chỗ

- **Tác nhân:** Khách thuê.
- **Tiền điều kiện:** Đã đăng nhập; chỗ nghỉ ACTIVE.
- **Luồng chính:**
  1. Khách thuê thực hiện: Chọn ngày nhận/trả phòng và số khách; gửi yêu cầu đặt chỗ.
  2. Hệ thống: Kiểm tra ngày, sức chứa, trạng thái và khoảng trống; tính giá theo số đêm, lưu giá/cọc tại thời điểm đặt; tạo đơn chờ thanh toán.
  3. Hệ thống thông báo kết quả cho tác nhân.
- **Ngoại lệ:** Ngày quá khứ/sai, vượt sức chứa hoặc trùng đơn đã xác nhận: không tạo đơn.
- **Hậu điều kiện:** Đơn PENDING_PAYMENT, chưa giữ chỗ; có tổng tiền/cọc/phần còn lại.

## UC-13 — Xem các đặt chỗ của mình

- **Tác nhân:** Khách thuê.
- **Tiền điều kiện:** Đã đăng nhập.
- **Luồng chính:**
  1. Khách thuê thực hiện: Mở Đặt phòng của tôi.
  2. Hệ thống: Chỉ hiển thị đơn của chính khách thuê, lịch, số khách, giá, cọc, thanh toán, trạng thái và thao tác phù hợp.
  3. Hệ thống thông báo kết quả cho tác nhân.
- **Ngoại lệ:** Chưa có đơn: thông báo “Bạn chưa có đặt phòng nào.”
- **Hậu điều kiện:** Khách thuê biết tiến trình và lịch sử của mình.

## UC-14 — Thanh toán tiền cọc giả lập

- **Tác nhân:** Khách thuê.
- **Tiền điều kiện:** Sở hữu đơn PENDING_PAYMENT; chỗ nghỉ vẫn hoạt động và ngày nhận chưa qua.
- **Luồng chính:**
  1. Khách thuê thực hiện: Xem tiền cọc và xác nhận thanh toán giả lập.
  2. Hệ thống: Kiểm tra lại khoảng trống và trạng thái; ghi nhận thanh toán đúng tiền cọc và xác nhận đơn trong cùng một thao tác nhất quán.
  3. Hệ thống thông báo kết quả cho tác nhân.
- **Ngoại lệ:** Hết chỗ, đã trả, đã hủy hoặc yêu cầu đồng thời thua: không có thanh toán thành công mới, không xác nhận.
- **Hậu điều kiện:** Đơn CONFIRMED, có một khoản cọc SUCCESS; phần còn lại trả tại chỗ nghỉ.

## UC-15 — Hủy đặt chỗ

- **Tác nhân:** Khách thuê.
- **Tiền điều kiện:** Sở hữu đơn PENDING_PAYMENT hoặc CONFIRMED.
- **Luồng chính:**
  1. Khách thuê thực hiện: Chọn Hủy; nếu đã xác nhận, đọc cảnh báo mất cọc và xác nhận tiếp tục.
  2. Hệ thống: Chuyển đơn sang CANCELLED; giữ nguyên lịch sử thanh toán; giải phóng khoảng ngày.
  3. Hệ thống thông báo kết quả cho tác nhân.
- **Ngoại lệ:** Đơn đã hủy hoặc không sở hữu: từ chối. Hủy cùng lúc thanh toán vẫn đảm bảo trạng thái nhất quán.
- **Hậu điều kiện:** Đơn hủy không giữ chỗ. Cọc đã trả không hoàn lại. Đơn chưa trả không mất tiền.

## UC-16 — Theo dõi đặt chỗ của chỗ nghỉ do mình sở hữu

- **Tác nhân:** Người cho thuê.
- **Tiền điều kiện:** Đăng nhập, tài khoản ACTIVE.
- **Luồng chính:**
  1. Người cho thuê thực hiện: Mở mục Đặt phòng trong khu vực quản lý.
  2. Hệ thống: Hiển thị đơn của các chỗ nghỉ sở hữu, khách thuê, lịch, số tiền, cọc và trạng thái.
  3. Hệ thống thông báo kết quả cho tác nhân.
- **Ngoại lệ:** Chưa có đơn: trạng thái trống. Không cho xem đơn của người cho thuê khác.
- **Hậu điều kiện:** Chỉ xem; không duyệt, sửa, hủy hoặc từ chối đơn của khách.

## UC-17 — Xét duyệt tài khoản Người cho thuê

- **Tác nhân:** Quản trị viên.
- **Tiền điều kiện:** Đã đăng nhập; tài khoản cần duyệt đang PENDING.
- **Luồng chính:**
  1. Quản trị viên thực hiện: Xem danh sách chờ, chọn Phê duyệt hoặc Từ chối và xác nhận.
  2. Hệ thống: Kiểm tra quyền và trạng thái; chuyển PENDING sang ACTIVE hoặc REJECTED một lần.
  3. Hệ thống thông báo kết quả cho tác nhân.
- **Ngoại lệ:** Người không phải Quản trị viên hoặc tài khoản đã xử lý: từ chối.
- **Hậu điều kiện:** ACTIVE được quản lý chỗ nghỉ; REJECTED chỉ xem trạng thái, không được phê duyệt lại.
