import { BookingsList } from '@/components/bookings-list';
export default function HostBookingsPage() {
  return (
    <>
      <h2 className="mb-3 text-xl font-semibold">Quản lý đặt phòng</h2>
      <p className="mb-4 text-sm leading-6 text-muted-foreground">
        Theo dõi đặt chỗ theo cơ sở. Đơn được xác nhận sau khi khoản cọc đã được
        xác minh.
      </p>
      <BookingsList host />
    </>
  );
}
