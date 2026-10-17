'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireAuth } from '@/components/require-auth';
import { HostPropertyScope } from '@/components/host-property-scope';
import { useAuth } from '@/components/providers';
import { AccountScreen } from '@/components/account-screen';
export default function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  if (
    user?.role === 'HOST' &&
    user.status === 'ACTIVE' &&
    pathname === '/host/account'
  )
    return <RequireAuth role="HOST">{children}</RequireAuth>;
  if (user?.role === 'HOST' && user.status !== 'ACTIVE')
    return (
      <RequireAuth role="HOST" allowInactive>
        <AccountScreen />
      </RequireAuth>
    );
  const bookingsActive = pathname.startsWith('/host/bookings');
  return (
    <RequireAuth role="HOST">
      <div className="container-shell py-6 md:py-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Quản lý chỗ nghỉ
        </h1>
        <nav
          aria-label="Quản lý chỗ nghỉ"
          className="mb-6 mt-4 flex gap-6 border-b text-sm font-medium"
        >
          <Link
            aria-current={!bookingsActive ? 'page' : undefined}
            className={`min-h-11 border-b-2 py-3 ${!bookingsActive ? '!border-primary font-semibold text-secondary-foreground' : '!border-transparent text-muted-foreground hover:text-foreground'}`}
            href="/host"
          >
            Chỗ nghỉ của tôi
          </Link>
          <Link
            aria-current={bookingsActive ? 'page' : undefined}
            className={`min-h-11 border-b-2 py-3 ${bookingsActive ? '!border-primary font-semibold text-secondary-foreground' : '!border-transparent text-muted-foreground hover:text-foreground'}`}
            href="/host/bookings"
          >
            Đặt phòng
          </Link>
        </nav>
        <HostPropertyScope>
          {/^\/host\/bookings\/[^/]+$/.test(pathname) ? (
            children
          ) : (
            <div className="panel p-5 sm:p-6">{children}</div>
          )}
        </HostPropertyScope>
      </div>
    </RequireAuth>
  );
}
