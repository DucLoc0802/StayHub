import type { Booking } from './types';
export function paymentState(booking: Booking, now = Date.now()) {
  const claim = booking.paymentAttempts
    ?.filter((p) => p.method === 'MOMO_MANUAL')
    .at(-1);
  const terminal =
    booking.status === 'CANCELLED' ||
    booking.status === 'EXPIRED' ||
    (booking.status === 'PENDING_PAYMENT' &&
      Date.parse(booking.paymentDeadlineAt) <= now);
  const paid = booking.payment?.status === 'SUCCESS';
  if (terminal)
    return {
      kind: booking.status === 'CANCELLED' ? 'cancelled' : 'expired',
      title:
        booking.status === 'CANCELLED'
          ? 'Đặt phòng đã hủy'
          : 'Đã hết hạn giữ phòng',
      description:
        claim && claim.status !== 'FAILED'
          ? 'Đơn không còn giữ phòng. Thông tin chuyển tiền được giữ lại để đối chiếu và xử lý riêng; không tự động hoàn tiền.'
          : paid
            ? 'Đơn không còn giữ phòng. Khoản cọc và lịch sử thanh toán vẫn được lưu theo chính sách hủy.'
            : 'Phòng đã được giải phóng. Không chuyển thêm tiền cho đơn này. Nếu đã chuyển trước đó, bạn có thể báo khoản đã chuyển để được xử lý riêng.',
      canPay: false,
      claim,
    };
  if (paid)
    return {
      kind: booking.payment?.method === 'FAKE' ? 'simulated' : 'verified',
      title:
        booking.payment?.method === 'FAKE'
          ? 'Giao dịch mô phỏng trong lịch sử'
          : 'Thanh toán đã được xác nhận',
      description:
        booking.payment?.method === 'FAKE'
          ? 'Không thu tiền thật cho giao dịch mô phỏng này.'
          : 'Khoản cọc đã được kiểm tra trong tài khoản nhận tiền. Đặt phòng của bạn đã được xác nhận.',
      canPay: false,
      claim,
    };
  if (claim?.status === 'RESOLUTION_REQUIRED')
    return {
      kind: 'resolution',
      title: 'Khoản chuyển tiền cần xử lý riêng',
      description:
        claim.failureReason ||
        'Thông báo đang được kiểm tra riêng. Đặt phòng chưa được xác nhận; vui lòng không chuyển thêm tiền.',
      canPay: false,
      claim,
    };
  if (claim?.status === 'SUBMITTED')
    return {
      kind: 'reported',
      title: 'Đang chờ đối chiếu thanh toán',
      description:
        'Đã lưu thông báo chuyển tiền. Đơn chưa được xác nhận cho đến khi khoản cọc được đối chiếu; bạn không cần gửi lại hoặc chuyển thêm tiền.',
      canPay: false,
      claim,
    };
  if (claim?.status === 'FAILED')
    return {
      kind: 'rejected',
      title: 'Chưa xác minh được khoản chuyển tiền',
      description:
        claim.failureReason ||
        'Vui lòng kiểm tra lại mã giao dịch và thông tin chuyển tiền. Không chuyển thêm tiền chỉ vì thông báo bị từ chối.',
      canPay: true,
      claim,
    };
  return {
    kind: 'unpaid',
    title: 'Chờ thanh toán cọc',
    description:
      'Chuyển đúng khoản cọc trong MoMo, sau đó gửi thông báo kèm mã giao dịch để được đối chiếu.',
    canPay: true,
    claim,
  };
}
