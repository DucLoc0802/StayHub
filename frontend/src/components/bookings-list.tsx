'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Users, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import type { Booking } from '@/lib/types';
import { dateLabel, money, timestampLabel } from '@/lib/utils';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog';
import { Empty, ErrorState, Loading, StatusBadge } from './ui/states';
import { DemoQr, BookingLookup, FeedbackForm } from './booking-extras';
import { useAuth } from './providers';
export function BookingsList({ host = false }: { host?: boolean }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const refreshInventory = () => {
    for (const key of ['availability', 'quote', 'eligibility'])
      void client.invalidateQueries({ queryKey: [key] });
  };
  const bookings = useQuery({
    queryKey: [host ? 'host-bookings' : 'bookings'],
    queryFn: host ? api.hostBookings : api.bookings,
    refetchInterval: 10000,
  });
  const [action, setAction] = useState<{
    kind: 'pay' | 'cancel';
    booking: Booking;
  } | null>(null);
  // Keep presentation intact during exit; the active action still clears immediately.
  const [displayAction, setDisplayAction] = useState<typeof action>(null);
  const dialogTrigger = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const mutation = useMutation({
    mutationFn: ({ kind, booking }: NonNullable<typeof action>) =>
      api[kind](booking.id),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.kind === 'pay'
          ? 'Đã thanh toán cọc. Đặt phòng được xác nhận.'
          : 'Đã hủy đặt chỗ.',
      );
      setAction(null);
      refreshInventory();
      void client.invalidateQueries({ queryKey: ['bookings'] });
      void client.invalidateQueries({ queryKey: ['host-bookings'] });
      void client.invalidateQueries({ queryKey: ['property'] });
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      refreshInventory();
      void client.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
  const due = bookings.data?.some(
    (b) =>
      b.status === 'PENDING_PAYMENT' &&
      new Date(b.paymentDeadlineAt).getTime() <= now,
  );
  useEffect(() => {
    if (!due) return;
    void client.invalidateQueries({
      queryKey: [host ? 'host-bookings' : 'bookings'],
    });
    for (const key of ['availability', 'quote', 'eligibility'])
      void client.invalidateQueries({ queryKey: [key] });
  }, [due, client, host]);
  if (bookings.isPending) return <Loading />;
  if (bookings.isError)
    return (
      <ErrorState
        message={errorMessage(bookings.error)}
        retry={() => void bookings.refetch()}
      />
    );
  return (
    <>
      <BookingLookup />
      {!bookings.data.length ? (
        <Empty>
          {host ? (
            'Chưa có đặt chỗ nào cho chỗ nghỉ của bạn.'
          ) : (
            <>
              <p>Bạn chưa có đặt phòng nào.</p>
              <Button asChild className="mt-5">
                <Link href="/properties">Khám phá chỗ nghỉ</Link>
              </Button>
            </>
          )}
        </Empty>
      ) : (
        <div ref={listRef} tabIndex={-1} className="motion-content space-y-5">
          {bookings.data.map((b) => (
            <article key={b.id} className="panel p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Mã đặt chỗ · {b.bookingCode}
                  </p>
                  <h2 className="text-lg font-semibold">{b.property.name}</h2>
                  <p className="mt-2 text-sm font-medium">
                    {b.roomTypeNameSnapshot} · {b.quantity}{' '}
                    {b.property.type === 'HOTEL' ? 'phòng' : 'căn'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {b.property.district} · {b.property.address}
                  </p>
                </div>
                <StatusBadge status={b.status} />
              </div>
              <div className="my-5 flex flex-wrap gap-5 text-sm">
                <span className="flex items-center gap-2">
                  <CalendarDays size={16} />
                  {dateLabel(b.checkIn)} lúc {b.checkInTimeSnapshot} →{' '}
                  {dateLabel(b.checkOut)} lúc {b.checkOutTimeSnapshot} (UTC+7) ·{' '}
                  {b.totalNights} đêm
                </span>
                <span className="flex items-center gap-2">
                  <Users size={16} />
                  {b.guestCount} khách
                </span>
              </div>
              {host && b.guest && (
                <p className="mb-4 break-all text-sm">
                  Khách thuê: {b.guest.fullName} · {b.guest.email}
                </p>
              )}
              <dl className="grid grid-cols-2 gap-4 rounded-xl bg-muted p-4 md:grid-cols-4">
                {[
                  ['Giá mỗi đêm khi đặt', money(b.nightlyPriceSnapshot)],
                  ['Tổng tiền', money(b.totalAmount)],
                  [
                    `Tiền cọc (${b.depositPercentSnapshot}%)`,
                    money(b.depositAmount),
                  ],
                  ['Trả tại chỗ nghỉ', money(b.remainingAmount)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs leading-5 text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs leading-6 text-muted-foreground">
                  {b.payment?.status === 'SUCCESS' ? (
                    <>
                      <p className="flex items-center gap-1 text-success">
                        <CreditCard size={14} />
                        Đã thanh toán cọc {money(b.payment.amount)} ·{' '}
                        {dateLabel(b.payment.paidAt)}
                      </p>
                      {b.status === 'CANCELLED' && (
                        <p>Tiền cọc được giữ lại, không hoàn tiền.</p>
                      )}
                    </>
                  ) : (
                    <div>
                      {b.status === 'PENDING_PAYMENT' ? (
                        <>
                          <p>
                            Phòng đang được giữ tạm. Hạn cọc:{' '}
                            {timestampLabel(b.paymentDeadlineAt)}.
                          </p>
                          <p>
                            {new Date(b.paymentDeadlineAt).getTime() > now
                              ? 'Còn ' +
                                Math.ceil(
                                  (new Date(b.paymentDeadlineAt).getTime() -
                                    now) /
                                    60000,
                                ) +
                                ' phút để thanh toán.'
                              : 'Đã hết thời gian thanh toán. Đang cập nhật trạng thái…'}
                          </p>
                        </>
                      ) : (
                        <p>
                          {b.status === 'EXPIRED'
                            ? 'Đơn đã hết hạn thanh toán. Phòng đã được giải phóng.'
                            : 'Đơn đã hủy. Phòng đã được giải phóng.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {!host && user?.role === 'GUEST' &&
                  (b.status === 'CONFIRMED' ||
                    (b.status === 'PENDING_PAYMENT' &&
                      new Date(b.paymentDeadlineAt).getTime() > now)) && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={(event) => {
                          dialogTrigger.current = event.currentTarget;
                          mutation.reset();
                          setDisplayAction({ kind: 'cancel', booking: b });
                          setAction({ kind: 'cancel', booking: b });
                        }}
                      >
                        Hủy đặt chỗ
                      </Button>
                      {b.status === 'PENDING_PAYMENT' && (
                        <Button
                          onClick={(event) => {
                            dialogTrigger.current = event.currentTarget;
                            mutation.reset();
                            setDisplayAction({ kind: 'pay', booking: b });
                            setAction({ kind: 'pay', booking: b });
                          }}
                        >
                          Thanh toán cọc
                        </Button>
                      )}
                    </div>
                  )}
              </div>
              {b.status === 'CONFIRMED' && b.payment?.status === 'SUCCESS' && (
                <Button asChild variant="outline" className="mt-4">
                  <Link href={`/bookings/${b.id}/invoice`}>Xem hóa đơn</Link>
                </Button>
              )}
              {!host &&
                b.status === 'CONFIRMED' &&
                !b.feedback &&
                new Date(
                  `${b.checkOut.slice(0, 10)}T${b.checkOutTimeSnapshot}:00+07:00`,
                ).getTime() <= now && <FeedbackForm booking={b} />}
              {b.feedback && (
                <p className="mt-4 text-sm">
                  Đã đánh giá: {b.feedback.rating}/5 · {b.feedback.content}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
      <Dialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setAction(null);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = dialogTrigger.current?.isConnected
              ? dialogTrigger.current
              : listRef.current;
            target?.focus({ preventScroll: true });
          }}
        >
          <DialogTitle className="pr-6 text-xl font-semibold">
            {displayAction?.kind === 'pay'
              ? 'Thanh toán tiền cọc giả lập'
              : 'Hủy đặt chỗ'}
          </DialogTitle>
          <DialogDescription className="mt-4 text-sm leading-7 text-muted-foreground">
            {displayAction?.kind === 'pay'
              ? `Bạn sẽ thanh toán tiền cọc ${money(displayAction.booking.depositAmount)}. Đây là thanh toán giả lập, không thu tiền thật. Phần còn lại ${money(displayAction.booking.remainingAmount)} trả tại chỗ nghỉ. Phòng đang được giữ cho bạn đến hạn thanh toán.`
              : displayAction?.booking.status === 'CONFIRMED'
                ? 'Đặt phòng này đã được xác nhận. Nếu hủy, bạn sẽ mất khoản tiền cọc. Bạn có chắc chắn muốn tiếp tục?'
                : 'Bạn có chắc muốn hủy đặt chỗ này? Bạn chưa thanh toán nên không mất tiền cọc.'}
          </DialogDescription>
          {action?.kind === 'pay' && <DemoQr id={action.booking.id} />}
          {mutation.isError && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {errorMessage(mutation.error)}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setAction(null)}
            >
              Quay lại
            </Button>
            <Button
              variant={
                displayAction?.kind === 'cancel' ? 'destructive' : 'default'
              }
              disabled={
                mutation.isPending ||
                (action?.kind === 'pay' &&
                  new Date(action.booking.paymentDeadlineAt).getTime() <= now)
              }
              onClick={() => {
                if (action) mutation.mutate(action);
              }}
            >
              {mutation.isPending
                ? 'Đang xử lý…'
                : displayAction?.kind === 'pay'
                  ? 'Tôi đã thanh toán'
                  : 'Xác nhận hủy'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
