'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Clock3, ShieldCheck } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { money, dateLabel, timestampLabel } from '@/lib/utils';
import { paymentState } from '@/lib/payment-state';
import type { Booking } from '@/lib/types';
import { Button } from './ui/button';
import { ErrorState, StatusBadge } from './ui/states';
import { PaymentError } from './payment-error';
import { InvoiceDownload } from './invoice-download';

const disclosure =
  'Thanh toán mô phỏng phục vụ đồ án. Không phát sinh giao dịch tiền thật.';
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
function Summary({
  booking: b,
  className = '',
}: {
  booking: Booking;
  className?: string;
}) {
  const paid = b.payment?.status === 'SUCCESS';
  return (
    <aside
      className={`self-start rounded-xl border bg-white p-5 sm:p-7 ${className}`}
      aria-label="Thông tin đặt phòng"
    >
      <h2 className="mb-5 text-lg font-semibold">Thông tin đặt phòng</h2>
      <p className="break-words text-xl font-semibold">
        {b.propertyNameSnapshot || 'Chỗ nghỉ theo đơn đã lưu'}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {b.roomTypeNameSnapshot} · {b.quantity} phòng / căn · {b.guestCount}{' '}
        khách
      </p>
      <dl className="my-5 grid grid-cols-2 gap-4 border-y py-5 text-sm">
        <div>
          <dt className="text-muted-foreground">Nhận phòng</dt>
          <dd className="mt-1 font-semibold">{dateLabel(b.checkIn)}</dd>
          <dd>{b.checkInTimeSnapshot}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Trả phòng</dt>
          <dd className="mt-1 font-semibold">{dateLabel(b.checkOut)}</dd>
          <dd>{b.checkOutTimeSnapshot}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        Giờ Việt Nam (UTC+7) · {b.totalNights} đêm
      </p>
      <dl className="mt-5 space-y-4 text-sm">
        {[
          ['Tổng giá trị đặt phòng', b.totalAmount],
          [
            paid
              ? 'Cọc đã ghi nhận'
              : `Tiền cọc (${b.depositPercentSnapshot}%)`,
            paid ? b.payment!.amount : b.depositAmount,
          ],
          [
            'Còn lại tại chỗ nghỉ',
            b.totalAmount - (paid ? b.payment!.amount : b.depositAmount),
          ],
        ].map(([label, amount]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="shrink-0 font-semibold tabular-nums">
              {money(Number(amount))}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 space-y-2 border-t pt-5 text-sm">
        <p className="break-all">
          Mã đặt phòng: <strong>{b.bookingCode}</strong>
        </p>
        <StatusBadge status={b.status} />
      </div>
    </aside>
  );
}
function PaymentLoading() {
  return (
    <div className="container-shell page-section">
      <p role="status" className="py-16 text-center text-muted-foreground">
        Đang tải thông tin thanh toán…
      </p>
    </div>
  );
}
export function PaymentScreen({ id }: { id: string }) {
  const router = useRouter(),
    client = useQueryClient(),
    now = useNow();
  const inFlight = useRef(false);
  const query = useQuery({
    queryKey: ['checkout', id],
    queryFn: () => api.checkout(id),
    retry: false,
    refetchInterval: 10000,
  });
  const payment = useMutation({
    mutationFn: () => api.pay(id),
    onSuccess: (booking) => {
      client.setQueryData(['booking', id], booking);
      for (const key of [
        'checkout',
        'bookings',
        'pending-payments',
        'eligibility',
        'availability',
        'quote',
      ])
        void client.invalidateQueries({ queryKey: [key] });
      router.replace(`/bookings/${id}/payment/result`);
    },
    onError: () => {
      void query.refetch();
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });
  if (query.isPending) return <PaymentLoading />;
  if (query.isError)
    return (
      <PaymentError error={query.error} retry={() => void query.refetch()} />
    );
  const b = query.data.booking;
  const serverOffset = Date.parse(query.data.serverNow) - query.dataUpdatedAt;
  const state = paymentState(b, now + serverOffset);
  return (
    <div className="bg-cream">
      <div className="container-shell page-section">
        <div className="mx-auto max-w-5xl">
          <Link
            href={`/bookings/${id}`}
            className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm underline"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Chi tiết đặt phòng
          </Link>
          <h1 className="page-title">Thanh toán đặt phòng</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            Kiểm tra thông tin và xác nhận khoản cọc. Đặt phòng được xác nhận
            ngay sau khi thanh toán mô phỏng thành công.
          </p>
          <div className="mt-7 grid items-start gap-6 lg:grid-cols-[1.15fr_1fr]">
            <section
              className="rounded-xl border bg-white p-5 sm:p-8"
              aria-labelledby="payment-info"
            >
              <h2 id="payment-info" className="text-lg font-semibold">
                Thông tin thanh toán
              </h2>
              <dl className="mt-5 space-y-3 border-b pb-5 text-sm">
                <div>
                  <dt className="text-muted-foreground">Khách đặt phòng</dt>
                  <dd className="mt-1 break-words font-semibold">
                    {b.customerNameSnapshot || 'Không có trong bản ghi'}
                  </dd>
                </div>
                {b.customerPhoneSnapshot && (
                  <div>
                    <dt className="text-muted-foreground">Điện thoại</dt>
                    <dd className="mt-1">{b.customerPhoneSnapshot}</dd>
                  </div>
                )}
                {b.customerEmailSnapshot && (
                  <div>
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="mt-1 break-all">
                      {b.customerEmailSnapshot}
                    </dd>
                  </div>
                )}
              </dl>
              {state.canPay ? (
                <>
                  <p className="mt-6 text-sm text-muted-foreground">
                    Số tiền cọc cần ghi nhận
                  </p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums sm:text-4xl">
                    {money(b.depositAmount)}
                  </p>
                  <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                    <Clock3
                      size={17}
                      className="mt-1 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      Thanh toán trước {timestampLabel(b.paymentDeadlineAt)}
                    </span>
                  </p>
                  <Button
                    className="mt-7 min-h-12 w-full"
                    disabled={payment.isPending}
                    aria-busy={payment.isPending}
                    onClick={() => {
                      if (inFlight.current) return;
                      inFlight.current = true;
                      payment.mutate();
                    }}
                  >
                    {payment.isPending
                      ? 'Đang xử lý thanh toán…'
                      : 'Tôi đã thanh toán'}
                    <ArrowRight size={18} aria-hidden="true" />
                  </Button>
                </>
              ) : (
                <div className="mt-6 space-y-3" role="status">
                  <h3 className="font-semibold">{state.title}</h3>
                  <p className="text-sm leading-7 text-muted-foreground">
                    {state.description}
                  </p>
                  <Button asChild variant="outline">
                    <Link href={`/bookings/${id}/payment/result`}>
                      Xem trạng thái thanh toán
                    </Link>
                  </Button>
                </div>
              )}
              {payment.isError && (
                <div className="mt-4">
                  <ErrorState message={errorMessage(payment.error)} />
                </div>
              )}
              <p className="mt-5 text-xs leading-6 text-muted-foreground">
                {disclosure}
              </p>
            </section>
            <Summary booking={b} className="order-first lg:order-last" />
          </div>
        </div>
      </div>
    </div>
  );
}
export function PaymentResultScreen({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.booking(id),
    retry: false,
    refetchOnMount: 'always',
    refetchInterval: 5000,
  });
  const now = useNow();
  if (query.isPending) return <PaymentLoading />;
  if (query.isError)
    return (
      <PaymentError error={query.error} retry={() => void query.refetch()} />
    );
  const b = query.data,
    state = paymentState(b, now),
    paid = b.payment?.status === 'SUCCESS';
  return (
    <div className="bg-cream">
      <div className="container-shell page-section">
        <div className="mx-auto grid max-w-5xl items-start gap-6 lg:grid-cols-[1.15fr_1fr]">
          <section className="space-y-5 rounded-xl border bg-white p-5 sm:p-8">
            {paid ? (
              <ShieldCheck
                size={40}
                className="text-success"
                aria-hidden="true"
              />
            ) : (
              <Clock3 size={40} className="text-warning" aria-hidden="true" />
            )}
            <h1 className="page-title">{state.title}</h1>
            <p
              role="status"
              className="text-sm leading-7 text-muted-foreground"
            >
              {state.description}
            </p>
            {paid && (
              <dl className="space-y-3 border-y py-5 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <dt>
                    Cọc đã ghi nhận
                    {b.payment!.method === 'FAKE' ? ' (mô phỏng)' : ''}
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {money(b.payment!.amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    Thời điểm thanh toán
                  </dt>
                  <dd className="mt-1">{timestampLabel(b.payment!.paidAt)}</dd>
                </div>
              </dl>
            )}
            <div className="flex flex-wrap gap-3">
              {paid && (
                <>
                  <Button asChild>
                    <Link href="/bookings">Xem đặt phòng của tôi</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/bookings/${id}/invoice`}>Xem hóa đơn</Link>
                  </Button>
                  <InvoiceDownload id={id} />
                </>
              )}
              {state.canPay && (
                <Button asChild>
                  <Link href={`/bookings/${id}/payment`}>
                    Tiếp tục thanh toán
                  </Link>
                </Button>
              )}
              {!paid && (
                <Button asChild variant="outline">
                  <Link href="/bookings/pending-payments">
                    Đơn chờ thanh toán
                  </Link>
                </Button>
              )}
            </div>
            {(!paid || b.payment!.method === 'FAKE') && (
              <p className="text-xs leading-6 text-muted-foreground">
                {disclosure}
              </p>
            )}
            <Link
              href={`/bookings/${id}`}
              className="inline-flex min-h-11 items-center text-sm underline"
            >
              Chi tiết đặt phòng
            </Link>
          </section>
          <Summary booking={b} />
        </div>
      </div>
    </div>
  );
}
