'use client';
import axios from 'axios';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from './ui/button';
import { errorMessage } from '@/lib/api';
export function PaymentError({
  error,
  retry,
  invoice = false,
}: {
  error: unknown;
  retry: () => void;
  invoice?: boolean;
}) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  const code = axios.isAxiosError(error)
    ? error.response?.data?.code
    : undefined;
  const missing = status === 404 && code !== 'API_ROUTE_NOT_FOUND';
  const invalid = code === 'INVALID_BOOKING_ID';
  const title = invalid
    ? 'Mã đặt phòng không hợp lệ'
    : missing
      ? 'Không tìm thấy đặt phòng'
      : status === 401
        ? 'Phiên đăng nhập đã hết hạn'
        : status === 403
          ? 'Bạn không có quyền mở đặt phòng này'
          : invoice
            ? 'Chưa thể mở biên nhận'
            : 'Chưa thể tải thông tin thanh toán';
  return (
    <div className="container-shell page-section">
      <div className="mx-auto max-w-2xl">
        <Link
          className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm underline"
          href="/bookings/pending-payments"
        >
          <ArrowLeft size={16} />
          Đơn chờ thanh toán
        </Link>
        <section className="panel space-y-5 p-6 sm:p-8" role="alert">
          <WifiOff className="text-muted-foreground" size={28} />
          <h1 className="page-title">{title}</h1>
          <p className="max-w-prose text-sm leading-6 text-muted-foreground">
            {missing
              ? 'Đơn có thể không tồn tại hoặc thuộc tài khoản khác. Mở lại đơn từ danh sách của bạn; không tạo đơn mới chỉ để khắc phục lỗi tải.'
              : errorMessage(error)}
          </p>
          <div className="flex flex-wrap gap-3">
            {!missing && !invalid && status !== 403 && (
              <Button onClick={retry}>
                <RefreshCw size={16} />
                Thử lại
              </Button>
            )}
            {status === 401 ? (
              <Button asChild>
                <Link href="/login">Đăng nhập lại</Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/bookings/pending-payments">
                  Về danh sách đặt phòng
                </Link>
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
