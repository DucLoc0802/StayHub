import { RequireAuth } from '@/components/require-auth';
import { BookingScreen } from '@/components/booking-pages';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RequireAuth>
      <BookingScreen id={id} />
    </RequireAuth>
  );
}
