"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PropertyCard } from "@/components/property-card";
import { Button, Input, PageState, Select } from "@/components/ui";
import { propertyService } from "@/lib/services";

function PropertiesContent() {
  const search = useSearchParams();
  const [filters, setFilters] = useState({
    q: search.get("q") ?? "",
    minPrice: "",
    maxPrice: "",
    amenities: [] as string[],
    sort: "",
  });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const amenities = useQuery({
    queryKey: ["amenities"],
    queryFn: propertyService.amenities,
  });
  const result = useQuery({
    queryKey: ["properties", applied, page],
    queryFn: () =>
      propertyService.list({
        q: applied.q || undefined,
        minPrice: applied.minPrice || undefined,
        maxPrice: applied.maxPrice || undefined,
        amenities: applied.amenities.join(",") || undefined,
        sort: applied.sort || undefined,
        page,
      }),
  });
  const filterPanel = (
    <div className="grid gap-5">
      <label className="grid gap-2 text-sm font-semibold">
        Tên chỗ nghỉ hoặc quận
        <Input
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          placeholder="Ví dụ: Quận 1"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-2 text-sm font-semibold">
          Giá từ
          <Input
            type="number"
            min="0"
            value={filters.minPrice}
            onChange={(e) =>
              setFilters({ ...filters, minPrice: e.target.value })
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Đến
          <Input
            type="number"
            min="0"
            value={filters.maxPrice}
            onChange={(e) =>
              setFilters({ ...filters, maxPrice: e.target.value })
            }
          />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-semibold">
        Sắp xếp
        <Select
          value={filters.sort}
          onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
        >
          <option value="">Mới nhất</option>
          <option value="price_asc">Giá thấp đến cao</option>
          <option value="price_desc">Giá cao đến thấp</option>
        </Select>
      </label>
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">Tiện ích</legend>
        <div className="grid gap-2">
          {amenities.data?.map((item) => (
            <label
              key={item.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${filters.amenities.includes(item.code) ? "border-primary bg-secondary text-ink" : "border-transparent bg-white text-muted hover:border-border hover:bg-surface"}`}
            >
              <input
                type="checkbox"
                checked={filters.amenities.includes(item.code)}
                onChange={() =>
                  setFilters({
                    ...filters,
                    amenities: filters.amenities.includes(item.code)
                      ? filters.amenities.filter((x) => x !== item.code)
                      : [...filters.amenities, item.code],
                  })
                }
              />
              {item.nameVi}
            </label>
          ))}
        </div>
      </fieldset>
      <Button
        onClick={() => {
          setApplied(filters);
          setPage(1);
        }}
      >
        Áp dụng bộ lọc
      </Button>
    </div>
  );
  return (
    <div className="container py-10">
      <div className="mb-8">
        <p className="font-bold text-secondary-foreground">
          StayHub tại TP.HCM
        </p>
        <h1 className="text-3xl font-black md:text-4xl">
          Tìm chỗ nghỉ phù hợp
        </h1>
      </div>
      <div className="mb-5 flex justify-between lg:hidden">
        <span className="text-sm text-muted">
          {result.data?.meta.total ?? 0} chỗ nghỉ
        </span>
        <Dialog.Root>
          <Dialog.Trigger asChild>
            <Button variant="ghost" className="gap-2">
              <SlidersHorizontal size={17} /> Bộ lọc
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
            <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-[min(90vw,380px)] overflow-auto bg-white p-6 shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <Dialog.Title className="text-xl font-black">
                  Bộ lọc
                </Dialog.Title>
                <Dialog.Close>
                  <X />
                </Dialog.Close>
              </div>
              {filterPanel}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
      <div className="grid gap-7 lg:grid-cols-[260px_1fr]">
        <aside className="hidden h-fit rounded-2xl border border-border bg-white p-5 lg:block">
          <h2 className="mb-5 text-lg font-black">Bộ lọc</h2>
          {filterPanel}
        </aside>
        <div>
          {result.isLoading ? (
            <PageState>Đang tìm chỗ nghỉ...</PageState>
          ) : result.isError ? (
            <PageState>Không thể tải danh sách chỗ nghỉ.</PageState>
          ) : !result.data?.items.length ? (
            <PageState>Không tìm thấy chỗ nghỉ phù hợp.</PageState>
          ) : (
            <>
              <div className="mb-5 hidden text-sm text-muted lg:block">
                Tìm thấy {result.data.meta.total} chỗ nghỉ
              </div>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {result.data.items.map((p) => (
                  <PropertyCard key={p.id} property={p} />
                ))}
              </div>
              <div className="mt-8 flex items-center justify-center gap-3">
                <Button
                  variant="ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Trang trước
                </Button>
                <span className="text-sm">
                  Trang {page} / {result.data.meta.totalPages || 1}
                </span>
                <Button
                  variant="ghost"
                  disabled={page >= result.data.meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Trang sau
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
export default function PropertiesPage() {
  return (
    <Suspense>
      <PropertiesContent />
    </Suspense>
  );
}
