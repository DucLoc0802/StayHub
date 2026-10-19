import type { Booking } from './types';
export function paymentState(booking: Booking, now = Date.now()) {
  if (booking.status === 'CANCELLED')
    return {
      kind: 'cancelled',
      title: 'Đặt phòng đã hủy',
      description:
        booking.payment?.status === 'SUCCESS'
          ? 'Đơn đã hủy. Biên nhận và lịch sử thanh toán vẫn được lưu.'
          : 'Đơn đã hủy và không thể thanh toán.',
      canPay: false,
    };
  if (
    booking.status === 'EXPIRED' ||
    (booking.status === 'PENDING_PAYMENT' &&
      Date.parse(booking.paymentDeadlineAt) <= now)
  )
    return {
      kind: 'expired',
      title: 'Đã hết hạn giữ phòng',
      description:
        'Thời hạn thanh toán đã kết thúc. Vui lòng chọn chỗ nghỉ và tạo đặt phòng mới.',
      canPay: false,
    };
  if (booking.payment?.status === 'SUCCESS')
    return {
      kind: 'paid',
      title:
        booking.status === 'CONFIRMED'
          ? 'Thanh toán thành công!'
          : 'Khoản cọc đã được ghi nhận',
      description:
        booking.payment.method === 'FAKE'
          ? 'Khoản cọc mô phỏng đã được ghi nhận. Không phát sinh giao dịch tiền thật.'
          : 'Khoản cọc MoMo được lưu theo bản ghi lịch sử.',
      canPay: false,
    };
  if (booking.payment)
    return {
      kind: 'failed',
      title: 'Chưa hoàn tất thanh toán',
      description:
        'Đơn có bản ghi thanh toán lịch sử chưa thành công. Vui lòng liên hệ hỗ trợ.',
      canPay: false,
    };
  return {
    kind: 'unpaid',
    title: 'Chờ thanh toán cọc',
    description:
      'Nhấn “Tôi đã thanh toán” để ghi nhận khoản cọc mô phỏng và xác nhận đặt phòng ngay.',
    canPay: booking.status === 'PENDING_PAYMENT',
  };
}
