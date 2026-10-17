import type { Role, User } from './types';
export const roleHome = (role: Role) =>
  role === 'ADMIN' ? '/admin' : role === 'HOST' ? '/host' : '/properties';
export const roleAccount = (role: Role) =>
  role === 'ADMIN'
    ? '/admin/account'
    : role === 'HOST'
      ? '/host/account'
      : '/account';
export function customerDestination(next: string | null) {
  if (
    !next ||
    !/^\/(properties|bookings|account)(?:\/|\?|#|$)/.test(next) ||
    next.includes('\\')
  )
    return '/properties';
  return next;
}
export function roleRedirect(
  user: Pick<User, 'role' | 'status'>,
  pathname: string,
) {
  if (user.role === 'ADMIN')
    return pathname === '/admin' || pathname.startsWith('/admin/')
      ? null
      : '/admin';
  if (user.role === 'HOST') {
    if (user.status !== 'ACTIVE')
      return pathname === '/host' || pathname === '/host/account'
        ? null
        : '/host';
    return pathname === '/host' || pathname.startsWith('/host/')
      ? null
      : '/host';
  }
  return /^\/(admin|host)(?:\/|$)/.test(pathname) ? '/properties' : null;
}
