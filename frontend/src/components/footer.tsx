import Link from 'next/link';
import { House, ArrowUpRight } from 'lucide-react';
export function Footer() {
  return (
    <footer className="border-t bg-white">
      <div className="container-shell grid gap-8 py-12 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <Link className="flex items-center gap-2 text-xl font-bold" href="/">
            <House className="text-secondary-foreground" />
            StayHub
          </Link>
        </div>
        <div>
          <h2 className="mb-4 text-sm font-semibold">Khám phá StayHub</h2>
          <Link
            className="block text-sm text-muted-foreground hover:underline"
            href="/properties"
          >
            Tìm chỗ nghỉ
          </Link>
          <Link
            className="mt-3 block text-sm text-muted-foreground hover:underline"
            href="/bookings"
          >
            Đặt phòng của tôi
          </Link>
        </div>
        <div>
          <h2 className="mb-4 text-sm font-semibold">Cùng StayHub đón khách</h2>
          <Link
            className="inline-flex gap-1 text-sm text-secondary-foreground"
            href="/register?role=HOST"
          >
            Trở thành người cho thuê
            <ArrowUpRight size={16} />
          </Link>
          <p className="mt-4 text-xs leading-6 text-muted-foreground">
            TP. Hồ Chí Minh, Việt Nam
            <br />
            University of Information Technology, VNU-HCM
          </p>
        </div>
      </div>
      <div className="container-shell border-t py-5 text-xs text-muted-foreground">
        © {new Date().getFullYear()} StayHub, tìm kiếm bình yên giữa Sài Gòn.
      </div>
    </footer>
  );
}
