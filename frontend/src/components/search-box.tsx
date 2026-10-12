'use client';
import { useRouter } from 'next/navigation';
import { MapPin, Search } from 'lucide-react';
import { Button } from './ui/button';
export function SearchBox({
  initial = '',
  variant = 'default',
}: {
  initial?: string;
  variant?: 'default' | 'homepage';
}) {
  const router = useRouter();
  const isHomepage = variant === 'homepage';
  return (
    <form
      role="search"
      aria-label="Tìm chỗ nghỉ"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        router.push(
          `/properties?q=${encodeURIComponent(String(data.get('q') ?? ''))}`,
        );
      }}
      className={
        isHomepage
          ? 'search-box homepage-search flex flex-col gap-3 rounded-xl bg-white p-3 text-foreground sm:flex-row sm:items-center sm:gap-5 sm:p-4'
          : 'search-box flex flex-col gap-3 rounded-lg border bg-white p-4 sm:flex-row sm:items-end'
      }
    >
      <div className="min-w-0 flex-1">
        <label
          htmlFor="destination"
          className={
            isHomepage
              ? 'mb-1 block text-left text-xs font-semibold sm:pl-1'
              : 'mb-2 block text-sm font-medium'
          }
        >
          Bạn muốn nghỉ ở đâu?
        </label>
        <div className={isHomepage ? 'relative' : undefined}>
          {isHomepage && (
            <MapPin
              size={20}
              strokeWidth={1.75}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary-foreground"
            />
          )}
          <input
            id="destination"
            name="q"
            defaultValue={initial}
            placeholder={
              isHomepage
                ? 'Tên chỗ nghỉ hoặc khu vực'
                : 'Tên chỗ nghỉ hoặc khu vực tại TP. Hồ Chí Minh'
            }
            maxLength={150}
            className={isHomepage ? 'homepage-search-input h-12' : 'h-12'}
          />
        </div>
      </div>
      <Button
        type="submit"
        size="lg"
        className={
          isHomepage ? 'h-13 shrink-0 px-6 sm:h-14 sm:px-8' : 'h-12 shrink-0'
        }
      >
        <Search size={18} aria-hidden="true" />
        Tìm chỗ nghỉ
      </Button>
    </form>
  );
}
