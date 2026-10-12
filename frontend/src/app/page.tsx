'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { SearchBox } from '@/components/search-box';
import { PropertyCard } from '@/components/property-card';
import { Empty, ErrorState, PropertySkeletons } from '@/components/ui/states';
import { SectionReveal } from '@/components/ui/section-reveal';
export default function HomePage() {
  const properties = useQuery({
    queryKey: ['properties', 'featured'],
    queryFn: () => api.properties({ limit: 4 }),
  });
  return (
    <>
      <section className="border-b bg-cream">
        <div className="container-shell py-6 md:py-8">
          <h1 className="max-w-3xl text-2xl font-semibold leading-snug tracking-tight md:text-3xl">
            Tìm chỗ nghỉ tại TP. Hồ Chí Minh
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            So sánh homestay và khách sạn theo khu vực, loại phòng và giá mỗi đêm.
          </p>
          <div className="mt-5 max-w-4xl">
            <SearchBox variant="homepage" />
          </div>
          <nav
            aria-label="Tìm chỗ nghỉ theo khu vực tại TP. Hồ Chí Minh"
            className="mt-3 flex flex-wrap items-center gap-x-5 text-sm"
          >
            <span className="text-xs text-muted-foreground">Theo khu vực</span>
            {['Quận 1', 'Quận 3', 'Bình Thạnh', 'Thủ Đức'].map((district) => (
              <Link
                key={district}
                href={`/properties?district=${encodeURIComponent(district)}`}
                className="motion-link inline-flex min-h-11 items-center font-medium"
              >
                {district}
              </Link>
            ))}
          </nav>
        </div>
      </section>
      <SectionReveal as="section" className="container-shell py-8 md:py-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Homestay và khách sạn
            </h2>
          </div>
          <Link
            href="/properties"
            className="motion-link flex min-h-11 items-center gap-2 text-sm font-medium"
          >
            Xem tất cả chỗ nghỉ
            <ArrowRight size={17} />
          </Link>
        </div>
        {properties.isPending ? (
          <PropertySkeletons
            count={4}
            variant="discovery"
            className="sm:grid-cols-2 xl:grid-cols-4"
          />
        ) : properties.isError ? (
          <ErrorState
            message={errorMessage(properties.error)}
            retry={() => void properties.refetch()}
          />
        ) : properties.data.items.length ? (
          <div className="motion-list grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            {properties.data.items.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                variant="discovery"
                comparisonProperties={properties.data.items}
              />
            ))}
          </div>
        ) : (
          <Empty>Chưa có chỗ nghỉ để hiển thị. Vui lòng quay lại sau.</Empty>
        )}
      </SectionReveal>
    </>
  );
}
