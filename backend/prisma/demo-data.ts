import type { AccountStatus, Role } from '@prisma/client';
export const demoAmenities = [
  ['WIFI', 'Wi-Fi'],
  ['AIR_CONDITIONING', 'Máy lạnh'],
  ['PARKING', 'Chỗ đậu xe'],
  ['KITCHEN', 'Bếp'],
  ['SWIMMING_POOL', 'Hồ bơi'],
  ['TV', 'TV'],
  ['WASHING_MACHINE', 'Máy giặt'],
  ['BALCONY', 'Ban công'],
  ['FRIDGE', 'Tủ lạnh'],
  ['ELEVATOR', 'Thang máy'],
  ['GYM', 'Phòng gym'],
  ['WORKSPACE', 'Bàn làm việc'],
  ['HAIR_DRYER', 'Máy sấy tóc'],
  ['HOT_WATER', 'Nước nóng'],
] as const;

// Fictional local-development personas; passwords are supplied by environment.
export const demoAccounts: [string, string, Role, AccountStatus][] = [
  ['admin@stayhub.local', 'Quản trị demo StayHub', 'ADMIN', 'ACTIVE'],
  ['guest@stayhub.local', 'Nguyễn Minh Anh', 'GUEST', 'ACTIVE'],
  ['guest.lan@stayhub.local', 'Phạm Ngọc Lan', 'GUEST', 'ACTIVE'],
  ['host@stayhub.local', 'Trần Thảo An', 'HOST', 'ACTIVE'],
  ['host.east@stayhub.local', 'Nguyễn Minh Châu', 'HOST', 'ACTIVE'],
  ['host.south@stayhub.local', 'Lê Bình An', 'HOST', 'ACTIVE'],
  ['host.hoangthanh@stayhub.local', 'Hoàng Thanh Tùng', 'HOST', 'ACTIVE'],
];
const specs = [
  [
    'Homestay An Nhiên',
    'host@stayhub.local',
    'HOMESTAY',
    'Quận 3',
    'Võ Văn Tần',
    750000,
  ],
  [
    'Khách sạn Minh Châu',
    'host.east@stayhub.local',
    'HOTEL',
    'Thủ Đức',
    'Võ Văn Ngân',
    620000,
  ],
  [
    'Nhà nghỉ Bình An',
    'host.south@stayhub.local',
    'HOTEL',
    'Quận 7',
    'Lâm Văn Bền',
    380000,
  ],
  [
    'Khách sạn Hoàng Thành 1',
    'host.hoangthanh@stayhub.local',
    'HOTEL',
    'Quận 1',
    'Nguyễn Văn Thủ',
    850000,
  ],
  [
    'Khách sạn Hoàng Thành 2',
    'host.hoangthanh@stayhub.local',
    'HOTEL',
    'Bình Thạnh',
    'Nguyễn Gia Trí',
    720000,
  ],
] as const;
export const demoAccommodations = specs.map(
  ([name, hostEmail, type, district, street, price], index) => {
    const id = `71000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
    return {
      id,
      hostEmail,
      name,
      type,
      district,
      address: `Khu vực đường ${street}, ${district}, TP. Hồ Chí Minh (địa chỉ demo)`,
      description: `${name} ${type === 'HOMESTAY' ? 'là căn nghỉ riêng với bếp và ban công, phù hợp hai khách.' : 'có phòng đôi và phòng gia đình, phòng tắm riêng, bàn làm việc và nước nóng.'} ${index >= 3 ? 'Hai cơ sở Hoàng Thành thuộc cùng một đơn vị vận hành.' : 'Cơ sở do chủ nhà độc lập vận hành.'} Nhận phòng từ 14:00, trả phòng trước 12:00. Tên, địa chỉ, ảnh và giá là dữ liệu tổng hợp cho demo StayHub, không phải tin đăng thật.`,
      depositPercent: 30,
      paymentWindowHours: 6,
      checkInTime: '14:00',
      checkOutTime: '12:00',
      status: 'ACTIVE' as const,
      codes:
        type === 'HOMESTAY'
          ? ['WIFI', 'AIR_CONDITIONING', 'HOT_WATER', 'KITCHEN', 'BALCONY']
          : ['WIFI', 'AIR_CONDITIONING', 'HOT_WATER', 'TV', 'WORKSPACE'],
      images: [
        'photo-1611892440504-42a792e24d32',
        'photo-1600210492486-724fe5c67fb0',
        'photo-1600566753086-00f18fb6b3ea',
      ].map((photo, sortOrder) => ({
        url: `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1400&q=85`,
        sortOrder,
      })),
      roomTypes: (type === 'HOMESTAY' ? [0] : [0, 1, 2]).map((n) => ({
        id: `${72 + n}000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        propertyId: id,
        name:
          type === 'HOMESTAY'
            ? 'Nguyên căn homestay'
            : ['Phòng đôi tiêu chuẩn', 'Phòng đôi cao cấp', 'Phòng gia đình'][
                n
              ],
        description:
          type === 'HOMESTAY'
            ? 'Một phòng ngủ, bếp riêng và ban công.'
            : n === 2
              ? 'Hai giường đôi, phòng tắm riêng cho gia đình bốn người.'
              : 'Một giường đôi, phòng tắm riêng và bàn làm việc.',
        pricePerNight: Math.round((price * [1, 1.3, 1.7][n]) / 10000) * 10000,
        totalUnits: type === 'HOMESTAY' ? 1 : [4, 3, 2][n],
        maxGuests: n === 2 ? 4 : 2,
        bedrooms: 1,
        beds: n === 2 ? 2 : 1,
        bathrooms: 1,
        status: 'ACTIVE' as const,
      })),
    };
  },
);
