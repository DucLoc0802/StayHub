"use client";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { Card, PageState } from "@/components/ui";

const roleText = { GUEST: "Khách", HOST: "Chủ nhà", ADMIN: "Quản trị viên" };
const statusText = {
  ACTIVE: "Đang hoạt động",
  PENDING: "Chờ phê duyệt",
  REJECTED: "Đã bị từ chối",
};
export default function AccountPage() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="container py-12">
        <PageState>Đang tải tài khoản...</PageState>
      </div>
    );
  if (!user)
    return (
      <div className="container py-12">
        <PageState>
          Vui lòng{" "}
          <Link
            className="font-semibold text-secondary-foreground"
            href="/login"
          >
            đăng nhập
          </Link>{" "}
          để xem tài khoản.
        </PageState>
      </div>
    );
  return (
    <div className="container max-w-3xl py-12">
      <h1 className="text-3xl font-extrabold">Tài khoản của tôi</h1>
      {user.role === "HOST" && user.status === "PENDING" && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 font-medium text-amber-800">
          Tài khoản chủ nhà của bạn đang chờ phê duyệt.
        </div>
      )}
      {user.role === "HOST" && user.status === "REJECTED" && (
        <div className="mt-6 rounded-2xl bg-red-50 p-5 text-red-700">
          Yêu cầu trở thành chủ nhà của bạn đã bị từ chối.
        </div>
      )}
      <Card className="mt-6 grid gap-5 p-6 sm:grid-cols-2">
        <Info label="Họ và tên" value={user.fullName} />
        <Info label="Email" value={user.email} />
        <Info label="Vai trò" value={roleText[user.role]} />
        <Info label="Trạng thái" value={statusText[user.status]} />
      </Card>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 font-bold">{value}</div>
    </div>
  );
}
