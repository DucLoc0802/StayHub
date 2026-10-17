import { RequireAuth } from '@/components/require-auth';
import { BookingsList } from '@/components/bookings-list';
import Link from 'next/link';
export default function BookingsPage() {
  return (
    <RequireAuth role="GUEST">
      <div className="container-shell page-section">
        <h1 className="page-title mt-3">Đặt phòng của tôi</h1>
        <p className="mb-8 mt-3 text-sm text-muted-foreground">
          Các đặt phòng đã thanh toán cọc và lịch sử chuyến đi của bạn.
        </p>
        <Link
          href="/bookings/pending-payments"
          className="mb-6 inline-flex min-h-11 items-center text-sm font-medium underline"
        >
          Tiếp tục đơn chờ thanh toán
        </Link>
        <BookingsList />
      </div>
    </RequireAuth>
  );
}
