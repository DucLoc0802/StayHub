'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { roleRedirect } from '@/lib/role-routes';
import { useAuth } from './providers';
import { Loading } from './ui/states';
export function RoleBoundary({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const path = usePathname(),
    router = useRouter();
  const destination = user ? roleRedirect(user, path) : null;
  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);
  if (loading || destination) return <Loading />;
  return children;
}
