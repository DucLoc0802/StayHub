# Kịch bản kiểm thử

Kết quả thực thi nằm tại [verification.md](verification.md). Danh sách này là tiêu chí, không phải khẳng định đã kiểm tra tất cả.

| Nhóm          | Thao tác                                        | Kết quả mong đợi                                       |
| ------------- | ----------------------------------------------- | ------------------------------------------------------ |
| Đăng ký       | Khách thuê hợp lệ                               | ACTIVE, JWT, tự đăng nhập                              |
| Đăng ký       | Người cho thuê hợp lệ                           | PENDING, JWT, xem trạng thái                           |
| Đăng ký       | Email trùng/sai, password ngắn, ADMIN           | Bị từ chối; không thêm người dùng                      |
| Đăng nhập     | Đúng/sai mật khẩu                               | JWT hoặc thông báo chung                               |
| Tài khoản     | Token hết hạn/giả                               | Yêu cầu đăng nhập, không dữ liệu riêng tư              |
| Đăng xuất     | Menu đăng xuất, tải lại                         | Token/cache mất, về trang công khai                    |
| Duyệt Host    | PENDING → ACTIVE / REJECTED                     | Chuyển đúng một lần                                    |
| Duyệt Host    | Phê duyệt lại REJECTED                          | Bị từ chối                                             |
| Phân quyền    | Guest/Host gọi API admin                        | 403                                                    |
| Phân quyền    | Host PENDING/REJECTED quản lý property          | 403                                                    |
| Phân quyền    | Host sửa property khác; Guest trả/hủy đơn khác  | Không tìm thấy, không thay đổi dữ liệu                 |
| Property      | Tạo/sửa đủ thông tin                            | Lưu đầy đủ, ảnh đúng thứ tự                            |
| Property      | Giá/cọc/sức chứa sai; thiếu ảnh/tiện ích        | 400, validation tiếng Việt                             |
| Property      | Tạm ngưng/kích hoạt                             | Ẩn/hiện công khai, giữ lịch sử                         |
| Tìm kiếm      | Không filter, tên, khu vực                      | Chỉ ACTIVE, kết quả phù hợp                            |
| Tìm kiếm      | Khoảng giá, nhiều tiện ích                      | Giá trong khoảng, đủ ALL tiện ích                      |
| Tìm kiếm      | Giá tăng/giảm, trang tiếp theo, không kết quả   | Thứ tự/phân trang/empty đúng                           |
| Booking       | Ngày không hợp lệ, cùng ngày, đảo ngày, quá khứ | Không tạo đơn                                          |
| Booking       | Quá sức chứa, property INACTIVE, role HOST      | Không tạo đơn                                          |
| Booking       | Hợp lệ                                          | PENDING_PAYMENT, snapshot phía hệ thống                |
| Booking       | Client gửi tổng tiền giả                        | Bị từ chối                                             |
| Booking       | Trùng CONFIRMED / sát ngày checkout             | Từ chối trùng / cho phép sát                           |
| Booking       | Hai PENDING_PAYMENT cùng ngày                   | Cả hai được tạo                                        |
| Payment       | Thanh toán hợp lệ                               | Chỉ cọc, CONFIRMED, Payment SUCCESS                    |
| Payment       | Thanh toán lặp                                  | 409, đúng một payment                                  |
| Payment       | Hai yêu cầu đồng thời trùng ngày                | Đúng một thành công, đơn thua không có Payment SUCCESS |
| Snapshot      | Host thay giá trước khi khách thanh toán        | Cọc và tổng theo giá cũ                                |
| Hủy           | PENDING_PAYMENT                                 | CANCELLED, không payment                               |
| Hủy           | CONFIRMED, xác nhận cảnh báo                    | CANCELLED, giữ payment, không hoàn tiền                |
| Hủy           | Hủy lại, thanh toán sau hủy                     | Bị từ chối                                             |
| Hủy           | Payment/cancel đồng thời                        | Không xác nhận lại đơn đã hủy; tối đa một payment      |
| Host          | Danh sách đặt phòng                             | Chỉ đơn thuộc chỗ nghỉ sở hữu, chỉ xem                 |
| Responsive    | 375/768/1440 px                                 | Không tràn ngang, menu/filter/lịch/form dùng được      |
| Accessibility | Tab/Enter/Escape, dialog/dropdown/calendar      | Focus rõ, dialog giữ focus và trả focus, nhãn đầy đủ   |
| UI state      | Đang tải, API mất kết nối, dữ liệu trống        | Nội dung tiếng Việt, nút thử lại phù hợp               |

Chạy unit: `npm test --prefix backend`. Chạy API E2E: khởi động MySQL, migrate, seed, API; chạy `npm run test:e2e --prefix backend`. E2E tạo dữ liệu có tiền tố riêng và dọn dữ liệu đó khi kết thúc; nên chạy trên database local chuyên cho kiểm thử.
