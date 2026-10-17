'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { RequireAuth } from '@/components/require-auth';
import { useAuth } from '@/components/providers';
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navigation.current;
    if (!nav) return;
    const alignCurrentPage = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (active)
        nav.scrollLeft =
          active.offsetLeft -
          nav.offsetLeft -
          (nav.clientWidth - active.clientWidth) / 2;
    };
    alignCurrentPage();
    const observer = new ResizeObserver(alignCurrentPage);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [pathname, user?.id]);
  return (
    <RequireAuth role="ADMIN">
      <nav
        ref={navigation}
        aria-label="Quản trị StayHub"
        className="container-shell flex gap-x-4 overflow-x-auto whitespace-nowrap border-b py-1 text-sm"
      >
        {[
          ['/admin', 'Thống kê'],
          ['/admin/hosts', 'Duyệt Host'],
          ['/admin/users', 'Người dùng & phân quyền'],
          ['/admin/properties', 'Cơ sở lưu trú'],
          ['/admin/bookings', 'Tra cứu đặt phòng'],
          ['/admin/payments', 'Xác minh thanh toán'],
          ['/admin/amenities', 'Tiện ích'],
          ['/admin/feedback', 'Đánh giá'],
        ].map(([href, label]) => {
          const active =
            href === '/admin'
              ? pathname === href
              : pathname.startsWith(href) ||
                (href === '/admin/users' &&
                  pathname.startsWith('/admin/customers/'));
          return (
            <Link
              aria-current={active ? 'page' : undefined}
              className={`motion-link flex min-h-11 items-center border-b-2 py-2 ${active ? '!border-primary font-semibold text-foreground' : '!border-transparent text-muted-foreground hover:text-foreground'}`}
              key={href}
              href={href}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      {children}
    </RequireAuth>
  );
}
