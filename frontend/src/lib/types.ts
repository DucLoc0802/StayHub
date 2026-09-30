export type Role = 'GUEST' | 'HOST' | 'ADMIN';
export interface User {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: 'ACTIVE' | 'PENDING' | 'REJECTED';
  createdAt: string;
}
export interface Amenity {
  id: string;
  code: string;
  nameVi: string;
}
export interface PropertyImage {
  id: string;
  url: string;
  sortOrder: number;
}
export interface Property {
  id: string;
  hostId: string;
  name: string;
  description: string;
  type: 'HOMESTAY' | 'HOTEL';
  district: string;
  address: string;
  pricePerNight: number;
  depositPercent: number;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  status: 'ACTIVE' | 'INACTIVE';
  images: PropertyImage[];
  amenities: { amenity: Amenity; amenityId: string }[];
  unavailableDates?: { checkIn: string; checkOut: string }[];
}
export interface Booking {
  id: string;
  property: Property;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  totalNights: number;
  nightlyPriceSnapshot: number;
  totalAmount: number;
  depositPercentSnapshot: number;
  depositAmount: number;
  remainingAmount: number;
  status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED';
  payment: null | {
    id: string;
    amount: number;
    status: 'SUCCESS' | 'FAILED';
    paidAt: string;
  };
  guest?: { fullName: string; email: string };
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
export interface Session {
  accessToken: string;
  user: User;
}
