import { BadRequestException } from '@nestjs/common';

const positive = (name: string, fallback: number, max: number) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > max)
    throw new Error(`Invalid booking configuration: ${name}`);
  return value;
};
export const bookingPolicy = Object.freeze({
  paymentWindowOptions: [1, 3, 6, 12, 24] as readonly number[],
  defaultPaymentWindowHours: 6,
  minimumLeadTimeHours: positive('BOOKING_MINIMUM_LEAD_HOURS', 2, 24),
  maxActiveUnpaidBookings: 2,
  lastMinuteThresholdHours: 24,
  lastMinutePaymentWindowHours: 1,
  expirationThreshold: positive('BOOKING_EXPIRATION_THRESHOLD', 3, 100),
  expirationPeriodDays: positive('BOOKING_EXPIRATION_PERIOD_DAYS', 30, 365),
  blockDurationHours: positive('BOOKING_BLOCK_HOURS', 24, 720),
  expirationIntervalMs: 60_000,
  maximumUnits: 100,
});
export const publicBookingPolicy = () => ({
  paymentWindowOptions: bookingPolicy.paymentWindowOptions,
  defaultPaymentWindowHours: bookingPolicy.defaultPaymentWindowHours,
  minimumLeadTimeHours: bookingPolicy.minimumLeadTimeHours,
  maxActiveUnpaidBookings: bookingPolicy.maxActiveUnpaidBookings,
  lastMinuteThresholdHours: bookingPolicy.lastMinuteThresholdHours,
  lastMinutePaymentWindowHours: bookingPolicy.lastMinutePaymentWindowHours,
});
export function paymentDeadline(
  checkIn: string,
  checkInTime: string,
  windowHours: number,
  now = new Date(),
) {
  if (!bookingPolicy.paymentWindowOptions.includes(windowHours))
    throw new BadRequestException('Thời gian thanh toán cọc không hợp lệ.');
  const arrival = new Date(`${checkIn}T${checkInTime}:00+07:00`).getTime();
  const remaining = arrival - now.getTime();
  const lead = bookingPolicy.minimumLeadTimeHours * 3600000;
  if (!Number.isFinite(arrival) || remaining <= lead)
    throw new BadRequestException(
      'Thời gian nhận phòng quá gần. Vui lòng chọn thời gian nhận phòng muộn hơn.',
    );
  const hours =
    remaining <= bookingPolicy.lastMinuteThresholdHours * 3600000
      ? Math.min(windowHours, bookingPolicy.lastMinutePaymentWindowHours)
      : windowHours;
  return new Date(Math.min(now.getTime() + hours * 3600000, arrival - lead));
}
export const availabilityConflict =
  'Loại phòng vừa được người khác đặt hoặc không còn đủ phòng trong khoảng thời gian này. Vui lòng chọn ngày hoặc số phòng khác.';
export const unpaidLimitMessage =
  'Bạn đã có 2 đơn đặt phòng chưa thanh toán. Vui lòng thanh toán hoặc chờ các đơn hết hạn trước khi đặt thêm.';
export const blockedMessage =
  'Bạn đang tạm thời không thể đặt phòng do có nhiều đơn đặt phòng hết hạn chưa thanh toán. Vui lòng thử lại sau.';
export const expiredMessage = 'Đơn đặt phòng đã hết thời gian thanh toán.';
