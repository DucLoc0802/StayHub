import Link from 'next/link';
import { RequireAuth } from '@/components/require-auth';
import { BookingsList } from '@/components/bookings-list';
export default function Page() {
  return (
    <RequireAuth role="GUEST">
      <div className="container-shell page-section">
        <h1 className="page-title">Chờ thanh toán</h1>
        <p className="mt-3 mb-6 max-w-2xl text-sm leading-6 text-muted-foreground">
          Các đơn giữ phòng tạm còn hiệu lực. Hoàn tất tiền cọc trước hạn để đơn
          xuất hiện trong Đặt phòng của tôi.
        </p>
        <Link
          href="/bookings"
          className="mb-6 inline-flex min-h-11 items-center text-sm underline"
        >
          Xem đặt phòng đã thanh toán
        </Link>
        <BookingsList pending />
      </div>
    </RequireAuth>
  );
}
