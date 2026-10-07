'use client';
import Link from 'next/link';
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, endOfMonth, format, startOfMonth } from 'date-fns';
import { DayButton, type DateRange } from 'react-day-picker';
import { CalendarDays, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { money, timestampLabel } from '@/lib/utils';
import { propertyPath } from '@/lib/property-url';
import { earliestCheckInDate } from '@/lib/booking-time';
import { calendarAvailability } from '@/lib/calendar-availability';
import type { CalendarPriceDay, Property } from '@/lib/types';
import { useAuth } from './providers';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
const AvailabilityDays = createContext(new Map<string, CalendarPriceDay & { insufficient?: boolean }>());
function InventoryDayButton(props: React.ComponentProps<typeof DayButton>) {
  const daily = useContext(AvailabilityDays);
  const day = daily.get(format(props.day.date, 'yyyy-MM-dd'));
  const count = day?.availableUnits;
  const state = calendarAvailability(count);
  return (
    <DayButton
      {...props}
      data-availability={state.tone}
      className={`${props.className ?? ''} flex-col`}
      aria-label={`${props['aria-label'] ?? format(props.day.date, 'dd/MM/yyyy')}. ${state.label}${day?.insufficient && count ? ', không đủ số phòng đã chọn' : ''}${day?.pricePerNight ? `, giá từ ${money(day.pricePerNight)}` : ''}`}
      title={
        count === undefined
          ? 'Đang kiểm tra phòng'
          : `${count} phòng trống trong đêm này`
      }
    >
      <span>{props.children}</span>
      <span
        aria-hidden="true"
        className={`calendar-price inventory-${state.tone} block text-[8px] leading-3 whitespace-nowrap`}
      >
        {day?.pricePerNight && count
          ? `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(day.pricePerNight / 1000)}k`
          : '\u00a0'}
      </span>
    </DayButton>
  );
}
export function BookingCard({
  property,
  onDatesChange,
}: {
  property: Property;
  onDatesChange?: (dates: { checkIn: string; checkOut: string } | null) => void;
}) {
  const [roomId, setRoomId] = useState('');
  const room = property.roomTypes.find((r) => r.id === roomId) ?? property.roomTypes[0];
  const [range, setRange] = useState<DateRange>();
  const [quantity, setQuantity] = useState(1);
  const [guests, setGuests] = useState(1);
  const [now, setNow] = useState(() => new Date());
  const [month, setMonth] = useState(() =>
    earliestCheckInDate(property.checkInTime),
  );
  const { user, loading } = useAuth();
  const router = useRouter();
  const client = useQueryClient();
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const policy = useQuery({
    queryKey: ['booking-policy'],
    queryFn: api.bookingPolicy,
  });
  const eligibility = useQuery({
    queryKey: ['eligibility'],
    queryFn: api.eligibility,
    enabled: user?.role === 'GUEST',
    refetchInterval: 15000,
  });
  const earliestDate = earliestCheckInDate(
    property.checkInTime,
    now,
    policy.data?.minimumLeadTimeHours ?? 0,
  );
  const params = {
    checkIn: range?.from ? format(range.from, 'yyyy-MM-dd') : '',
    checkOut: range?.to ? format(range.to, 'yyyy-MM-dd') : '',
    quantity,
    guestCount: guests,
  };
  const hasDates = !!range?.from && !!range.to && range.to > range.from;
  useEffect(() => {
    onDatesChange?.(
      hasDates ? { checkIn: params.checkIn, checkOut: params.checkOut } : null,
    );
  }, [hasDates, params.checkIn, params.checkOut, onDatesChange]);
  const quote = useQuery({
    queryKey: ['quote', roomId, params],
    queryFn: () => api.quote(roomId, params),
    enabled: !!roomId && hasDates,
    retry: false,
    refetchInterval: 15000,
  });
  const calendarParams = {
    checkIn: format(addDays(startOfMonth(month), -7), 'yyyy-MM-dd'),
    checkOut: format(addDays(endOfMonth(month), 8), 'yyyy-MM-dd'),
  };
  const availability = useQuery({
    queryKey: ['availability', roomId, calendarParams],
    queryFn: () => api.availability(roomId, calendarParams),
    enabled: !!roomId,
    refetchInterval: 15000,
  });
  const selectedDates = { checkIn: params.checkIn, checkOut: params.checkOut };
  const selectedAvailability = useQuery({
    // Shared key with RoomAvailabilityLabel; quantity does not alter physical inventory.
    queryKey: ['availability', roomId, selectedDates],
    queryFn: () => api.availability(roomId, selectedDates),
    enabled: !!roomId && hasDates,
    refetchInterval: 15000,
  });
  const propertyCalendar = useQuery({
    queryKey: ['availability', 'property-calendar', property.id, calendarParams],
    queryFn: () => api.propertyCalendar(property.id, calendarParams),
    enabled: !roomId,
    refetchInterval: 15000,
  });
  const daily = new Map(
    roomId
      ? availability.data?.days.map((d) => [d.date, {
          ...d,
          insufficient: d.availableUnits < quantity,
          pricePerNight: d.availableUnits >= quantity ? room?.pricePerNight ?? null : null,
        }] as const)
      : propertyCalendar.data?.days.map((d) => [d.date, d] as const),
  );
  const refresh = () => {
    for (const key of ['bookings', 'availability', 'quote', 'eligibility'])
      void client.invalidateQueries({ queryKey: [key] });
  };
  const mutation = useMutation({
    mutationFn: () => api.createBooking({ roomTypeId: roomId, ...params }),
    onSuccess: () => {
      refresh();
      toast.success(
        'Đã giữ phòng tạm thời. Vui lòng thanh toán cọc trước hạn.',
      );
      router.push('/bookings');
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      refresh();
    },
  });
  const blocked = eligibility.data?.bookingBlockedUntil;
  if (!room)
    return (
      <aside className="panel p-6">
        Chỗ nghỉ hiện chưa có loại phòng đang mở bán.
      </aside>
    );
  const q = quote.data;
  return (
    <aside className="motion-content panel self-start p-5 shadow-sm lg:sticky lg:top-26 xl:p-6">
      <div className="field mb-4">
        <label htmlFor="roomType">Loại phòng / chỗ ở</label>
        <select
          id="roomType"
          value={roomId}
          onChange={(e) => {
            setRoomId(e.target.value);
            setQuantity(1);
            setGuests(1);
            mutation.reset();
          }}
        >
          <option value="">Chọn loại phòng</option>
          {property.roomTypes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <p>
        <strong className="text-2xl tracking-tight">
          {!roomId && 'Từ '}{money(room.pricePerNight)}
        </strong>
        <span className="ml-1 text-sm text-muted-foreground">
          / {property.type === 'HOTEL' ? 'phòng' : 'căn'} / đêm
        </span>
      </p>
      {roomId && hasDates && selectedAvailability.data && (
        <p className="mt-2 text-sm text-success">Còn {selectedAvailability.data.availableUnits} {property.type === 'HOTEL' ? 'phòng' : 'căn'} trong toàn bộ kỳ lưu trú</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Đặt cọc {property.depositPercent}% · Phần còn lại trả tại chỗ nghỉ
      </p>
      <div className="my-5 border-y py-4">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <CalendarDays size={17} />
          Chọn ngày lưu trú
        </h2>
        <AvailabilityDays.Provider value={daily}>
          <Calendar
            mode="range"
            month={month}
            onMonthChange={setMonth}
            selected={range}
            onSelect={(value) => {
              setRange(value);
              mutation.reset();
            }}
            min={1}
            max={365}
            disabled={(date) => {
              const day = daily.get(format(date, 'yyyy-MM-dd'));
              return date < earliestDate || (!!day && day.availableUnits < (roomId ? quantity : 1));
            }}
            excludeDisabled
            numberOfMonths={1}
            components={{ DayButton: InventoryDayButton }}
          />
        </AvailabilityDays.Provider>
        {(availability.isError || propertyCalendar.isError) && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {errorMessage(availability.error ?? propertyCalendar.error)}
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 divide-x rounded-xl border bg-cream p-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Nhận phòng</p>
            <p className="mt-1 text-sm">
              {range?.from ? format(range.from, 'dd/MM/yyyy') : 'Chọn ngày'}
            </p>
            <p className="text-xs">{property.checkInTime}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Trả phòng</p>
            <p className="mt-1 text-sm">
              {range?.to ? format(range.to, 'dd/MM/yyyy') : 'Chọn ngày'}
            </p>
            <p className="text-xs">{property.checkOutTime}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Giờ Việt Nam (UTC+7). Cần đặt trước giờ nhận phòng ít nhất{' '}
          {policy.data?.minimumLeadTimeHours ?? '…'} giờ.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label htmlFor="quantity">
            {property.type === 'HOTEL' ? 'Số phòng' : 'Số căn'}
          </label>
          <select
            id="quantity"
            value={quantity}
            disabled={!roomId || property.type === 'HOMESTAY'}
            onChange={(e) => {
              const value = Number(e.target.value);
              setQuantity(value);
              setGuests(Math.min(guests, room.maxGuests * value));
            }}
          >
            {Array.from({ length: room.totalUnits }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="guestCount">Số khách</label>
          <input
            id="guestCount"
            type="number"
            min={1}
            max={room.maxGuests * quantity}
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
          />
        </div>
      </div>
      <div aria-live="polite" aria-atomic="true">
        {!roomId ? (
          <p className="my-4 text-sm text-muted-foreground">Chọn loại phòng để đặt chỗ.</p>
        ) : !hasDates ? (
          <p className="my-4 text-sm text-muted-foreground">
            Chọn ngày để kiểm tra phòng trống
          </p>
        ) : quote.isPending ? (
          <p role="status" className="my-4 text-sm">
            Đang kiểm tra phòng và giá…
          </p>
        ) : quote.isError ? (
          <p role="alert" className="my-4 text-sm text-destructive">
            {errorMessage(quote.error)}
          </p>
        ) : (
          q && (
            <div
              key={`${roomId}-${quantity}-${q.totalAmount}`}
              className="motion-feedback my-5 text-sm"
            >
              <dl className="space-y-3">
                <div className="flex justify-between gap-3">
                  <dt>
                    {money(q.nightlyPriceSnapshot)} × {quantity} ×{' '}
                    {q.totalNights} đêm
                  </dt>
                  <dd>{money(q.totalAmount)}</dd>
                </div>
                <div className="flex justify-between border-t pt-3 font-semibold">
                  <dt>Tiền cọc ({q.depositPercentSnapshot}%)</dt>
                  <dd>{money(q.depositAmount)}</dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>Trả tại chỗ nghỉ</dt>
                  <dd>{money(q.remainingAmount)}</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs leading-5">
                Hạn cọc dự kiến nếu đặt lúc này:{' '}
                {timestampLabel(q.paymentDeadlineAt)}. Hạn chính thức được ghi
                trên đơn khi đặt.
              </p>
            </div>
          )
        )}
      </div>
      {blocked ? (
        <p role="alert" className="my-3 text-sm text-destructive">
          Tạm khóa đặt phòng do nhiều đơn hết hạn. Bạn có thể đặt lại sau{' '}
          {timestampLabel(blocked)}.
        </p>
      ) : (
        eligibility.data &&
        !eligibility.data.canBook && (
          <p role="alert" className="my-3 text-sm text-destructive">
            Bạn đã có 2 đơn chưa thanh toán. Vui lòng thanh toán, hủy hoặc chờ
            hết hạn.
          </p>
        )
      )}
      {!!range?.from && range.from < earliestDate && (
        <p role="alert" className="my-3 text-sm text-destructive">
          Thời gian nhận phòng quá gần. Vui lòng chọn ngày khác.
        </p>
      )}
      {(mutation.isError || policy.isError || eligibility.isError) && (
        <p role="alert" className="my-3 text-sm text-destructive">
          {errorMessage(mutation.error ?? policy.error ?? eligibility.error)}
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
            !hasDates ||
            !roomId ||
            !q ||
            quote.isError ||
            quote.isFetching ||
            !policy.data ||
            !eligibility.data?.canBook ||
            (!!range?.from && range.from < earliestDate)
          }
          onClick={() => {
            if (
              !user.fullName.trim() ||
              !/^(?:0|\+84)[35789]\d{8}$/.test(user.phoneNumber ?? '')
            ) {
              toast.info(
                'Vui lòng hoàn thiện thông tin cá nhân trước khi đặt phòng.',
              );
              router.push(
                `/account?next=${encodeURIComponent(propertyPath(property))}`,
              );
              return;
            }
            mutation.mutate();
          }}
        >
          {mutation.isPending ? 'Đang tạo đặt chỗ…' : 'Đặt chỗ ngay'}
        </Button>
      )}
      <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
        Phòng được giữ tạm ngay khi đặt. Thanh toán cọc trước hạn để xác nhận;
        quá hạn phòng tự động được giải phóng.
      </p>
      <div className="mt-5 flex items-center justify-center gap-2 border-t pt-4 text-xs text-muted-foreground">
        <ShieldCheck size={16} />
        Thông tin giá minh bạch
      </div>
    </aside>
  );
}
