'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronLeft, MapPin } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/utils';
import { propertyPath } from '@/lib/property-url';
import { ErrorState, Loading } from './ui/states';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from './ui/dialog';
import { BookingCard } from './booking-card';
import { PropertyImage } from './property-image';
import { SectionReveal } from './ui/section-reveal';
import { PropertyFeedback, RoomAvailabilityLabel } from './booking-extras';
export function PropertyDetail({ id }: { id: string }) {
  const router = useRouter();
  const property = useQuery({
    queryKey: ['property', id],
    queryFn: () => api.property(id),
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [dates, setDates] = useState<{
    checkIn: string;
    checkOut: string;
  } | null>(null);
  const galleryTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!property.data) return;
    const path = propertyPath(property.data);
    if (window.location.pathname !== path) {
      router.replace(`${path}${window.location.search}${window.location.hash}`);
    }
  }, [property.data, router]);
  if (property.isPending) return <Loading />;
  if (property.isError)
    return (
      <div className="container-shell page-section">
        <ErrorState
          message={errorMessage(property.error)}
          retry={() => void property.refetch()}
        />
      </div>
    );
  const p = property.data;
  return (
    <div className="container-shell page-section">
      <Link
        href="/properties"
        className="mb-4 flex min-h-11 items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft size={16} />
        Khám phá chỗ nghỉ
      </Link>
      <div className="mb-6">
        <span className="text-sm text-muted-foreground">
          {p.type === 'HOTEL' ? 'Khách sạn' : 'Homestay'}
        </span>
        <h1 className="page-title mb-2 mt-1">{p.name}</h1>
        <p className="flex items-start gap-1 text-sm leading-6 text-muted-foreground">
          <MapPin size={16} className="mt-1 shrink-0" />
          {p.address} · {p.district}
        </p>
      </div>
      <div className="mb-6 grid h-[220px] gap-2 overflow-hidden rounded-lg sm:h-[340px] sm:grid-cols-[2fr_1fr]">
        {p.images.slice(0, 3).map((image, i) => (
          <button
            key={image.id}
            onClick={(event) => {
              galleryTrigger.current = event.currentTarget;
              setSelected(i);
              setGalleryOpen(true);
            }}
            className={`${i === 0 ? 'row-span-2' : 'hidden sm:block'} gallery-trigger relative min-h-0 overflow-hidden bg-muted`}
            aria-label={`Xem ảnh ${i + 1}: ${p.name}`}
          >
            <PropertyImage
              className="gallery-image size-full object-cover"
              src={image.url}
              alt={`${p.name} — ảnh ${i + 1}`}
            />
            {i === Math.min(2, p.images.length - 1) && (
              <span className="absolute bottom-3 right-3 rounded-lg bg-white px-3 py-2 text-xs font-semibold">
                Xem {p.images.length} ảnh
              </span>
            )}
          </button>
        ))}
      </div>
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent
          className="max-w-4xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            galleryTrigger.current?.focus();
          }}
        >
          <DialogTitle className="pr-6 font-semibold">{p.name}</DialogTitle>
          <DialogDescription className="mt-2 text-sm text-muted-foreground">
            Thư viện ảnh chỗ nghỉ
          </DialogDescription>
          {selected !== null && (
            <>
              <PropertyImage
                key={p.images[selected].id}
                src={p.images[selected].url}
                alt={`${p.name} — ảnh ${selected + 1}`}
                className="motion-feedback mt-4 h-[50vh] max-h-[65vh] w-full rounded-xl object-contain"
              />
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {p.images.map((image, i) => (
                  <button
                    key={image.id}
                    className={`rounded-lg border px-3 py-2 text-sm ${selected === i ? 'bg-primary' : ''}`}
                    aria-label={`Ảnh ${i + 1}`}
                    aria-pressed={selected === i}
                    onClick={() => setSelected(i)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <a
        href="#property-booking"
        className="mb-6 inline-flex min-h-11 items-center text-sm font-semibold text-secondary-foreground underline underline-offset-4 lg:hidden"
      >
        Chọn phòng và ngày lưu trú
      </a>
      <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:gap-10">
        <SectionReveal>
          <section className="pb-6">
            <h2 className="mb-4 text-xl font-semibold">Loại phòng và chỗ ở</h2>
            <div className="divide-y border-y">
              {p.roomTypes.map((room) => (
                <article
                  key={room.id}
                  className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-5 sm:py-5"
                >
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-6">{room.name}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {room.description}
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      {room.maxGuests} khách /{' '}
                      {p.type === 'HOTEL' ? 'phòng' : 'căn'}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {room.bedrooms} phòng ngủ · {room.beds} giường ·{' '}
                      {room.bathrooms} phòng tắm
                    </p>
                  </div>
                  <div className="sm:max-w-48 sm:text-right">
                    <p className="font-semibold tabular-nums">
                      {money(room.pricePerNight)}{' '}
                      <span className="whitespace-nowrap text-xs font-normal text-muted-foreground">
                        / đêm
                      </span>
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      <RoomAvailabilityLabel
                        id={room.id}
                        dates={dates}
                        homestay={p.type === 'HOMESTAY'}
                      />
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="border-t py-7">
            <h2 className="mb-4 text-xl font-semibold">Về chỗ nghỉ này</h2>
            <p className="max-w-[72ch] whitespace-pre-line text-sm leading-7 text-muted-foreground">
              {p.description}
            </p>
          </section>
          <section className="border-t py-7">
            <h2 className="mb-4 text-xl font-semibold">Tiện nghi</h2>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-3 sm:gap-x-6">
              {p.amenities.map((a) => (
                <li
                  key={a.amenityId}
                  className="flex items-start gap-2 text-sm leading-6"
                >
                  <Check size={18} className="mt-1 shrink-0 text-success" />
                  {a.amenity.nameVi}
                </li>
              ))}
            </ul>
          </section>
          <section className="border-t py-6">
            <h2 className="text-xl font-semibold">Chính sách lưu trú</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              <li>
                Nhận phòng: {p.checkInTime} · Trả phòng: {p.checkOutTime} (giờ
                Việt Nam).
              </li>
              <li>
                Đặt cọc {p.depositPercent}% để xác nhận. Phần còn lại thanh toán
                tại chỗ nghỉ.
              </li>
              <li>
                Có thể hủy đơn đã xác nhận, nhưng tiền cọc đã thanh toán sẽ
                không được hoàn lại.
              </li>
            </ul>
          </section>
        </SectionReveal>
        <div id="property-booking" className="scroll-mt-24 lg:contents">
          <BookingCard property={p} onDatesChange={setDates} />
        </div>
      </div>
      <PropertyFeedback id={p.id} />
    </div>
  );
}
