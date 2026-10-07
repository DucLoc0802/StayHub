import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { priceSnapshot, vietnamToday } from '../src/common/domain';
import {
  availabilityByNight,
  heldBookings,
} from '../src/bookings/availability';
import * as bcrypt from 'bcrypt';
import {
  demoAccounts,
  demoPasswords,
  demoAmenities,
  demoProperties,
  demoAccommodations,
} from './demo-data';

const prisma = new PrismaClient();
async function main() {
  const defaultPasswordHash = await bcrypt.hash('StayHub123!', 12);
  const users = new Map<string, { id: string; role: string; status: string }>();
  for (const [email, fullName, role, status] of demoAccounts) {
    const demoPassword = demoPasswords[email];
    const passwordHash = demoPassword
      ? await bcrypt.hash(demoPassword, 12)
      : defaultPasswordHash;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        fullName,
        role,
        status,
        passwordHash,
        phoneNumber: role === 'GUEST' ? '0900000001' : null,
      },
    });
    // Keep the three primary demo credentials fixed, including existing databases.
    // Avoid changing the hash/timestamps again when the password already matches.
    if (
      demoPassword &&
      !(await bcrypt.compare(demoPassword, user.passwordHash))
    ) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
    }
    users.set(email, user);
    if (role === 'GUEST')
      await prisma.user.updateMany({
        where: { id: user.id, fullName, phoneNumber: null },
        data: { phoneNumber: '0900000001' },
      });
  }
  // Replace only the original fictional display names, preserving IDs,
  // roles, approval decisions and any user-customized display name.
  for (const [email, legacyName] of [
    ['guest@stayhub.local', 'Nguyễn Minh Anh'],
    ['host@stayhub.local', 'Trần Hoàng Nam'],
    ['pendinghost@stayhub.local', 'Lê Thảo Nguyên'],
  ]) {
    await prisma.user.updateMany({
      where: { email, fullName: legacyName },
      data: { fullName: demoAccounts.find((a) => a[0] === email)![1] },
    });
  }
  for (const [code, nameVi] of demoAmenities) {
    await prisma.amenity.upsert({
      where: { code },
      update: {},
      create: { code, nameVi },
    });
  }
  const amenities = new Map(
    (await prisma.amenity.findMany()).map((a) => [a.code, a.id]),
  );
  let created = 0;
  let upgraded = 0;
  for (const {
    hostEmail,
    codes,
    images,
    roomTypes,
    ...data
  } of demoAccommodations) {
    const host = users.get(hostEmail)!;
    await prisma.$transaction(async (tx) => {
      let existing = await tx.property.findUnique({
        where: { id: data.id },
        include: { roomTypes: true },
      });
      if (!existing) {
        if (host.role !== 'HOST' || host.status !== 'ACTIVE')
          throw new Error('Demo host must be active');
        existing = await tx.property.create({
          data: {
            ...data,
            hostId: host.id,
            images: { create: images },
            amenities: {
              create: codes.map((code) => ({
                amenityId: amenities.get(code)!,
              })),
            },
            roomTypes: {
              create: roomTypes.map(({ propertyId, ...room }) => {
                void propertyId;
                return room;
              }),
            },
          },
          include: { roomTypes: true },
        });
        created++;
      } else {
        const original = demoProperties.find((p) => p.id === data.id)!;
        const migrated = existing.roomTypes[0];
        // Upgrade only an untouched fixture backfilled by the inventory migration.
        const untouched =
          existing.hostId === host.id &&
          existing.name === original.name &&
          existing.type === data.type &&
          existing.description === original.description &&
          existing.status === 'ACTIVE' &&
          existing.roomTypes.length === 1 &&
          migrated.id === data.id &&
          migrated.totalUnits === 1 &&
          migrated.description === original.description &&
          migrated.pricePerNight === original.pricePerNight &&
          migrated.maxGuests === original.maxGuests &&
          migrated.bedrooms === original.bedrooms &&
          migrated.beds === original.beds &&
          migrated.bathrooms === original.bathrooms &&
          migrated.name ===
            (data.type === 'HOTEL'
              ? 'Phòng tiêu chuẩn'
              : 'Nguyên căn homestay') &&
          migrated.status === 'ACTIVE';
        const oldDescriptions = [
          original.description,
          original.description.replace(
            'mỗi phòng demo là một đơn vị đặt độc lập.',
            'khách sạn có nhiều loại phòng để lựa chọn.',
          ),
        ];
        if (
          existing.hostId === host.id &&
          existing.name === original.name &&
          oldDescriptions.includes(existing.description) &&
          (existing.name !== data.name ||
            existing.description !== data.description)
        ) {
          await tx.property.update({
            where: { id: data.id },
            data: { name: data.name, description: data.description },
          });
        }
        if (untouched) {
          for (const room of roomTypes)
            await tx.roomType.upsert({
              where: { id: room.id },
              create: room,
              update: room,
            });
          upgraded++;
        }
      }
    });
  }
  const demoGuest = await prisma.user.upsert({
    where: { email: 'inventory-demo@stayhub.local' },
    update: {},
    create: {
      email: 'inventory-demo@stayhub.local',
      fullName: 'Khách minh họa lịch phòng',
      phoneNumber: '0900000002',
      role: 'GUEST',
      status: 'ACTIVE',
      passwordHash: defaultPasswordHash,
    },
  });
  const hotel = demoAccommodations.find((p) => p.type === 'HOTEL')!;
  await prisma.user.updateMany({
    where: {
      id: demoGuest.id,
      fullName: 'Khách minh họa lịch phòng',
      phoneNumber: null,
    },
    data: { phoneNumber: '0900000002' },
  });
  const homestay = demoAccommodations.find((p) => p.type === 'HOMESTAY')!;
  const day = (offset: number) =>
    new Date(new Date(vietnamToday()).getTime() + offset * 86400000);
  const scenarios = [
    { room: hotel.roomTypes[0], from: 14, to: 17, quantity: 5 },
    { room: hotel.roomTypes[1], from: 14, to: 17, quantity: 5 },
    { room: hotel.roomTypes[2], from: 15, to: 16, quantity: 3 },
    { room: homestay.roomTypes[0], from: 14, to: 16, quantity: 1 },
    { room: homestay.roomTypes[0], from: 16, to: 18, quantity: 1 },
    { room: hotel.roomTypes[0], from: 16, to: 18, quantity: 2 },
    { room: homestay.roomTypes[0], from: -10, to: -8, quantity: 1 },
    { room: hotel.roomTypes[0], from: 21, to: 23, quantity: 1 },
  ];
  for (const [index, scenario] of scenarios.entries()) {
    const id = '50000000-0000-4000-8000-' + String(index + 1).padStart(12, '0');
    if (await prisma.booking.findUnique({ where: { id } })) continue;
    const room = await prisma.roomType.findUnique({
      where: { id: scenario.room.id },
      include: { property: true },
    });
    if (!room || room.status !== 'ACTIVE' || room.property.status !== 'ACTIVE')
      continue;
    const checkIn = day(scenario.from),
      checkOut = day(scenario.to),
      now = new Date();
    const holds = await prisma.booking.findMany({
      where: {
        roomTypeId: room.id,
        ...heldBookings(now),
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
    });
    if (
      availabilityByNight(room.totalUnits, holds, checkIn, checkOut)
        .availableUnits < scenario.quantity
    )
      continue;
    const amounts = priceSnapshot(
      room.pricePerNight,
      room.property.depositPercent,
      scenario.to - scenario.from,
      scenario.quantity,
    );
    await prisma.booking.create({
      data: {
        id,
        bookingCode: `STB-DEMO${String(index + 1).padStart(8, '0')}`,
        customerNameSnapshot: demoGuest.fullName,
        customerPhoneSnapshot: demoGuest.phoneNumber ?? '0900000002',
        customerEmailSnapshot: demoGuest.email,
        propertyNameSnapshot: room.property.name,
        propertyAddressSnapshot: room.property.address,
        guestId: demoGuest.id,
        roomTypeId: room.id,
        roomTypeNameSnapshot: room.name,
        quantity: scenario.quantity,
        guestCount: scenario.quantity,
        checkIn,
        checkOut,
        checkInTimeSnapshot: room.property.checkInTime,
        checkOutTimeSnapshot: room.property.checkOutTime,
        paymentDeadlineAt: new Date(
          now.getTime() + (index === 7 ? 6 : 1) * 3600000,
        ),
        status: index === 7 ? 'PENDING_PAYMENT' : 'CONFIRMED',
        ...amounts,
        payment:
          index === 7
            ? undefined
            : {
                create: {
                  amount: amounts.depositAmount,
                  status: 'SUCCESS',
                  method: 'FAKE',
                  paidAt: now,
                },
              },
      },
    });
  }
  const reviewBooking = await prisma.booking.findUnique({
    where: { id: '50000000-0000-4000-8000-000000000007' },
    include: { roomType: true },
  });
  if (
    reviewBooking?.status === 'CONFIRMED' &&
    reviewBooking.guestId === demoGuest.id &&
    reviewBooking.checkOut < new Date()
  ) {
    await prisma.feedback.upsert({
      where: { bookingId: reviewBooking.id },
      update: {},
      create: {
        id: '60000000-0000-4000-8000-000000000001',
        bookingId: reviewBooking.id,
        guestId: demoGuest.id,
        propertyId: reviewBooking.roomType.propertyId,
        rating: 5,
        content:
          'Đánh giá tổng hợp cho demo: không gian sạch, thông tin đặt phòng rõ ràng và phù hợp chuyến nghỉ ngắn.',
      },
    });
  }
  console.info(
    JSON.stringify(
      {
        dataset: 'StayHub synthetic inventory demo',
        created,
        upgraded,
        properties: await prisma.property.count(),
        hotels: await prisma.property.count({ where: { type: 'HOTEL' } }),
        homestays: await prisma.property.count({ where: { type: 'HOMESTAY' } }),
        roomTypes: await prisma.roomType.count(),
        inventory: (
          await prisma.roomType.aggregate({ _sum: { totalUnits: true } })
        )._sum.totalUnits,
        districts: await prisma.property.groupBy({
          by: ['district'],
          _count: true,
        }),
        demoBookings: await prisma.booking.count({
          where: { guestId: demoGuest.id },
        }),
      },
      null,
      2,
    ),
  );
}
main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Demo seed failed');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
