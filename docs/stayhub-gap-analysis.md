# Đối chiếu yêu cầu StayHub

## Hiện trạng ban đầu

Workspace E:\StayHub trống, không có mã nguồn hay tài liệu use case riêng. Theo yêu cầu mới của người dùng, tạo dự án mới. Các trạng thái dưới đây mô tả thời điểm khởi tạo, không khẳng định dự án cũ thiếu chức năng.

| Use case | Yêu cầu                          | Hiện trạng | Trạng thái | Hành động                            |
| -------- | -------------------------------- | ---------- | ---------- | ------------------------------------ |
| UC-01    | Đăng ký khách thuê, tự đăng nhập | Chưa có    | MISSING    | User, API, form                      |
| UC-02    | Đăng ký người cho thuê chờ duyệt | Chưa có    | MISSING    | HOST/PENDING, trang trạng thái       |
| UC-03    | Đăng nhập                        | Chưa có    | MISSING    | bcrypt, JWT, form                    |
| UC-04    | Xem tài khoản                    | Chưa có    | MISSING    | /auth/me, trang tài khoản            |
| UC-05    | Đăng xuất                        | Chưa có    | MISSING    | Xóa token, cache                     |
| UC-06    | Tìm kiếm, lọc, phân trang        | Chưa có    | MISSING    | ALL amenities, lọc giá, tên/quận     |
| UC-07    | Chi tiết chỗ nghỉ                | Chưa có    | MISSING    | Gallery, lịch, giá, tiện ích         |
| UC-08    | Chỗ nghỉ của tôi                 | Chưa có    | MISSING    | HOST ACTIVE, kiểm tra sở hữu         |
| UC-09    | Tạo chỗ nghỉ                     | Chưa có    | MISSING    | DTO, form, ảnh URL                   |
| UC-10    | Cập nhật chỗ nghỉ                | Chưa có    | MISSING    | Kiểm tra sở hữu, validation          |
| UC-11    | Kích hoạt/tạm ngưng              | Chưa có    | MISSING    | Soft deactivation                    |
| UC-12    | Tạo đặt chỗ                      | Chưa có    | MISSING    | Ngày, sức chứa, snapshot giá         |
| UC-13    | Đặt chỗ của tôi                  | Chưa có    | MISSING    | Chỉ dữ liệu khách thuê hiện tại      |
| UC-14    | Cọc giả lập                      | Chưa có    | MISSING    | Serializable, retry, unique payment  |
| UC-15    | Hủy đặt chỗ                      | Chưa có    | MISSING    | Chuyển trạng thái nguyên tử, giữ cọc |
| UC-16    | Theo dõi đặt chỗ sở hữu          | Chưa có    | MISSING    | Chỉ xem, không duyệt booking         |
| UC-17    | Duyệt người cho thuê             | Chưa có    | MISSING    | Chỉ PENDING sang ACTIVE/REJECTED     |

Mỗi use case được triển khai xuyên suốt database, API, giao diện, phân quyền, validation và trạng thái loading/error/empty tương ứng. Báo cáo kiểm tra cuối cùng được lưu riêng trong docs/verification.md.

## Quyết định làm rõ

- Giữ MySQL theo stack được nhắc nhiều lần; câu “Do NOT change the database to MySQL” là mâu thuẫn nội bộ không áp dụng được cho workspace trống.
- VND nguyên, giới hạn giá/độ dài lưu trú để tránh tràn số nguyên MySQL.
- Ngày lưu trú là ngày lịch tại Việt Nam, checkout exclusive.
- Giao dịch Serializable có retry lỗi P2034; không dùng SQL đặc thù MySQL hoặc khóa trong bộ nhớ.
- Dữ liệu demo chỉ thêm khi chưa tồn tại, không xóa lịch sử đặt chỗ.

## Sau triển khai

Các mục MISSING ở bảng đầu đã được triển khai. Ma trận dưới mô tả phiên bản bàn giao, không thay thế kết quả kiểm thử chi tiết trong verification.md.

| Phạm vi             | Database / API                                    | Frontend                                           | Phân quyền / validation                     | Trạng thái |
| ------------------- | ------------------------------------------------- | -------------------------------------------------- | ------------------------------------------- | ---------- |
| UC-01–05            | User, bcrypt, JWT, /auth/me                       | Đăng ký/đăng nhập/tài khoản/đăng xuất, cache reset | Public role whitelist; tải trạng thái từ DB | CORRECT    |
| UC-06–07            | Property/images/amenities, search ALL, pagination | Card, filter desktop/mobile, gallery, lịch         | Chỉ public ACTIVE, giá/khu vực hợp lệ       | CORRECT    |
| UC-08–11            | Host properties, nested images/amenities, status  | Danh sách/form tạo/sửa, nút trạng thái             | HOST ACTIVE, owner-only, null bị chặn       | CORRECT    |
| UC-12–15            | Booking snapshot, payment unique, Serializable    | Summary, danh sách, cọc/hủy qua dialog             | GUEST owner-only, overlap/date/capacity     | CORRECT    |
| UC-16               | Host booking join owner                           | Danh sách chỉ xem                                  | HOST ACTIVE, không thao tác đơn Guest       | CORRECT    |
| UC-17               | Conditional update PENDING only                   | Admin pending list, confirm actions                | ADMIN only, không reapprove REJECTED        | CORRECT    |
| UI state            | Lỗi tiếng Việt thống nhất                         | Loading/error/empty, toast, retry                  | Không lộ stack trace                        | CORRECT    |
| Docker verification | Có Compose MySQL 8.4; đã chạy MySQL portable      | Không áp dụng                                      | Docker chưa được cài trên máy kiểm tra      | PARTIAL    |

Thay đổi so với mô tả hình thức: chữ nút cam dùng màu tối để tăng tương phản; giữ sắc cam #F28C52. Kiểm tra runtime: 8 unit/validation, 77 API/concurrency, 5 Playwright; chi tiết giới hạn trong verification.md.
