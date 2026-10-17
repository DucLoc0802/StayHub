'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Copy,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { money, dateLabel, timestampLabel } from '@/lib/utils';
import { paymentState } from '@/lib/payment-state';
import type { Booking } from '@/lib/types';
import { Button } from './ui/button';
import { ErrorState, StatusBadge } from './ui/states';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { PaymentError } from './payment-error';

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
function Summary({ booking: b }: { booking: Booking }) {
  return (
    <aside className="panel self-start p-5 sm:p-6">
      <h2 className="mb-5 text-lg font-semibold">Thông tin đặt phòng</h2>
      <p className="break-words text-xl font-semibold">
        {b.propertyNameSnapshot || b.property.name}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {b.roomTypeNameSnapshot} · {b.quantity}{' '}
        {b.property.type === 'HOTEL' ? 'phòng' : 'căn'} · {b.guestCount} khách
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
      <dl className="mt-5 space-y-3 text-sm">
        {[
          ['Tổng tiền', b.totalAmount],
          ['Tiền cọc', b.depositAmount],
          ['Còn lại tại chỗ nghỉ', b.remainingAmount],
        ].map(([label, amount]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={label === 'Tiền cọc' ? 'font-bold' : 'font-medium'}>
              {money(Number(amount))}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 border-t pt-5 text-sm">
        <p className="font-semibold">{b.customerNameSnapshot}</p>
        <p className="mt-1 text-muted-foreground">{b.customerPhoneSnapshot}</p>
        <p className="mt-3 break-all text-xs text-muted-foreground">
          Mã đặt phòng: {b.bookingCode}
        </p>
        <div className="mt-3">
          <StatusBadge status={b.status} />
        </div>
      </div>
    </aside>
  );
}
function PaymentLoading() {
  return (
    <div
      className="container-shell page-section"
      role="status"
      aria-label="Đang tải thanh toán"
    >
      <h1 className="page-title">Đang mở thanh toán</h1>
      <p className="my-4 text-sm text-muted-foreground">
        Đang lấy thông tin đặt phòng và khoản cọc của bạn…
      </p>
      <div aria-hidden="true" className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="panel space-y-5 p-6">
          <div className="skeleton h-12 w-2/3 rounded-lg" />
          <div className="skeleton h-44 rounded-lg" />
          <div className="skeleton h-11 rounded-lg" />
        </div>
        <div className="panel space-y-4 p-6">
          <div className="skeleton h-8 rounded-lg" />
          <div className="skeleton h-40 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
export function PaymentScreen({ id }: { id: string }) {
  const router = useRouter(),
    client = useQueryClient(),
    now = useNow();
  const [open, setOpen] = useState(false),
    [transactionRef, setReference] = useState(''),
    [note, setNote] = useState('');
  const query = useQuery({
    queryKey: ['checkout', id],
    queryFn: () => api.checkout(id),
    retry: false,
    refetchInterval: 5000,
  });
  const mutation = useMutation({
    mutationFn: () =>
      api.submitTransfer(id, {
        transactionRef: transactionRef.trim(),
        evidenceNote: note.trim() || undefined,
      }),
    onSuccess: (booking) => {
      client.setQueryData(['booking', id], booking);
      void client.invalidateQueries({ queryKey: ['pending-payments'] });
      void client.invalidateQueries({ queryKey: ['checkout', id] });
      setOpen(false);
      router.push(`/bookings/${id}/payment/result`);
    },
  });
  if (query.isPending) return <PaymentLoading />;
  if (query.isError)
    return (
      <PaymentError error={query.error} retry={() => void query.refetch()} />
    );
  const { booking: b, recipient } = query.data,
    state = paymentState(b, now);
  const terminal = state.kind === 'expired' || state.kind === 'cancelled';
  const canReport = b.payment?.status !== 'SUCCESS' && !state.claim && terminal;
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Đã sao chép.');
    } catch {
      toast.error('Không thể sao chép. Bạn có thể chọn nội dung để sao chép.');
    }
  };
  const action = terminal
    ? 'Báo khoản đã chuyển'
    : state.kind === 'rejected'
      ? 'Gửi lại thông tin thanh toán'
      : 'Thanh toán cọc';
  return (
    <div className="container-shell page-section">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/bookings/pending-payments"
          className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground underline"
        >
          <ArrowLeft size={16} />
          Đơn chờ thanh toán
        </Link>
        <h1 className="page-title">Thanh toán qua MoMo</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Hoàn tất khoản cọc để giữ lịch lưu trú. Gửi thông báo sau khi chuyển
          tiền; StayHub sẽ đối chiếu trước khi xác nhận phòng.
        </p>
        <ol
          aria-label="Tiến trình đặt phòng"
          className="my-6 flex flex-wrap gap-x-6 gap-y-3 border-y py-4 text-sm"
        >
          <li className="flex items-center gap-2">
            <Check size={17} className="text-success" />
            Thông tin đặt phòng
          </li>
          <li
            aria-current="step"
            className="flex items-center gap-2 font-semibold text-secondary-foreground"
          >
            <Smartphone size={17} />
            Thanh toán cọc
          </li>
          <li className="flex items-center gap-2 text-muted-foreground">
            <ShieldCheck size={17} />
            Đối chiếu & xác nhận
          </li>
        </ol>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section className="panel min-w-0 p-5 sm:p-7">
            <div className="flex items-center gap-3 border-b pb-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#a50064]/10 text-[#8b0054]">
                <Smartphone size={24} />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Chuyển tiền qua MoMo</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Khoản cọc do StayHub thu tập trung
                </p>
              </div>
            </div>
            <div className="py-6">
              <p className="text-sm text-muted-foreground">
                Số tiền cần thanh toán
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums sm:text-4xl">
                {money(b.depositAmount)}
              </p>
              {state.canPay && (
                <p className="mt-3 flex items-start gap-2 text-sm text-warning">
                  <Clock3 size={16} className="mt-0.5 shrink-0" />
                  <span>
                    Hạn giữ phòng: {timestampLabel(b.paymentDeadlineAt)}
                  </span>
                </p>
              )}
            </div>
            {state.kind !== 'unpaid' && (
              <div className="mb-5 border-y py-4" role="status">
                <h3 className="font-semibold">{state.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {state.description}
                </p>
                {state.claim?.transactionRef && (
                  <p className="mt-3 break-all text-sm">
                    Mã giao dịch: <strong>{state.claim.transactionRef}</strong>
                  </p>
                )}
              </div>
            )}
            {(state.canPay || canReport) && (
              <>
                {!recipient.available ? (
                  <div role="status" className="border-y py-5 text-sm">
                    <h3 className="font-semibold">Thanh toán đang tạm ngừng</h3>
                    <p className="mt-2 leading-6 text-muted-foreground">
                      Chưa có thông tin người nhận được xác nhận. Vui lòng liên
                      hệ hỗ trợ và không chuyển tiền vào tài khoản khác. Đơn và
                      thời hạn giữ phòng vẫn được lưu.
                    </p>
                  </div>
                ) : (
                  <div className="border-y py-5">
                    <h3 className="mb-4 font-semibold">Thông tin người nhận</h3>
                    <p className="text-xs text-muted-foreground">
                      Tên tài khoản MoMo
                    </p>
                    <p className="mb-4 mt-1 font-semibold">
                      {recipient.receiverName}
                    </p>
                    <dl className="space-y-4 text-sm">
                      {[
                        ['Số điện thoại MoMo', recipient.receiverPhone!],
                        ['Số tiền cần thanh toán', String(b.depositAmount)],
                        ['Nội dung chuyển tiền', b.bookingCode],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd className="mt-1 flex items-center justify-between gap-3">
                            <span className="break-all font-semibold tabular-nums">
                              {label === 'Số tiền cần thanh toán'
                                ? money(b.depositAmount)
                                : value}
                            </span>
                            <Button
                              size="sm"
                              className="min-h-11 shrink-0"
                              variant="outline"
                              aria-label={`Sao chép ${label.toLowerCase()}`}
                              onClick={() => void copy(value)}
                            >
                              <Copy size={15} />
                              <span className="hidden sm:inline">Sao chép</span>
                            </Button>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
                <div className="mt-5 text-sm leading-6">
                  <h3 className="font-semibold">
                    {terminal
                      ? 'Bạn đã chuyển tiền trước đó?'
                      : 'Sau khi chuyển tiền'}
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    {terminal
                      ? 'Chỉ báo khoản tiền đã chuyển để được kiểm tra riêng. Đơn này không còn giữ phòng; không chuyển thêm tiền.'
                      : 'Kiểm tra người nhận, số tiền và mã đặt phòng trong MoMo. Mở lịch sử giao dịch để lấy mã giao dịch, rồi gửi thông báo bên dưới.'}
                  </p>
                </div>
                <Dialog
                  open={open}
                  onOpenChange={(value) => {
                    if (!mutation.isPending) {
                      setOpen(value);
                      mutation.reset();
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      className="mt-5 w-full"
                      disabled={!recipient.available}
                    >
                      {action}
                      <ArrowRight size={17} />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogTitle className="pr-6 text-xl font-semibold">
                      Xác nhận thông báo thanh toán
                    </DialogTitle>
                    <DialogDescription className="mt-3 text-sm leading-6 text-muted-foreground">
                      Chỉ gửi khi đã chuyển {money(b.depositAmount)} cho{' '}
                      {recipient.receiverName}. Thông báo này chưa xác nhận đã
                      nhận tiền. StayHub cần kiểm tra tài khoản nhận trước khi
                      xác nhận phòng.
                    </DialogDescription>
                    <form
                      className="mt-5 space-y-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        mutation.mutate();
                      }}
                    >
                      <p className="break-words text-sm font-semibold">
                        Mã đặt phòng: {b.bookingCode}
                      </p>
                      <div className="field">
                        <label htmlFor="transfer-ref">
                          Mã giao dịch MoMo *
                        </label>
                        <input
                          id="transfer-ref"
                          required
                          minLength={4}
                          maxLength={100}
                          pattern="[A-Za-z0-9][A-Za-z0-9_-]{3,99}"
                          autoComplete="off"
                          value={transactionRef}
                          onChange={(e) => setReference(e.target.value)}
                          aria-describedby="transfer-help"
                        />
                        <p
                          id="transfer-help"
                          className="text-xs text-muted-foreground"
                        >
                          Lấy từ lịch sử giao dịch MoMo; mã này khác mã đặt
                          phòng.
                        </p>
                      </div>
                      <div className="field">
                        <label htmlFor="transfer-note">
                          Ghi chú (không bắt buộc)
                        </label>
                        <textarea
                          id="transfer-note"
                          maxLength={1000}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                        />
                      </div>
                      {mutation.isError && (
                        <ErrorState message={errorMessage(mutation.error)} />
                      )}
                      <div className="flex flex-wrap justify-end gap-3">
                        <Button
                          variant="outline"
                          type="button"
                          disabled={mutation.isPending}
                          onClick={() => setOpen(false)}
                        >
                          Quay lại
                        </Button>
                        <Button disabled={mutation.isPending}>
                          {mutation.isPending
                            ? 'Đang gửi…'
                            : 'Tôi đã thanh toán'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </>
            )}
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t pt-4 text-sm">
              <Link
                className="inline-flex min-h-11 items-center underline"
                href={`/bookings/${id}/payment/result`}
              >
                Xem trạng thái thanh toán
              </Link>
              <Link
                className="inline-flex min-h-11 items-center underline"
                href={`/bookings/${id}`}
              >
                Chi tiết đặt phòng
              </Link>
            </div>
          </section>
          <Summary booking={b} />
        </div>
      </div>
    </div>
  );
}
export function PaymentResultScreen({ id }: { id: string }) {
  const now = useNow(),
    query = useQuery({
      queryKey: ['booking', id],
      queryFn: () => api.booking(id),
      retry: false,
      refetchInterval: 5000,
    });
  if (query.isPending) return <PaymentLoading />;
  if (query.isError)
    return (
      <PaymentError error={query.error} retry={() => void query.refetch()} />
    );
  const b = query.data,
    state = paymentState(b, now),
    verified = state.kind === 'verified',
    terminal = state.kind === 'expired' || state.kind === 'cancelled';
  return (
    <div className="container-shell page-section">
      <div className="mx-auto grid max-w-5xl items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="panel space-y-5 p-6 sm:p-8">
          <span
            className={`inline-flex size-12 items-center justify-center rounded-xl ${verified ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}
          >
            {verified ? <ShieldCheck size={26} /> : <Clock3 size={26} />}
          </span>
          <h1 className="page-title">{state.title}</h1>
          <p role="status" className="text-sm leading-7 text-muted-foreground">
            {state.description}
          </p>
          {state.claim?.transactionRef && (
            <dl className="space-y-3 border-y py-5 text-sm">
              <div>
                <dt className="text-muted-foreground">Mã giao dịch đã báo</dt>
                <dd className="mt-1 break-all font-semibold">
                  {state.claim.transactionRef}
                </dd>
              </div>
              {state.kind === 'reported' && (
                <div>
                  <dt className="text-muted-foreground">
                    Hạn đối chiếu / giữ phòng
                  </dt>
                  <dd className="mt-1">
                    {timestampLabel(b.paymentDeadlineAt)}
                  </dd>
                </div>
              )}
            </dl>
          )}
          <div className="flex flex-wrap gap-3">
            {(verified ||
              state.kind === 'simulated' ||
              b.payment?.status === 'SUCCESS') && (
              <Button asChild>
                <Link href="/bookings">Xem đặt phòng của tôi</Link>
              </Button>
            )}
            {state.canPay && (
              <Button asChild>
                <Link href={`/bookings/${id}/payment`}>
                  {state.kind === 'rejected'
                    ? 'Kiểm tra và gửi lại thông tin'
                    : 'Tiếp tục thanh toán'}
                </Link>
              </Button>
            )}
            {terminal && !b.payment && !state.claim && (
              <Button asChild variant="outline">
                <Link href={`/bookings/${id}/payment`}>
                  Báo khoản đã chuyển
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/bookings/pending-payments">Đơn chờ thanh toán</Link>
            </Button>
            <Link
              href="/properties"
              className="inline-flex min-h-11 items-center text-sm underline"
            >
              Khám phá chỗ nghỉ
            </Link>
          </div>
        </section>
        <Summary booking={b} />
      </div>
    </div>
  );
}
