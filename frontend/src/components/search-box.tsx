'use client';
import { useRouter } from 'next/navigation';
import { MapPin, Search, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
export function SearchBox({ initial = '' }: { initial?: string }) {
  const router = useRouter();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        router.push(
          `/properties?q=${encodeURIComponent(String(data.get('q') ?? ''))}`,
        );
      }}
      className="flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-[0_8px_35px_rgba(85,54,35,0.06)] sm:flex-row sm:items-center sm:p-5"
    >
      <MapPin
        className="hidden shrink-0 text-secondary-foreground sm:block"
        size={25}
      />
      <div className="flex-1">
        <label
          htmlFor="destination"
          className="mb-1 block text-xs font-semibold"
        >
          Bạn muốn nghỉ ở đâu?
        </label>
        <input
          id="destination"
          name="q"
          defaultValue={initial}
          placeholder="Tên chỗ nghỉ hoặc khu vực tại TP. Hồ Chí Minh"
          maxLength={150}
          className="!border-0 !p-0 !py-1 !shadow-none"
        />
      </div>
      <span className="hidden border-l pl-5 text-xs text-muted-foreground lg:block">
        Một chuyến đi mới
        <br />
        <span className="mt-1 block font-medium text-foreground">
          bắt đầu từ đây.
        </span>
      </span>
      <Button type="submit" size="lg">
        <Search size={17} />
        Tìm chỗ nghỉ
        <ArrowRight size={16} />
      </Button>
    </form>
  );
}
