'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { dateLabel, money } from '@/lib/utils';
import type { Booking } from '@/lib/types';
import { Button } from './ui/button';
import { Loading, StatusBadge } from './ui/states';
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
