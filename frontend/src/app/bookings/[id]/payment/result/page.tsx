import { RequireAuth } from '@/components/require-auth';
import { PaymentResultScreen } from '@/components/booking-pages';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RequireAuth role="GUEST">
      <PaymentResultScreen id={id} />
    </RequireAuth>
  );
}
