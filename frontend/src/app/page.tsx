'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, House } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { SearchBox } from '@/components/search-box';
import { PropertyCard } from '@/components/property-card';
import { ErrorState, PropertySkeletons } from '@/components/ui/states';
import { SectionReveal } from '@/components/ui/section-reveal';
import { Button } from '@/components/ui/button';
import { districts } from '@/lib/utils';
import heroImage from '../../public/images/stayhub-courtyard.jpg';

const popularDistricts = ['Quận 1', 'Quận 3', 'Bình Thạnh', 'Thủ Đức'];
const exploreDistricts = [
  'Quận 1',
  'Quận 3',
  'Quận 2',
  'Bình Thạnh',
  'Quận 7',
  'Thủ Đức',
].filter((district) => districts.includes(district));

export default function HomePage() {
  const properties = useQuery({
    queryKey: ['properties', 'featured'],
    queryFn: () => api.properties({ limit: 4 }),
  });
  return (
    <>
      <section className="home-hero" aria-labelledby="home-title">
        <Image
          src={heroImage}
          alt="Hồ bơi giữa sân trong của một khách sạn, với những ban công ấm ánh đèn lúc chiều tối"
          fill
          preload
          placeholder="blur"
          sizes="100vw"
          className="home-hero-image object-cover"
        />
        <div className="home-hero-overlay" aria-hidden="true" />
        <div className="container-shell home-hero-content">
          <h1 id="home-title" className="home-hero-title">
            Tìm chốn nghỉ cho hành trình của bạn
          </h1>
          <p className="home-hero-description">
            Khám phá homestay và khách sạn phù hợp tại TP. Hồ Chí Minh.
          </p>
          <div className="home-hero-search">
            <SearchBox variant="homepage" />
          </div>
          <nav
            aria-label="Tìm chỗ nghỉ theo khu vực tại TP. Hồ Chí Minh"
            className="home-popular-locations"
          >
            <span className="home-popular-label">Khám phá:</span>
            {popularDistricts.map((district) => (
              <Link
                key={district}
                href={`/properties?district=${encodeURIComponent(district)}`}
                className="home-popular-link motion-link"
              >
                {district}
              </Link>
            ))}
          </nav>
        </div>
      </section>
      <SectionReveal
        as="section"
        className="home-stays"
        aria-labelledby="home-stays-title"
      >
        <div className="container-shell">
          <div className="home-section-heading">
            <div>
              <h2 id="home-stays-title" className="home-section-title">
                Homestay và khách sạn
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Một nơi nghỉ vừa ý, cho mỗi lần ghé thăm Sài Gòn.
              </p>
            </div>
            <Link
              href="/properties"
              className="motion-link inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold text-secondary-foreground"
            >
              Xem tất cả chỗ nghỉ
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          {properties.isPending ? (
            <PropertySkeletons
              count={4}
              variant="homepage"
              className="sm:grid-cols-2 xl:grid-cols-4"
            />
          ) : properties.isError ? (
            <ErrorState
              message={errorMessage(properties.error)}
              retry={() => void properties.refetch()}
            />
          ) : properties.data.items.length ? (
            <div className="motion-list grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
              {properties.data.items.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  variant="homepage"
                  comparisonProperties={properties.data.items}
                />
              ))}
            </div>
          ) : (
            <div role="status" className="home-empty-state">
              <House
                size={32}
                strokeWidth={1.5}
                aria-hidden="true"
                className="text-secondary-foreground"
              />
              <h3 className="text-xl font-semibold">
                Chưa có chỗ nghỉ để khám phá
              </h3>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                Danh sách hiện đang trống. Hãy thử tải lại hoặc bắt đầu với khu
                vực bạn muốn ghé thăm.
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => void properties.refetch()}
                >
                  Tải lại danh sách
                </Button>
                <Button asChild variant="ghost">
                  <a href="#explore-locations">
                    Xem các khu vực <ArrowRight size={16} aria-hidden="true" />
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </SectionReveal>
      <section
        id="explore-locations"
        className="home-locations"
        aria-labelledby="home-locations-title"
      >
        <div className="container-shell home-locations-layout">
          <div>
            <h2 id="home-locations-title" className="home-section-title">
              Khám phá theo khu vực
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">
              Mỗi hành trình có một điểm bắt đầu. Chọn khu vực phù hợp với lịch
              trình của bạn.
            </p>
          </div>
          <nav aria-label="Khám phá các khu vực" className="home-location-grid">
            {exploreDistricts.map((district) => (
              <Link
                key={district}
                href={`/properties?district=${encodeURIComponent(district)}`}
                className="home-location-link group"
              >
                <span>{district}</span>
                <ArrowRight
                  size={19}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className="shrink-0 text-secondary-foreground"
                />
              </Link>
            ))}
          </nav>
        </div>
      </section>
    </>
  );
}
