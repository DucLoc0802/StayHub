'use client';
import Link from 'next/link';
import { Clock3, CircleX } from 'lucide-react';
import { useAuth } from '@/components/providers';
import { RequireAuth } from '@/components/require-auth';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/states';
import { roleLabel } from '@/lib/utils';
import { ProfileEditor } from '@/components/profile-editor';
function Account() {
  const { user, retry } = useAuth();
  if (!user) return null;
  return (
    <div className="container-shell py-8 md:py-10">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-6 text-2xl font-semibold leading-snug tracking-tight">
          Tài khoản của tôi
        </h1>
        <div className="motion-content">
          <div className="mb-4">
            <h2 className="break-words text-lg font-semibold">
              {user.fullName}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {roleLabel[user.role]}
            </p>
          </div>
          <dl className="grid gap-4 border-t pt-4 sm:grid-cols-[minmax(0,1fr)_auto]">
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
          <ProfileEditor />
        </div>
        {user.role === 'HOST' && user.status !== 'ACTIVE' && (
          <div className="mt-6 border-t pt-5">
            {user.status === 'PENDING' ? (
              <Clock3 className="mb-2 text-warning" size={20} />
            ) : (
              <CircleX className="mb-2 text-destructive" size={20} />
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
