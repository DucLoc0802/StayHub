import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';
import { Loading } from '@/components/ui/states';
export default function LoginPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AuthForm />
    </Suspense>
  );
}
