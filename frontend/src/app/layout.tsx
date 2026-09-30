import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { Providers } from '@/components/providers';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import './globals.css';
const font = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-be-vietnam',
  display: 'swap',
});
export const metadata: Metadata = {
  title: {
    default: 'StayHub — Chỗ nghỉ vừa ý, chuyến đi trọn vẹn',
    template: '%s | StayHub',
  },
  description:
    'Khám phá homestay và khách sạn ấm áp tại TP. Hồ Chí Minh. Chọn chỗ nghỉ, đặt cọc và tận hưởng chuyến đi.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className={`${font.variable} antialiased`}>
        <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-white focus:p-4"
          >
            Đến nội dung chính
          </a>
          <Header />
          <main id="main" className="min-h-[65vh]">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
