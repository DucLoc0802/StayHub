import { AdminBookings } from '@/components/admin-management';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const query = await searchParams;
  const propertyId = /^[a-f0-9-]{36}$/i.test(query.propertyId ?? '')
    ? query.propertyId!
    : '';
  return <AdminBookings key={propertyId} initialPropertyId={propertyId} />;
}
