export type Role = 'GUEST' | 'HOST' | 'ADMIN';
export interface User {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  role: Role;
  status: 'ACTIVE' | 'PENDING' | 'REJECTED';
  createdAt: string;
}
export interface Amenity {
  id: string;
  code: string;
  nameVi: string;
  active: boolean;
}
export interface PropertyImage {
  id: string;
  url: string;
  sortOrder: number;
}
export interface RoomType {
  id: string;
  propertyId: string;
  name: string;
  description: string;
  pricePerNight: number;
  totalUnits: number;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  status: 'ACTIVE' | 'INACTIVE';
}
export interface Availability {
  roomTypeId: string;
  totalUnits: number;
  availableUnits: number;
  serverNow: string;
  days: { date: string; availableUnits: number }[];
}
export interface CalendarPriceDay {
  date: string;
  pricePerNight: number | null;
  availableUnits: number;
}
export interface PropertyCalendar {
  serverNow: string;
  days: CalendarPriceDay[];
}
export interface PublicBooking {
  bookingCode: string;
  status: Booking['status'];
  propertyName: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  quantity: number;
  guestCount: number;
  paymentState: 'PAID' | 'UNPAID';
  paymentDeadlineAt?: string;
}
export interface BookingPolicy {
  paymentWindowOptions: number[];
  defaultPaymentWindowHours: number;
  minimumLeadTimeHours: number;
  maxActiveUnpaidBookings: number;
  lastMinuteThresholdHours: number;
  lastMinutePaymentWindowHours: number;
}
export interface Eligibility {
  activeUnpaidBookings: number;
  maxActiveUnpaidBookings: number;
  bookingBlockedUntil: string | null;
  canBook: boolean;
}
export interface Quote {
  roomTypeId: string;
  quantity: number;
  totalNights: number;
  nightlyPriceSnapshot: number;
  totalAmount: number;
  depositPercentSnapshot: number;
  depositAmount: number;
  remainingAmount: number;
  availableUnits: number;
  paymentDeadlineAt: string;
  serverNow: string;
}
export interface Property {
  slug?: string | null;
  id: string;
  hostId: string;
  name: string;
  description: string;
  type: 'HOMESTAY' | 'HOTEL';
  district: string;
  address: string;
  minPricePerNight: number | null;
  roomTypes: RoomType[];
  depositPercent: number;
  paymentWindowHours: number;
  checkInTime: string;
  checkOutTime: string;
  status: 'ACTIVE' | 'INACTIVE';
  images: PropertyImage[];
  amenities: { amenity: Amenity; amenityId: string }[];
}
export interface Booking {
  id: string;
  guestId?: string;
  bookingCode: string;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string;
  customerEmailSnapshot: string;
  propertyNameSnapshot: string;
  propertyAddressSnapshot: string;
  feedback: Feedback | null;
  property: Pick<
    Property,
    'id' | 'slug' | 'name' | 'type' | 'district' | 'address' | 'images'
  >;
  roomType: RoomType;
  roomTypeId: string;
  roomTypeNameSnapshot: string;
  quantity: number;
  paymentDeadlineAt: string;
  expiredAt: string | null;
  cancelledAt: string | null;
  checkIn: string;
  checkOut: string;
  checkInTimeSnapshot: string;
  checkOutTimeSnapshot: string;
  guestCount: number;
  totalNights: number;
  nightlyPriceSnapshot: number;
  totalAmount: number;
  depositPercentSnapshot: number;
  depositAmount: number;
  remainingAmount: number;
  status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
  payment: null | {
    id: string;
    amount: number;
    status: 'SUCCESS' | 'FAILED';
    paidAt: string;
    method: 'FAKE';
  };
  guest?: { fullName: string; email: string };
}
export interface Feedback {
  id: string;
  rating: number;
  content: string;
  createdAt: string;
}
export interface FeedbackSummary {
  averageRating: number | null;
  count: number;
  items: (Feedback & { guest: { fullName: string } })[];
}
export interface DemoPayment {
  booking: Booking;
  qrDataUrl: string;
  serverNow: string;
  payload: {
    mode: 'DEMO';
    currency: 'VND';
    amount: number;
    reference: string;
    description: string;
  };
}
export interface AdminStatistics {
  guests: number;
  hosts: number;
  properties: number;
  roomTypes: number;
  totalBookings: number;
  confirmed: number;
  pending: number;
  expired: number;
  cancelled: number;
  successfulDepositAmount: number;
}
export interface AdminPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
export interface CustomerHistory {
  user: User;
  totalBookings: number;
  confirmed: number;
  pending: number;
  expired: number;
  cancelled: number;
  successfulDepositAmount: number;
  recentBookings: Booking[];
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
