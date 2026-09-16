import { api } from './api';
import { Amenity, Booking, PageResult, Property, User } from './types';

export const authService = {
  login: (data: { email: string; password: string }) => api.post<{ accessToken: string; user: User }>('/auth/login', data).then((r) => r.data),
  register: (data: { email: string; password: string; fullName: string; role: 'GUEST' | 'HOST' }) => api.post<{ accessToken: string; user: User }>('/auth/register', data).then((r) => r.data),
  me: () => api.get<User>('/auth/me').then((r) => r.data),
};
export const propertyService = {
  list: (params?: Record<string, string | number | undefined>) => api.get<PageResult<Property>>('/properties', { params }).then((r) => r.data),
  detail: (id: string) => api.get<Property>(`/properties/${id}`).then((r) => r.data),
  amenities: () => api.get<Amenity[]>('/amenities').then((r) => r.data),
  hostList: () => api.get<Property[]>('/host/properties').then((r) => r.data),
  create: (data: PropertyInput) => api.post<Property>('/host/properties', data).then((r) => r.data),
  update: (id: string, data: Partial<PropertyInput>) => api.patch<Property>(`/host/properties/${id}`, data).then((r) => r.data),
  status: (id: string, status: 'ACTIVE' | 'INACTIVE') => api.patch<Property>(`/host/properties/${id}/status`, { status }).then((r) => r.data),
};
export interface PropertyInput { type: 'HOMESTAY' | 'HOTEL'; name: string; description: string; district: string; address: string; pricePerNight: number; depositPercent: number; maxGuests: number; bedrooms: number; beds: number; bathrooms: number; imageUrls: string[]; amenityCodes: string[] }
export const bookingService = {
  create: (data: { propertyId: string; checkIn: string; checkOut: string; guestCount: number }) => api.post<Booking>('/bookings', data).then((r) => r.data),
  my: () => api.get<Booking[]>('/bookings/my').then((r) => r.data),
  host: () => api.get<Booking[]>('/host/bookings').then((r) => r.data),
  pay: (id: string) => api.post(`/bookings/${id}/pay`).then((r) => r.data),
  cancel: (id: string) => api.patch<Booking>(`/bookings/${id}/cancel`).then((r) => r.data),
};
export const adminService = {
  hosts: () => api.get<(User & { createdAt: string })[]>('/admin/hosts').then((r) => r.data),
  approve: (id: string) => api.patch(`/admin/hosts/${id}/approve`).then((r) => r.data),
  reject: (id: string) => api.patch(`/admin/hosts/${id}/reject`).then((r) => r.data),
};
