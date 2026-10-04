# StayHub

Nền tảng đặt homestay/khách sạn tại TP. Hồ Chí Minh, xây mới theo task.txt. Một chỗ nghỉ là một đơn vị đặt độc lập. Giao diện tiếng Việt, cam ấm / kem / trắng, font Be Vietnam Pro.

## Chức năng

- Khách thuê đăng ký và tự đăng nhập; Người cho thuê đăng ký chờ duyệt; Quản trị viên duyệt hoặc từ chối.
- Tìm kiếm tên/khu vực, loại HOTEL/HOMESTAY, giá, đủ tất cả tiện ích đã chọn, sắp xếp giá và phân trang.
- Người cho thuê ACTIVE tạo/sửa/kích hoạt/tạm ngưng chỗ nghỉ, nhiều URL ảnh, tỷ lệ cọc riêng; chỉ xem đơn thuộc sở hữu.
- Chủ nhà thiết lập giờ nhận/trả phòng (HH:mm, UTC+7); khách thấy giờ khi chọn ngày và trong lịch sử đơn. Sau giờ nhận phòng, lịch làm mờ và không cho chọn ngày hôm nay và API từ chối tạo đơn/thanh toán cọc quá hạn. Giờ được lưu theo từng đơn, thay đổi giờ chỗ nghỉ chỉ áp dụng cho đơn mới. Chỗ nghỉ và đơn cũ mặc định nhận 14:00, trả 12:00.
- Lịch chọn ngày, tính giá trên backend, lưu snapshot; thanh toán cọc giả lập xác nhận tự động.
- Chống xác nhận hai đơn trùng lịch; hủy đơn giữ lại cọc đã trả, giải phóng lịch.
- Link chỗ nghỉ dùng tên ngắn như /properties/loi-hoa-family-home, trùng tên thêm hậu tố -2, -3. Đường dẫn được giữ khi đổi tên chỗ nghỉ; link UUID và link dài cũ tự chuyển sang link ngắn. API tự bổ sung đường dẫn cho các chỗ nghỉ cũ khi khởi động.
- Loading/error/empty, menu và dialog có hỗ trợ bàn phím; layout responsive.

## Stack và cấu trúc

Next.js App Router + TypeScript + Tailwind + shadcn/Radix + React Hook Form/Zod + Axios/TanStack Query. NestJS REST + Prisma 6 + MySQL 8.4 + JWT + bcrypt + Swagger. Các phiên bản cụ thể nằm trong package-lock.json.

```text
frontend/                 Next.js, UI, Playwright
backend/src/              NestJS modules, services, DTOs, guards
backend/prisma/           Schema, migrations, seed
backend/test/             Unit, validation, API/concurrency E2E
docs/                     Phân tích, use cases, ERD, kiểm thử, Postman
scripts/setup-env.mjs      Tạo env local và JWT ngẫu nhiên
docker-compose.yml        Frontend, backend và MySQL; tự seed khi khởi động
PROJECT_PLAN.md            Kế hoạch và tiến độ
```

## Chạy toàn bộ bằng Docker

Chuẩn bị `.env` ở thư mục gốc, `backend/.env` và `frontend/.env` theo các file `.env.example`. Trong `backend/.env`, `DATABASE_URL` phải dùng host `mysql`, cổng `3306`, tên database và tài khoản khớp với `.env` ở thư mục gốc.

```powershell
docker compose up -d --build
docker compose logs -f server
```

Mỗi lần backend khởi động, Docker chờ MySQL healthy, chạy `prisma db push`, chạy seed đã biên dịch rồi mới mở API. Seed lỗi thì backend dừng để tránh khởi động với dữ liệu mẫu chưa hoàn tất. Image chứa sẵn Prisma CLI và seed JavaScript, không cần tải công cụ khi container khởi động.

Mở http://localhost:3000/properties để xem 38 chỗ nghỉ tổng hợp với ảnh minh họa và 14 tiện ích. Tên, địa chỉ khu vực, giá và tài khoản đều dùng cho demo; không lấy từ tin đăng thật. Đăng nhập bằng `admin/admin`, `host/host` hoặc `guest/guest`. Dữ liệu MySQL được giữ trong volume `mysql_data`.

Để chạy seed riêng khi backend đang hoạt động:

```powershell
docker compose exec server node dist/seed/seed.js
```

## Chạy trên máy mới

Cần Node.js 22.12+ hoặc 24 LTS, npm, Docker Compose. Cổng 3000, 4000, 3306 phải trống. Lần cài/build đầu cần mạng để tải npm packages và Google Fonts.

Trên PowerShell nếu `npm.ps1` bị chặn, dùng `npm.cmd` và `npx.cmd` thay vì đổi execution policy.

```powershell
npm.cmd ci
npm.cmd ci --prefix backend
npm.cmd ci --prefix frontend
node scripts/setup-env.mjs
docker compose up -d mysql
docker compose ps
```

Đợi mysql healthy. `setup-env` không ghi đè cấu hình đã có, tạo JWT secret ngẫu nhiên; .env được gitignore. Điều chỉnh DATABASE_URL nếu dùng MySQL riêng. Compose dùng tài khoản `stayhub` / `stayhub` chỉ dành cho local.

```powershell
cd backend
npm.cmd run prisma:generate
npm.cmd run prisma:validate
npm.cmd run prisma:migrate
npm.cmd run build:seed
npx.cmd prisma db seed
npm.cmd run dev
```

Mở terminal khác tại thư mục dự án:

```powershell
cd frontend
npm.cmd run dev
```

- Giao diện: http://localhost:3000
- REST API: http://localhost:4000/api
- Swagger: http://localhost:4000/api/docs
- Chỗ nghỉ: http://localhost:3000/properties
- Người cho thuê: http://localhost:3000/host
- Quản trị viên: http://localhost:3000/admin/hosts

Swagger: gọi `/auth/login`, copy accessToken vào nút Authorize (Bearer). POST login/register không cần đăng nhập.

## Chạy lại trong workspace hiện tại khi chưa có Docker

Đã tải MySQL Community 8.4.11 portable chính thức vào `.local/mysql` và tạo database riêng ở `127.0.0.1:3307`. Cổng 3306 đã bận nên dịch vụ hiện có được giữ nguyên. `backend/.env` local hiện trỏ tới 3307; `.env.example` vẫn dùng 3306 cho Docker trên máy mới.

Giữ ba terminal mở, chạy từ `E:\StayHub`:

```powershell
# Terminal 1: chỉ chạy nếu MySQL portable chưa hoạt động
node scripts/start-local-mysql.mjs

# Terminal 2
npm.cmd start --prefix backend

# Terminal 3
npm.cmd start --prefix frontend
```

Dừng MySQL riêng bằng `node scripts/stop-local-mysql.mjs`. Thư mục `.local` và cấu hình root ngẫu nhiên không được đưa vào Git. Khi chuyển sang Docker, sửa DATABASE_URL local về cổng 3306 hoặc cổng Compose bạn chọn. Mỗi instance có dữ liệu riêng.

## Tài khoản demo

Tài khoản và mật khẩu dưới đây chỉ dùng demo local. Màn hình đăng nhập nhận tên demo hoặc email tương ứng; đăng ký vẫn yêu cầu email hợp lệ và mật khẩu ít nhất 8 ký tự.

| Tài khoản đăng nhập       | Email                     | Mật khẩu    | Vai trò                | Trạng thái |
| ------------------------- | ------------------------- | ----------- | ---------------------- | ---------- |
| admin                     | admin@stayhub.local       | admin       | Quản trị viên          | ACTIVE     |
| host                      | host@stayhub.local        | host        | Người cho thuê         | ACTIVE     |
| guest                     | guest@stayhub.local       | guest       | Khách thuê             | ACTIVE     |
| pendinghost@stayhub.local | pendinghost@stayhub.local | StayHub123! | Người cho thuê         | PENDING    |
| host.east@stayhub.local   | host.east@stayhub.local   | StayHub123! | Chủ nhà demo phía Đông | ACTIVE     |
| host.south@stayhub.local  | host.south@stayhub.local  | StayHub123! | Chủ nhà demo phía Nam  | ACTIVE     |

Seed gồm 38 chỗ nghỉ (7 Thủ Đức, 7 Quận 1, 6 Quận 2, 6 Bình Thạnh, 5 Quận 7, 3 Quận 3, 2 Gò Vấp, 2 Phú Nhuận), 14 tiện ích và 3 chủ nhà ACTIVE; giữ tài khoản chủ nhà chờ duyệt để demo admin. Quận 2 và tên phường/khu vực được dùng theo nhãn quen thuộc trước đây, không mô tả địa giới hành chính hiện hành. Giá 350.000–2.350.000 ₫/đêm là giá tổng hợp, không phải khảo sát thị trường.

UUID chỗ nghỉ và email demo cố định giúp chạy seed nhiều lần không tạo trùng. Seed nâng cấp một lần 4 chỗ nghỉ cũ chỉ khi vẫn nhận diện được nội dung seed ban đầu; giữ ID, chủ sở hữu, trạng thái và lịch sử đặt phòng/thanh toán. Các chỗ nghỉ đã sửa và vai trò/trạng thái tài khoản được giữ nguyên. Seed cập nhật mật khẩu của đúng ba tài khoản demo chính về admin/host/guest nếu đang khác; mật khẩu của các tài khoản khác được giữ nguyên. Tên hiển thị giả lập cũ của 3 tài khoản được đổi sang nhãn demo nếu chưa bị chỉnh sửa. Không tạo booking mẫu để các chỗ nghỉ sẵn sàng cho thử đặt phòng.

Prisma 6 chạy `npx prisma db seed` bằng seed JavaScript đã biên dịch; tại máy local cần chạy `npm run build:seed` trước. `npm run prisma:seed` là lựa chọn chạy TypeScript trực tiếp trong môi trường phát triển. Image Docker đã chứa seed biên dịch và tự chạy khi backend khởi động.

Hiện không có collector/scraper, importer dữ liệu ngoài hoặc dataset lấy từ website thương mại. Thu thập dữ liệu Việt Nam hợp lệ là giai đoạn riêng trong tương lai. [Chi tiết seed và kiểm chứng](docs/synthetic-seed-data.md).

## Quy tắc cần nhớ

- PENDING_PAYMENT **không giữ chỗ**. Chỉ CONFIRMED chặn ngày. Checkout exclusive: trả ngày 15 thì đơn mới có thể nhận ngày 15.
- Thanh toán kiểm tra lại availability và xác nhận trong cùng transaction Serializable, retry P2034. `Payment.bookingId` duy nhất.
- Tỷ lệ cọc 1–100% theo chỗ nghỉ, số tiền nguyên VND, làm tròn lên 1 đồng. Không tính lại đơn cũ theo giá mới.
- Giới hạn 365 đêm, giá tối đa 50 triệu/đêm, tổng không vượt 2.147.483.647 ₫. Backend từ chối tổng vượt giới hạn.
- Hủy CONFIRMED giữ Payment SUCCESS và không hoàn tiền. Hủy/thu cọc đồng thời không được xác nhận lại đơn đã hủy.
- HOST PENDING/REJECTED được đăng nhập nhưng không quản lý. REJECTED không được duyệt lại.
- Không có đánh giá, sao, bản đồ, thanh toán thật, upload, host duyệt booking, chỉnh sửa hồ sơ hoặc phân cấp khách sạn/phòng.

## Kiểm tra

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd test
npm.cmd run format:check
```

API E2E cần MySQL đã migrate/seed và backend đang chạy:

```powershell
npm.cmd run test:e2e --prefix backend
```

E2E dùng email riêng cho từng lượt, kiểm tra luồng chính, phân quyền, snapshot, overlap, cọc lặp và tranh chấp cọc/hủy; dọn dữ liệu API test tự tạo trong `finally`. Nên dùng database local riêng.

Playwright cần frontend và backend đang chạy cùng database demo. Cấu hình hiện dùng Microsoft Edge đã cài trên Windows:

```powershell
cd frontend
npx.cmd playwright test
```

Máy không có Edge: đổi `channel` trong playwright.config.ts thành trình duyệt đã cài hoặc bỏ `channel` và chạy `npx playwright install chromium`. Test UI luồng đặt chỗ để lại một đơn CANCELLED có cọc để có thể kiểm tra lịch sử demo.

Build production: `npm run build` tại root; sau đó `npm start --prefix backend` và `npm start --prefix frontend` ở hai terminal.

## Tài liệu và Postman

- [Kết quả kiểm chứng và giới hạn](docs/verification.md)
- [17 use case](docs/use-cases.md)
- [Gap analysis](docs/stayhub-gap-analysis.md)
- [Kiến trúc](docs/architecture.md), [ERD](docs/erd.md), [Luồng nghiệp vụ](docs/business-flow.md)
- [Test cases](docs/test-cases.md), [AI log](docs/ai-development-log-template.md)
- [Postman collection](docs/postman/StayHub.postman_collection.json): import, đổi `runId` cho mỗi lượt, chọn ngày tương lai; chạy các thư mục theo thứ tự. Token/id được lưu tự động. Không chứa secret thật.

## Giới hạn vận hành

Đây là mini project local, chưa triển khai lên dịch vụ công khai. JWT localStorage là lựa chọn của đề bài. Ảnh Unsplash/URL của Host phụ thuộc nguồn ngoài. Không có tiền thật, email thật hoặc khôi phục mật khẩu. Các kiểm tra thực tế và phần chưa kiểm tra được ghi riêng trong verification.md; không suy luận “hoạt động” chỉ vì có mã nguồn.
