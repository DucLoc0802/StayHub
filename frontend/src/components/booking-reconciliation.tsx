'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import type { Booking, PaymentAttempt } from '@/lib/types';
import { money, timestampLabel } from '@/lib/utils';
import { Button } from './ui/button';
import { ErrorState, StatusBadge } from './ui/states';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
export function BookingReconciliation({ booking }: { booking: Booking }) {
  const client = useQueryClient();
  const [selected, setSelected] = useState<PaymentAttempt | null>(null),
    [decision, setDecision] = useState<
      'VERIFY' | 'REJECT' | 'RESOLUTION_REQUIRED'
    >('VERIFY');
  const [amount, setAmount] = useState(''),
    [reference, setReference] = useState(''),
    [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: () =>
      api.reconcilePayment(booking.id, selected!.id, {
        decision,
        reason: reason.trim() || undefined,
        ...(decision === 'VERIFY'
          ? {
              receivedAmount: Number(amount),
              verifiedTransactionRef: reference.trim(),
            }
          : {}),
      }),
    onSuccess: (b) => {
      client.setQueryData(['admin-booking', booking.id], b);
      void client.invalidateQueries({ queryKey: ['admin-bookings'] });
      void client.invalidateQueries({ queryKey: ['admin-statistics'] });
      setSelected(null);
    },
  });
  const claims =
    booking.paymentAttempts?.filter((p) => p.method === 'MOMO_MANUAL') ?? [];
  return (
    <section className="border-t pt-6">
      <h2 className="text-lg font-semibold">Đối chiếu khoản cọc</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Kiểm tra tài khoản nhận tiền thực tế trước khi xác nhận. Thông báo của
        khách chưa chứng minh đã nhận tiền.
      </p>
      {!claims.length ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Chưa có thông báo chuyển tiền MoMo cho đơn này.
        </p>
      ) : (
        <div className="mt-5 divide-y border-y">
          {claims.map((p) => (
            <article key={p.id} className="space-y-3 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <strong className="break-all">{p.transactionRef}</strong>
                <StatusBadge status={p.status} />
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">
                    Số tiền cần đối chiếu
                  </dt>
                  <dd className="mt-1 font-semibold">{money(p.amount)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Gửi lúc</dt>
                  <dd className="mt-1">{timestampLabel(p.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    Người nhận lúc báo thanh toán
                  </dt>
                  <dd className="mt-1">
                    {p.receiverNameSnapshot} · {p.receiverPhoneSnapshot}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Hạn đối chiếu</dt>
                  <dd className="mt-1">
                    {p.verificationDeadlineAt
                      ? timestampLabel(p.verificationDeadlineAt)
                      : 'Không còn giữ phòng'}
                  </dd>
                </div>
              </dl>
              {p.evidenceNote && (
                <p className="whitespace-pre-wrap break-words text-sm">
                  Ghi chú của khách: {p.evidenceNote}
                </p>
              )}
              {p.failureReason && (
                <p className="text-sm text-muted-foreground">
                  Kết quả: {p.failureReason}
                </p>
              )}
              {p.reviewedAt && (
                <p className="break-all text-xs text-muted-foreground">
                  Đã ghi nhận bởi {p.reviewedById} ·{' '}
                  {timestampLabel(p.reviewedAt)}
                </p>
              )}
              {(p.status === 'SUBMITTED' ||
                (p.status === 'RESOLUTION_REQUIRED' && !p.reviewedAt)) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelected(p);
                    setDecision(
                      p.status === 'SUBMITTED'
                        ? 'VERIFY'
                        : 'RESOLUTION_REQUIRED',
                    );
                    setAmount('');
                    setReference('');
                    setReason('');
                    mutation.reset();
                  }}
                >
                  Kiểm tra giao dịch
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogTitle className="pr-6 text-xl font-semibold">
            Đối chiếu khoản chuyển tiền
          </DialogTitle>
          <DialogDescription className="mt-3 text-sm leading-6 text-muted-foreground">
            Đối chiếu mã giao dịch và số tiền trong tài khoản nhận. Hệ thống
            không tra cứu MoMo tự động.
          </DialogDescription>
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <div className="field">
              <label htmlFor="review-decision">Kết quả kiểm tra</label>
              <select
                id="review-decision"
                value={decision}
                onChange={(e) => setDecision(e.target.value as typeof decision)}
              >
                {selected?.status === 'SUBMITTED' && (
                  <option value="VERIFY">
                    Đã nhận đủ tiền · Xác nhận phòng
                  </option>
                )}
                <option value="REJECT">Từ chối thông báo</option>
                <option value="RESOLUTION_REQUIRED">Cần xử lý riêng</option>
              </select>
            </div>
            {decision === 'VERIFY' && (
              <>
                <div className="field">
                  <label htmlFor="received-amount">
                    Số tiền thực nhận (₫) *
                  </label>
                  <input
                    id="received-amount"
                    type="number"
                    min={1}
                    max={2147483647}
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="received-reference">
                    Mã giao dịch trong tài khoản nhận *
                  </label>
                  <input
                    id="received-reference"
                    minLength={4}
                    maxLength={100}
                    autoComplete="off"
                    required
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" required className="mt-1" />
                  Tôi đã kiểm tra giao dịch trong tài khoản nhận tiền.
                </label>
              </>
            )}
            <div className="field">
              <label htmlFor="review-reason">
                Ghi chú / lý do{' '}
                {decision === 'VERIFY' ? '(không bắt buộc)' : '*'}
              </label>
              <textarea
                id="review-reason"
                minLength={5}
                maxLength={250}
                required={decision !== 'VERIFY'}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
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
                onClick={() => setSelected(null)}
              >
                Quay lại
              </Button>
              <Button disabled={mutation.isPending}>
                {mutation.isPending ? 'Đang lưu…' : 'Lưu kết quả xác minh'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
