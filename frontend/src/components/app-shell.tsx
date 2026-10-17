'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { House, LogOut, UserRound } from 'lucide-react';
import { roleAccount, roleHome } from '@/lib/role-routes';
import { useAuth } from './providers';
import { Header } from './header';
import { Footer } from './footer';
import { Button } from './ui/button';
import { RoleBoundary } from './role-boundary';
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const management = user?.role === 'ADMIN' || user?.role === 'HOST';
  return (
    <>
      {management ? (
        <header className="border-b bg-white">
          <div className="container-shell flex min-h-18 flex-wrap items-center justify-between gap-3 py-3">
            <Link
              href={roleHome(user.role)}
              className="flex items-center gap-2 text-xl font-bold"
            >
              <House
                aria-hidden="true"
                size={24}
                className="text-secondary-foreground"
              />
              StayHub{' '}
              <span className="ml-1 border-l pl-3 text-sm font-medium text-muted-foreground">
                {user.role === 'ADMIN' ? 'Quản trị' : 'Chủ cơ sở'}
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost">
                <Link href={roleAccount(user.role)}>
                  <UserRound size={16} />
                  <span className="max-w-36 truncate">{user.fullName}</span>
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  logout();
                  router.replace('/login');
                }}
              >
                <LogOut size={16} />
                Đăng xuất
              </Button>
            </div>
          </div>
        </header>
      ) : loading ? (
        <header className="border-b bg-white">
          <div className="container-shell py-5 text-xl font-bold">StayHub</div>
        </header>
      ) : (
        <Header />
      )}
      <main id="main" className="min-h-[65vh]">
        <RoleBoundary>{children}</RoleBoundary>
      </main>
      {management ? (
        <footer className="container-shell border-t py-6 text-xs text-muted-foreground">
          StayHub ·{' '}
          {user.role === 'ADMIN' ? 'Khu vực quản trị' : 'Khu vực chủ cơ sở'}
        </footer>
      ) : (
        !loading && <Footer />
      )}
    </>
  );
}
