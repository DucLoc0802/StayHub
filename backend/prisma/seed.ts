import 'dotenv/config';
import { PrismaClient, Role, AccountStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const prisma = new PrismaClient();
async function main() {
  const passwordHash = await bcrypt.hash('StayHub123!', 12);
  const accounts: [string, string, Role, AccountStatus][] = [
    ['admin@stayhub.local', 'Quản trị StayHub', 'ADMIN', 'ACTIVE'],
    ['guest@stayhub.local', 'Nguyễn Minh Anh', 'GUEST', 'ACTIVE'],
    ['host@stayhub.local', 'Trần Hoàng Nam', 'HOST', 'ACTIVE'],
    ['pendinghost@stayhub.local', 'Lê Thảo Nguyên', 'HOST', 'PENDING'],
  ];
  for (const [email, fullName, role, status] of accounts)
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, fullName, role, status, passwordHash },
    });
  const host = await prisma.user.findUniqueOrThrow({
    where: { email: 'host@stayhub.local' },
  });
  const amenities = [
    ['WIFI', 'Wi-Fi'],
    ['AIR_CONDITIONING', 'Điều hòa'],
    ['PARKING', 'Bãi đỗ xe'],
    ['KITCHEN', 'Nhà bếp'],
    ['SWIMMING_POOL', 'Hồ bơi'],
    ['TV', 'TV'],
    ['WASHING_MACHINE', 'Máy giặt'],
    ['BALCONY', 'Ban công'],
  ];
  for (const [code, nameVi] of amenities)
    await prisma.amenity.upsert({
      where: { code },
      update: { nameVi },
      create: { code, nameVi },
    });
  const allAmenities = await prisma.amenity.findMany();
  const listings = [
    {
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Nắng Sài Gòn · Căn hộ ban công',
      district: 'Quận 1',
      address: '18 Nguyễn Văn Thủ, Đa Kao, TP. Hồ Chí Minh',
      type: 'HOMESTAY' as const,
      pricePerNight: 850000,
      depositPercent: 30,
      maxGuests: 2,
      photo: 'photo-1600210492486-724fe5c67fb0',
      codes: ['WIFI', 'AIR_CONDITIONING', 'KITCHEN', 'BALCONY'],
    },
    {
      id: '10000000-0000-4000-8000-000000000002',
      name: 'An Nhiên · Studio bên ô cửa',
      district: 'Quận 3',
      address: '42 Võ Văn Tần, TP. Hồ Chí Minh',
      type: 'HOMESTAY' as const,
      pricePerNight: 650000,
      depositPercent: 20,
      maxGuests: 2,
      photo: 'photo-1616486338812-3dadae4b4ace',
      codes: ['WIFI', 'AIR_CONDITIONING', 'KITCHEN', 'WASHING_MACHINE'],
    },
    {
      id: '10000000-0000-4000-8000-000000000003',
      name: 'The Mộc Hotel · Phòng Deluxe',
      district: 'Bình Thạnh',
      address: '65 Nguyễn Gia Trí, TP. Hồ Chí Minh',
      type: 'HOTEL' as const,
      pricePerNight: 1200000,
      depositPercent: 40,
      maxGuests: 3,
      photo: 'photo-1611892440504-42a792e24d32',
      codes: ['WIFI', 'AIR_CONDITIONING', 'PARKING', 'TV'],
    },
    {
      id: '10000000-0000-4000-8000-000000000004',
      name: 'Riverside · Góc bình yên',
      district: 'Thủ Đức',
      address: '28 Nguyễn Văn Hưởng, Thảo Điền, TP. Hồ Chí Minh',
      type: 'HOMESTAY' as const,
      pricePerNight: 1450000,
      depositPercent: 50,
      maxGuests: 4,
      photo: 'photo-1600607687939-ce8a6c25118c',
      codes: [
        'WIFI',
        'AIR_CONDITIONING',
        'SWIMMING_POOL',
        'BALCONY',
        'KITCHEN',
      ],
    },
  ];
  for (const { photo, codes, ...data } of listings)
    await prisma.property.upsert({
      where: { id: data.id },
      update: {},
      create: {
        ...data,
        hostId: host.id,
        description:
          'Một không gian sáng thoáng, ấm áp và riêng tư để bạn tận hưởng nhịp sống Sài Gòn theo cách của mình. Nội thất gỗ tự nhiên, giường ngủ êm ái cùng những tiện nghi cần thiết cho chuyến đi. Gần các quán cà phê, nhà hàng và điểm khám phá địa phương. Toàn bộ chỗ nghỉ dành riêng cho nhóm của bạn. Nhận phòng từ 14:00, trả phòng trước 12:00. Vui lòng giữ yên tĩnh sau 22:00.',
        bedrooms: data.maxGuests > 3 ? 2 : 1,
        beds: data.maxGuests > 2 ? 2 : 1,
        bathrooms: 1,
        images: {
          create: [
            photo,
            'photo-1615874959474-d609969a20ed',
            'photo-1600566753086-00f18fb6b3ea',
          ].map((image, sortOrder) => ({
            url: `https://images.unsplash.com/${image}?auto=format&fit=crop&w=1400&q=85`,
            sortOrder,
          })),
        },
        amenities: {
          create: allAmenities
            .filter((a) => codes.includes(a.code))
            .map((a) => ({ amenityId: a.id })),
        },
      },
    });
  console.info(
    'Đã tạo dữ liệu demo StayHub (không ghi đè tài khoản/chỗ nghỉ đã có).',
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
