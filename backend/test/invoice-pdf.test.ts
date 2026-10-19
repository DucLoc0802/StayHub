import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderInvoice, invoiceNote } from '../src/bookings/invoice.service';
import { BookingAccessService } from '../src/bookings/booking-access.service';

type Invoice = Awaited<ReturnType<BookingAccessService['invoice']>>;
const booking = {
  bookingCode: 'STB-PDF-123456',
  customerNameSnapshot: 'Nguyễn Thị Ánh',
  customerPhoneSnapshot: '0901234567',
  customerEmailSnapshot: 'anh@example.test',
  propertyNameSnapshot: 'Nhà nghỉ Ánh Dương',
  propertyAddressSnapshot: 'Đường Nguyễn Huệ, Thành phố Hồ Chí Minh',
  roomTypeNameSnapshot: 'Phòng đôi hướng vườn',
  checkIn: new Date('2027-10-09'),
  checkOut: new Date('2027-10-11'),
  checkInTimeSnapshot: '14:00',
  checkOutTimeSnapshot: '12:00',
  quantity: 2,
  guestCount: 4,
  totalNights: 2,
  nightlyPriceSnapshot: 600000,
  totalAmount: 2400000,
  depositAmount: 720000,
  remainingAmount: 1680000,
  status: 'CONFIRMED',
  payment: {
    id: 'persisted',
    method: 'FAKE',
    status: 'SUCCESS',
    amount: 720000,
    paidAt: new Date('2027-10-05T03:00:00Z'),
  },
} as Invoice;

async function parse(bytes: Buffer) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
  });
  const pdf = await task.promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    pages.push({
      width: page.view[2],
      height: page.view[3],
      text: content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' '),
    });
  }
  await task.destroy();
  return pages;
}
test('real PDF embeds Unicode font, preserves Vietnamese and persisted amounts, and uses A4 pages', async () => {
  const bytes = await renderInvoice(booking, new Date('2027-10-05T03:00:00Z'));
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  assert.match(bytes.toString('latin1'), /\/FontFile2/);
  const pages = await parse(bytes),
    text = pages
      .map((p) => p.text)
      .join(' ')
      .normalize('NFC');
  for (const value of [
    'PHIẾU XÁC NHẬN ĐẶT PHÒNG',
    'Biên nhận thanh toán mô phỏng',
    'STB-PDF-123456',
    'Nguyễn Thị Ánh',
    'Nhà nghỉ Ánh Dương',
    'Đường Nguyễn Huệ',
    'Phòng đôi hướng vườn',
    '9/10/2027',
    '11/10/2027',
    '2.400.000',
    '720.000',
    '1.680.000',
    '10:00',
    'Đã thanh toán cọc',
  ])
    assert.ok(text.includes(value), value);
  for (const p of pages) {
    assert.ok(Math.abs(p.width - 595.28) < 0.1);
    assert.ok(Math.abs(p.height - 841.89) < 0.1);
  }
  assert.ok(text.includes(invoiceNote));
});
test('cancelled receipts keep original payment and do not relabel historical MoMo as simulated', async () => {
  const b = {
    ...booking,
    status: 'CANCELLED',
    depositAmount: 999999,
    payment: { ...booking.payment!, method: 'MOMO_MANUAL', amount: 123456 },
  } as Invoice;
  const text = (await parse(await renderInvoice(b)))
    .map((p) => p.text)
    .join(' ')
    .normalize('NFC');
  assert.ok(text.includes('Đã hủy'));
  assert.ok(text.includes('123.456'));
  assert.ok(!text.includes('999.999'));
  assert.ok(text.includes('MoMo thủ công (lịch sử)'));
  assert.ok(!text.includes('Biên nhận thanh toán mô phỏng'));
});
test('long snapshot text wraps onto multiple valid pages without dropping content', async () => {
  const b = {
    ...booking,
    propertyNameSnapshot: 'Chỗ nghỉ dài '.repeat(50),
    propertyAddressSnapshot: 'Đường Nguyễn Huệ '.repeat(60),
    roomTypeNameSnapshot: 'Phòng có tên dài '.repeat(20),
  };
  const pages = await parse(await renderInvoice(b));
  assert.ok(pages.length > 1);
  assert.ok(
    pages
      .map((p) => p.text)
      .join(' ')
      .includes('Không phải hóa đơn giá trị gia tăng'),
  );
});
