"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Button, Card, PageState } from "@/components/ui";
import { adminService } from "@/lib/services";
import { apiError, dateVi } from "@/lib/utils";

export default function AdminHostsPage() {
  const { user, loading } = useAuth();
  const client = useQueryClient();
  const hosts = useQuery({
    queryKey: ["pending-hosts"],
    queryFn: adminService.hosts,
    enabled: user?.role === "ADMIN",
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["pending-hosts"] });
  const approve = useMutation({
    mutationFn: adminService.approve,
    onSuccess: () => {
      toast.success("Đã phê duyệt chủ nhà.");
      refresh();
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const reject = useMutation({
    mutationFn: adminService.reject,
    onSuccess: () => {
      toast.success("Đã từ chối yêu cầu.");
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
  if (user.role !== "ADMIN")
    return (
      <div className="container py-12">
        <PageState>Bạn không có quyền truy cập trang quản trị.</PageState>
      </div>
    );
  return (
    <div className="container max-w-4xl py-10">
      <p className="font-bold text-secondary-foreground">Quản trị StayHub</p>
      <h1 className="text-3xl font-extrabold">Phê duyệt chủ nhà</h1>
      <p className="mt-2 text-muted">
        Danh sách tài khoản chủ nhà đang chờ xét duyệt.
      </p>
      <div className="mt-8 grid gap-4">
        {hosts.isLoading ? (
          <PageState>Đang tải...</PageState>
        ) : !hosts.data?.length ? (
          <PageState>Không có tài khoản chủ nhà nào đang chờ duyệt.</PageState>
        ) : (
          hosts.data.map((host) => (
            <Card
              key={host.id}
              className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
            >
              <div>
                <h2 className="font-extrabold">{host.fullName}</h2>
                <p className="text-sm text-muted">
                  {host.email} · Đăng ký {dateVi(host.createdAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={approve.isPending || reject.isPending}
                  onClick={() => approve.mutate(host.id)}
                >
                  Phê duyệt
                </Button>
                <Button
                  variant="danger"
                  disabled={approve.isPending || reject.isPending}
                  onClick={() => reject.mutate(host.id)}
                >
                  Từ chối
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
