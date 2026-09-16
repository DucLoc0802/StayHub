import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const money = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)} ₫`;
export const dateVi = (value: string | Date) => new Intl.DateTimeFormat('vi-VN').format(new Date(value));
export const apiError = (error: unknown) => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string | string[] } } }).response;
    const message = response?.data?.message;
    return Array.isArray(message) ? message.join(' ') : message ?? 'Đã có lỗi xảy ra.';
  }
  return 'Không thể kết nối máy chủ.';
};
