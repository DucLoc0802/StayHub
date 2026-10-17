// Distinct illustrative Unsplash photographs, grouped in accommodation order.
// Sources and the verified production refresh are recorded in PROPERTY_IMAGE_SOURCES.md.
export const demoPhotoSets = [
  [
    'photo-1522771739844-6a9f6d5f14af', // An Nhien: bedroom
    'photo-1484101403633-562f891dc89a', // living room
    'photo-1556911220-bff31c812dba', // kitchen
  ],
  [
    'photo-1631049307264-da0ec9d70304', // Minh Chau: bedroom
    'photo-1583847268964-b28dc8f51f92', // sitting area
    'photo-1560448075-bb485b067938', // bathroom
  ],
  [
    'photo-1566665797739-1674de7a421a', // Binh An: bedroom
    'photo-1582719478250-c89cae4dc85b', // second bedroom
    'photo-1586023492125-27b2c045efd7', // sitting area
  ],
  [
    'photo-1590490360182-c33d57733427', // Hoang Thanh 1: bedroom
    'photo-1616594039964-ae9021a400a0', // second bedroom
    'photo-1564540583246-934409427776', // bathroom
  ],
  [
    'photo-1618773928121-c32242e63f39', // Hoang Thanh 2: bedroom
    'photo-1505693416388-ac5ce068fe85', // second bedroom
    'photo-1560448204-e02f11c3d0e2', // living room
  ],
] as const;

export const demoImageUrl = (photo: string) =>
  `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1400&q=85`;

export const retiredDemoPhotoIds = [
  'photo-1611892440504-42a792e24d32',
  'photo-1600210492486-724fe5c67fb0',
  'photo-1600566753086-00f18fb6b3ea',
] as const;
