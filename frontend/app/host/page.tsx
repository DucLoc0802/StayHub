"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { PropertyForm } from "@/components/property-form";
import { Button, Card, PageState } from "@/components/ui";
import { bookingService, propertyService, PropertyInput } from "@/lib/services";
import { Property } from "@/lib/types";
import { apiError, dateVi, money } from "@/lib/utils";

export default function HostPage() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"properties" | "bookings">("properties");
  const queryClient = useQueryClient();
  const properties = useQuery({
    queryKey: ["host-properties"],
    queryFn: propertyService.hostList,
    enabled: user?.role === "HOST" && user.status === "ACTIVE",
  });
  const bookings = useQuery({
    queryKey: ["host-bookings"],
    queryFn: bookingService.host,
    enabled:
      user?.role === "HOST" && user.status === "ACTIVE" && tab === "bookings",
  });
  const create = useMutation({
    mutationFn: propertyService.create,
    onSuccess: () => {
      toast.success("Đã tạo chỗ nghỉ.");
      queryClient.invalidateQueries({ queryKey: ["host-properties"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PropertyInput }) =>
      propertyService.update(id, data),
    onSuccess: () => {
      toast.success("Đã cập nhật chỗ nghỉ.");
      queryClient.invalidateQueries({ queryKey: ["host-properties"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const status = useMutation({
    mutationFn: ({ id, value }: { id: string; value: "ACTIVE" | "INACTIVE" }) =>
      propertyService.status(id, value),
    onSuccess: () => {
      toast.success("Đã cập nhật trạng thái.");
      queryClient.invalidateQueries({ queryKey: ["host-properties"] });
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
  if (user.role !== "HOST")
    return (
      <div className="container py-12">
        <PageState>Khu vực này chỉ dành cho chủ nhà.</PageState>
      </div>
    );
  if (user.status !== "ACTIVE")
    return (
      <div className="container max-w-2xl py-12">
        <div
          className={`rounded-2xl border p-8 text-center font-medium ${user.status === "PENDING" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-700"}`}
        >
          {user.status === "PENDING"
            ? "Tài khoản chủ nhà của bạn đang chờ phê duyệt."
            : "Tài khoản chủ nhà của bạn đã bị từ chối."}
        </div>
      </div>
    );
  return (
    <div className="container py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-bold text-secondary-foreground">Khu vực chủ nhà</p>
          <h1 className="text-3xl font-extrabold">Quản lý StayHub</h1>
        </div>
        {tab === "properties" && (
          <PropertyDialog
            label="Thêm chỗ nghỉ"
            icon={<Plus size={18} />}
            onSubmit={(data) => create.mutate(data)}
            pending={create.isPending}
          />
        )}
      </div>
      <div className="mt-8 flex gap-2 border-b border-border">
        <Tab active={tab === "properties"} onClick={() => setTab("properties")}>
          Chỗ nghỉ của tôi
        </Tab>
        <Tab active={tab === "bookings"} onClick={() => setTab("bookings")}>
          Đặt phòng
        </Tab>
      </div>
      {tab === "properties" ? (
        <div className="mt-6 grid gap-5">
          {properties.isLoading ? (
            <PageState>Đang tải...</PageState>
          ) : !properties.data?.length ? (
            <PageState>Bạn chưa có chỗ nghỉ nào.</PageState>
          ) : (
            properties.data.map((p) => (
              <Card
                key={p.id}
                className="grid overflow-hidden sm:grid-cols-[180px_1fr]"
              >
                <div className="relative min-h-44">
                  <Image
                    src={p.images[0]?.url}
                    alt={p.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                  <div>
                    <span
                      className={`text-xs font-bold ${p.status === "ACTIVE" ? "text-green-700" : "text-muted"}`}
                    >
                      {p.status === "ACTIVE"
                        ? "Đang hoạt động"
                        : "Đã tạm ngưng"}
                    </span>
                    <h2 className="mt-1 text-xl font-extrabold">{p.name}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {p.district} · {money(p.pricePerNight)} / đêm · Cọc{" "}
                      {p.depositPercent}%
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PropertyDialog
                      property={p}
                      label="Sửa"
                      icon={<Pencil size={16} />}
                      onSubmit={(data) => update.mutate({ id: p.id, data })}
                      pending={update.isPending}
                    />
                    <Button
                      variant={p.status === "ACTIVE" ? "danger" : "secondary"}
                      onClick={() =>
                        status.mutate({
                          id: p.id,
                          value: p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                        })
                      }
                    >
                      {p.status === "ACTIVE" ? "Tạm ngưng" : "Kích hoạt"}
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-surface">
              <tr>
                <th className="p-4">Chỗ nghỉ</th>
                <th className="p-4">Khách</th>
                <th className="p-4">Thời gian</th>
                <th className="p-4">Tổng tiền</th>
                <th className="p-4">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {bookings.data?.map((b) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="p-4 font-bold">{b.property.name}</td>
                  <td className="p-4">
                    {b.guest?.fullName}
                    <br />
                    <span className="text-muted">{b.guest?.email}</span>
                  </td>
                  <td className="p-4">
                    {dateVi(b.checkIn)} – {dateVi(b.checkOut)}
                  </td>
                  <td className="p-4">{money(b.totalAmount)}</td>
                  <td className="p-4">
                    <span
                      className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${b.status === "CONFIRMED" ? "bg-green-50 text-green-700" : b.status === "CANCELLED" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}
                    >
                      {b.status === "CONFIRMED"
                        ? "Đã xác nhận"
                        : b.status === "CANCELLED"
                          ? "Đã hủy"
                          : "Chờ thanh toán"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!bookings.isLoading && !bookings.data?.length && (
            <PageState>Chưa có đặt phòng nào cho chỗ nghỉ của bạn.</PageState>
          )}
        </div>
      )}
    </div>
  );
}
function Tab({
  active,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      className={`border-b-2 px-4 py-3 font-bold ${active ? "border-primary text-secondary-foreground" : "border-transparent text-muted hover:text-ink"}`}
      {...props}
    />
  );
}
function PropertyDialog({
  property,
  label,
  icon,
  onSubmit,
  pending,
}: {
  property?: Property;
  label: string;
  icon: React.ReactNode;
  onSubmit: (data: PropertyInput) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant={property ? "ghost" : "primary"} className="gap-2">
          {icon}
          {label}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed inset-2 z-50 overflow-auto rounded-2xl bg-white p-5 shadow-2xl sm:inset-8 lg:left-1/2 lg:w-[900px] lg:-translate-x-1/2">
          <div className="mb-6 flex justify-between">
            <Dialog.Title className="text-2xl font-extrabold">
              {property ? "Chỉnh sửa chỗ nghỉ" : "Thêm chỗ nghỉ mới"}
            </Dialog.Title>
            <Dialog.Close>
              <X />
            </Dialog.Close>
          </div>
          <PropertyForm
            property={property}
            pending={pending}
            onSubmit={(data) => {
              onSubmit(data);
              if (!pending) setOpen(false);
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
