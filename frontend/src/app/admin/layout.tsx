import Link from 'next/link';
import { RequireAuth } from '@/components/require-auth';
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth role="ADMIN">
      <nav
        aria-label="Quản trị StayHub"
        className="container-shell flex flex-wrap gap-3 border-b py-5 text-sm"
      >
        {[
          ['/admin', 'Thống kê'],
          ['/admin/hosts', 'Duyệt Host'],
          ['/admin/users', 'Người dùng & phân quyền'],
          ['/admin/bookings', 'Tra cứu đặt phòng'],
          ['/admin/amenities', 'Tiện ích'],
          ['/admin/feedback', 'Đánh giá'],
        ].map(([href, label]) => (
          <Link
            className="motion-link rounded-lg px-3 py-2 hover:bg-accent"
            key={href}
            href={href}
          >
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </RequireAuth>
  );
}
