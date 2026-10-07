import { AlertCircle, MapPin } from 'lucide-react';
import { Button } from './button';
import { cn, statusLabel } from '@/lib/utils';
export function Loading() {
  return (
    <div
      role="status"
      className="flex min-h-40 flex-col justify-center gap-4 p-6 text-center text-sm text-muted-foreground"
    >
      <span>Đang tải dữ liệu…</span>
      <div aria-hidden="true" className="mx-auto w-full max-w-sm space-y-3">
        <div className="skeleton h-3 rounded-full" />
        <div className="skeleton h-3 w-3/4 rounded-full" />
        <div className="skeleton h-3 w-1/2 rounded-full" />
      </div>
    </div>
  );
}
export function PropertySkeletons({
  count = 6,
  className = 'sm:grid-cols-2 xl:grid-cols-3',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div role="status" aria-label="Đang tải chỗ nghỉ">
      <span className="sr-only">Đang tải chỗ nghỉ…</span>
      <div aria-hidden="true" className={cn('grid gap-5', className)}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border bg-white">
            <div className="skeleton aspect-[4/3]" />
            <div className="p-5">
              <div className="skeleton h-4 w-2/3 rounded" />
              <div className="mt-2 min-h-12 space-y-2 py-1">
                <div className="skeleton h-4 rounded" />
                <div className="skeleton h-4 w-3/4 rounded" />
              </div>
              <div className="skeleton mt-3 h-4 w-3/4 rounded" />
              <div className="mt-5 flex items-center justify-between border-t pt-4">
                <div className="skeleton h-7 w-1/2 rounded" />
                <div className="skeleton size-[33px] rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center"
    >
      <AlertCircle className="mx-auto mb-3 text-destructive" />
      <p>{message}</p>
      {retry && (
        <Button variant="outline" className="mt-4" onClick={retry}>
          Thử lại
        </Button>
      )}
    </div>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="motion-content rounded-2xl border border-dashed bg-muted/40 p-12 text-center text-muted-foreground">
      <MapPin className="mx-auto mb-4" />
      {children}
    </div>
  );
}
export function StatusBadge({ status }: { status: keyof typeof statusLabel }) {
  return (
    <span
      className={cn(
        'motion-status inline-flex rounded-full px-3 py-1 text-xs font-semibold',
        status === 'ACTIVE' || status === 'CONFIRMED'
          ? 'bg-success/10 text-success'
          : status === 'PENDING' || status === 'PENDING_PAYMENT'
            ? 'bg-warning/10 text-warning'
            : status === 'REJECTED' || status === 'CANCELLED'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted text-muted-foreground',
      )}
    >
      {statusLabel[status]}
    </span>
  );
}
