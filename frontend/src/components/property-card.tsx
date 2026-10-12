import Link from 'next/link';
import { MapPin } from 'lucide-react';
import type { Property } from '@/lib/types';
import { money } from '@/lib/utils';
import { propertyPath } from '@/lib/property-url';
import { PropertyImage } from './property-image';
export function PropertyCard({
  property,
  variant = 'default',
  comparisonProperties = [],
}: {
  property: Property;
  variant?: 'default' | 'discovery';
  comparisonProperties?: Property[];
}) {
  if (variant === 'discovery') {
    const distinguishingAmenities = property.amenities
      .filter(({ amenityId }) =>
        comparisonProperties.some(
          (other) =>
            !other.amenities.some((item) => item.amenityId === amenityId),
        ),
      )
      .slice(0, 2)
      .map(({ amenity }) => amenity.nameVi);
    return (
      <Link
        href={propertyPath(property)}
        className="property-card discovery-property group grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] overflow-hidden rounded-lg border bg-white sm:flex sm:flex-col"
      >
        <div className="relative overflow-hidden bg-muted sm:aspect-[3/2]">
          <PropertyImage
            src={property.images[0]?.url ?? '/room-placeholder.svg'}
            alt={property.name}
            loading="lazy"
            className="property-card-image absolute inset-0 size-full object-cover"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 sm:p-4">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 group-hover:text-secondary-foreground sm:min-h-12 sm:text-base sm:leading-6">
            {property.name}
          </h3>
          <p
            className="line-clamp-2 text-xs leading-5 text-muted-foreground sm:line-clamp-1"
            title={`${property.district} · ${property.address}`}
          >
            {property.district} · {property.address}
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            {property.type === 'HOTEL' ? 'Khách sạn' : 'Homestay'}
            {' · '}
            {property.roomTypes.length} loại phòng
          </p>
          {distinguishingAmenities.length > 0 && (
            <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
              {distinguishingAmenities.join(' · ')}
            </p>
          )}
          <p className="mt-auto border-t pt-2 leading-6">
            {property.minPricePerNight === null ? (
              <span className="text-sm font-medium">Xem giá theo loại phòng</span>
            ) : (
              <>
                <span className="mr-1 text-xs text-muted-foreground">Từ</span>
                <strong className="text-base font-semibold tabular-nums sm:text-lg">
                  {money(property.minPricePerNight)}
                </strong>
                <span className="ml-1 whitespace-nowrap text-xs text-muted-foreground">
                  / đêm
                </span>
              </>
            )}
          </p>
        </div>
      </Link>
    );
  }
  return (
    <Link
      href={propertyPath(property)}
      className="property-card group block overflow-hidden rounded-lg border bg-white"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {/* External host images are rendered in the browser, never fetched by the server. */}
        <PropertyImage
          src={property.images[0]?.url ?? '/room-placeholder.svg'}
          alt={property.name}
          loading="lazy"
          className="property-card-image size-full object-cover"
        />
      </div>
      <div className="p-4">
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin size={13} />
          {property.district}, TP. Hồ Chí Minh
        </p>
        <h3 className="mt-2 line-clamp-2 min-h-12 text-base font-semibold leading-6">
          {property.name}
        </h3>
        <div className="mt-2 text-xs leading-5 text-muted-foreground">
          {property.type === 'HOTEL' ? 'Khách sạn' : 'Homestay'} ·{' '}
          {property.roomTypes.length} loại phòng{' · '}
          {property.amenities
            .slice(0, 2)
            .map((a) => a.amenity.nameVi)
            .join(' · ')}
        </div>
        <div className="mt-3 border-t pt-3">
          <p>
            {property.minPricePerNight === null ? (
              <span className="text-sm font-medium">Xem giá theo loại phòng</span>
            ) : (
              <>
                <span className="mr-1 text-xs text-muted-foreground">Từ</span>
                <strong className="text-lg font-semibold tabular-nums">
                  {money(property.minPricePerNight)}
                </strong>
                <span className="ml-1 text-xs text-muted-foreground">/ đêm</span>
              </>
            )}
          </p>
        </div>
      </div>
    </Link>
  );
}
