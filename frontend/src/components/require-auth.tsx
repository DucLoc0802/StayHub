'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './providers';
import { Button } from './ui/button';
import { ErrorState, Loading } from './ui/states';
import { errorMessage } from '@/lib/api';
import type { Role } from '@/lib/types';
export function RequireAuth({
  role,
  children,
}: {
  role?: Role;
  children: React.ReactNode;
}) {
  const { user, loading, error, retry } = useAuth();
  const pathname = usePathname();
  if (loading) return <Loading />;
  if (error)
    return (
      <div className="container-shell page-section">
        <ErrorState message={errorMessage(error)} retry={retry} />
      </div>
    );
  if (!user)
    return (
      <div className="container-shell py-20 text-center">
        <h1 className="page-title">Đăng nhập để tiếp tục</h1>
        <p className="my-5 text-muted-foreground">
          Chuyến đi của bạn đang chờ.
        </p>
        <Button asChild>
          <Link href={`/login?next=${encodeURIComponent(pathname)}`}>
            Đăng nhập
          </Link>
        </Button>
      </div>
    );
  if (role && (user.role !== role || user.status !== 'ACTIVE'))
    return (
      <div className="container-shell page-section">
        <ErrorState message="Tài khoản của bạn chưa có quyền truy cập trang này." />
        <Button className="mt-4" asChild>
          <Link href="/account">Xem trạng thái tài khoản</Link>
        </Button>
      </div>
    );
  return children;
}
