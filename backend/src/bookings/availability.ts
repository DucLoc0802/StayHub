import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

export function dateRange(checkIn: string, checkOut: string) {
  const parse = (value: string) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException(
        'Ngày phải có định dạng YYYY-MM-DD và là ngày hợp lệ.',
      );
    return date;
  };
  const start = parse(checkIn),
    end = parse(checkOut);
  const totalNights = (end.getTime() - start.getTime()) / 86400000;
  if (totalNights < 1 || totalNights > 365)
    throw new BadRequestException('Thời gian lưu trú phải từ 1 đến 365 đêm.');
  return { checkIn: start, checkOut: end, totalNights };
}
export const heldBookings = (now: Date): Prisma.BookingWhereInput => ({
  OR: [
    { status: 'CONFIRMED' },
    { status: 'PENDING_PAYMENT', paymentDeadlineAt: { gt: now } },
  ],
});
export type Occupancy = { checkIn: Date; checkOut: Date; quantity: number };
export function availabilityByNight(
  totalUnits: number,
  bookings: Occupancy[],
  checkIn: Date,
  checkOut: Date,
) {
  const events = new Map<number, number>();
  for (const b of bookings) {
    const start = Math.max(checkIn.getTime(), b.checkIn.getTime());
    const end = Math.min(checkOut.getTime(), b.checkOut.getTime());
    if (start >= end) continue;
    events.set(start, (events.get(start) ?? 0) + b.quantity);
    events.set(end, (events.get(end) ?? 0) - b.quantity);
  }
  const days: { date: string; availableUnits: number }[] = [];
  let occupied = 0;
  for (
    let time = checkIn.getTime();
    time < checkOut.getTime();
    time += 86400000
  ) {
    occupied += events.get(time) ?? 0;
    days.push({
      date: new Date(time).toISOString().slice(0, 10),
      availableUnits: Math.max(0, totalUnits - occupied),
    });
  }
  return {
    availableUnits: Math.min(
      totalUnits,
      ...days.map((day) => day.availableUnits),
    ),
    days,
  };
}
// Host inventory reductions must cover the peak on any future night, not the sum of disjoint stays.
export function peakOccupancy(bookings: Occupancy[], from: Date) {
  const events = new Map<number, number>();
  for (const b of bookings) {
    if (b.checkOut <= from) continue;
    const start = Math.max(from.getTime(), b.checkIn.getTime());
    events.set(start, (events.get(start) ?? 0) + b.quantity);
    events.set(
      b.checkOut.getTime(),
      (events.get(b.checkOut.getTime()) ?? 0) - b.quantity,
    );
  }
  let peak = 0,
    occupied = 0;
  for (const [, delta] of [...events].sort(([a], [b]) => a - b)) {
    occupied += delta;
    peak = Math.max(peak, occupied);
  }
  return peak;
}
