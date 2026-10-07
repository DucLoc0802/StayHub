'use client';
import { useId, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, ArrowLeft, ArrowRight } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { districts, money } from '@/lib/utils';
import { PropertyCard } from './property-card';
import { SearchBox } from './search-box';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Empty, ErrorState, Loading, PropertySkeletons } from './ui/states';
const PRICE_LIMIT = 5000000;
const PRICE_STEP = 50000;

function FilterForm({ onApply }: { onApply?: () => void }) {
  const formId = useId();
  const params = useSearchParams();
  const router = useRouter();
  const [priceRange, setPriceRange] = useState<[number, number]>(() => {
    function initialPrice(key: string, fallback: number) {
      const value = params.get(key);
      const price = value ? Number(value) : fallback;
      return Number.isFinite(price)
        ? Math.min(
            PRICE_LIMIT,
            Math.max(0, Math.round(price / PRICE_STEP) * PRICE_STEP),
          )
        : fallback;
    }
    const minPrice = initialPrice('minPrice', 0);
    const maxPrice = initialPrice('maxPrice', PRICE_LIMIT);
    return [Math.min(minPrice, maxPrice), Math.max(minPrice, maxPrice)];
  });
  const amenities = useQuery({
    queryKey: ['amenities'],
    queryFn: api.amenities,
  });
  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const query = new URLSearchParams(params.toString());
    for (const key of ['district', 'type', 'minPrice', 'maxPrice']) {
      const value = String(data.get(key) ?? '');
      if (value) query.set(key, value);
      else query.delete(key);
    }
    const selected = data.getAll('amenities').join(',');
    if (selected) query.set('amenities', selected);
    else query.delete('amenities');
    query.delete('page');
    router.push(`/properties?${query}`);
    onApply?.();
  }
  return (
    <form onSubmit={apply} className="space-y-6">
      <div className="field">
        <label htmlFor={`${formId}-district`}>Khu vực</label>
        <select
          id={`${formId}-district`}
          name="district"
          defaultValue={params.get('district') ?? ''}
        >
          <option value="">Tất cả khu vực</option>
          {districts.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${formId}-type`}>Loại chỗ nghỉ</label>
        <select
          id={`${formId}-type`}
          name="type"
          defaultValue={params.get('type') ?? ''}
        >
          <option value="">Tất cả loại chỗ nghỉ</option>
          <option value="HOMESTAY">Homestay</option>
          <option value="HOTEL">Khách sạn</option>
        </select>
      </div>
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">
          Ngân sách mỗi đêm
        </legend>
        <div className="space-y-3">
          <div className="flex justify-between gap-2 text-xs text-muted-foreground">
            <label className="!text-xs" htmlFor={`${formId}-min-price`}>
              Từ{' '}
              <span className="font-semibold text-foreground">
                {money(priceRange[0])}
              </span>
            </label>
            <label
              className="!text-xs text-right"
              htmlFor={`${formId}-max-price`}
            >
              Đến{' '}
              <span className="font-semibold text-foreground">
                {money(priceRange[1])}
              </span>
            </label>
          </div>
          <div className="relative flex h-8 items-center">
            <div
              aria-hidden="true"
              className="absolute inset-x-2 h-1.5 rounded-full bg-border"
            >
              <div
                className="absolute h-full rounded-full bg-primary"
                style={{
                  left: `${(priceRange[0] / PRICE_LIMIT) * 100}%`,
                  right: `${100 - (priceRange[1] / PRICE_LIMIT) * 100}%`,
                }}
              />
            </div>
            <input
              id={`${formId}-min-price`}
              className="price-range"
              style={{ zIndex: priceRange[0] === PRICE_LIMIT ? 3 : 1 }}
              type="range"
              name="minPrice"
              min={0}
              max={PRICE_LIMIT}
              step={PRICE_STEP}
              value={priceRange[0]}
              aria-valuemax={priceRange[1]}
              aria-valuetext={money(priceRange[0])}
              onChange={(event) =>
                setPriceRange(([, maxPrice]) => [
                  Math.min(Number(event.target.value), maxPrice),
                  maxPrice,
                ])
              }
            />
            <input
              id={`${formId}-max-price`}
              className="price-range z-2"
              type="range"
              name="maxPrice"
              min={0}
              max={PRICE_LIMIT}
              step={PRICE_STEP}
              value={priceRange[1]}
              aria-valuemin={priceRange[0]}
              aria-valuetext={money(priceRange[1])}
              onChange={(event) =>
                setPriceRange(([minPrice]) => [
                  minPrice,
                  Math.max(Number(event.target.value), minPrice),
                ])
              }
            />
          </div>
          <div
            aria-hidden="true"
            className="flex justify-between text-xs text-muted-foreground"
          >
            <span>0 ₫</span>
            <span>5 triệu ₫</span>
          </div>
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">Tiện ích</legend>
        {amenities.isPending ? (
          <Loading />
        ) : amenities.isError ? (
          <ErrorState
            message={errorMessage(amenities.error)}
            retry={() => void amenities.refetch()}
          />
        ) : (
          <div className="space-y-3">
            {amenities.data.map((a) => (
              <label
                key={a.id}
                className="flex items-center gap-3 !font-normal"
              >
                <input
                  type="checkbox"
                  name="amenities"
                  value={a.id}
                  defaultChecked={(params.get('amenities') ?? '')
                    .split(',')
                    .includes(a.id)}
                />
                {a.nameVi}
              </label>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Chỗ nghỉ cần có đủ các tiện ích bạn chọn.
        </p>
      </fieldset>
      <Button type="submit" className="w-full">
        Áp dụng bộ lọc
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => {
          router.push('/properties');
          onApply?.();
        }}
      >
        Xóa bộ lọc
      </Button>
    </form>
  );
}
export function PropertyList() {
  const params = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const filters = Object.fromEntries(params.entries());
  const properties = useQuery({
    queryKey: ['properties', params.toString()],
    queryFn: () => api.properties(filters),
  });
  function change(key: string, value: string) {
    const query = new URLSearchParams(params.toString());
    if (value) query.set(key, value);
    else query.delete(key);
    if (key !== 'page') query.delete('page');
    router.push(`/properties?${query}`);
  }
  return (
    <div className="container-shell page-section">
      <p className="eyebrow">KHÁM PHÁ SÀI GÒN</p>
      <h1 className="page-title mb-7 mt-3">Tìm một nơi bạn muốn ở lại.</h1>
      <SearchBox key={params.get('q')} initial={params.get('q') ?? ''} />
      <div className="mt-9 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden self-start rounded-2xl border bg-white p-5 lg:block">
          <h2 className="mb-6 flex items-center gap-2 font-semibold">
            <SlidersHorizontal size={18} />
            Lọc chỗ nghỉ
          </h2>
          <FilterForm key={params.toString()} />
        </aside>
        <div className="min-w-0">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {properties.data ? (
                <>
                  <strong className="text-foreground">
                    {properties.data.total}
                  </strong>{' '}
                  chỗ nghỉ tại TP. Hồ Chí Minh
                </>
              ) : (
                'Chỗ nghỉ tại TP. Hồ Chí Minh'
              )}
            </p>
            <div className="flex gap-2">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="lg:hidden">
                    <SlidersHorizontal size={16} />
                    Bộ lọc
                  </Button>
                </DialogTrigger>
                <DialogContent motion="sheet">
                  <DialogTitle className="mb-2 text-lg font-semibold">
                    Lọc chỗ nghỉ
                  </DialogTitle>
                  <DialogDescription className="mb-6 text-sm text-muted-foreground">
                    Chọn khu vực, loại chỗ nghỉ, ngân sách và tiện ích phù hợp.
                  </DialogDescription>
                  <FilterForm
                    key={params.toString()}
                    onApply={() => setOpen(false)}
                  />
                </DialogContent>
              </Dialog>
              <label className="sr-only" htmlFor="sort">
                Sắp xếp
              </label>
              <select
                id="sort"
                value={params.get('sort') ?? ''}
                onChange={(e) => change('sort', e.target.value)}
                className="!w-auto"
              >
                <option value="">Mới nhất</option>
                <option value="price_asc">Giá thấp đến cao</option>
                <option value="price_desc">Giá cao đến thấp</option>
              </select>
            </div>
          </div>
          {properties.isPending ? (
            <PropertySkeletons />
          ) : properties.isError ? (
            <ErrorState
              message={errorMessage(properties.error)}
              retry={() => void properties.refetch()}
            />
          ) : properties.data.items.length ? (
            <>
              <div
                key={params.toString()}
                className="motion-list grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
              >
                {properties.data.items.map((p) => (
                  <PropertyCard key={p.id} property={p} />
                ))}
              </div>
              <nav
                aria-label="Phân trang"
                className="mt-8 flex items-center justify-center gap-4"
              >
                <Button
                  variant="outline"
                  disabled={properties.data.page <= 1}
                  onClick={() =>
                    change('page', String(properties.data.page - 1))
                  }
                >
                  <ArrowLeft size={16} />
                  Trước
                </Button>
                <span className="text-sm">
                  {properties.data.page} / {properties.data.totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={properties.data.page >= properties.data.totalPages}
                  onClick={() =>
                    change('page', String(properties.data.page + 1))
                  }
                >
                  Sau
                  <ArrowRight size={16} />
                </Button>
              </nav>
            </>
          ) : (
            <Empty>Không tìm thấy chỗ nghỉ phù hợp.</Empty>
          )}
        </div>
      </div>
    </div>
  );
}
