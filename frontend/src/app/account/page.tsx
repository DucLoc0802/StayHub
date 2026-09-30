'use client';
import Link from 'next/link';
import { UserRound, Clock3, CircleX } from 'lucide-react';
import { useAuth } from '@/components/providers';
import { RequireAuth } from '@/components/require-auth';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/states';
import { roleLabel } from '@/lib/utils';
function Account() {
  const { user, retry } = useAuth();
  if (!user) return null;
  return (
    <div className="container-shell page-section">
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow">GÓC CỦA BẠN</p>
        <h1 className="page-title mb-8 mt-3">Tài khoản của tôi</h1>
        <div className="panel p-7">
          <div className="mb-6 flex items-center gap-4">
            <span className="rounded-full bg-accent p-4">
              <UserRound size={28} />
            </span>
            <div>
              <h2 className="text-lg font-semibold">{user.fullName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {roleLabel[user.role]}
              </p>
            </div>
          </div>
          <dl className="grid gap-5 border-t pt-6">
            <div>
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd className="mt-1 break-all">{user.email}</dd>
            </div>
            <div>
              <dt className="mb-2 text-xs text-muted-foreground">
                Trạng thái tài khoản
              </dt>
              <dd>
                <StatusBadge status={user.status} />
              </dd>
            </div>
          </dl>
        </div>
        {user.role === 'HOST' && user.status !== 'ACTIVE' && (
          <div className="mt-5 rounded-2xl border bg-cream p-6">
            {user.status === 'PENDING' ? (
              <Clock3 className="mb-3 text-warning" />
            ) : (
              <CircleX className="mb-3 text-destructive" />
            )}
            <h2 className="font-semibold">
              {user.status === 'PENDING'
                ? 'Tài khoản của bạn đang chờ phê duyệt.'
                : 'Tài khoản Người cho thuê của bạn đã bị từ chối.'}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Bạn chỉ có thể quản lý chỗ nghỉ sau khi tài khoản được phê duyệt.
            </p>
            <Button variant="outline" className="mt-4" onClick={retry}>
              Cập nhật trạng thái
            </Button>
          </div>
        )}
        {user.status === 'ACTIVE' && (
          <Button asChild className="mt-6">
            <Link
              href={
                user.role === 'HOST'
                  ? '/host'
                  : user.role === 'ADMIN'
                    ? '/admin/hosts'
                    : '/bookings'
              }
            >
              {user.role === 'HOST'
                ? 'Quản lý chỗ nghỉ'
                : user.role === 'ADMIN'
                  ? 'Xét duyệt người cho thuê'
                  : 'Đặt phòng của tôi'}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
export default function AccountPage() {
  return (
    <RequireAuth>
      <Account />
    </RequireAuth>
  );
}
