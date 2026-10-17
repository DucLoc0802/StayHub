'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/utils';
import { Empty, ErrorState, Loading, StatusBadge } from './ui/states';
import { Pager } from './admin-management';
export function AdminProperties() {
  const [q, setQ] = useState(''),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['admin-properties', q, page],
    queryFn: () => api.adminProperties({ q: q || undefined, page }),
  });
  return (
    <div className="container-shell py-6 sm:py-8">
      <h1 className="page-title">Cơ sở lưu trú</h1>
      <p className="mt-3 mb-6 text-sm text-muted-foreground">
        Đối chiếu chủ cơ sở, chi nhánh và loại phòng trên toàn hệ thống.
      </p>
      <div className="panel mb-6 p-5">
        <div className="field max-w-lg">
          <label htmlFor="admin-property-search">Tên cơ sở / chi nhánh</label>
          <input
            id="admin-property-search"
            value={q}
            maxLength={191}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} />
      ) : (
        <>
          <div className="panel divide-y px-5 sm:px-6">
            {query.data.items.map((p) => (
              <article
                key={p.id}
                className="grid gap-3 py-5 text-sm sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <h2 className="mb-2 font-semibold">{p.name}</h2>
                  <p>Chủ cơ sở: {p.host.fullName}</p>
                  <p className="mt-1 text-muted-foreground">{p.address}</p>
                  <p className="mt-2">
                    {p.roomTypes.length} loại phòng ·{' '}
                    {p.roomTypes.reduce(
                      (count, room) => count + room.totalUnits,
                      0,
                    )}{' '}
                    đơn vị
                  </p>
                </div>
                <div className="space-y-3">
                  <StatusBadge status={p.status} />
                  <p>
                    {p.minPricePerNight == null
                      ? 'Chưa có phòng mở bán'
                      : `Từ ${money(p.minPricePerNight)} / đêm`}
                  </p>
                </div>
              </article>
            ))}
            {!query.data.items.length && (
              <Empty>Không tìm thấy cơ sở phù hợp.</Empty>
            )}
          </div>
          <Pager {...query.data} onChange={setPage} />
        </>
      )}
    </div>
  );
}
