'use client';
import { useMutation } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { Button } from './ui/button';

export function InvoiceDownload({
  id,
  label = 'Tải hóa đơn PDF',
}: {
  id: string;
  label?: string;
}) {
  const download = useMutation({ mutationFn: () => api.downloadInvoice(id) });
  return (
    <div>
      <Button
        variant="outline"
        disabled={download.isPending}
        aria-busy={download.isPending}
        onClick={() => download.mutate()}
      >
        <Download size={16} aria-hidden="true" />
        {download.isPending ? 'Đang tạo PDF…' : label}
      </Button>
      {download.isError && (
        <p role="alert" className="mt-2 max-w-sm text-sm text-destructive">
          {errorMessage(download.error)}
        </p>
      )}
    </div>
  );
}
