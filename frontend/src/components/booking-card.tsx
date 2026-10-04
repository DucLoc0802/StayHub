'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { CalendarDays, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/utils';
import { propertyPath } from '@/lib/property-url';
import { earliestCheckInDate } from '@/lib/booking-time';
import type { Property } from '@/lib/types';
import { useAuth } from './providers';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
export function BookingCard({ property }: { property: Property }) {
  const [range, setRange] = useState<DateRange>();
  const [guests, setGuests] = useState(1);
  const { user, loading } = useAuth();
  const router = useRouter();
  const client = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  const earliestDate = earliestCheckInDate(property.checkInTime, now);
  const expired = !!range?.from && range.from < earliestDate;
  const nights =
    range?.from && range.to
      ? differenceInCalendarDays(range.to, range.from)
      : 0;
  const total = nights * property.pricePerNight;
  const deposit = Math.ceil((total * property.depositPercent) / 100);
  const conflict = !!(
    range?.from &&
    range.to &&
    property.unavailableDates?.some(
      (d) =>
        range.from! < parseISO(d.checkOut.slice(0, 10)) &&
        range.to! > parseISO(d.checkIn.slice(0, 10)),
    )
  );
  const mutation = useMutation({
    mutationFn: () => {
      if (range!.from! < earliestCheckInDate(property.checkInTime)) {
        throw new Error(
          'Đã quá giờ nhận phòng của ngày này. Vui lòng chọn ngày khác.',
        );
      }
      return api.createBooking({
        propertyId: property.id,
        checkIn: format(range!.from!, 'yyyy-MM-dd'),
        checkOut: format(range!.to!, 'yyyy-MM-dd'),
        guestCount: guests,
      });
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['bookings'] });
      toast.success(
        'Đã tạo đặt chỗ. Vui lòng thanh toán tiền cọc để xác nhận.',
      );
      router.push('/bookings');
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      void client.invalidateQueries({ queryKey: ['property'] });
    },
  });
  return (
    <aside className="panel self-start p-5 shadow-sm lg:sticky lg:top-26 xl:p-6">
      <p>
        <strong className="text-2xl tracking-tight">
          {money(property.pricePerNight)}
        </strong>
        <span className="ml-1 text-sm text-muted-foreground">/ đêm</span>
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Đặt cọc {property.depositPercent}% · Phần còn lại trả tại chỗ nghỉ
      </p>
      <div className="my-5 border-y py-4">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <CalendarDays size={17} />
          Chọn ngày lưu trú
        </h2>
        <Calendar
          mode="range"
          defaultMonth={earliestDate}
          selected={range}
          onSelect={setRange}
          min={1}
          max={365}
          disabled={{ before: earliestDate }}
          numberOfMonths={1}
        />
        <div className="mt-4 grid grid-cols-2 divide-x rounded-xl border bg-cream p-3 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Nhận phòng
            </p>
            <p className="mt-1 text-sm font-medium">
              {range?.from ? format(range.from, 'dd/MM/yyyy') : 'Chọn ngày'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {property.checkInTime}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Trả phòng
            </p>
            <p className="mt-1 text-sm font-medium">
              {range?.to ? format(range.to, 'dd/MM/yyyy') : 'Chọn ngày'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {property.checkOutTime}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Giờ Việt Nam (UTC+7)
        </p>
        {!!property.unavailableDates?.length && (
          <details className="mt-3 text-xs text-muted-foreground">
            <summary>Khoảng ngày đã có khách</summary>
            <ul className="mt-2 space-y-1">
              {property.unavailableDates.map((d) => (
                <li key={d.checkIn}>
                  {format(parseISO(d.checkIn), 'dd/MM/yyyy')} →{' '}
                  {format(parseISO(d.checkOut), 'dd/MM/yyyy')}
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Bạn có thể nhận phòng đúng ngày khách trước trả phòng.
            </p>
          </details>
        )}
      </div>
      <div className="field">
        <label htmlFor="guestCount">Số khách</label>
        <select
          id="guestCount"
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value))}
        >
          {Array.from({ length: property.maxGuests }, (_, i) => (
            <option key={i} value={i + 1}>
              {i + 1} khách
            </option>
          ))}
        </select>
      </div>
      {nights > 0 && (
        <dl className="my-5 space-y-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt>
              {money(property.pricePerNight)} × {nights} đêm
            </dt>
            <dd>{money(total)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t pt-3 font-semibold">
            <dt>Tiền cọc ({property.depositPercent}%)</dt>
            <dd>{money(deposit)}</dd>
          </div>
          <div className="flex justify-between gap-3 text-muted-foreground">
            <dt>Trả tại chỗ nghỉ</dt>
            <dd>{money(total - deposit)}</dd>
          </div>
        </dl>
      )}
      {expired && (
        <p role="alert" className="my-3 text-sm text-destructive">
          Đã quá giờ nhận phòng của ngày này. Vui lòng chọn ngày khác.
        </p>
      )}
      {conflict && (
        <p role="alert" className="my-3 text-sm text-destructive">
          Khoảng ngày này đã có khách. Vui lòng chọn ngày khác.
        </p>
      )}
      {mutation.isError && (
        <p role="alert" className="my-3 text-sm text-destructive">
          {errorMessage(mutation.error)}
        </p>
      )}
      {loading ? (
        <Button className="mt-5 w-full" disabled>
          Đang tải tài khoản…
        </Button>
      ) : !user ? (
        <Button asChild className="mt-5 w-full">
          <Link
            href={`/login?next=${encodeURIComponent(propertyPath(property))}`}
          >
            Đăng nhập để đặt chỗ
          </Link>
        </Button>
      ) : user.role !== 'GUEST' ? (
        <p className="mt-5 rounded-xl bg-muted p-3 text-sm">
          Vui lòng dùng tài khoản Khách thuê để đặt chỗ.
        </p>
      ) : (
        <Button
          className="mt-5 w-full"
          disabled={
            mutation.isPending ||
            nights < 1 ||
            conflict ||
            expired ||
            total > 2147483647
          }
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Đang tạo đặt chỗ…' : 'Đặt chỗ ngay'}
        </Button>
      )}
      <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
        Bạn chưa bị thu tiền ở bước này.
        <br />
        Chỗ nghỉ chỉ được giữ sau khi thanh toán cọc.
      </p>
      <div className="mt-5 flex items-center justify-center gap-2 border-t pt-4 text-xs text-muted-foreground">
        <ShieldCheck size={16} />
        Thông tin giá minh bạch
      </div>
    </aside>
  );
}
