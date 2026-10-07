'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { dateLabel, timestampLabel } from '@/lib/utils';
import { Button } from './ui/button';
import { StatusBadge } from './ui/states';

export function PublicBookingLookup() {
  const [bookingCode, setCode] = useState('');
  const [email, setEmail] = useState('');
  const lookup = useMutation({ mutationFn: api.publicLookup });
  const result = lookup.data;
  return (
    <div className="container-shell page-section">
      <section className="panel mx-auto max-w-xl p-6">
        <h1 className="page-title">Tra cứu booking</h1>
        <p className="my-4 text-sm text-muted-foreground">Nhập mã booking và email đã dùng khi đặt phòng. Chỉ thông tin trạng thái cơ bản được hiển thị.</p>
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          lookup.mutate({ bookingCode: bookingCode.trim().toUpperCase(), email: email.trim().toLowerCase() });
        }}>
          <div className="field"><label htmlFor="lookup-code">Mã booking</label>
            <input id="lookup-code" required minLength={5} maxLength={40} autoComplete="off" placeholder="STB-XXXXXXXX" value={bookingCode} onChange={(event) => { setCode(event.target.value); lookup.reset(); }} />
          </div>
          <div className="field"><label htmlFor="lookup-email">Email đặt phòng</label>
            <input id="lookup-email" required type="email" maxLength={191} autoComplete="email" placeholder="example@email.com" value={email} onChange={(event) => { setEmail(event.target.value); lookup.reset(); }} />
          </div>
          <Button disabled={lookup.isPending}>{lookup.isPending ? 'Đang tra cứu…' : 'Tra cứu'}</Button>
        </form>
        <div aria-live="polite" className="mt-5">
          {lookup.isPending && <p role="status">Đang kiểm tra thông tin booking…</p>}
          {lookup.isError && <p role="alert" className="text-sm text-destructive">{errorMessage(lookup.error)}</p>}
          {result && <article className="space-y-3 border-t pt-5">
            <h2 className="font-semibold">{result.bookingCode}</h2>
            <StatusBadge status={result.status} />
            <p>{result.propertyName} · {result.roomTypeName}</p>
            <p>{dateLabel(result.checkIn)} → {dateLabel(result.checkOut)}</p>
            <p>{result.quantity} phòng / căn · {result.guestCount} khách</p>
            <p>{result.paymentState === 'PAID' ? 'Đã thanh toán cọc' : 'Chưa thanh toán cọc'}</p>
            {result.paymentDeadlineAt && <p>Hạn thanh toán: {timestampLabel(result.paymentDeadlineAt)}</p>}
          </article>}
        </div>
      </section>
    </div>
  );
}
