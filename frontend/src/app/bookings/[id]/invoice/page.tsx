import { RequireAuth } from '@/components/require-auth';
import { InvoiceScreen } from '@/components/booking-pages';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RequireAuth>
      <InvoiceScreen id={id} />
    </RequireAuth>
  );
}
