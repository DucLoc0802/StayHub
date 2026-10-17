'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { dateLabel, money, timestampLabel } from '@/lib/utils';
import { BookingSummary } from './booking-extras';
import { Button } from './ui/button';
import { ErrorState, Loading } from './ui/states';
import { useAuth } from './providers';
import { BookingHistory } from './booking-history';
import { BookingReconciliation } from './booking-reconciliation';
import { PaymentError } from './payment-error';

export function BookingScreen({
  id,
  admin = false,
  host = false,
}: {
  id: string;
  admin?: boolean;
  host?: boolean;
}) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: [admin ? 'admin-booking' : host ? 'host-booking' : 'booking', id],
    queryFn: () =>
      admin
        ? api.adminBooking(id)
        : host
          ? api.hostBooking(id)
          : api.booking(id),
    refetchInterval: 10000,
  });
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <PaymentError error={query.error} retry={() => void query.refetch()} />
    );
  const b = query.data;
  return (
    <div className="container-shell page-section">
      <article
        className={`panel mx-auto space-y-5 p-5 sm:p-7 ${admin ? 'max-w-4xl' : 'max-w-2xl'}`}
      >
        <h1 className="page-title">Đơn đặt phòng</h1>
        <BookingSummary booking={b} />
        <p className="text-sm">
          Khách: {b.customerNameSnapshot} · {b.guestCount} người
        </p>
        {b.createdAt && (
          <p className="text-sm text-muted-foreground">
            Tạo ngày {timestampLabel(b.createdAt)}
          </p>
        )}
        {admin && <BookingReconciliation booking={b} />}
        <BookingHistory booking={b} />
        {b.status === 'PENDING_PAYMENT' && (
          <p className="text-sm">
            Hạn cọc: {timestampLabel(b.paymentDeadlineAt)}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {user?.role === 'GUEST' && b.status === 'PENDING_PAYMENT' && (
            <Button asChild>
              <Link href={`/bookings/${id}/payment`}>Thanh toán cọc</Link>
            </Button>
          )}
          {user?.role === 'GUEST' &&
            b.status === 'CONFIRMED' &&
            b.payment?.status === 'SUCCESS' && (
              <Button asChild variant="outline">
                <Link href={`/bookings/${id}/invoice`}>Xem hóa đơn</Link>
              </Button>
            )}
        </div>
        <Link
          href={
            user?.role === 'HOST' &&
            b.guestId !== user.id &&
            user.status === 'ACTIVE'
              ? '/host/bookings'
              : user?.role === 'ADMIN'
                ? '/admin/bookings'
                : '/bookings'
          }
          className="text-sm underline"
        >
          Quay lại lịch sử
        </Link>
      </article>
    </div>
  );
}
export { PaymentScreen, PaymentResultScreen } from './payment-screen';

export function InvoiceScreen({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.invoice(id),
    retry: false,
  });
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <div className="container-shell page-section">
        <ErrorState message={errorMessage(query.error)} />
      </div>
    );
  const b = query.data;
  const rows = [
    ['Họ tên khách hàng', b.customerNameSnapshot],
    [
      'Số điện thoại',
      b.customerPhoneSnapshot || 'Chưa cung cấp ở thời điểm tạo đơn',
    ],
    ['Email', b.customerEmailSnapshot],
    ['Cơ sở lưu trú', b.propertyNameSnapshot],
    ['Địa chỉ', b.propertyAddressSnapshot],
    ['Loại phòng', b.roomTypeNameSnapshot],
    ['Nhận phòng', `${dateLabel(b.checkIn)} ${b.checkInTimeSnapshot} (UTC+7)`],
    ['Trả phòng', `${dateLabel(b.checkOut)} ${b.checkOutTimeSnapshot} (UTC+7)`],
    ['Số đêm', String(b.totalNights)],
    ['Số phòng / căn', String(b.quantity)],
    ['Số khách', String(b.guestCount)],
    ['Đơn giá mỗi đêm', money(b.nightlyPriceSnapshot)],
    ['Tổng tiền', money(b.totalAmount)],
    ['Tỷ lệ cọc', `${b.depositPercentSnapshot}%`],
    ['Tiền cọc đã thanh toán', money(b.depositAmount)],
    ['Còn lại trả tại chỗ nghỉ', money(b.remainingAmount)],
    [
      'Phương thức',
      b.payment?.method === 'MOMO_MANUAL'
        ? 'Chuyển khoản MoMo đã xác minh'
        : 'Giao dịch mô phỏng (lịch sử)',
    ],
    ['Ngày thanh toán', timestampLabel(b.payment!.paidAt)],
    ['Trạng thái', 'CONFIRMED — Đã xác nhận'],
  ];
  return (
    <div className="container-shell page-section">
      <div className="invoice-actions mx-auto mb-5 flex max-w-3xl flex-wrap gap-3">
        <Button onClick={() => window.print()}>In / Xuất PDF</Button>
        <Button asChild variant="outline">
          <Link href={`/bookings/${id}`}>Về đơn đặt phòng</Link>
        </Button>
      </div>
      <article className="invoice-content panel mx-auto max-w-3xl p-6 sm:p-10">
        <p className="text-2xl font-bold tracking-widest">STAYHUB</p>
        <h1 className="mt-4 text-xl font-semibold">Biên nhận thanh toán cọc</h1>
        <p className="mt-2 break-all font-medium">{b.bookingCode}</p>
        <dl className="mt-8 space-y-4">
          {rows.map(([label, value]) => (
            <div
              className="grid gap-1 border-b pb-3 text-sm sm:grid-cols-2"
              key={label}
            >
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-words font-medium sm:text-right">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-xs leading-6 text-muted-foreground">
          Đây là biên nhận khoản cọc, không phải hóa đơn thuế. Giá và thông tin
          khách/cơ sở được lưu khi đặt phòng; đơn cũ được bổ sung thông tin tại
          lúc chuyển đổi dữ liệu. Chọn “Lưu dưới dạng PDF” trong hộp thoại in
          của trình duyệt.
        </p>
      </article>
    </div>
  );
}
