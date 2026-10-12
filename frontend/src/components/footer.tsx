import Link from 'next/link';
import { House } from 'lucide-react';
import { SectionReveal } from './ui/section-reveal';
export function Footer() {
  return (
    <footer className="border-t bg-white">
      <SectionReveal className="container-shell grid gap-5 py-6 md:grid-cols-[1fr_2fr] md:gap-8">
        <div>
          <Link className="flex items-center gap-2 text-xl font-bold" href="/">
            <House className="text-secondary-foreground" />
            StayHub
          </Link>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">TP. Hồ Chí Minh, Việt Nam</p>
        </div>
        <nav aria-label="Liên kết cuối trang" className="flex flex-wrap items-start gap-x-6 gap-y-1 text-sm md:justify-end">
          <Link
            className="motion-link inline-flex min-h-11 items-center text-muted-foreground"
            href="/properties"
          >
            Tìm chỗ nghỉ
          </Link>
          <Link
            className="motion-link inline-flex min-h-11 items-center text-muted-foreground"
            href="/bookings"
          >
            Đặt phòng của tôi
          </Link>
          <Link
            className="motion-link inline-flex min-h-11 items-center text-muted-foreground"
            href="/register?role=HOST"
          >
            Trở thành người cho thuê
          </Link>
        </nav>
      </SectionReveal>
      <div className="container-shell flex flex-wrap justify-between gap-2 border-t py-4 text-xs leading-5 text-muted-foreground">
        <span>© {new Date().getFullYear()} StayHub</span>
        <span>University of Information Technology, VNU-HCM</span>
      </div>
    </footer>
  );
}
