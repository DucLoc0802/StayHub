import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
    value,
  );
export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
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
export const roleLabel = {
  GUEST: 'Khách thuê',
  HOST: 'Người cho thuê',
  ADMIN: 'Quản trị viên',
};
export const statusLabel = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Tạm ngưng',
  PENDING: 'Chờ phê duyệt',
  REJECTED: 'Đã từ chối',
  PENDING_PAYMENT: 'Chờ thanh toán',
  CONFIRMED: 'Đã xác nhận',
  CANCELLED: 'Đã hủy',
};
