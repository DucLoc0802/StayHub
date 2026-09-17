"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Button, Card, PageState } from "@/components/ui";
import { bookingService } from "@/lib/services";
import { Booking } from "@/lib/types";
import { apiError, dateVi, money } from "@/lib/utils";

const statusLabel = {
  PENDING_PAYMENT: "Chờ thanh toán",
  CONFIRMED: "Đã xác nhận",
  CANCELLED: "Đã hủy",
};
const statusStyle = {
  PENDING_PAYMENT: "bg-amber-50 text-amber-800",
  CONFIRMED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
};
export default function BookingsPage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const bookings = useQuery({
    queryKey: ["my-bookings"],
    queryFn: bookingService.my,
    enabled: user?.role === "GUEST",
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
  const pay = useMutation({
    mutationFn: bookingService.pay,
    onSuccess: () => {
      toast.success(
        "Thanh toán tiền cọc thành công. Đặt phòng đã được xác nhận.",
      );
      refresh();
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const cancel = useMutation({
    mutationFn: bookingService.cancel,
    onSuccess: () => {
      toast.success("Đã hủy đặt phòng.");
      refresh();
    },
    onError: (e) => toast.error(apiError(e)),
  });
  if (loading)
    return (
      <div className="container py-12">
        <PageState>Đang tải...</PageState>
      </div>
    );
  if (!user)
    return (
      <div className="container py-12">
        <PageState>
          Vui lòng{" "}
          <Link
            href="/login"
            className="font-semibold text-secondary-foreground"
          >
            đăng nhập
          </Link>
          .
        </PageState>
      </div>
    );
  if (user.role !== "GUEST")
    return (
      <div className="container py-12">
        <PageState>Trang này chỉ dành cho tài khoản khách.</PageState>
      </div>
    );
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-extrabold">Đặt phòng của tôi</h1>
      <p className="mt-2 text-muted">
        Theo dõi, thanh toán tiền cọc và quản lý chuyến đi.
      </p>
      <div className="mt-8 grid gap-5">
        {bookings.isLoading ? (
          <PageState>Đang tải đặt phòng...</PageState>
        ) : !bookings.data?.length ? (
          <PageState>Bạn chưa có đặt phòng nào.</PageState>
        ) : (
          bookings.data.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              onPay={() => pay.mutate(b.id)}
              onCancel={() => cancel.mutate(b.id)}
              busy={pay.isPending || cancel.isPending}
            />
          ))
        )}
      </div>
    </div>
  );
}
function BookingCard({
  booking: b,
  onPay,
  onCancel,
  busy,
}: {
  booking: Booking;
  onPay: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="grid md:grid-cols-[220px_1fr]">
        <div className="relative min-h-48">
          <Image
            src={
              b.property.images[0]?.url ??
              "https://placehold.co/800x600/png?text=StayHub"
            }
            alt={b.property.name}
            fill
            className="object-cover"
          />
        </div>
        <div className="p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <span
                className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold uppercase ${statusStyle[b.status]}`}
              >
                {statusLabel[b.status]}
              </span>
              <h2 className="mt-1 text-xl font-extrabold">{b.property.name}</h2>
              <p className="text-sm text-muted">{b.property.district}</p>
            </div>
            <Link
              href={`/properties/${b.property.id}`}
              className="text-sm font-bold text-secondary-foreground transition hover:text-primary-dark"
            >
              Xem chỗ nghỉ
            </Link>
          </div>
          <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Info
              label="Thời gian"
              value={`${dateVi(b.checkIn)} – ${dateVi(b.checkOut)}`}
            />
            <Info label="Số đêm" value={`${b.totalNights} đêm`} />
            <Info label="Tổng tiền" value={money(b.totalAmount)} />
            <Info
              label={`Tiền cọc (${b.depositPercentSnapshot}%)`}
              value={money(b.depositAmount)}
            />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <span className="text-sm text-muted">
              Thanh toán tại chỗ:{" "}
              <strong className="text-ink">{money(b.remainingAmount)}</strong>
            </span>
            <div className="flex gap-2">
              {b.status === "PENDING_PAYMENT" && (
                <Button disabled={busy} onClick={onPay}>
                  Thanh toán tiền cọc
                </Button>
              )}
              {b.status !== "CANCELLED" && (
                <CancelDialog
                  booking={b}
                  onConfirm={onCancel}
                  disabled={busy}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted">{label}</div>
      <strong>{value}</strong>
    </div>
  );
}
function CancelDialog({
  booking,
  onConfirm,
  disabled,
}: {
  booking: Booking;
  onConfirm: () => void;
  disabled: boolean;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="danger" disabled={disabled}>
          Hủy đặt phòng
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl">
          <Dialog.Title className="text-xl font-extrabold">
            Xác nhận hủy đặt phòng
          </Dialog.Title>
          <Dialog.Description className="mt-3 leading-7 text-muted">
            {booking.status === "CONFIRMED"
              ? `Đặt phòng này đã được xác nhận. Nếu hủy, bạn sẽ mất khoản tiền cọc ${money(booking.depositAmount)}. Khoản cọc không được hoàn lại. Bạn có chắc chắn muốn tiếp tục?`
              : "Đặt phòng chưa được thanh toán nên bạn sẽ không mất tiền cọc. Bạn có chắc chắn muốn hủy?"}
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <Button variant="ghost">Quay lại</Button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <Button variant="danger" onClick={onConfirm}>
                Xác nhận hủy
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
