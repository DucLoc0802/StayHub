'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { dateLabel, money, timestampLabel } from '@/lib/utils';
import { BookingSummary } from './booking-extras';
import { Button } from './ui/button';
import { ErrorState, Loading } from './ui/states';
import { useAuth } from './providers';
import { BookingHistory } from './booking-history';

export function BookingScreen({
  id,
  admin = false,
}: {
  id: string;
  admin?: boolean;
}) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: [admin ? 'admin-booking' : 'booking', id],
    queryFn: () => (admin ? api.adminBooking(id) : api.booking(id)),
    refetchInterval: 10000,
  });
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} />;
  const b = query.data;
  return (
    <div className="container-shell page-section">
      <article className="panel mx-auto max-w-2xl space-y-5 p-6">
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
              <Link href={`/bookings/${id}/payment`}>
                Thanh toán cọc bằng QR demo
              </Link>
            </Button>
          )}
          {b.status === 'CONFIRMED' && b.payment?.status === 'SUCCESS' && (
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
export function PaymentScreen({ id }: { id: string }) {
  const router = useRouter(),
    client = useQueryClient();
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const query = useQuery({
    queryKey: ['payment-demo', id],
    queryFn: () => api.paymentDemo(id),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: (outcome: 'SUCCESS' | 'FAILED') => api.pay(id, outcome),
    onSuccess: () => {
      for (const key of [
        'bookings',
        'booking',
        'availability',
        'quote',
        'eligibility',
        'payment-demo',
        'pending-payments',
      ])
        void client.invalidateQueries({ queryKey: [key] });
      router.push(`/bookings/${id}/payment/result`);
    },
    onError: () => {
      void client.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <div className="container-shell page-section">
        <ErrorState message={errorMessage(query.error)} />
        <Link href="/bookings" className="underline">
          Về lịch sử đặt phòng
        </Link>
        <Link
          href={`/bookings/${id}/payment/result`}
          className="mt-4 block underline"
        >
          Xem trạng thái thanh toán
        </Link>
      </div>
    );
  const { booking, payload, qrDataUrl } = query.data;
  const serverClock =
    new Date(query.data.serverNow).getTime() +
    Math.max(0, clock - query.dataUpdatedAt);
  const remaining = new Date(booking.paymentDeadlineAt).getTime() - serverClock;
  return (
    <div className="container-shell page-section">
      <div className="panel mx-auto grid max-w-4xl gap-7 p-6 md:grid-cols-2">
        <section>
          <h1 className="page-title mb-6">Thanh toán cọc</h1>
          <BookingSummary booking={booking} />
          <p className="mt-4 text-sm">
            Khách đặt: {booking.customerNameSnapshot} ·{' '}
            {booking.customerPhoneSnapshot}
          </p>
          <p className="mt-4 text-sm">
            Hạn thanh toán: {timestampLabel(booking.paymentDeadlineAt)}
          </p>
          <p aria-live="polite" className="mt-2 font-semibold">
            {remaining > 0
              ? `Còn ${Math.ceil(remaining / 60000)} phút`
              : 'Đơn đặt phòng đã hết thời gian thanh toán.'}
          </p>
        </section>
        <section className="space-y-4 text-center">
          <h2 className="font-semibold">QR thanh toán demo</h2>
          <Image
            src={qrDataUrl}
            width={280}
            height={280}
            unoptimized
            alt={`QR demo ${payload.reference}, ${money(payload.amount)}`}
            className="mx-auto max-w-full rounded-xl border"
          />
          <p className="break-words font-mono text-sm font-semibold">
            {payload.description}
          </p>
          <p className="text-sm text-muted-foreground">
            Số tiền cần thanh toán lúc này
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {money(payload.amount)}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            Thanh toán mô phỏng. QR không chứa thông tin ngân hàng. Không chuyển
            tiền thật; bấm nút bên dưới để xác nhận demo. Thời hạn và phòng
            trống được kiểm tra trước khi ghi nhận.
          </p>
          {mutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(mutation.error)}
            </p>
          )}
          <Button
            className="w-full"
            disabled={remaining <= 0 || mutation.isPending}
            onClick={() => mutation.mutate('SUCCESS')}
          >
            {mutation.isPending ? 'Đang xác nhận…' : 'Thanh toán cọc demo'}
          </Button>
          <Button
            className="w-full"
            variant="outline"
            disabled={remaining <= 0 || mutation.isPending}
            onClick={() => mutation.mutate('FAILED')}
          >
            Thử tình huống thanh toán thất bại
          </Button>
          <Link
            href="/bookings/pending-payments"
            className="inline-block text-sm underline"
          >
            Thanh toán sau
          </Link>
          {remaining <= 0 && (
            <Link
              href={`/bookings/${id}/payment/result`}
              className="block text-sm underline"
            >
              Xem kết quả hết hạn
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}
export function PaymentResultScreen({ id }: { id: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const query = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.booking(id),
    refetchInterval: 10000,
    retry: false,
  });
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <div className="container-shell page-section">
        <ErrorState
          message={errorMessage(query.error)}
          retry={() => void query.refetch()}
        />
      </div>
    );
  const b = query.data;
  const paid = b.payment?.status === 'SUCCESS';
  const expired =
    b.status === 'EXPIRED' ||
    (!paid && new Date(b.paymentDeadlineAt).getTime() <= now);
  const cancelled = b.status === 'CANCELLED';
  const lastAttempt = b.paymentAttempts?.at(-1);
  const eligible =
    !paid && !expired && !cancelled && b.status === 'PENDING_PAYMENT';
  const title = cancelled
    ? 'Đặt phòng đã hủy'
    : paid
      ? 'Thanh toán thành công'
      : expired
        ? 'Đã hết hạn thanh toán'
        : lastAttempt?.status === 'FAILED'
          ? 'Thanh toán chưa thành công'
          : 'Chưa ghi nhận thanh toán';
  return (
    <div className="container-shell page-section">
      <article className="panel mx-auto max-w-2xl space-y-6 p-6 sm:p-8">
        <h1 className="page-title">{title}</h1>
        <p className="break-words font-semibold">
          Mã đặt phòng: {b.bookingCode}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {cancelled
            ? paid
              ? 'Đơn đã hủy sau thanh toán. Tiền cọc được giữ lại theo chính sách.'
              : 'Đơn đã hủy và phòng đã được giải phóng.'
            : paid
              ? 'Cọc demo đã được ghi nhận. Đặt phòng được xác nhận tự động.'
              : expired
                ? 'Phòng đã được giải phóng. Vui lòng tạo đặt phòng mới.'
                : (lastAttempt?.failureReason ??
                  'Bạn có thể tiếp tục thanh toán trước thời hạn giữ phòng.')}
        </p>
        <BookingSummary booking={b} />
        <div className="flex flex-wrap gap-3">
          {paid && (
            <Button asChild>
              <Link href="/bookings">Xem đặt phòng của tôi</Link>
            </Button>
          )}
          {eligible && (
            <Button asChild>
              <Link href={`/bookings/${id}/payment`}>Thử thanh toán lại</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/properties">Khám phá chỗ nghỉ</Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Thanh toán mô phỏng, không thu tiền thật.
        </p>
      </article>
    </div>
  );
}
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
    ['Phương thức', 'FAKE — Thanh toán demo'],
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
        <h1 className="mt-4 text-xl font-semibold">
          Hóa đơn cọc / Biên nhận demo
        </h1>
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
          Đây là biên nhận tổng hợp cho thanh toán mô phỏng, không phải hóa đơn
          thuế. Giá và thông tin khách/cơ sở được lưu khi đặt phòng; đơn cũ được
          bổ sung thông tin tại lúc chuyển đổi dữ liệu. Chọn “Lưu dưới dạng PDF”
          trong hộp thoại in của trình duyệt.
        </p>
      </article>
    </div>
  );
}
