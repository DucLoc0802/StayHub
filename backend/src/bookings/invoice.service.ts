import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { SessionUser } from '../common/security';
import { BookingAccessService } from './booking-access.service';

export const invoiceNote =
  'Đây là phiếu xác nhận đặt phòng và biên nhận thanh toán mô phỏng phục vụ đồ án. Không phải hóa đơn giá trị gia tăng và không xác nhận giao dịch tiền thật.';
export const historicalInvoiceNote =
  'Đây là phiếu xác nhận đặt phòng và biên nhận khoản cọc MoMo theo bản ghi lịch sử. Không phải hóa đơn giá trị gia tăng. Tài liệu không tạo thêm giao dịch hay xác minh lại khoản tiền.';
type InvoiceBooking = Awaited<ReturnType<BookingAccessService['invoice']>>;
const currency = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
    value,
  );
const timestamp = (value: Date) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);
const date = (value: Date) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);

// Separate from transport so PDF content can be parsed and checked in tests.
export async function renderInvoice(
  b: InvoiceBooking,
  generatedAt = new Date(),
): Promise<Buffer> {
  // Support both Nest's compiled layout and Vercel's source entrypoint bundle.
  const font = [
    join(__dirname, '../assets/fonts/NotoSans-Regular.ttf'),
    join(process.cwd(), 'src/assets/fonts/NotoSans-Regular.ttf'),
    join(process.cwd(), 'dist/assets/fonts/NotoSans-Regular.ttf'),
  ].find(existsSync);
  if (!font)
    throw new Error(
      'The embedded invoice font is missing from the deployment.',
    );
  const doc = new PDFDocument({
    size: 'A4',
    margin: 44,
    bufferPages: true,
    font,
    info: {
      Title: `StayHub ${b.bookingCode}`,
      Author: 'StayHub',
      CreationDate: generatedAt,
    },
  });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const orange = '#954619',
    ink = '#2f2926',
    muted = '#6f625c';
  const width = doc.page.width - 88;
  const ensure = (height: number) => {
    if (doc.y + height > doc.page.height - 55) doc.addPage();
  };
  const section = (title: string) => {
    ensure(65);
    doc.moveDown(0.8).fontSize(12).fillColor(orange).text(title);
    doc.moveDown(0.45);
  };
  const row = (label: string, value: string, highlight = false) => {
    doc.fontSize(9.5);
    const height =
      Math.max(
        doc.heightOfString(label, { width: 185 }),
        doc.heightOfString(value, { width: width - 202 }),
      ) + 12;
    ensure(height);
    const y = doc.y;
    doc.fillColor(muted).text(label, 44, y, { width: 185 });
    doc
      .fillColor(highlight ? orange : ink)
      .text(value, 246, y, { width: width - 202, align: 'right' });
    doc.y = y + height;
    doc
      .moveTo(44, doc.y - 5)
      .lineTo(doc.page.width - 44, doc.y - 5)
      .lineWidth(0.4)
      .strokeColor('#eaddd5')
      .stroke();
    doc.x = 44;
  };
  const missing = 'Không có trong bản ghi khi đặt phòng';
  const simulated = b.payment!.method === 'FAKE';
  doc.fillColor(orange).fontSize(24).text('StayHub');
  doc
    .moveDown(0.4)
    .fillColor(ink)
    .fontSize(17)
    .text('PHIẾU XÁC NHẬN ĐẶT PHÒNG');
  doc
    .moveDown(0.4)
    .fontSize(10)
    .fillColor(muted)
    .text(
      simulated
        ? 'Biên nhận thanh toán mô phỏng'
        : 'Biên nhận khoản cọc MoMo (lịch sử)',
    );
  doc.moveDown();
  row('Mã đặt phòng', b.bookingCode);
  row('Ngày lập phiếu (UTC+7)', timestamp(generatedAt));
  row(
    'Trạng thái đặt phòng',
    b.status === 'CANCELLED'
      ? 'Đã hủy · Giữ nguyên lịch sử thanh toán'
      : b.status === 'CONFIRMED'
        ? 'Đã xác nhận'
        : b.status === 'EXPIRED'
          ? 'Đã hết hạn'
          : 'Chờ thanh toán',
  );
  section('Thông tin khách hàng');
  row('Họ và tên', b.customerNameSnapshot || missing);
  row('Số điện thoại', b.customerPhoneSnapshot || missing);
  if (b.customerEmailSnapshot) row('Email', b.customerEmailSnapshot);
  section('Chỗ nghỉ & thời gian lưu trú');
  row('Cơ sở lưu trú', b.propertyNameSnapshot || missing);
  row('Địa chỉ', b.propertyAddressSnapshot || missing);
  // No live host/contact fallback: these fields were never snapshotted.
  row('Phòng / loại phòng', b.roomTypeNameSnapshot);
  row('Nhận phòng (UTC+7)', `${date(b.checkIn)} · ${b.checkInTimeSnapshot}`);
  row('Trả phòng (UTC+7)', `${date(b.checkOut)} · ${b.checkOutTimeSnapshot}`);
  row(
    'Thời gian & số lượng',
    `${b.totalNights} đêm · ${b.quantity} phòng / căn · ${b.guestCount} khách`,
  );
  section('Chi tiết thanh toán');
  row(
    'Giá phòng khi đặt',
    `${currency(b.nightlyPriceSnapshot)} × ${b.totalNights} đêm × ${b.quantity}`,
  );
  row('Tổng giá trị đặt phòng', currency(b.totalAmount));
  row(
    simulated ? 'Cọc đã ghi nhận (mô phỏng)' : 'Cọc đã ghi nhận (lịch sử)',
    currency(b.payment!.amount),
    true,
  );
  row('Còn lại tại chỗ nghỉ', currency(b.totalAmount - b.payment!.amount));
  row(
    'Phương thức',
    simulated ? 'Thanh toán mô phỏng' : 'MoMo thủ công (lịch sử)',
  );
  row('Trạng thái thanh toán', 'Đã thanh toán cọc');
  row(
    'Thời điểm thanh toán (UTC+7)',
    b.payment!.paidAt
      ? timestamp(b.payment!.paidAt)
      : 'Không có thời điểm trong bản ghi lịch sử',
  );
  const note = simulated ? invoiceNote : historicalInvoiceNote;
  doc.fontSize(8.5);
  ensure(doc.heightOfString(note, { width }) + 20);
  doc.moveDown().fillColor(muted).text(note, { width, lineGap: 3 });
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index++) {
    doc.switchToPage(index);
    doc
      .fontSize(8)
      .fillColor(muted)
      .text(
        `${b.bookingCode} · ${index + 1}/${range.count}`,
        44,
        doc.page.height - 35,
        { width, align: 'center', lineBreak: false },
      );
  }
  doc.end();
  return result;
}

@Injectable()
export class InvoiceService {
  constructor(private readonly access: BookingAccessService) {}
  async pdf(user: SessionUser, id: string) {
    const booking = await this.access.invoice(user, id);
    return {
      bytes: await renderInvoice(booking),
      filename: `StayHub-${booking.bookingCode.replace(/[^A-Za-z0-9-]/g, '_')}.pdf`,
    };
  }
}
