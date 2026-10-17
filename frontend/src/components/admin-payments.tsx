'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import type { PaymentAttempt } from '@/lib/types';
import { money, timestampLabel } from '@/lib/utils';
import { Button } from './ui/button';
import { Empty, ErrorState, Loading, StatusBadge } from './ui/states';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog';
import { Pager } from './admin-management';
export function AdminPayments() {
  const [status, setStatus] = useState(''),
    [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PaymentAttempt | null>(null),
    [decision, setDecision] = useState<
      'VERIFY' | 'REJECT' | 'RESOLUTION_REQUIRED'
    >('VERIFY');
  const [reason, setReason] = useState(''),
    [amount, setAmount] = useState(''),
    [reference, setReference] = useState('');
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['admin-payments', status, page],
    queryFn: () => api.adminPayments({ status: status || undefined, page }),
    refetchInterval: 10000,
  });
  const mutation = useMutation({
    mutationFn: () =>
      api.reviewPayment(selected!.id, {
        decision,
        reason: reason.trim() || undefined,
        ...(decision === 'VERIFY'
          ? {
              receivedAmount: Number(amount),
              verifiedTransactionRef: reference.trim(),
            }
          : {}),
      }),
    onSuccess: () => {
      setSelected(null);
      for (const key of [
        'admin-payments',
        'admin-bookings',
        'admin-booking',
        'admin-statistics',
      ])
        void client.invalidateQueries({ queryKey: [key] });
    },
  });
  return (
    <div className="container-shell py-6 sm:py-8">
      <h1 className="page-title">Xác minh thanh toán</h1>
      <p className="mt-3 mb-6 max-w-3xl text-sm leading-6 text-muted-foreground">
        Đối chiếu giao dịch trong tài khoản nhận tiền trước khi xác nhận. Thông
        báo của khách chưa chứng minh đã nhận tiền. Khoản sau hạn cần được xử lý
        riêng.
      </p>
      <div className="panel mb-6 p-5">
        <div className="field max-w-md">
          <label htmlFor="payment-filter">Trạng thái xác minh</label>
          <select
            id="payment-filter"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả thông báo</option>
            <option value="SUBMITTED">Chờ xác minh</option>
            <option value="RESOLUTION_REQUIRED">Cần xử lý riêng</option>
            <option value="SUCCESS">Đã xác minh</option>
            <option value="FAILED">Đã từ chối</option>
          </select>
        </div>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState
          message={errorMessage(query.error)}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          <div className="panel divide-y px-5 sm:px-6">
            {!query.data.items.length && (
              <Empty>Không có thông báo thanh toán phù hợp.</Empty>
            )}
            {query.data.items.map((p) => (
              <article
                key={p.id}
                className="grid gap-4 py-5 lg:grid-cols-[1.1fr_1fr_1fr]"
              >
                <div className="min-w-0 space-y-2">
                  <Link
                    href={`/admin/bookings/${p.booking!.id}`}
                    className="break-all font-semibold underline"
                  >
                    {p.booking!.bookingCode}
                  </Link>
                  <p className="text-sm font-medium">
                    {p.booking!.propertyNameSnapshot ||
                      p.booking!.roomType.property.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Chủ cơ sở: {p.booking!.roomType.property.host.fullName}
                  </p>
                  <p className="text-sm">
                    Khách: {p.booking!.customerNameSnapshot}
                  </p>
                  <StatusBadge status={p.status} />
                </div>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">
                      Mã giao dịch khách cung cấp
                    </dt>
                    <dd className="break-all font-semibold">
                      {p.transactionRef}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      Số tiền cần đối chiếu
                    </dt>
                    <dd className="font-semibold tabular-nums">
                      {money(p.amount)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      Người nhận lúc báo thanh toán
                    </dt>
                    <dd>
                      {p.receiverNameSnapshot} · {p.receiverPhoneSnapshot}
                    </dd>
                  </div>
                </dl>
                <div className="space-y-3 text-sm">
                  <p>Gửi lúc {timestampLabel(p.createdAt)}</p>
                  {p.verificationDeadlineAt && (
                    <p>
                      Hạn xác minh: {timestampLabel(p.verificationDeadlineAt)}
                    </p>
                  )}
                  {p.evidenceNote && (
                    <p className="whitespace-pre-wrap break-words text-muted-foreground">
                      Ghi chú: {p.evidenceNote}
                    </p>
                  )}
                  {p.failureReason && (
                    <p className="break-words text-destructive">
                      {p.failureReason}
                    </p>
                  )}
                  {p.reviewedAt && (
                    <p className="text-muted-foreground">
                      Xử lý bởi {p.reviewedBy?.fullName ?? 'Quản trị viên'} ·{' '}
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
                        setReason('');
                        setAmount('');
                        setReference('');
                        mutation.reset();
                      }}
                    >
                      Kiểm tra giao dịch
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
          <Pager {...query.data} onChange={setPage} />
        </>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setSelected(null);
        }}
      >
        <DialogContent className="rounded-xl">
          <DialogTitle className="pr-6 text-xl font-semibold">
            Đối chiếu khoản chuyển tiền
          </DialogTitle>
          <DialogDescription className="mt-3 text-sm leading-6 text-muted-foreground">
            Mở tài khoản nhận tiền và kiểm tra đúng mã giao dịch, số tiền, người
            nhận. Hệ thống không tra cứu MoMo tự động.
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
                    required
                    minLength={4}
                    maxLength={100}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <label className="flex items-start gap-3 text-sm">
                  <input className="mt-1" type="checkbox" required />
                  Tôi đã kiểm tra giao dịch trong tài khoản nhận tiền.
                </label>
              </>
            )}
            <div className="field">
              <label htmlFor="review-reason">
                Ghi chú / lý do{' '}
                {decision !== 'VERIFY' ? '*' : '(không bắt buộc)'}
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
            <div className="flex justify-end gap-3">
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
    </div>
  );
}
