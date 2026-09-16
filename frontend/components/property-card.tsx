import { BedDouble, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Property } from "@/lib/types";
import { money } from "@/lib/utils";
import { Card } from "./ui";

export function PropertyCard({ property }: { property: Property }) {
  return (
    <Card className="group overflow-hidden transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg">
      <Link href={`/properties/${property.id}`}>
        <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
          <Image
            src={
              property.images[0]?.url ??
              "https://placehold.co/800x600/png?text=StayHub"
            }
            alt={property.name}
            fill
            className="object-cover transition duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        </div>
        <div className="grid gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">
              {property.type === "HOMESTAY" ? "Homestay" : "Khách sạn"}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted">
              <MapPin size={14} />
              {property.district}
            </span>
          </div>
          <h3 className="line-clamp-1 text-lg font-bold">{property.name}</h3>
          <div className="flex items-center gap-1.5 text-sm text-muted">
            <BedDouble size={16} />
            {property.bedrooms} phòng ngủ · {property.beds} giường
          </div>
          <div className="line-clamp-1 text-xs text-muted">
            {property.propertyAmenities
              .slice(0, 3)
              .map((x) => x.amenity.nameVi)
              .join(" · ")}
          </div>
          <div className="pt-1 text-right">
            <strong className="text-lg text-secondary-foreground">
              {money(property.pricePerNight)}
            </strong>
            <span className="text-sm text-muted"> / đêm</span>
          </div>
        </div>
      </Link>
    </Card>
  );
}
