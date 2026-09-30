import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';
import { Loading } from '@/components/ui/states';
export default function RegisterPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AuthForm register />
    </Suspense>
  );
}
