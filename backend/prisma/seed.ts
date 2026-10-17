import 'dotenv/config';
import { PrismaClient, BookingStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { priceSnapshot, vietnamToday } from '../src/common/domain';
import {
  availabilityByNight,
  heldBookings,
} from '../src/bookings/availability';
import { demoAccounts, demoAmenities, demoAccommodations } from './demo-data';
import { legacyDemoProperties as legacyProperties } from './legacy-demo-data';

const prisma = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Demo seeding is disabled in production.');
  const password = process.env.DEMO_PASSWORD;
  if (
    !password ||
    password.length < 8 ||
    Buffer.byteLength(password, 'utf8') > 72
  )
    throw new Error(
      'Set DEMO_PASSWORD (8+ characters, at most 72 UTF-8 bytes) for local demo accounts.',
    );
  const hash = await bcrypt.hash(password, 12);
  for (const [email, names] of [
    ['guest.lan@stayhub.local', ['guest02', 'Phạm Ngọc Lan']],
    ['pendinghost@stayhub.local', ['Chủ nhà demo chờ duyệt']],
    ['inventory-demo@stayhub.local', ['Khách minh họa lịch phòng']],
  ] as [string, string[]][])
    await prisma.user.updateMany({
      where: { email, fullName: { in: names }, archivedAt: null },
      data: { archivedAt: new Date() },
    });
  await prisma.feedback.deleteMany({
    where: {
      id: '60000000-0000-4000-8000-000000000001',
      bookingId: '50000000-0000-4000-8000-000000000007',
      content:
        'Đánh giá tổng hợp cho demo: không gian sạch, thông tin đặt phòng rõ ràng và phù hợp chuyến nghỉ ngắn.',
    },
  });
  const users = new Map<
    string,
    {
      id: string;
      fullName: string;
      email: string;
      phoneNumber: string | null;
      role: string;
      status: string;
    }
  >();
  for (const [email, fullName, role, status] of demoAccounts) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        fullName,
        role,
        status,
        passwordHash: hash,
        phoneNumber: role === 'GUEST' ? '0900000001' : null,
      },
    });
    users.set(email, user);
  }
  // Rename only known old fixture personas; preserve real account customizations.
  for (const [email, legacyName] of [
    ['admin@stayhub.local', 'Quản trị demo StayHub'],
    ['guest@stayhub.local', 'Nguyễn Minh Anh'],
    ['host@stayhub.local', 'Trần Thảo An'],
    ['host.east@stayhub.local', 'Nguyễn Minh Châu'],
    ['host.south@stayhub.local', 'Lê Bình An'],
    ['host.hoangthanh@stayhub.local', 'Hoàng Thanh Tùng'],
    ['guest@stayhub.local', 'Khách demo StayHub'],
    ['host@stayhub.local', 'Chủ nhà demo Trung tâm'],
    ['host.east@stayhub.local', 'Chủ nhà demo phía Đông'],
    ['host.south@stayhub.local', 'Chủ nhà demo phía Nam'],
  ]) {
    const fullName = demoAccounts.find((account) => account[0] === email)![1];
    await prisma.user.updateMany({
      where: { email, fullName: legacyName },
      data: { fullName },
    });
    const user = users.get(email)!;
    if (user.fullName === legacyName) user.fullName = fullName;
  }
  const amenities = new Map<string, string>();
  for (const [code, nameVi] of demoAmenities) {
    const amenity = await prisma.amenity.upsert({
      where: { code },
      update: {},
      create: { code, nameVi },
    });
    amenities.set(code, amenity.id);
  }
  // Archive only exact untouched old fixtures; retain bookings and user edits.
  for (const old of legacyProperties) {
    const owner = await prisma.user.findUnique({
      where: { email: old.hostEmail },
      select: { id: true },
    });
    if (!owner) continue;
    await prisma.property.updateMany({
      where: {
        id: old.id,
        hostId: owner.id,
        name: old.name,
        description: old.description,
        address: old.address,
        status: { in: ['ACTIVE', 'INACTIVE'] },
        archivedAt: null,
      },
      data: { status: 'INACTIVE', archivedAt: new Date() },
    });
  }
  for (const {
    hostEmail,
    codes,
    images,
    roomTypes,
    ...property
  } of demoAccommodations) {
    const host = users.get(hostEmail)!;
    if (host.role !== 'HOST' || host.status !== 'ACTIVE')
      throw new Error(`Demo host must be active: ${hostEmail}`);
    const existing = await prisma.property.findUnique({
      where: { id: property.id },
      select: { hostId: true },
    });
    if (
      existing &&
      existing.hostId !== host.id &&
      property.id === '71000000-0000-4000-8000-000000000005'
    ) {
      const oldOwner = users.get('host.hoangthanh@stayhub.local')!;
      const realPayments = await prisma.payment.count({
        where: {
          method: 'MOMO_MANUAL',
          booking: { roomType: { propertyId: property.id } },
        },
      });
      const changed = realPayments
        ? { count: 0 }
        : await prisma.property.updateMany({
            where: {
              id: property.id,
              hostId: oldOwner.id,
              name: property.name,
              address: property.address,
              description: property.description,
            },
            data: { hostId: host.id },
          });
      if (changed.count) existing.hostId = host.id;
    }
    if (existing && existing.hostId !== host.id)
      throw new Error(
        `Seed property ownership differs: ${property.id}. Existing data was preserved.`,
      );
    await prisma.property.updateMany({
      where: {
        id: property.id,
        hostId: host.id,
        address: property.address.replace(
          '(địa chỉ minh họa)',
          '(địa chỉ demo)',
        ),
        description: property.description.replace(
          'Thông tin chỗ nghỉ, địa chỉ, ảnh và giá là dữ liệu minh họa, không phải tin đăng thật.',
          'Tên, địa chỉ, ảnh và giá là dữ liệu tổng hợp cho demo StayHub, không phải tin đăng thật.',
        ),
      },
      data: { address: property.address, description: property.description },
    });
    await prisma.property.upsert({
      where: { id: property.id },
      update: {},
      create: {
        ...property,
        hostId: host.id,
        images: { create: images },
        amenities: {
          create: codes.map((code) => ({ amenityId: amenities.get(code)! })),
        },
        roomTypes: {
          create: roomTypes.map(({ propertyId: ignored, ...room }) => {
            void ignored;
            return room;
          }),
        },
      },
    });
  }
  const day = (n: number) =>
    new Date(new Date(vietnamToday()).getTime() + n * 86400000);
  const states: BookingStatus[] = [
    'CONFIRMED',
    'CONFIRMED',
    'CANCELLED',
    'EXPIRED',
    'PENDING_PAYMENT',
    'PENDING_PAYMENT',
    'CONFIRMED',
  ];
  for (const [index, status] of states.entries()) {
    const id = `75000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
    if (await prisma.booking.findUnique({ where: { id } })) continue;
    const roomId = demoAccommodations[index % 5].roomTypes[0].id;
    const customer = users.get('guest@stayhub.local')!;
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM User WHERE id = ${customer.id} FOR UPDATE`;
        const room = await tx.roomType.findUniqueOrThrow({
          where: { id: roomId },
          include: { property: true },
        });
        await tx.$queryRaw`SELECT id FROM Property WHERE id = ${room.propertyId} FOR UPDATE`;
        const now = new Date(),
          historical = index === 6;
        const createdAt = new Date(
          now.getTime() - (historical ? 15 * 86400000 : 2 * 3600000),
        );
        const checkIn = day(historical ? -10 : 14 + index * 3),
          checkOut = day(historical ? -8 : 16 + index * 3);
        const holds = await tx.booking.findMany({
          where: {
            roomTypeId: room.id,
            ...heldBookings(now),
            checkIn: { lt: checkOut },
            checkOut: { gt: checkIn },
          },
        });
        if (
          availabilityByNight(room.totalUnits, holds, checkIn, checkOut)
            .availableUnits < 1
        )
          return;
        const amounts = priceSnapshot(
          room.pricePerNight,
          room.property.depositPercent,
          2,
        );
        const paid = status === 'CONFIRMED' || status === 'CANCELLED';
        const paymentAt = new Date(createdAt.getTime() + 30 * 60000);
        const cancelledAt =
          status === 'CANCELLED'
            ? new Date(createdAt.getTime() + 60 * 60000)
            : null;
        const deadline =
          status === 'EXPIRED'
            ? new Date(createdAt.getTime() + 3600000)
            : new Date(createdAt.getTime() + 6 * 3600000);
        await tx.booking.create({
          data: {
            id,
            bookingCode: `STB-DEMO-V2-${index + 1}`,
            guestId: customer.id,
            customerNameSnapshot: customer.fullName,
            customerPhoneSnapshot: customer.phoneNumber ?? '',
            customerEmailSnapshot: customer.email,
            propertyNameSnapshot: room.property.name,
            propertyAddressSnapshot: room.property.address,
            roomTypeId: room.id,
            roomTypeNameSnapshot: room.name,
            quantity: 1,
            guestCount: 2,
            checkIn,
            checkOut,
            checkInTimeSnapshot: room.property.checkInTime,
            checkOutTimeSnapshot: room.property.checkOutTime,
            status,
            createdAt,
            paymentDeadlineAt: deadline,
            cancelledAt,
            expiredAt: status === 'EXPIRED' ? deadline : null,
            ...amounts,
            payment: paid
              ? {
                  create: {
                    amount: amounts.depositAmount,
                    status: 'SUCCESS',
                    method: 'FAKE',
                    paidAt: paymentAt,
                    createdAt: paymentAt,
                  },
                }
              : undefined,
            paymentAttempts:
              paid || index === 5
                ? {
                    create: {
                      amount: amounts.depositAmount,
                      status: paid ? 'SUCCESS' : 'FAILED',
                      createdAt: paymentAt,
                      failureReason: paid
                        ? null
                        : 'Thanh toán demo thất bại. Có thể thử lại trước hạn.',
                    },
                  }
                : undefined,
            events: {
              create: [
                { type: 'CREATED', status: 'PENDING_PAYMENT', createdAt },
                ...(paid
                  ? [
                      {
                        type: 'CONFIRMED',
                        status: 'CONFIRMED' as const,
                        createdAt: paymentAt,
                      },
                    ]
                  : []),
                ...(cancelledAt
                  ? [
                      {
                        type: 'CANCELLED',
                        status: 'CANCELLED' as const,
                        createdAt: cancelledAt,
                      },
                    ]
                  : []),
                ...(status === 'EXPIRED'
                  ? [
                      {
                        type: 'EXPIRED',
                        status: 'EXPIRED' as const,
                        createdAt: deadline,
                      },
                    ]
                  : []),
              ],
            },
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }
  console.info(
    'Fictional StayHub demo: five Hosts, five properties, seven booking scenarios; no generated public reviews. Existing accounts and host edits preserved.',
  );
}
main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Demo seed failed');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
