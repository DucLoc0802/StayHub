'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { dateLabel, money, timestampLabel } from '@/lib/utils';
import { BookingSummary } from './booking-extras';
import { Button } from './ui/button';
import { Loading } from './ui/states';
import { useAuth } from './providers';
import { BookingHistory } from './booking-history';
import { InvoiceDownload } from './invoice-download';
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
          {user?.role === 'GUEST' && b.payment?.status === 'SUCCESS' && (
            <>
              <Button asChild variant="outline">
                <Link href={`/bookings/${id}/invoice`}>Xem hóa đơn</Link>
              </Button>
              <InvoiceDownload id={id} />
            </>
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
      <PaymentError
        invoice
        error={query.error}
        retry={() => void query.refetch()}
      />
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
    ['Tiền cọc đã ghi nhận', money(b.payment!.amount)],
    ['Còn lại trả tại chỗ nghỉ', money(b.totalAmount - b.payment!.amount)],
    [
      'Phương thức',
      b.payment?.method === 'MOMO_MANUAL'
        ? 'Chuyển khoản MoMo đã xác minh'
        : 'Thanh toán mô phỏng',
    ],
    ['Ngày thanh toán', timestampLabel(b.payment!.paidAt)],
    ['Trạng thái thanh toán', 'Đã thanh toán cọc'],
    [
      'Trạng thái đặt phòng',
      b.status === 'CANCELLED'
        ? 'Đã hủy · Giữ nguyên lịch sử thanh toán'
        : b.status === 'CONFIRMED'
          ? 'Đã xác nhận'
          : b.status === 'EXPIRED'
            ? 'Đã hết hạn'
            : 'Chờ thanh toán',
    ],
  ];
  return (
    <div className="container-shell page-section">
      <div className="invoice-actions mx-auto mb-5 flex max-w-3xl flex-wrap gap-3">
        <Button onClick={() => window.print()}>In hóa đơn</Button>
        <InvoiceDownload id={id} label="Tải PDF" />
        <Button asChild variant="outline">
          <Link href={`/bookings/${id}`}>Về đơn đặt phòng</Link>
        </Button>
      </div>
      <article className="invoice-content panel mx-auto max-w-3xl p-6 sm:p-10">
        <p className="text-2xl font-bold text-secondary-foreground">StayHub</p>
        <h1 className="mt-4 text-xl font-semibold">PHIẾU XÁC NHẬN ĐẶT PHÒNG</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {b.payment!.method === 'FAKE'
            ? 'Biên nhận thanh toán mô phỏng'
            : 'Biên nhận khoản cọc MoMo (lịch sử)'}
        </p>
        <p className="mt-2 break-all font-medium">{b.bookingCode}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Thời điểm xuất phiếu:{' '}
          {timestampLabel(new Date(query.dataUpdatedAt).toISOString())}
        </p>
        <div className="mt-8 space-y-4">
          {rows.map(([label, value], index) => (
            <div key={label}>
              {[0, 3, 5, 11].includes(index) && (
                <h2 className="mb-4 pt-3 text-base font-semibold text-secondary-foreground">
                  {index === 0
                    ? 'Thông tin khách hàng'
                    : index === 3
                      ? 'Thông tin chỗ nghỉ'
                      : index === 5
                        ? 'Chi tiết đặt phòng'
                        : 'Chi tiết thanh toán'}
                </h2>
              )}
              <dl className="invoice-row grid gap-1 border-b pb-3 text-sm sm:grid-cols-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd
                  className={`break-words font-medium tabular-nums sm:text-right ${label === 'Tiền cọc đã ghi nhận' ? 'text-lg font-semibold text-secondary-foreground' : ''}`}
                >
                  {value || 'Không có trong bản ghi khi đặt phòng'}
                </dd>
              </dl>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs leading-6 text-muted-foreground">
          {b.payment!.method === 'FAKE'
            ? 'Đây là phiếu xác nhận đặt phòng và biên nhận thanh toán mô phỏng phục vụ đồ án. Không phải hóa đơn giá trị gia tăng và không xác nhận giao dịch tiền thật.'
            : 'Đây là phiếu xác nhận đặt phòng và biên nhận khoản cọc MoMo theo bản ghi lịch sử. Không phải hóa đơn giá trị gia tăng. Tài liệu không tạo thêm giao dịch hay xác minh lại khoản tiền.'}
        </p>
      </article>
    </div>
  );
}
