import { Suspense } from 'react';
import { PropertyList } from '@/components/property-list';
import { Loading } from '@/components/ui/states';
export default function PropertiesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PropertyList />
    </Suspense>
  );
}
