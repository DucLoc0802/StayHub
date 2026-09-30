'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import {
  ArrowUpRight,
  ChevronDown,
  House,
  LogOut,
  Menu,
  Search,
  UserRound,
} from 'lucide-react';
import { useAuth } from './providers';
import { Button } from './ui/button';
export function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const itemClass =
    'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm outline-none focus:bg-accent cursor-pointer';
  return (
    <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur-md">
      <div className="container-shell flex h-20 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-2xl font-bold tracking-tight"
          aria-label="StayHub — Trang chủ"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary">
            <House size={23} strokeWidth={2} />
          </span>
          stayhub<span className="text-primary-hover">.</span>
        </Link>
        <nav
          aria-label="Điều hướng chính"
          className="hidden items-center gap-8 text-sm md:flex"
        >
          <Link
            href="/properties"
            className={
              pathname.startsWith('/properties')
                ? 'font-semibold text-secondary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }
          >
            Khám phá chỗ nghỉ
          </Link>
          <span className="hidden text-xs text-muted-foreground lg:block">
            Một chút Sài Gòn, một nơi để về.
          </span>
        </nav>
        <div className="flex items-center gap-3">
          {!user && (
            <>
              <Link
                href="/register?role=HOST"
                className="hidden items-center gap-1 text-xs font-medium lg:flex"
              >
                Trở thành người cho thuê
                <ArrowUpRight size={15} />
              </Link>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href="/login">Đăng nhập</Link>
              </Button>
              <Button asChild className="hidden sm:inline-flex">
                <Link href="/register">Đăng ký</Link>
              </Button>
            </>
          )}
          <Dropdown.Root>
            <Dropdown.Trigger asChild>
              <Button
                variant="outline"
                className={user ? 'max-w-52' : 'sm:hidden'}
                aria-label="Mở menu tài khoản"
              >
                {user ? (
                  <>
                    <UserRound size={17} />
                    <span className="hidden truncate sm:block">
                      {user.fullName}
                    </span>
                    <ChevronDown size={14} />
                  </>
                ) : (
                  <Menu size={20} />
                )}
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Content
                align="end"
                sideOffset={10}
                className="z-50 min-w-56 rounded-xl border bg-white p-2 shadow-lg"
              >
                <Dropdown.Item asChild>
                  <Link className={itemClass} href="/properties">
                    <Search size={16} />
                    Khám phá chỗ nghỉ
                  </Link>
                </Dropdown.Item>
                {user ? (
                  <>
                    <Dropdown.Item asChild>
                      <Link className={itemClass} href="/account">
                        Tài khoản
                      </Link>
                    </Dropdown.Item>
                    {user.role === 'GUEST' && (
                      <Dropdown.Item asChild>
                        <Link className={itemClass} href="/bookings">
                          Đặt phòng của tôi
                        </Link>
                      </Dropdown.Item>
                    )}
                    {user.role === 'HOST' && user.status === 'ACTIVE' && (
                      <Dropdown.Item asChild>
                        <Link className={itemClass} href="/host">
                          Quản lý chỗ nghỉ
                        </Link>
                      </Dropdown.Item>
                    )}
                    {user.role === 'ADMIN' && (
                      <Dropdown.Item asChild>
                        <Link className={itemClass} href="/admin/hosts">
                          Xét duyệt người cho thuê
                        </Link>
                      </Dropdown.Item>
                    )}
                    <Dropdown.Separator className="my-1 h-px bg-border" />
                    <Dropdown.Item
                      className={itemClass}
                      onSelect={() => {
                        logout();
                        router.push('/');
                      }}
                    >
                      <LogOut size={16} />
                      Đăng xuất
                    </Dropdown.Item>
                  </>
                ) : (
                  <>
                    <Dropdown.Item asChild>
                      <Link className={itemClass} href="/login">
                        Đăng nhập
                      </Link>
                    </Dropdown.Item>
                    <Dropdown.Item asChild>
                      <Link className={itemClass} href="/register">
                        Đăng ký khách thuê
                      </Link>
                    </Dropdown.Item>
                    <Dropdown.Item asChild>
                      <Link className={itemClass} href="/register?role=HOST">
                        Trở thành người cho thuê
                      </Link>
                    </Dropdown.Item>
                  </>
                )}
              </Dropdown.Content>
            </Dropdown.Portal>
          </Dropdown.Root>
        </div>
      </div>
    </header>
  );
}
