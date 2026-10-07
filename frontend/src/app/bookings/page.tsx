import { RequireAuth } from '@/components/require-auth';
import { BookingsList } from '@/components/bookings-list';
export default function BookingsPage() {
  return (
    <RequireAuth>
      <div className="container-shell page-section">
        <p className="eyebrow">NHỮNG CHUYẾN ĐI CỦA BẠN</p>
        <h1 className="page-title mt-3">Đặt phòng của tôi</h1>
        <p className="mb-8 mt-3 text-sm text-muted-foreground">
          Xem lịch trình, thanh toán cọc và quản lý đặt chỗ của bạn.
        </p>
        <BookingsList />
      </div>
    </RequireAuth>
  );
}
