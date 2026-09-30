'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Users, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import type { Booking } from '@/lib/types';
import { dateLabel, money } from '@/lib/utils';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog';
import { Empty, ErrorState, Loading, StatusBadge } from './ui/states';
export function BookingsList({ host = false }: { host?: boolean }) {
  const client = useQueryClient();
  const bookings = useQuery({
    queryKey: [host ? 'host-bookings' : 'bookings'],
    queryFn: host ? api.hostBookings : api.bookings,
  });
  const [action, setAction] = useState<{
    kind: 'pay' | 'cancel';
    booking: Booking;
  } | null>(null);
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
      void client.invalidateQueries({ queryKey: ['bookings'] });
      void client.invalidateQueries({ queryKey: ['host-bookings'] });
      void client.invalidateQueries({ queryKey: ['property'] });
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      void client.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
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
        <div className="space-y-5">
          {bookings.data.map((b) => (
            <article key={b.id} className="panel p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Mã đặt chỗ · {b.id.slice(0, 8)}
                  </p>
                  <h2 className="text-lg font-semibold">{b.property.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {b.property.district} · {b.property.address}
                  </p>
                </div>
                <StatusBadge status={b.status} />
              </div>
              <div className="my-5 flex flex-wrap gap-5 text-sm">
                <span className="flex items-center gap-2">
                  <CalendarDays size={16} />
                  {dateLabel(b.checkIn)} → {dateLabel(b.checkOut)} ·{' '}
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
                    <p>Chưa thanh toán cọc. Chỗ nghỉ chưa được giữ.</p>
                  )}
                </div>
                {!host && b.status !== 'CANCELLED' && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        mutation.reset();
                        setAction({ kind: 'cancel', booking: b });
                      }}
                    >
                      Hủy đặt chỗ
                    </Button>
                    {b.status === 'PENDING_PAYMENT' && (
                      <Button
                        onClick={() => {
                          mutation.reset();
                          setAction({ kind: 'pay', booking: b });
                        }}
                      >
                        Thanh toán cọc
                      </Button>
                    )}
                  </div>
                )}
              </div>
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
        <DialogContent>
          <DialogTitle className="pr-6 text-xl font-semibold">
            {action?.kind === 'pay'
              ? 'Thanh toán tiền cọc giả lập'
              : 'Hủy đặt chỗ'}
          </DialogTitle>
          <DialogDescription className="mt-4 text-sm leading-7 text-muted-foreground">
            {action?.kind === 'pay'
              ? `Bạn sẽ thanh toán tiền cọc ${money(action.booking.depositAmount)}. Đây là thanh toán giả lập, không thu tiền thật. Phần còn lại ${money(action.booking.remainingAmount)} trả tại chỗ nghỉ. Chỗ nghỉ chỉ được xác nhận nếu vẫn còn trống.`
              : action?.booking.status === 'CONFIRMED'
                ? 'Đặt phòng này đã được xác nhận. Nếu hủy, bạn sẽ mất khoản tiền cọc. Bạn có chắc chắn muốn tiếp tục?'
                : 'Bạn có chắc muốn hủy đặt chỗ này? Bạn chưa thanh toán nên không mất tiền cọc.'}
          </DialogDescription>
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
              variant={action?.kind === 'cancel' ? 'destructive' : 'default'}
              disabled={mutation.isPending}
              onClick={() => {
                if (action) mutation.mutate(action);
              }}
            >
              {mutation.isPending
                ? 'Đang xử lý…'
                : action?.kind === 'pay'
                  ? 'Xác nhận thanh toán'
                  : 'Xác nhận hủy'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
