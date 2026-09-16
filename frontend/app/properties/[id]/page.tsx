"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, format } from "date-fns";
import { BedDouble, House, MapPin, ShowerHead, Users } from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { DayPicker, DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Button, Card, Input, PageState } from "@/components/ui";
import { bookingService, propertyService } from "@/lib/services";
import { apiError, money } from "@/lib/utils";

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const property = useQuery({
    queryKey: ["property", id],
    queryFn: () => propertyService.detail(id),
  });
  const [range, setRange] = useState<DateRange>();
  const [guestCount, setGuestCount] = useState(1);
  const booking = useMutation({
    mutationFn: bookingService.create,
    onSuccess: () => {
      toast.success("Tạo đặt phòng thành công. Vui lòng thanh toán tiền cọc.");
      router.push("/bookings");
    },
    onError: (e) => toast.error(apiError(e)),
  });
  if (property.isLoading)
    return (
      <div className="container py-12">
        <PageState>Đang tải thông tin...</PageState>
      </div>
    );
  if (!property.data)
    return (
      <div className="container py-12">
        <PageState>Không tìm thấy chỗ nghỉ.</PageState>
      </div>
    );
  const p = property.data;
  const nights =
    range?.from && range?.to
      ? Math.max(0, differenceInCalendarDays(range.to, range.from))
      : 0;
  const total = nights * p.pricePerNight;
  const deposit = Math.round((total * p.depositPercent) / 100);
  const reserve = () => {
    if (!user) return router.push(`/login?next=/properties/${id}`);
    if (user.role !== "GUEST")
      return toast.error("Chỉ tài khoản khách mới có thể đặt phòng.");
    if (!range?.from || !range.to)
      return toast.error("Vui lòng chọn ngày nhận và trả phòng.");
    booking.mutate({
      propertyId: id,
      checkIn: format(range.from, "yyyy-MM-dd"),
      checkOut: format(range.to, "yyyy-MM-dd"),
      guestCount,
    });
  };
  return (
    <div className="container py-8">
      <div className="mb-6">
        <span className="rounded-full bg-secondary px-3 py-1 text-sm font-bold text-secondary-foreground">
          {p.type === "HOTEL" ? "Khách sạn" : "Homestay"}
        </span>
        <h1 className="mt-3 text-3xl font-black md:text-4xl">{p.name}</h1>
        <p className="mt-2 flex items-center gap-2 text-muted">
          <MapPin size={17} />
          {p.address}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl md:aspect-auto md:min-h-96">
          <Image
            src={p.images[0]?.url}
            alt={p.name}
            fill
            className="object-cover"
            priority
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {p.images.slice(1, 5).map((image) => (
            <div
              key={image.id}
              className="relative min-h-40 overflow-hidden rounded-2xl"
            >
              <Image
                src={image.url}
                alt={p.name}
                fill
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1fr_390px]">
        <article>
          <h2 className="text-2xl font-black">Không gian dành cho bạn</h2>
          <div className="my-6 flex flex-wrap gap-4 border-y border-border py-5 text-sm">
            <span className="flex items-center gap-2 [&>svg]:text-primary-dark">
              <Users /> Tối đa {p.maxGuests} khách
            </span>
            <span className="flex items-center gap-2 [&>svg]:text-primary-dark">
              <House /> {p.bedrooms} phòng ngủ
            </span>
            <span className="flex items-center gap-2 [&>svg]:text-primary-dark">
              <BedDouble /> {p.beds} giường
            </span>
            <span className="flex items-center gap-2 [&>svg]:text-primary-dark">
              <ShowerHead /> {p.bathrooms} phòng tắm
            </span>
          </div>
          <p className="leading-8 text-muted">{p.description}</p>
          <h2 className="mt-10 text-2xl font-black">Tiện ích</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {p.propertyAmenities.map(({ amenity }) => (
              <div
                key={amenity.id}
                className="rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium"
              >
                {amenity.nameVi}
              </div>
            ))}
          </div>
          <h2 className="mt-10 text-2xl font-black">Chọn ngày lưu trú</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-white p-3 shadow-warm">
            <DayPicker
              mode="range"
              selected={range}
              onSelect={setRange}
              disabled={{ before: new Date() }}
              numberOfMonths={1}
            />
          </div>
        </article>
        <Card className="sticky top-24 p-6">
          <div>
            <strong className="text-2xl text-secondary-foreground">
              {money(p.pricePerNight)}
            </strong>
            <span className="text-muted"> / đêm</span>
          </div>
          <div className="mt-5 rounded-xl border border-border bg-surface p-3 text-sm">
            {range?.from ? format(range.from, "dd/MM/yyyy") : "Ngày nhận phòng"}{" "}
            → {range?.to ? format(range.to, "dd/MM/yyyy") : "Ngày trả phòng"}
          </div>
          <label className="mt-4 grid gap-2 text-sm font-semibold">
            Số khách
            <Input
              type="number"
              min={1}
              max={p.maxGuests}
              value={guestCount}
              onChange={(e) => setGuestCount(Number(e.target.value))}
            />
          </label>
          {nights > 0 && (
            <div className="mt-5 grid gap-2 border-t border-border pt-5 text-sm">
              <div className="flex justify-between">
                <span>
                  {money(p.pricePerNight)} × {nights} đêm
                </span>
                <span>{money(total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tiền cọc ({p.depositPercent}%)</span>
                <strong>{money(deposit)}</strong>
              </div>
              <div className="flex justify-between text-muted">
                <span>Thanh toán tại chỗ</span>
                <span>{money(total - deposit)}</span>
              </div>
            </div>
          )}
          <Button
            className="mt-5 w-full"
            disabled={booking.isPending}
            onClick={reserve}
          >
            {booking.isPending ? "Đang xử lý..." : "Đặt phòng"}
          </Button>
          <p className="mt-3 text-center text-xs text-muted">
            Bạn chỉ thanh toán tiền cọc sau khi tạo đặt phòng.
          </p>
        </Card>
      </div>
    </div>
  );
}
