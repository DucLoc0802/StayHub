import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/header";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "StayHub – Chỗ nghỉ tại TP.HCM",
  description: "Đặt homestay và khách sạn dễ dàng tại Thành phố Hồ Chí Minh.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <Providers>
          <Header />
          <main>{children}</main>
          <footer className="mt-20 border-t border-border bg-white py-8">
            <div className="container text-sm text-muted">
              © 2026 StayHub · Chỗ nghỉ thân thiện tại TP.HCM
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
