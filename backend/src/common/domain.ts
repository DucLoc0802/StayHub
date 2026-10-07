import { BadRequestException } from '@nestjs/common';

export const districts = [
  'Quận 1',
  'Quận 2',
  'Quận 3',
  'Quận 4',
  'Quận 5',
  'Quận 6',
  'Quận 7',
  'Quận 8',
  'Quận 10',
  'Quận 11',
  'Quận 12',
  'Bình Thạnh',
  'Phú Nhuận',
  'Tân Bình',
  'Tân Phú',
  'Gò Vấp',
  'Bình Tân',
  'Thủ Đức',
  'Bình Chánh',
  'Nhà Bè',
  'Hóc Môn',
  'Củ Chi',
  'Cần Giờ',
];
export function vietnamToday(now = new Date()) {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}
export function bookingDates(
  checkIn: string,
  checkOut: string,
  now = new Date(),
  checkInTime?: string,
) {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new BadRequestException('Ngày phải có định dạng YYYY-MM-DD.');
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException('Ngày không hợp lệ.');
    return date;
  };
  const start = parse(checkIn),
    end = parse(checkOut);
  const totalNights = (end.getTime() - start.getTime()) / 86400000;
  if (checkIn < vietnamToday(now))
    throw new BadRequestException('Ngày nhận phòng không được ở quá khứ.');
  if (
    checkInTime &&
    now.getTime() > new Date(`${checkIn}T${checkInTime}:00+07:00`).getTime()
  )
    throw new BadRequestException(
      'Đã quá giờ nhận phòng của ngày này. Vui lòng chọn ngày khác.',
    );
  if (totalNights < 1 || totalNights > 365)
    throw new BadRequestException('Thời gian lưu trú phải từ 1 đến 365 đêm.');
  return { checkIn: start, checkOut: end, totalNights };
}
export function priceSnapshot(
  nightlyPriceSnapshot: number,
  depositPercentSnapshot: number,
  totalNights: number,
  quantity = 1,
) {
  const totalAmount = nightlyPriceSnapshot * totalNights * quantity;
  if (!Number.isSafeInteger(totalAmount) || totalAmount > 2147483647)
    throw new BadRequestException(
      'Tổng tiền vượt giới hạn cho phép. Vui lòng giảm số đêm hoặc số phòng.',
    );
  const depositAmount = Math.ceil((totalAmount * depositPercentSnapshot) / 100);
  return {
    nightlyPriceSnapshot,
    depositPercentSnapshot,
    totalNights,
    totalAmount,
    depositAmount,
    remainingAmount: totalAmount - depositAmount,
  };
}
export function overlap(
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
  now = new Date(),
) {
  return {
    roomTypeId,
    OR: [
      { status: 'CONFIRMED' as const },
      { status: 'PENDING_PAYMENT' as const, paymentDeadlineAt: { gt: now } },
    ],
    checkIn: { lt: checkOut },
    checkOut: { gt: checkIn },
  };
}
