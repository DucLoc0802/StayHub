import { PropertyForm } from '@/components/property-form';
export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PropertyForm id={id} />;
}
