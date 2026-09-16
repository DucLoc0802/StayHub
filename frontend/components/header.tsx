"use client";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { HeartHandshake, Menu, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useAuth } from "./auth-provider";

export function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-white/95 backdrop-blur">
      <div className="container flex h-18 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-extrabold text-secondary-foreground"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-white">
            <HeartHandshake size={20} />
          </span>
          StayHub
        </Link>
        <Link
          href="/properties"
          className="hidden items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium md:flex"
        >
          <Search size={17} /> Tìm chỗ nghỉ tại TP.HCM
        </Link>
        <nav className="flex items-center gap-2">
          {!user ? (
            <>
              <Link
                className="btn-ghost hidden sm:inline-flex"
                href="/register"
              >
                Đăng ký
              </Link>
              <Link className="btn-primary" href="/login">
                Đăng nhập
              </Link>
            </>
          ) : (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-3 transition hover:border-accent hover:bg-secondary">
                <span className="grid size-7 place-items-center rounded-full bg-secondary text-primary-dark">
                  <UserRound size={16} />
                </span>
                <span className="hidden max-w-32 truncate text-sm font-semibold sm:block">
                  {user.fullName}
                </span>
                <Menu size={17} />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  className="z-50 mt-2 min-w-56 rounded-xl border border-border bg-popover p-1 shadow-warm"
                >
                  <MenuLink href="/account">Tài khoản</MenuLink>
                  {user.role === "GUEST" && (
                    <MenuLink href="/bookings">Đặt phòng của tôi</MenuLink>
                  )}
                  {user.role === "HOST" && (
                    <MenuLink href="/host">Quản lý chỗ nghỉ</MenuLink>
                  )}
                  {user.role === "ADMIN" && (
                    <MenuLink href="/admin/hosts">Quản trị</MenuLink>
                  )}
                  <DropdownMenu.Item
                    onSelect={logout}
                    className="cursor-pointer rounded-lg px-3 py-2 text-sm text-red-600 outline-none hover:bg-red-50"
                  >
                    Đăng xuất
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
        </nav>
      </div>
    </header>
  );
}
function MenuLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.Item asChild>
      <Link
        href={href}
        className="block rounded-lg px-3 py-2 text-sm outline-none hover:bg-surface"
      >
        {children}
      </Link>
    </DropdownMenu.Item>
  );
}
