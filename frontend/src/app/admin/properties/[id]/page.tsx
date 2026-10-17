import { AdminPropertyDetail } from '@/components/admin-properties';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminPropertyDetail id={id} />;
}
