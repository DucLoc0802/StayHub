'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { dateLabel, money, timestampLabel } from '@/lib/utils';
import { BookingSummary } from './booking-extras';
import { Button } from './ui/button';
import { ErrorState, Loading } from './ui/states';
import { useAuth } from './providers';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { toast } from 'sonner';
import { BookingHistory } from './booking-history';

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
export function PaymentScreen({ id }: { id: string }) {
  const router = useRouter(),
    client = useQueryClient();
  const [open, setOpen] = useState(false),
    [transactionRef, setReference] = useState(''),
    [note, setNote] = useState('');
  const query = useQuery({
    queryKey: ['checkout', id],
    queryFn: () => api.checkout(id),
    retry: false,
    refetchInterval: 10000,
  });
  const mutation = useMutation({
    mutationFn: () =>
      api.submitTransfer(id, {
        transactionRef: transactionRef.trim(),
        evidenceNote: note.trim() || undefined,
      }),
    onSuccess: (booking) => {
      client.setQueryData(['booking', id], booking);
      for (const key of [
        'checkout',
        'pending-payments',
        'host-bookings',
        'admin-payments',
      ])
        void client.invalidateQueries({ queryKey: [key] });
      setOpen(false);
      router.push(`/bookings/${id}/payment/result`);
    },
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
  const { booking: b, recipient } = query.data;
  const pendingClaim = b.paymentAttempts?.find(
    (p) => p.status === 'SUBMITTED' || p.status === 'RESOLUTION_REQUIRED',
  );
  const paid = b.payment?.status === 'SUCCESS';
  const terminal = b.status === 'EXPIRED' || b.status === 'CANCELLED';
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Đã sao chép.');
    } catch {
      toast.error(
        'Không thể sao chép. Bạn có thể chọn và sao chép nội dung hiển thị.',
      );
    }
  };
  return (
    <div className="container-shell page-section">
      <div className="mx-auto max-w-4xl">
        <h1 className="page-title mb-2">Thanh toán qua MoMo</h1>
        <p className="mb-6 max-w-2xl text-sm leading-6 text-muted-foreground">
          Hoàn tất chuyển tiền trong MoMo, sau đó thông báo để StayHub kiểm tra
          khoản cọc.
        </p>
        <div className="panel grid gap-6 p-5 sm:p-6 md:grid-cols-2 md:gap-8">
          <section>
            <BookingSummary booking={b} />
            <dl className="mt-5 space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Khách đặt phòng</dt>
                <dd className="font-medium">
                  {b.customerNameSnapshot} · {b.customerPhoneSnapshot}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  Hạn giữ phòng / xác minh
                </dt>
                <dd>{timestampLabel(b.paymentDeadlineAt)}</dd>
              </div>
            </dl>
          </section>
          <section className="border-t pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
            <h2 className="text-lg font-semibold">Thông tin người nhận</h2>
            {!recipient.available ? (
              <div
                role="status"
                className="mt-4 space-y-3 border-y py-5 text-sm"
              >
                <p className="font-medium">Thanh toán đang tạm ngừng</p>
                <p className="text-muted-foreground">
                  Hiện chưa thể cung cấp thông tin nhận tiền. Vui lòng liên hệ
                  hỗ trợ; không chuyển tiền vào tài khoản chưa được xác nhận.
                </p>
              </div>
            ) : (
              <>
                <dl className="mt-4 space-y-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Người nhận MoMo</dt>
                    <dd className="mt-1 font-semibold">
                      {recipient.receiverName}
                    </dd>
                  </div>
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
                          className="min-h-11"
                          variant="outline"
                          aria-label={`Sao chép ${label.toLowerCase()}`}
                          onClick={() => void copy(value)}
                        >
                          Sao chép
                        </Button>
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-5 text-sm leading-6 text-muted-foreground">
                  Kiểm tra đúng người nhận, số tiền và mã đặt phòng trong MoMo.
                  Khoản cọc được thu tập trung; không có chuyển tiền tự động cho
                  từng chủ cơ sở.
                </p>
              </>
            )}
            <div className="mt-6 space-y-3 border-t pt-5">
              {paid ? (
                <p className="font-medium text-success">
                  {b.payment?.method === 'FAKE'
                    ? 'Giao dịch mô phỏng trong lịch sử, không thu tiền thật.'
                    : 'Thanh toán đã được xác nhận.'}
                </p>
              ) : pendingClaim ? (
                <p role="status" className="text-sm font-medium">
                  {pendingClaim.status === 'SUBMITTED'
                    ? 'Đang chờ xác nhận thanh toán. Bạn không cần gửi lại.'
                    : 'Khoản chuyển tiền cần xử lý riêng. Phòng không được giữ thêm trong thời gian xử lý.'}
                </p>
              ) : (
                <>
                  {terminal && (
                    <p className="text-sm text-destructive">
                      Đơn không còn giữ phòng. Nếu đã chuyển tiền, hãy báo để
                      được kiểm tra và xử lý riêng.
                    </p>
                  )}
                  <Dialog
                    open={open}
                    onOpenChange={(value) => {
                      if (!mutation.isPending) {
                        setOpen(value);
                        mutation.reset();
                      }
                    }}
                  >
                    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white px-4 py-3 md:static md:border-0 md:bg-transparent md:p-0">
                      <p className="mb-2 text-center text-sm font-semibold md:hidden">
                        Tiền cọc: {money(b.depositAmount)}
                      </p>
                      <DialogTrigger asChild>
                        <Button
                          className="w-full"
                          disabled={!recipient.available}
                        >
                          {terminal
                            ? 'Báo khoản chuyển tiền sau hạn / hủy'
                            : 'Thanh toán cọc'}
                        </Button>
                      </DialogTrigger>
                    </div>
                    <DialogContent className="rounded-xl">
                      <DialogTitle className="pr-7 text-xl font-semibold">
                        Xác nhận thông báo thanh toán
                      </DialogTitle>
                      <DialogDescription className="mt-3 text-sm leading-6 text-muted-foreground">
                        Chỉ gửi khi bạn đã chuyển {money(b.depositAmount)} cho{' '}
                        {recipient.receiverName}. Thông báo này chưa xác nhận đã
                        nhận tiền. Admin sẽ kiểm tra giao dịch trước khi xác
                        nhận phòng.
                      </DialogDescription>
                      <p className="mt-4 text-sm font-semibold">
                        Mã đặt phòng:{' '}
                        <span className="block break-words">
                          {b.bookingCode}
                        </span>
                      </p>
                      <form
                        className="mt-5 space-y-4"
                        onSubmit={(event) => {
                          event.preventDefault();
                          mutation.mutate();
                        }}
                      >
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
                            aria-describedby="transfer-ref-help"
                          />
                          <p
                            id="transfer-ref-help"
                            className="text-xs text-muted-foreground"
                          >
                            Lấy mã giao dịch từ lịch sử chuyển tiền trong MoMo,
                            khác với mã đặt phòng.
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
                            placeholder="Thời gian chuyển hoặc thông tin cần đối chiếu"
                          />
                        </div>
                        {mutation.isError && (
                          <ErrorState message={errorMessage(mutation.error)} />
                        )}
                        <div className="flex flex-wrap justify-end gap-3">
                          <Button
                            type="button"
                            variant="outline"
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
              <Link
                href={`/bookings/${id}/payment/result`}
                className="inline-flex min-h-11 items-center text-sm underline"
              >
                Xem trạng thái thanh toán
              </Link>
              <br />
              <Link
                href="/bookings/pending-payments"
                className="inline-flex min-h-11 items-center text-sm underline"
              >
                Các đơn chờ thanh toán
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
export function PaymentResultScreen({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.booking(id),
    refetchInterval: 5000,
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
  const b = query.data,
    paid = b.payment?.status === 'SUCCESS',
    simulated = b.payment?.method === 'FAKE';
  const claim = b.paymentAttempts
    ?.filter((p) => p.method === 'MOMO_MANUAL')
    .at(-1);
  const resolution = claim?.status === 'RESOLUTION_REQUIRED',
    submitted = claim?.status === 'SUBMITTED';
  const expired = b.status === 'EXPIRED',
    cancelled = b.status === 'CANCELLED';
  const title = cancelled
    ? 'Đặt phòng đã hủy'
    : resolution
      ? 'Khoản chuyển tiền cần xử lý riêng'
      : paid
        ? simulated
          ? 'Giao dịch mô phỏng trong lịch sử'
          : 'Thanh toán đã được xác nhận'
        : expired
          ? 'Đã hết hạn thanh toán'
          : submitted
            ? 'Đang chờ xác nhận thanh toán'
            : claim?.status === 'FAILED'
              ? 'Thông báo thanh toán chưa được chấp nhận'
              : 'Chưa ghi nhận thanh toán';
  return (
    <div className="container-shell page-section">
      <article className="panel mx-auto max-w-2xl space-y-6 p-5 sm:p-8">
        <h1 className="page-title">{title}</h1>
        <p role="status" className="text-sm leading-6 text-muted-foreground">
          {resolution
            ? claim.failureReason
            : paid
              ? simulated
                ? 'Không thu tiền thật cho giao dịch mô phỏng này.'
                : 'Admin đã kiểm tra khoản tiền nhận. Đặt phòng được xác nhận.'
              : submitted
                ? `Thông báo chuyển tiền đã được lưu. Đơn vẫn chưa thanh toán cho đến khi được xác minh; hạn giữ phòng: ${timestampLabel(b.paymentDeadlineAt)}.`
                : cancelled || expired
                  ? 'Phòng đã được giải phóng. Nếu đã chuyển tiền, báo khoản chuyển tiền để được xử lý riêng; hoàn tiền không tự động.'
                  : (claim?.failureReason ??
                    'Bạn có thể chuyển tiền và gửi thông báo trước hạn giữ phòng.')}
        </p>
        <BookingSummary booking={b} />
        <div className="flex flex-wrap gap-3">
          {paid && (
            <Button asChild>
              <Link href="/bookings">Xem đặt phòng của tôi</Link>
            </Button>
          )}
          {!paid && !submitted && !resolution && (
            <Button asChild>
              <Link href={`/bookings/${id}/payment`}>
                {expired || cancelled
                  ? 'Báo khoản đã chuyển'
                  : 'Tiếp tục thanh toán'}
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/properties">Khám phá chỗ nghỉ</Link>
          </Button>
        </div>
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
