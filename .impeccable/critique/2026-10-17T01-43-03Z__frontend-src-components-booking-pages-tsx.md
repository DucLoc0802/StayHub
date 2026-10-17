---
target: StayHub role isolation and QR-free manual MoMo checkout
total_score: 32
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 0
target_identity: "file:C:\\Users\\Admin\\Desktop\\StayHub\\StayHub\\frontend\\src\\components\\booking-pages.tsx"
target_fingerprint: "sha256:fb48bbadbd49072d05b3fb49f73183a10937a174cd9fd44f26fb2220b5ff0d5b"
target_path: "C:\\Users\\Admin\\Desktop\\StayHub\\StayHub\\frontend\\src\\components\\booking-pages.tsx"
timestamp: 2026-10-17T01-43-03Z
slug: frontend-src-components-booking-pages-tsx
---
# StayHub UI review: vai trò và thanh toán

Ngày 17/10/2026. Mode: **Operate**. Mục tiêu là Guest gửi đúng thông báo tiền cọc, Admin đối chiếu rõ ràng và Host quản lý đúng cơ sở, trong nhận diện kem/cam hiện có.

## Nguồn đánh giá

Đánh giá ban đầu dùng hai agent độc lập: `design_review` đánh giá thiết kế, `design_evidence` chạy detector và đối chiếu ảnh/source. Không chia sẻ kết quả giữa hai agent trước khi tổng hợp. Assessment A chấm giao diện cũ **22/40**; Assessment B không tìm thấy lỗi cơ học qua detector. Hai kết quả không mâu thuẫn: detector không đánh giá được tính trung thực của trạng thái thanh toán hay việc trộn vai trò.

Điểm sau sửa dưới đây là tổng hợp của agent triển khai sau kiểm tra render và tương tác, không phải một lần chấm độc lập mới của hai agent.

## Kết quả critique

Thiết kế giữ được nhận diện StayHub qua màu nền ấm, chữ, ảnh chỗ nghỉ, số tiền và lịch lưu trú. Vùng quản lý dùng danh sách công việc phù hợp từng vai trò; không thêm biểu đồ, card trang trí hay dashboard không liên quan. Luồng thanh toán có thông tin người nhận, tiền cọc, mã đơn và kết quả đối chiếu rõ ràng.

| Nielsen heuristic | Trước | Sau tổng hợp | Bằng chứng |
| --- | ---: | ---: | --- |
| 1. Hiển thị trạng thái hệ thống | 2 | 3 | Phân biệt chưa trả, đã báo, xác minh, từ chối và xử lý riêng |
| 2. Phù hợp ngôn ngữ/nghiệp vụ | 3 | 4 | Tiếng Việt; không QR; mã giao dịch khác mã đơn; giao dịch cũ ghi mô phỏng |
| 3. Quyền kiểm soát của người dùng | 3 | 3 | Đóng hộp thoại, sửa mã, thử lại sau từ chối, đăng xuất |
| 4. Nhất quán | 2 | 3 | Account và điều hướng theo vai trò; surfaces/borders/dialog dùng hệ thống chung |
| 5. Ngăn lỗi | 1 | 4 | Cấu hình thiếu vô hiệu hóa nút; bắt buộc mã; Admin đối chiếu số tiền/mã; backend giữ quyền |
| 6. Nhận biết thay vì ghi nhớ | 3 | 3 | Hiển thị mã, cọc, người nhận và lịch; sao chép ngay tại trang |
| 7. Hiệu quả thao tác | 2 | 3 | Chi nhánh Host, lọc/phân trang Admin, tab hiện hành được giữ trong vùng nhìn thấy |
| 8. Tối giản | 3 | 3 | Một surface cho thông tin thanh toán; chia bằng đường kẻ; bỏ kết quả mô phỏng có thể tự chọn |
| 9. Phục hồi sau lỗi | 2 | 3 | Lý do từ chối, báo khoản sau hạn, nhắc không tự hoàn tiền |
| 10. Hướng dẫn | 1 | 3 | Hướng dẫn trong hộp thoại, ghi rõ chờ Admin; runbook cấu hình/triển khai |
| **Tổng** | **22/40** | **32/40** | Đánh giá thiết kế định tính, không phải chứng nhận truy cập |

Những điểm mạnh: ảnh và màu sắc marketplace được giữ; tiền/lịch rõ ràng; surface trắng giúp đọc form và danh sách dễ hơn. Hộp thoại bảo vệ thời điểm thông báo thanh toán, chỉ có quay lại hoặc gửi; Admin chọn một trong ba kết quả đối chiếu. Tám tab quản trị phục vụ điều hướng, không trộn vào quyết định thanh toán của Guest.

Hành trình cảm xúc: giai đoạn chưa xác minh có thể gây lo lắng, nên hiển thị trạng thái lưu bền vững và thời hạn; không dùng màn thành công trước khi Admin kiểm tra. Khoản sau hạn có chỉ dẫn xử lý riêng. Với khách dùng điện thoại, nút cọc có thanh cố định kèm số tiền; với Admin mới, checkbox nhắc kiểm tra tài khoản thật trước khi xác nhận.

## Các vấn đề đã xử lý

| Mức ban đầu | Vấn đề | Cách xử lý |
| --- | --- | --- |
| P1 | Thanh toán mô phỏng có thể bị hiểu là tiền thật | Bỏ API fake công khai; claim chưa paid; chỉ Admin xác minh; lịch sử FAKE ghi rõ mô phỏng |
| P1 | Điều hướng/quy trình trộn Guest, Host, Admin | Shell/route/account riêng; chặn render trước redirect; guard API kiểm tra vai trò hiện tại |
| P1 | Hành động cọc nằm sâu trên mobile | Bỏ QR; thanh hành động cố định dưới viewport mobile; kiểm tra tọa độ nút trong bài browser |
| P2 | Nội dung/form thiếu ranh giới | Surfaces trắng 20–24px padding, border mảnh, radius 8–12px, đường chia nhóm |
| P2 | Từ ngữ trạng thái/copy không nhất quán | Nhãn trạng thái dùng chung; sửa copy tài khoản quản lý; không trình bày đánh giá tổng hợp như thật |
| P2 | Mục Admin đang chọn khuất trên mobile | Cuộn đến tab hiện tại khi đăng nhập, đổi route và resize; browser kiểm tra vị trí tab |

## Technical audit

| Nhóm | Điểm | Bằng chứng / giới hạn |
| --- | ---: | --- |
| Accessibility | 3/4 | Label/error/focus/dialog keyboard; text khoảng 14.01:1, muted 5.74:1; input border sau sửa khoảng 3.01:1 trên trắng |
| Performance | 3/4 | Production build; bỏ ảnh QR và request QR; chưa đo Lighthouse hoặc thiết bị yếu |
| Theming | 3/4 | Giữ tokens kem/cam và surfaces trắng; chỉ đánh giá theme sáng đang được sản phẩm hỗ trợ |
| Responsive | 3/4 | Edge 1440/768/375; kiểm tra overflow, touch giả lập, reduced motion; chưa kiểm tra thiết bị vật lý |
| Implementation integrity | 4/4 | Detector trả `[]`; role/navigation và trạng thái giao dịch được kiểm tra cả API và browser |
| **Tổng** | **16/20** | **Good**, không đồng nghĩa đã kiểm toán WCAG toàn bộ |

Detector: `.agents/skills/impeccable/scripts/impeccable.cmd detect --json frontend/src/components`, exit 0, không có finding. Các nhận xét thiết kế/nghiệp vụ ở trên là đánh giá thủ công riêng với kết quả detector.

Không còn P0/P1 được quan sát trong phạm vi đã kiểm tra. P2 còn lại: một số nút phụ quản lý dùng variant nhỏ 36px; mở rộng mục tiêu chạm có thể giúp người thao tác khó khăn. P3: backend còn dependency QR không dùng; không được import hoặc đưa vào luồng thanh toán mới. Không mở rộng scope để thay đổi toàn bộ hệ thống nút/dependency trong lượt này.

## Bằng chứng và giới hạn

Đã xem ảnh thực ở `.local/momo-*.png`: checkout, hộp thoại, kết quả, queue Admin, danh sách cơ sở, overview Admin/Host, tài khoản từng vai trò, form cơ sở Host. Browser còn kiểm tra booking review/detail, tìm kiếm, lịch, bảng lọc, invoice/print, bàn phím, touch và reduced motion. Không có overlay detector vì môi trường không cung cấp tab/browser visualization hook; ảnh Playwright và source là bằng chứng thay thế. Không tạo overlay giả.

Hai vòng kiểm tra render và một xác nhận tập trung sửa lỗi copy/điều hướng; dừng chỉnh hình thức sau khi các vấn đề đã quan sát được xử lý. Ảnh dùng tài khoản nhận giả định trong database test, không phải tài khoản thanh toán hoạt động của chủ ứng dụng.

Không hỏi thêm về hướng thiết kế vì brief đã xác định rõ giữ nhận diện hiện có và tiếp tục triển khai. Cấu hình người nhận vẫn là công việc của chủ tài khoản; không cần ảnh QR.

Questions skipped: the user supplied a fixed refinement brief and requested implementation through completion.
