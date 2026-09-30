import Link from 'next/link';
import { ArrowUpRight, MapPin, Users } from 'lucide-react';
import type { Property } from '@/lib/types';
import { money } from '@/lib/utils';
import { PropertyImage } from './property-image';
export function PropertyCard({ property }: { property: Property }) {
  return (
    <Link
      href={`/properties/${property.id}`}
      className="group block overflow-hidden rounded-2xl border bg-white transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {/* External host images are rendered in the browser, never fetched by the server. */}
        <PropertyImage
          src={property.images[0]?.url ?? '/room-placeholder.svg'}
          alt={property.name}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider">
          {property.type === 'HOTEL' ? 'Khách sạn' : 'Homestay'}
        </span>
      </div>
      <div className="p-5">
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin size={13} />
          {property.district}, TP. Hồ Chí Minh
        </p>
        <h3 className="mt-2 line-clamp-2 min-h-12 text-base font-semibold leading-6">
          {property.name}
        </h3>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Users size={13} />
          {property.maxGuests} khách<span>·</span>
          {property.amenities
            .slice(0, 2)
            .map((a) => a.amenity.nameVi)
            .join(' · ')}
        </div>
        <div className="mt-5 flex items-center justify-between border-t pt-4">
          <p>
            <strong className="text-lg">{money(property.pricePerNight)}</strong>
            <span className="ml-1 text-xs text-muted-foreground">/ đêm</span>
          </p>
          <span className="rounded-full bg-accent p-2 text-secondary-foreground">
            <ArrowUpRight size={17} />
          </span>
        </div>
      </div>
    </Link>
  );
}
