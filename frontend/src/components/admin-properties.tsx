'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, MapPin, Search, UserRound } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/utils';
import { Empty, ErrorState, Loading, StatusBadge } from './ui/states';
import { Button } from './ui/button';
import { Pager } from './admin-management';
import { PropertyImage } from './property-image';
export function AdminProperties() {
  const [input, setInput] = useState(''),
    [q, setQ] = useState(''),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['admin-properties', q, page],
    queryFn: () => api.adminProperties({ q: q || undefined, page }),
  });
  return (
    <div className="container-shell py-6 sm:py-8">
      <h1 className="page-title">Cơ sở lưu trú</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
        Theo dõi cơ sở, chủ sở hữu và phòng trên toàn hệ thống.
      </p>
      <div className="my-6 flex flex-wrap items-end justify-between gap-4">
        <form
          className="flex w-full max-w-xl flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(input.trim());
            setPage(1);
          }}
        >
          <div className="field min-w-0 flex-1">
            <label htmlFor="admin-property-search">Tên cơ sở / chi nhánh</label>
            <input
              id="admin-property-search"
              maxLength={191}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập tên cơ sở cần tìm"
            />
          </div>
          <Button variant="outline">
            <Search size={17} />
            Tìm
          </Button>
          {q && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setInput('');
                setQ('');
                setPage(1);
              }}
            >
              Xóa
            </Button>
          )}
        </form>
        {query.data && (
          <p className="text-sm text-muted-foreground">
            {query.data.total} cơ sở
          </p>
        )}
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <div className="panel space-y-4 p-6">
          <h2 className="text-lg font-semibold">
            Chưa tải được danh sách cơ sở
          </h2>
          <ErrorState
            message={errorMessage(query.error)}
            retry={() => void query.refetch()}
          />
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {query.data.items.map((p) => (
              <article
                key={p.id}
                className="panel grid min-w-0 gap-5 p-5 sm:p-6 lg:grid-cols-[180px_minmax(0,1fr)]"
              >
                <PropertyImage
                  src={p.images[0]?.url}
                  alt={p.name}
                  className="hidden h-full min-h-44 w-full rounded-lg object-cover lg:block"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="min-w-0 break-words text-xl font-bold leading-snug sm:text-2xl">
                      <Link
                        className="hover:underline"
                        href={`/admin/properties/${p.id}`}
                      >
                        {p.name}
                      </Link>
                    </h2>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="mt-3 flex items-start gap-2 text-sm font-medium">
                    <UserRound size={16} className="mt-0.5 shrink-0" />
                    Chủ cơ sở: {p.host.fullName}
                  </p>
                  <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                    <MapPin size={16} className="mt-1 shrink-0" />
                    <span>
                      {p.address} · {p.district}
                    </span>
                  </p>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t pt-4 text-sm">
                    <span>{p.type === 'HOTEL' ? 'Khách sạn' : 'Homestay'}</span>
                    <span>
                      {p.roomTypes.length} loại phòng ·{' '}
                      {p.roomTypes.reduce((sum, r) => sum + r.totalUnits, 0)}{' '}
                      đơn vị
                    </span>
                    <span className="font-semibold">
                      {p.minPricePerNight == null
                        ? 'Chưa có phòng mở bán'
                        : `Từ ${money(p.minPricePerNight)} / đêm`}
                    </span>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button asChild variant="outline">
                      <Link href={`/admin/properties/${p.id}`}>
                        Chi tiết cơ sở
                        <ArrowRight size={16} />
                      </Link>
                    </Button>
                    <Button asChild variant="ghost">
                      <Link href={`/admin/bookings?propertyId=${p.id}`}>
                        Tra cứu đặt phòng
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!query.data.items.length && (
            <div className="panel p-6">
              <Empty>Không tìm thấy cơ sở phù hợp.</Empty>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => {
                  setInput('');
                  setQ('');
                  setPage(1);
                }}
              >
                Xóa bộ lọc
              </Button>
            </div>
          )}
          <Pager {...query.data} onChange={setPage} />
        </>
      )}
    </div>
  );
}
export function AdminPropertyDetail({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['admin-property', id],
    queryFn: () => api.adminProperty(id),
  });
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <div className="container-shell page-section">
        <ErrorState
          message={errorMessage(query.error)}
          retry={() => void query.refetch()}
        />
        <Link href="/admin/properties" className="mt-5 inline-block underline">
          Về danh sách cơ sở
        </Link>
      </div>
    );
  const p = query.data;
  return (
    <div className="container-shell page-section">
      <Link
        href="/admin/properties"
        className="mb-5 inline-flex min-h-11 items-center text-sm underline"
      >
        Về danh sách cơ sở
      </Link>
      <article className="panel space-y-5 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="page-title">{p.name}</h1>
          <StatusBadge status={p.status} />
        </div>
        <p className="font-medium">Chủ cơ sở: {p.host.fullName}</p>
        <p className="text-sm text-muted-foreground">
          {p.address} · {p.district}
        </p>
        <p className="max-w-3xl text-sm leading-7">{p.description}</p>
        <p className="text-sm">
          {p.type === 'HOTEL' ? 'Khách sạn' : 'Homestay'} · Nhận phòng{' '}
          {p.checkInTime} · Trả phòng {p.checkOutTime} (UTC+7) · Cọc{' '}
          {p.depositPercent}%
        </p>
        <section className="border-t pt-5">
          <h2 className="text-xl font-semibold">Loại phòng và sức chứa</h2>
          <div className="mt-4 divide-y">
            {p.roomTypes.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap justify-between gap-3 py-4 text-sm"
              >
                <div>
                  <h3 className="font-semibold">{r.name}</h3>
                  <p className="mt-2 text-muted-foreground">
                    {r.totalUnits} đơn vị · Tối đa {r.maxGuests} khách / đơn vị
                  </p>
                </div>
                <div className="space-y-2">
                  <StatusBadge status={r.status} />
                  <p className="font-semibold">
                    {money(r.pricePerNight)} / đêm
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <Button asChild>
          <Link href={`/admin/bookings?propertyId=${p.id}`}>
            Tra cứu đặt phòng tại cơ sở này
          </Link>
        </Button>
      </article>
    </div>
  );
}
