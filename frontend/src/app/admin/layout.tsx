'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RequireAuth } from '@/components/require-auth';
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <RequireAuth role="ADMIN">
      <nav
        aria-label="Quản trị StayHub"
        className="container-shell flex flex-wrap gap-x-4 border-b py-1 text-sm"
      >
        {[
          ['/admin', 'Thống kê'],
          ['/admin/hosts', 'Duyệt Host'],
          ['/admin/users', 'Người dùng & phân quyền'],
          ['/admin/bookings', 'Tra cứu đặt phòng'],
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
