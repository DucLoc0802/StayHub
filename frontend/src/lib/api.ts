import axios from 'axios';
import type { Amenity, Booking, Page, Property, Session, User } from './types';
export const tokenKey = 'stayhub.accessToken';
const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api',
  timeout: 15000,
});
client.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(tokenKey);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      !error.config?.url?.includes('/auth/login')
    ) {
      localStorage.removeItem(tokenKey);
      window.dispatchEvent(new Event('stayhub:logout'));
    }
    return Promise.reject(error);
  },
);
const get = async <T>(url: string, params?: object) =>
  (await client.get<T>(url, { params })).data;
const post = async <T>(url: string, body?: unknown) =>
  (await client.post<T>(url, body)).data;
const patch = async <T>(url: string, body?: unknown) =>
  (await client.patch<T>(url, body)).data;
export const api = {
  me: () => get<User>('/auth/me'),
  login: (body: unknown) => post<Session>('/auth/login', body),
  register: (body: unknown) => post<Session>('/auth/register', body),
  amenities: () => get<Amenity[]>('/amenities'),
  properties: (params?: object) => get<Page<Property>>('/properties', params),
  property: (id: string) => get<Property>(`/properties/${id}`),
  myProperties: () => get<Property[]>('/host/properties'),
  ownedProperty: (id: string) => get<Property>(`/host/properties/${id}`),
  saveProperty: (body: unknown, id?: string) =>
    id
      ? patch<Property>(`/host/properties/${id}`, body)
      : post<Property>('/host/properties', body),
  propertyStatus: (id: string, status: string) =>
    patch<Property>(`/host/properties/${id}/status`, { status }),
  bookings: () => get<Booking[]>('/bookings/my'),
  hostBookings: () => get<Booking[]>('/host/bookings'),
  createBooking: (body: unknown) => post<Booking>('/bookings', body),
  pay: (id: string) => post<Booking>(`/bookings/${id}/pay`),
  cancel: (id: string) => patch<Booking>(`/bookings/${id}/cancel`),
  pendingHosts: () => get<User[]>('/admin/hosts'),
  decideHost: (id: string, action: 'approve' | 'reject') =>
    patch(`/admin/hosts/${id}/${action}`),
};
export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(' ');
    if (typeof message === 'string') return message;
    return 'Không thể kết nối máy chủ. Vui lòng thử lại sau.';
  }
  return error instanceof Error
    ? error.message
    : 'Có lỗi xảy ra. Vui lòng thử lại.';
}
