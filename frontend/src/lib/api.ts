import axios from 'axios';
import { resolveApiUrl } from './api-config';
import type {
  Amenity,
  Availability,
  Booking,
  BookingPolicy,
  Eligibility,
  Quote,
  Page,
  Property,
  Session,
  User,
  CheckoutPayment,
  AdminStatistics,
  AdminPage,
  CustomerHistory,
  PropertyCalendar,
  PublicBooking,
} from './types';
export const tokenKey = 'stayhub.accessToken';
const client = axios.create({
  baseURL: resolveApiUrl(
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NODE_ENV === 'production',
  ),
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
  updateProfile: (body: { fullName: string; phoneNumber: string }) =>
    patch<User>('/auth/profile', body),
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
  bookingPolicy: () => get<BookingPolicy>('/bookings/policy'),
  eligibility: () => get<Eligibility>('/bookings/eligibility'),
  availability: (id: string, params: object) =>
    get<Availability>(`/room-types/${id}/availability`, params),
  propertyCalendar: (id: string, params: object) =>
    get<PropertyCalendar>(`/properties/${id}/calendar`, params),
  quote: (id: string, params: object) =>
    get<Quote>(`/room-types/${id}/quote`, params),
  bookings: () => get<Booking[]>('/bookings/my'),
  pendingPayments: () => get<Booking[]>('/bookings/pending-payments'),
  hostBookings: (propertyId?: string) =>
    get<Booking[]>('/host/bookings', { propertyId }),
  createBooking: (body: unknown) => post<Booking>('/bookings', body),
  submitTransfer: (
    id: string,
    body: { transactionRef: string; evidenceNote?: string },
  ) => post<Booking>(`/bookings/${id}/payment-claims`, body),
  lookupBooking: (code: string) =>
    get<Booking>(`/bookings/lookup/${encodeURIComponent(code)}`),
  publicLookup: (body: { bookingCode: string; email: string }) =>
    post<PublicBooking>('/booking-lookup', body),
  booking: (id: string) => get<Booking>(`/bookings/${id}`),
  checkout: (id: string) => get<CheckoutPayment>(`/bookings/${id}/payment`),
  hostBooking: (id: string) => get<Booking>(`/host/bookings/${id}`),
  reconcilePayment: (
    bookingId: string,
    claimId: string,
    body: {
      decision: 'VERIFY' | 'REJECT' | 'RESOLUTION_REQUIRED';
      reason?: string;
      receivedAmount?: number;
      verifiedTransactionRef?: string;
    },
  ) =>
    post<Booking>(
      `/admin/bookings/${bookingId}/payment-claims/${claimId}/reconcile`,
      body,
    ),
  adminProperty: (id: string) =>
    get<Property & { host: { id: string; fullName: string } }>(
      `/admin/properties/${id}`,
    ),
  adminProperties: (params?: object) =>
    get<AdminPage<Property & { host: { id: string; fullName: string } }>>(
      '/admin/properties',
      params,
    ),
  invoice: (id: string) => get<Booking>(`/bookings/${id}/invoice`),
  adminStatistics: () => get<AdminStatistics>('/admin/statistics'),
  adminUsers: (params?: object) => get<AdminPage<User>>('/admin/users', params),
  changeUser: (
    id: string,
    body: { role?: 'HOST'; status?: 'ACTIVE' | 'REJECTED' },
  ) => patch<User>(`/admin/users/${id}`, body),
  customerHistory: (id: string) =>
    get<CustomerHistory>(`/admin/customers/${id}/history`),
  adminBookings: (params?: object) =>
    get<AdminPage<Booking>>('/admin/bookings', params),
  adminBooking: (id: string) => get<Booking>(`/admin/bookings/${id}`),
  adminBookingFilters: () =>
    get<
      { id: string; name: string; hostId: string; host: { fullName: string } }[]
    >('/admin/booking-filters'),
  adminAmenities: () => get<Amenity[]>('/admin/amenities'),
  saveAmenity: (
    body: Partial<Pick<Amenity, 'code' | 'nameVi' | 'active'>>,
    id?: string,
  ) =>
    id
      ? patch<Amenity>(`/admin/amenities/${id}`, body)
      : post<Amenity>('/admin/amenities', body),
  cancel: (id: string) => patch<Booking>(`/bookings/${id}/cancel`),
  pendingHosts: () => get<User[]>('/admin/hosts'),
  decideHost: (id: string, action: 'approve' | 'reject') =>
    patch(`/admin/hosts/${id}/${action}`),
};
export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (!error.response)
      return 'Không thể kết nối máy chủ. Kiểm tra kết nối và thử lại; thông tin đặt phòng đã lưu sẽ được giữ nguyên.';
    if (status === 401)
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (status === 403)
      return 'Tài khoản này không có quyền truy cập thông tin được yêu cầu.';
    if (status === 502 || status === 504)
      return 'Máy chủ phản hồi chậm hoặc đang tạm ngừng. Vui lòng thử lại sau.';
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(' ');
    if (typeof message === 'string') return message;
    return 'Không thể kết nối máy chủ. Vui lòng thử lại sau.';
  }
  return error instanceof Error
    ? error.message
    : 'Có lỗi xảy ra. Vui lòng thử lại.';
}
