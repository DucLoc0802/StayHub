'use client';
import { createContext, useContext, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { ErrorState, Loading } from './ui/states';
const Scope = createContext<string | undefined>(undefined);
export const useHostProperty = () => useContext(Scope);
export function HostPropertyScope({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState('');
  const pathname = usePathname(),
    router = useRouter();
  const query = useQuery({
    queryKey: ['my-properties'],
    queryFn: api.myProperties,
  });
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <ErrorState
        message={errorMessage(query.error)}
        retry={() => void query.refetch()}
      />
    );
  const routeId = pathname.match(/^\/host\/properties\/([^/]+)\/edit$/)?.[1];
  const id = query.data.some((p) => p.id === routeId)
    ? routeId
    : query.data.some((p) => p.id === selected)
      ? selected
      : query.data[0]?.id;
  return (
    <Scope.Provider value={id}>
      {query.data.length > 1 ? (
        <div className="field mb-6 max-w-xl">
          <label htmlFor="host-property">Cơ sở đang quản lý</label>
          <select
            id="host-property"
            value={id ?? ''}
            onChange={(e) => {
              setSelected(e.target.value);
              if (routeId)
                router.push(`/host/properties/${e.target.value}/edit`);
            }}
          >
            {query.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.district}
              </option>
            ))}
          </select>
        </div>
      ) : query.data[0] ? (
        <p className="mb-6 font-medium">{query.data[0].name}</p>
      ) : null}
      {children}
    </Scope.Provider>
  );
}
