'use client';
import { money, timestampLabel } from '@/lib/utils';
import type { Booking } from '@/lib/types';

const labels: Record<string, string> = {
  CREATED: 'Tạo đơn, giữ phòng tạm',
  PAYMENT_SUCCESS: 'Thanh toán cọc thành công (demo)',
  PAYMENT_FAILED: 'Thanh toán thất bại (demo)',
  CONFIRMED: 'Xác nhận đặt phòng',
  CANCELLED: 'Hủy đặt phòng',
  EXPIRED: 'Hết hạn thanh toán',
  REJECTED: 'Từ chối đặt phòng',
  COMPLETED: 'Hoàn tất lưu trú',
};
export function BookingHistory({ booking }: { booking: Booking }) {
  return (
    <section className="border-t pt-6">
      <h2 className="text-lg font-semibold">Lịch sử đặt phòng & thanh toán</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Chỉ hiển thị sự kiện có thời điểm được ghi nhận. Đơn cũ có thể chưa có
        lịch sử xác nhận.
      </p>
      {booking.timeline?.length ? (
        <ol className="mt-5 divide-y border-y">
          {booking.timeline.map((event) => (
            <li
              key={event.id}
              className="grid gap-1 py-4 text-sm sm:grid-cols-[11rem_1fr] sm:gap-4"
            >
              <time
                className="text-muted-foreground tabular-nums"
                dateTime={event.createdAt}
              >
                {timestampLabel(event.createdAt)}
              </time>
              <div>
                <p className="font-medium">
                  {labels[event.type] ?? event.type}
                  {event.amount !== undefined && ` · ${money(event.amount)}`}
                </p>
                {event.failureReason && (
                  <p className="mt-1 text-muted-foreground">
                    {event.failureReason}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Chưa có sự kiện lịch sử được ghi nhận.
        </p>
      )}
    </section>
  );
}
