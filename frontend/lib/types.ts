export type Role = 'GUEST' | 'HOST' | 'ADMIN';
export type AccountStatus = 'PENDING' | 'ACTIVE' | 'REJECTED';
export interface User { id: string; email: string; fullName: string; role: Role; status: AccountStatus }
export interface Amenity { id: string; code: string; nameVi: string }
export interface PropertyImage { id: string; url: string; sortOrder: number }
export interface Property { id: string; hostId: string; type: 'HOMESTAY' | 'HOTEL'; name: string; description: string; district: string; address: string; pricePerNight: number; depositPercent: number; maxGuests: number; bedrooms: number; beds: number; bathrooms: number; status: 'ACTIVE' | 'INACTIVE'; images: PropertyImage[]; propertyAmenities: { amenity: Amenity }[] }
export interface Booking { id: string; checkIn: string; checkOut: string; guestCount: number; nightlyPriceSnapshot: number; totalNights: number; totalAmount: number; depositPercentSnapshot: number; depositAmount: number; remainingAmount: number; status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED'; property: Property; payments: { id: string; status: 'SUCCESS' | 'FAILED'; amount: number }[]; guest?: { fullName: string; email: string } }
export interface PageResult<T> { items: T[]; meta: { page: number; limit: number; total: number; totalPages: number } }
