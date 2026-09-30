'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Coffee,
  Home,
  MapPin,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { SearchBox } from '@/components/search-box';
import { PropertyCard } from '@/components/property-card';
import { Empty, ErrorState, Loading } from '@/components/ui/states';
export default function HomePage() {
  const properties = useQuery({
    queryKey: ['properties', 'featured'],
    queryFn: () => api.properties({ limit: 4 }),
  });
  return (
    <>
      <section className="bg-cream">
        <div className="container-shell relative pb-9 pt-8 md:pt-12">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
            <div className="py-4 md:py-9">
              <p className="eyebrow flex items-center gap-2">
                <Sun size={16} />
                CHÀO SÀI GÒN, CHÀO BẠN.
              </p>
              <h1 className="mt-6 text-[clamp(2.4rem,4.6vw,4.15rem)] font-semibold leading-[1.22] tracking-[-0.055em]">
                Chỗ nghỉ vừa ý,
                <br />
                <span className="text-secondary-foreground">
                  chuyến đi trọn vẹn.
                </span>
              </h1>
              <p className="mt-6 max-w-md text-sm leading-7 text-muted-foreground md:text-base">
                Một căn phòng ngập nắng, một góc nhỏ thân quen.{' '}
                <br className="hidden sm:block" />
                Tìm nơi dừng chân của riêng bạn giữa lòng Sài Gòn.
              </p>
              <div className="mt-8 flex flex-wrap gap-5 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <ShieldCheck
                    size={17}
                    className="text-secondary-foreground"
                  />
                  Thông tin rõ ràng
                </span>
                <span className="flex items-center gap-2">
                  <Home size={17} className="text-secondary-foreground" />
                  Không gian riêng tư
                </span>
              </div>
            </div>
            <div className="relative hidden pb-6 pl-6 md:block">
              <div className="absolute bottom-0 left-0 right-6 top-6 rounded-[2rem] border border-primary/25" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85"
                alt="Không gian nghỉ dưỡng ấm áp với nội thất gỗ và ánh nắng tự nhiên"
                className="relative h-[360px] w-full rounded-[2rem] object-cover lg:h-[405px]"
              />
              <div className="absolute bottom-12 left-0 flex items-center gap-3 rounded-xl border bg-white p-4 shadow-md">
                <span className="rounded-full bg-accent p-3">
                  <Coffee className="text-secondary-foreground" size={22} />
                </span>
                <div>
                  <p className="text-sm font-semibold">
                    Ở một nơi. Yêu một thành phố.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Những ngày thật chậm tại Sài Gòn
                  </p>
                </div>
              </div>
              <span className="absolute right-5 top-5 flex items-center gap-1 rounded-full bg-white/95 px-3 py-2 text-xs">
                <MapPin size={13} />
                TP. Hồ Chí Minh
              </span>
            </div>
          </div>
          <div className="relative mt-6">
            <SearchBox />
          </div>
        </div>
      </section>
      <section className="container-shell py-14">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">MỘT NƠI ĐỂ BẮT ĐẦU</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
              Chỗ nghỉ dành cho bạn
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Những không gian mới, sẵn sàng đón bạn.
            </p>
          </div>
          <Link
            href="/properties"
            className="flex items-center gap-2 text-sm font-semibold text-secondary-foreground"
          >
            Khám phá tất cả
            <ArrowRight size={17} />
          </Link>
        </div>
        {properties.isPending ? (
          <Loading />
        ) : properties.isError ? (
          <ErrorState
            message={errorMessage(properties.error)}
            retry={() => void properties.refetch()}
          />
        ) : properties.data.items.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {properties.data.items.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        ) : (
          <Empty>Chưa có chỗ nghỉ đang hoạt động. Hãy quay lại sau nhé.</Empty>
        )}
      </section>
      <section className="container-shell pb-16">
        <div className="rounded-3xl border bg-cream px-6 py-9 md:px-10">
          <div className="grid gap-7 md:grid-cols-[1.2fr_2fr]">
            <div>
              <p className="eyebrow">ĐI GẦN, TRẢI NGHIỆM NHIỀU</p>
              <h2 className="mt-3 text-2xl font-semibold leading-snug tracking-tight">
                Mỗi khu phố,
                <br />
                một Sài Gòn khác.
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Quận 1', 'Nhịp sống trung tâm'],
                ['Quận 3', 'Góc phố thân quen'],
                ['Bình Thạnh', 'Trẻ trung, gần gũi'],
                ['Thủ Đức', 'Bình yên bên sông'],
              ].map(([district, desc]) => (
                <Link
                  key={district}
                  href={`/properties?district=${encodeURIComponent(district)}`}
                  className="rounded-xl border bg-white p-4 transition-colors hover:border-primary"
                >
                  <MapPin
                    size={20}
                    className="mb-5 text-secondary-foreground"
                  />
                  <h3 className="text-sm font-semibold">{district}</h3>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {desc}
                  </p>
                  <ArrowRight
                    className="mt-3 text-secondary-foreground"
                    size={16}
                  />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
