import { AlertCircle, MapPin, LoaderCircle } from 'lucide-react';
import { Button } from './button';
import { cn, statusLabel } from '@/lib/utils';
export function Loading() {
  return (
    <div
      role="status"
      className="flex min-h-40 items-center justify-center gap-3 text-muted-foreground"
    >
      <LoaderCircle className="animate-spin" size={22} />
      Đang tải dữ liệu…
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
    <div className="rounded-2xl border border-dashed bg-muted/40 p-12 text-center text-muted-foreground">
      <MapPin className="mx-auto mb-4" />
      {children}
    </div>
  );
}
export function StatusBadge({ status }: { status: keyof typeof statusLabel }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
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
