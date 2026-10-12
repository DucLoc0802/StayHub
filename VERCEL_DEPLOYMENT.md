# Triển khai StayHub trên Vercel

Frontend: https://pentabug2-stayhub.vercel.app

Backend API: https://pentabug-stayhub.vercel.app/api

Cấu hình đã được kiểm tra: frontend/backend build thành công, 5 migration đã áp dụng lên Aiven `defaultdb`, API `/api/amenities` và `/api/properties` trả HTTP 200, preflight đăng nhập trả HTTP 204 với đúng CORS origin frontend. Theo yêu cầu demo, đã nạp bộ dữ liệu Prisma: 38 chỗ nghỉ (12 khách sạn, 26 homestay), 62 loại phòng, 14 tiện ích và 8 đơn minh họa. API Vercel đã trả dữ liệu và cả ba tài khoản demo đăng nhập thành công.

Tài khoản demo: `admin` / `admin`, `host` / `host`, `guest` / `guest` (tên đăng nhập / mật khẩu). Tiến trình seed chạy riêng một lần với chế độ development; biến môi trường và ứng dụng Vercel vẫn giữ production. Sau khi nạp dữ liệu, tải lại frontend; không cần redeploy chỉ để hiển thị dữ liệu mới.

## 1. Tạo database MySQL trước

Ứng dụng dùng Prisma 6 và MySQL. Hai project Vercel chỉ chạy frontend/backend; bạn cần tạo một MySQL được lưu trữ bên ngoài, có hostname truy cập được từ Vercel. Không dùng `mysql`, `localhost` hay `127.0.0.1` của Docker local. Lấy chuỗi kết nối từ nhà cung cấp, bao gồm các tùy chọn TLS mà họ yêu cầu; mã hóa ký tự đặc biệt trong username/password theo URL.

Chuỗi minh họa (thay toàn bộ thông tin bằng giá trị thật):

```dotenv
DATABASE_URL=mysql://USER:URL_ENCODED_PASSWORD@HOST:3306/stayhub?connection_limit=1
```

`connection_limit=1` là điểm khởi đầu để giới hạn kết nối trên mỗi instance. Điều chỉnh theo giới hạn MySQL và lượng truy cập. Nếu URL của nhà cung cấp đã có `?`, nối tùy chọn bằng `&` và giữ các tùy chọn TLS. Database phải dùng tên không kết thúc bằng `_test`.

Khi đã có MySQL, đặt `DATABASE_URL` vào môi trường của terminal và chạy migration từ thư mục `backend`:

```powershell
npm ci
npm run prisma:generate
npm run prisma:migrate
```

Nếu dùng `backend/.env` để chạy migration, thay `DATABASE_URL` bằng URL hosted MySQL và giữ file ngoài Git. Migration tạo các bảng từ `prisma/migrations`; database mới chưa có chỗ nghỉ hay tài khoản. Không chạy demo seed trên production. Xem [quy trình tạo quản trị viên production](docs/production.md#initial-access-and-demo-policy) nếu cần tài khoản Admin.

### Aiven của dự án này

Service dùng host `mysql-stayhub-ducloc0802-ddd1.b.aivencloud.com`, port `10718`, database `defaultdb`, user `avnadmin`. File `backend/.env.production` trên máy đã được cấu hình với thông tin thật và JWT secret riêng; file này được Git bỏ qua. Không chép nội dung vào tài liệu hoặc commit.

Prisma MySQL dùng tham số `sslaccept`, không dùng `ssl-mode=REQUIRED` của URI Aiven. Cấu hình hiện tại dùng `sslaccept=accept_invalid_certs` để tương ứng với chế độ **REQUIRED**: kết nối TLS nhưng không xác minh CA. Để xác minh chứng chỉ, tải CA từ Aiven vào `backend/prisma/aiven-ca.pem`, chuyển URL sang `sslcert=aiven-ca.pem&sslaccept=strict` và đảm bảo CA được đóng gói cùng deployment.

Khi dùng file production đã chuẩn bị, kiểm tra kết nối và chạy migration từ `backend`:

```powershell
npm.cmd run check:database
node --env-file=.env.production node_modules/prisma/build/index.js migrate deploy
```

## 2. Project backend: pentabug-stayhub

Trong **Settings > Build and Deployment**, chọn Root Directory `backend`, Framework Preset **NestJS**. File `backend/vercel.json` chọn framework và build command `npm run build:vercel`. Giữ Output Directory theo mặc định của framework. Vercel hỗ trợ entrypoint `src/main.ts`; không cần thêm handler hay rewrite `/api`.

Trong **Settings > Environment Variables**, thêm các biến cho **Production**:

| Biến           | Giá trị                                |
| -------------- | -------------------------------------- |
| `NODE_ENV`     | `production`                           |
| `FRONTEND_URL` | `https://pentabug2-stayhub.vercel.app` |
| `DATABASE_URL` | Chuỗi kết nối MySQL thật lấy ở bước 1  |
| `JWT_SECRET`   | Chuỗi ngẫu nhiên tối thiểu 32 ký tự    |

`NODE_ENV` và `FRONTEND_URL` đã có giá trị mặc định trong `backend/vercel.json`. Nếu project đang có `FRONTEND_URL` cũ, cập nhật về domain trên. Không đưa `DATABASE_URL` hoặc `JWT_SECRET` vào frontend hoặc biến có tiền tố `NEXT_PUBLIC_`. Không cần đặt `PORT` trên Vercel.

Để tạo JWT secret, chạy lệnh sau trên máy cá nhân rồi lưu kết quả vào biến Secret của backend:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Build chỉ generate Prisma Client và biên dịch NestJS; migration ở bước 1 thực hiện riêng. Backend không khởi động thành công khi thiếu database hoặc JWT secret. Prisma Client có binary target cho môi trường Linux của Vercel.

## 3. Project frontend: pentabug2-stayhub

Chọn Root Directory `frontend`, Framework Preset **Next.js**, build command `npm run build`. Giữ Output Directory theo mặc định của framework.

Thêm biến **Production**:

```dotenv
NEXT_PUBLIC_API_URL=https://pentabug-stayhub.vercel.app/api
```

Frontend đọc biến này lúc build. Code cũng dùng API Vercel trên làm mặc định production khi biến chưa được đặt, đồng thời nhận URL backend có hoặc không có `/api`. Nếu project đang đặt biến về localhost, phải sửa giá trị đó. Backend cho phép origin frontend ở trên và các header `Content-Type`, `Authorization` để đăng nhập bằng Bearer JWT.

Các file `.env.production.example` của từng thư mục là mẫu; Vercel không tự đọc file mẫu hay file `.env.production` ngoài Git trên máy bạn. Nhập nội dung `backend/.env.production` vào Environment Variables của project backend, và `frontend/.env.production` vào project frontend. File `.env` local vẫn dùng cho phát triển trên máy.

## 4. Redeploy và kiểm tra

Sau khi MySQL đã có schema và biến môi trường đã lưu, redeploy backend rồi frontend. Các biến mới chỉ áp dụng cho deployment mới.

- Mở https://pentabug-stayhub.vercel.app/api/docs để kiểm tra Swagger.
- Mở https://pentabug-stayhub.vercel.app/api/amenities: database mới sẽ trả `[]`.
- Mở frontend, đăng ký tài khoản Guest rồi đăng nhập. Trong DevTools > Network, request phải tới `https://pentabug-stayhub.vercel.app/api/...`.
- Nếu request trả 401/403 từ Vercel trước khi tới NestJS, kiểm tra Deployment Protection để API production truy cập được từ trình duyệt.
- Nếu backend khởi động thất bại, kiểm tra runtime logs, `DATABASE_URL`, `JWT_SECRET`, TLS, firewall và migration.

Preview dùng biến và database riêng. Nếu cần cho một frontend Preview gọi backend, đặt `FRONTEND_URL` của backend tương ứng thành đúng origin Preview; cấu hình hiện tại cho phép frontend production, không mở mọi domain `*.vercel.app`.

Lịch quét hết hạn dùng timer chỉ chạy khi instance còn hoạt động. Các thao tác đặt phòng/thanh toán có xử lý hết hạn theo request; nếu cần quét liên tục khi không có traffic, cần một scheduler bên ngoài Vercel Function.

Tài liệu tham khảo: [NestJS trên Vercel](https://vercel.com/docs/frameworks/backend/nestjs), [biến môi trường Vercel](https://vercel.com/docs/environment-variables), [Prisma 6 trên Vercel](https://www.prisma.io/docs/orm/v6/prisma-client/deployment/serverless/deploy-to-vercel), [tham số TLS của Prisma MySQL](https://docs.prisma.io/docs/orm/v6/overview/databases/mysql), [chứng chỉ Aiven](https://aiven.io/docs/platform/concepts/tls-ssl-certificates).
