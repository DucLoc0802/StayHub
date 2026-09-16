import { AccountStatus, PrismaClient, PropertyStatus, PropertyType, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const amenities = [
  ['WIFI', 'Wi-Fi'],
  ['AIR_CONDITIONING', 'Điều hòa'],
  ['PARKING', 'Bãi đỗ xe'],
  ['KITCHEN', 'Nhà bếp'],
  ['SWIMMING_POOL', 'Hồ bơi'],
  ['TV', 'TV'],
  ['WASHING_MACHINE', 'Máy giặt'],
  ['BALCONY', 'Ban công'],
] as const;

async function main() {
  const passwordHash = await bcrypt.hash('StayHub123!', 10);
  const users = await Promise.all([
    prisma.user.upsert({ where: { email: 'admin@stayhub.local' }, update: {}, create: { email: 'admin@stayhub.local', fullName: 'Quản trị StayHub', passwordHash, role: Role.ADMIN, status: AccountStatus.ACTIVE } }),
    prisma.user.upsert({ where: { email: 'guest@stayhub.local' }, update: {}, create: { email: 'guest@stayhub.local', fullName: 'Khách Demo', passwordHash, role: Role.GUEST, status: AccountStatus.ACTIVE } }),
    prisma.user.upsert({ where: { email: 'host@stayhub.local' }, update: {}, create: { email: 'host@stayhub.local', fullName: 'Chủ nhà Demo', passwordHash, role: Role.HOST, status: AccountStatus.ACTIVE } }),
    prisma.user.upsert({ where: { email: 'pendinghost@stayhub.local' }, update: { status: AccountStatus.PENDING }, create: { email: 'pendinghost@stayhub.local', fullName: 'Chủ nhà Chờ duyệt', passwordHash, role: Role.HOST, status: AccountStatus.PENDING } }),
  ]);
  const host = users[2];

  const amenityRows = await Promise.all(amenities.map(([code, nameVi]) => prisma.amenity.upsert({ where: { code }, update: { nameVi }, create: { code, nameVi } })));
  const amenityMap = new Map(amenityRows.map((item) => [item.code, item.id]));

  if ((await prisma.property.count()) === 0) {
    const properties = [
      { type: PropertyType.HOMESTAY, name: 'Nhà hồng bên sông Sài Gòn', district: 'Quận 1', address: '18 Tôn Đức Thắng, Quận 1, TP.HCM', description: 'Không gian ấm cúng bên sông, gần phố đi bộ và trung tâm thành phố.', pricePerNight: 950000, depositPercent: 30, maxGuests: 4, bedrooms: 2, beds: 2, bathrooms: 1, amenities: ['WIFI', 'AIR_CONDITIONING', 'KITCHEN', 'BALCONY'], images: ['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1400&q=80', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80'] },
      { type: PropertyType.HOTEL, name: 'Central Hotel - Phòng Deluxe', district: 'Quận 3', address: '126 Võ Văn Tần, Quận 3, TP.HCM', description: 'Phòng Deluxe hiện đại, yên tĩnh, thuận tiện khám phá các điểm đến trung tâm.', pricePerNight: 1250000, depositPercent: 40, maxGuests: 2, bedrooms: 1, beds: 1, bathrooms: 1, amenities: ['WIFI', 'AIR_CONDITIONING', 'TV', 'PARKING'], images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80', 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1400&q=80'] },
      { type: PropertyType.HOMESTAY, name: 'Thảo Điền Garden Home', district: 'Thành phố Thủ Đức', address: '42 Nguyễn Văn Hưởng, Thảo Điền, TP. Thủ Đức, TP.HCM', description: 'Căn nhà nhiều cây xanh với bếp riêng và ban công thoáng mát.', pricePerNight: 1650000, depositPercent: 25, maxGuests: 6, bedrooms: 3, beds: 3, bathrooms: 2, amenities: ['WIFI', 'AIR_CONDITIONING', 'KITCHEN', 'WASHING_MACHINE', 'BALCONY'], images: ['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80', 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1400&q=80'] },
      { type: PropertyType.HOTEL, name: 'Phú Mỹ Hưng Boutique - Studio', district: 'Quận 7', address: '88 Hà Huy Tập, Quận 7, TP.HCM', description: 'Studio boutique thanh lịch gần khu đô thị Phú Mỹ Hưng, có hồ bơi chung.', pricePerNight: 1100000, depositPercent: 50, maxGuests: 3, bedrooms: 1, beds: 2, bathrooms: 1, amenities: ['WIFI', 'AIR_CONDITIONING', 'SWIMMING_POOL', 'TV'], images: ['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80', 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1400&q=80'] },
    ];
    for (const item of properties) {
      await prisma.property.create({ data: { hostId: host.id, type: item.type, name: item.name, district: item.district, address: item.address, description: item.description, pricePerNight: item.pricePerNight, depositPercent: item.depositPercent, maxGuests: item.maxGuests, bedrooms: item.bedrooms, beds: item.beds, bathrooms: item.bathrooms, status: PropertyStatus.ACTIVE, images: { create: item.images.map((url, sortOrder) => ({ url, sortOrder })) }, propertyAmenities: { create: item.amenities.map((code) => ({ amenityId: amenityMap.get(code)! })) } } });
    }
  }
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
