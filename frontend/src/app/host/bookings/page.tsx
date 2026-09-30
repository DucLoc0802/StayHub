import { BookingsList } from '@/components/bookings-list';
export default function HostBookingsPage() {
  return (
    <>
      <h2 className="mb-3 text-xl font-semibold">
        Đặt phòng tại chỗ nghỉ của tôi
      </h2>
      <p className="mb-7 text-sm text-muted-foreground">
        Theo dõi thông tin đặt chỗ. Đơn được xác nhận tự động khi khách thanh
        toán cọc.
      </p>
      <BookingsList host />
    </>
  );
}
