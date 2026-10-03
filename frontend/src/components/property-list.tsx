'use client';
import { useId, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, ArrowLeft, ArrowRight } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { districts } from '@/lib/utils';
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
import { Empty, ErrorState, Loading } from './ui/states';
function FilterForm({ onApply }: { onApply?: () => void }) {
  const formId = useId();
  const params = useSearchParams();
  const router = useRouter();
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
          <div className="field">
            <label
              className="text-xs text-muted-foreground"
              htmlFor={`${formId}-min-price`}
            >
              Từ (₫)
            </label>
            <input
              id={`${formId}-min-price`}
              type="number"
              name="minPrice"
              min={0}
              max={50000000}
              defaultValue={params.get('minPrice') ?? ''}
              placeholder="0"
            />
          </div>
          <div className="field">
            <label
              className="text-xs text-muted-foreground"
              htmlFor={`${formId}-max-price`}
            >
              Đến (₫)
            </label>
            <input
              id={`${formId}-max-price`}
              type="number"
              name="maxPrice"
              min={0}
              max={50000000}
              defaultValue={params.get('maxPrice') ?? ''}
              placeholder="Không giới hạn"
            />
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
                <DialogContent>
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
            <Loading />
          ) : properties.isError ? (
            <ErrorState
              message={errorMessage(properties.error)}
              retry={() => void properties.refetch()}
            />
          ) : properties.data.items.length ? (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
