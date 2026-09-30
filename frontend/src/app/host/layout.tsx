import Link from 'next/link';
import { RequireAuth } from '@/components/require-auth';
export default function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth role="HOST">
      <div className="container-shell page-section">
        <p className="eyebrow">KHÔNG GIAN NGƯỜI CHO THUÊ</p>
        <h1 className="page-title mt-3">Cùng đón những chuyến đi mới.</h1>
        <nav
          aria-label="Quản lý chỗ nghỉ"
          className="my-7 flex gap-6 border-b pb-4 text-sm font-medium"
        >
          <Link className="hover:text-secondary-foreground" href="/host">
            Chỗ nghỉ của tôi
          </Link>
          <Link
            className="hover:text-secondary-foreground"
            href="/host/bookings"
          >
            Đặt phòng
          </Link>
        </nav>
        {children}
      </div>
    </RequireAuth>
  );
}
