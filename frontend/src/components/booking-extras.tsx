'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { dateLabel, money } from '@/lib/utils';
import type { Booking } from '@/lib/types';
import { Button } from './ui/button';
import { ErrorState, Loading, StatusBadge } from './ui/states';
export function RoomAvailabilityLabel({
  id,
  dates,
  homestay,
}: {
  id: string;
  dates: { checkIn: string; checkOut: string } | null;
  homestay: boolean;
}) {
  const query = useQuery({
    queryKey: ['availability', id, dates],
    queryFn: () => api.availability(id, dates!),
    enabled: !!dates,
    refetchInterval: 15000,
  });
  if (!dates) return <>Chọn ngày để kiểm tra phòng trống</>;
  if (query.isPending) return <>Đang kiểm tra phòng…</>;
  if (query.isError)
    return <span role="alert">{errorMessage(query.error)}</span>;
  return (
    <span
      className={
        query.data.availableUnits ? 'text-success' : 'text-muted-foreground'
      }
    >
      {query.data.availableUnits
        ? homestay
          ? 'Còn chỗ trong kỳ lưu trú đã chọn'
          : `Còn ${query.data.availableUnits} phòng trong kỳ lưu trú đã chọn`
        : 'Hết phòng trong kỳ lưu trú đã chọn'}
    </span>
  );
}

export function BookingSummary({ booking: b }: { booking: Booking }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="font-semibold">{b.bookingCode}</p>
      <h2 className="text-xl font-semibold">
        {b.propertyNameSnapshot || b.property.name}
      </h2>
      <p>
        {b.roomTypeNameSnapshot} · {b.quantity}{' '}
        {b.property.type === 'HOTEL' ? 'phòng' : 'căn'} · {b.guestCount} khách
      </p>
      <p>
        {dateLabel(b.checkIn)} {b.checkInTimeSnapshot} → {dateLabel(b.checkOut)}{' '}
        {b.checkOutTimeSnapshot} (UTC+7)
      </p>
      <StatusBadge status={b.status} />
      <dl className="grid grid-cols-2 gap-3 rounded-xl bg-cream p-4">
        <dt>Tổng tiền</dt>
        <dd className="text-right">{money(b.totalAmount)}</dd>
        <dt>Tiền cọc</dt>
        <dd className="text-right font-semibold">{money(b.depositAmount)}</dd>
        <dt>Còn lại</dt>
        <dd className="text-right">{money(b.remainingAmount)}</dd>
      </dl>
    </div>
  );
}
export function DemoQr({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['payment-demo', id],
    queryFn: () => api.paymentDemo(id),
    retry: false,
  });
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} />;
  return (
    <div className="mt-4 space-y-3 text-center">
      <Image
        className="mx-auto max-w-full rounded-xl border"
        src={query.data.qrDataUrl}
        unoptimized
        width={280}
        height={280}
        alt={`QR thanh toán demo ${query.data.payload.reference}, tiền cọc ${money(query.data.payload.amount)}`}
      />
      <p className="break-words font-mono text-sm font-semibold">
        {query.data.payload.description}
      </p>
      <p>{money(query.data.payload.amount)}</p>
      <p className="text-xs leading-6 text-muted-foreground">
        QR chứa số tiền và mã tham chiếu demo, không chứa tài khoản ngân hàng.
        Không chuyển tiền thật. Bấm “Tôi đã thanh toán” để mô phỏng thanh toán
        cọc.
      </p>
      <Link href={`/bookings/${id}/payment`} className="text-sm underline">
        Mở trang thanh toán QR
      </Link>
    </div>
  );
}
export function FeedbackForm({ booking }: { booking: Booking }) {
  const [rating, setRating] = useState(5),
    [content, setContent] = useState('');
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      api.feedback(booking.id, { rating, content: content.trim() }),
    onSuccess: () => {
      toast.success('Đã gửi đánh giá.');
      void client.invalidateQueries({ queryKey: ['bookings'] });
      void client.invalidateQueries({ queryKey: ['feedback'] });
    },
  });
  return (
    <form
      className="mt-5 space-y-3 border-t pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <h3 className="font-semibold">Đánh giá chuyến lưu trú</h3>
      <div className="field">
        <label htmlFor={`rating-${booking.id}`}>Điểm đánh giá</label>
        <select
          id={`rating-${booking.id}`}
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} / 5
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`feedback-${booking.id}`}>Nội dung</label>
        <textarea
          id={`feedback-${booking.id}`}
          required
          minLength={5}
          maxLength={2000}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      {mutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(mutation.error)}
        </p>
      )}
      <Button disabled={mutation.isPending || mutation.isSuccess}>
        {mutation.isSuccess ? 'Đã gửi đánh giá' : 'Gửi đánh giá'}
      </Button>
    </form>
  );
}
export function PropertyFeedback({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['feedback', id],
    queryFn: () => api.propertyFeedback(id),
  });
  return (
    <section className="mt-7 border-t py-7">
      <h2 className="text-xl font-semibold">Đánh giá của khách</h2>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} />
      ) : (
        <>
          <p className="my-4 text-sm">
            {query.data.count
              ? `${query.data.averageRating?.toFixed(1)} / 5 · ${query.data.count} đánh giá`
              : 'Chưa có đánh giá. Khách có thể đánh giá sau khi trả phòng.'}
          </p>
          {query.data.items.map((item) => (
            <article className="mb-3 rounded-xl border p-4" key={item.id}>
              <p className="text-sm font-medium">
                {item.guest.fullName} · {item.rating}/5
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {dateLabel(item.createdAt)}
              </p>
              <p className="mt-3 whitespace-pre-line break-words text-sm">
                {item.content}
              </p>
            </article>
          ))}
        </>
      )}
    </section>
  );
}
export function BookingLookup() {
  const [value, setValue] = useState(''),
    [code, setCode] = useState('');
  const query = useQuery({
    queryKey: ['booking-lookup', code],
    queryFn: () => api.lookupBooking(code),
    enabled: !!code,
    retry: false,
  });
  return (
    <section className="panel mb-6 p-5">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setCode(value.trim().toUpperCase());
        }}
      >
        <div className="field min-w-0 flex-1">
          <label htmlFor="booking-code">Tra cứu mã đặt chỗ</label>
          <input
            id="booking-code"
            required
            maxLength={40}
            placeholder="STB-…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <Button>Tra cứu</Button>
      </form>
      {code &&
        (query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {errorMessage(query.error)}
          </p>
        ) : (
          <div className="mt-4">
            <BookingSummary booking={query.data} />
            <Link
              className="mt-3 inline-block underline"
              href={`/bookings/${query.data.id}`}
            >
              Xem đơn đặt phòng
            </Link>
          </div>
        ))}
    </section>
  );
}
