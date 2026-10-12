'use client';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
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
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        router.push(
          `/properties?q=${encodeURIComponent(String(data.get('q') ?? ''))}`,
        );
      }}
      className={
        isHomepage
          ? 'search-box flex flex-col gap-3 sm:flex-row sm:items-end'
          : 'search-box flex flex-col gap-3 rounded-lg border bg-white p-4 sm:flex-row sm:items-end'
      }
    >
      <div className="min-w-0 flex-1">
        <label
          htmlFor="destination"
          className="mb-2 block text-sm font-medium"
        >
          Bạn muốn nghỉ ở đâu?
        </label>
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
          className="h-12"
        />
      </div>
      <Button
        type="submit"
        size="lg"
        className="h-12 shrink-0"
      >
        <Search size={17} />
        Tìm chỗ nghỉ
      </Button>
    </form>
  );
}
