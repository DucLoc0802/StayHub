"use client";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { propertyService } from "@/lib/services";
import { PropertyCard } from "./property-card";
import { PageState } from "./ui";

export function HomeContent() {
  const [q, setQ] = useState("");
  const router = useRouter();
  const featured = useQuery({
    queryKey: ["properties", "featured"],
    queryFn: () => propertyService.list({ limit: 4 }),
  });
  const search = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/properties${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  };
  return (
    <>
      <section className="hero-warm py-16 md:py-24">
        <div className="container grid items-center gap-10 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <span className="mb-4 inline-block rounded-full border border-border bg-card px-4 py-2 text-sm font-bold text-secondary-foreground shadow-sm">
              Khám phá Thành phố Hồ Chí Minh
            </span>
            <h1 className="font-display max-w-3xl text-4xl font-extrabold leading-[1.12] md:text-6xl">
              Chỗ nghỉ vừa ý,
              <br />
              <span className="text-primary-dark">chuyến đi trọn vẹn.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
              Tìm homestay ấm cúng và phòng khách sạn tiện nghi ở những khu vực
              bạn yêu thích.
            </p>
            <form
              onSubmit={search}
              className="mt-8 flex flex-col gap-3 rounded-2xl border border-border/70 bg-white p-3 shadow-warm sm:flex-row"
            >
              <label className="flex min-h-14 flex-1 items-center gap-3 px-3">
                <MapPin className="text-primary-dark" />
                <span className="sr-only">Tên hoặc quận</span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full outline-none placeholder:text-subtle"
                  placeholder="Tên chỗ nghỉ hoặc quận..."
                />
              </label>
              <button className="btn-primary min-h-14 gap-2 px-7">
                <Search size={19} /> Tìm kiếm
              </button>
            </form>
            <div className="mt-6 flex flex-wrap gap-5 text-sm text-muted">
              <span className="flex items-center gap-2">
                <ShieldCheck className="text-primary" size={18} /> Giá rõ ràng
              </span>
              <span className="flex items-center gap-2">
                <CalendarDays className="text-primary" size={18} /> Đặt phòng
                nhanh chóng
              </span>
            </div>
          </div>
          <div className="relative hidden lg:block">
            <div className="aspect-square rotate-3 rounded-[3rem] bg-[url('https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80')] bg-cover bg-center shadow-2xl"></div>
            <div className="absolute -bottom-5 -left-7 rounded-2xl bg-white p-5 shadow-xl">
              <strong className="block text-2xl text-primary">100%</strong>
              <span className="text-sm text-muted">Tập trung tại TP.HCM</span>
            </div>
          </div>
        </div>
      </section>
      <section className="container py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="font-bold text-secondary-foreground">Gợi ý cho bạn</p>
            <h2 className="mt-1 text-3xl font-extrabold">Chỗ nghỉ nổi bật</h2>
          </div>
          <Link
            href="/properties"
            className="hidden items-center gap-2 font-bold text-secondary-foreground transition hover:text-primary-dark sm:flex"
          >
            Xem tất cả <ArrowRight size={18} />
          </Link>
        </div>
        {featured.isLoading ? (
          <PageState>Đang tải chỗ nghỉ...</PageState>
        ) : featured.isError ? (
          <PageState>Không thể tải dữ liệu. Vui lòng thử lại.</PageState>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.data?.items.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
