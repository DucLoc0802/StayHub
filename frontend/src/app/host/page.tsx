'use client';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PropertyImage } from '@/components/property-image';
import { useHostProperty } from '@/components/host-property-scope';
import {
  Empty,
  ErrorState,
  Loading,
  StatusBadge,
} from '@/components/ui/states';
export default function HostPage() {
  const selected = useHostProperty();
  const client = useQueryClient();
  const properties = useQuery({
    queryKey: ['my-properties'],
    queryFn: api.myProperties,
  });
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.propertyStatus(id, status),
    onSuccess: () => {
      toast.success('Đã cập nhật trạng thái chỗ nghỉ.');
      void client.invalidateQueries({ queryKey: ['my-properties'] });
      void client.invalidateQueries({ queryKey: ['properties'] });
      void client.invalidateQueries({ queryKey: ['property'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Chỗ nghỉ của tôi</h2>
        <Button asChild>
          <Link href="/host/properties/new">
            <Plus size={17} />
            Thêm chỗ nghỉ
          </Link>
        </Button>
      </div>
      {properties.isPending ? (
        <Loading />
      ) : properties.isError ? (
        <ErrorState
          message={errorMessage(properties.error)}
          retry={() => void properties.refetch()}
        />
      ) : !properties.data.length ? (
        <Empty>Bạn chưa có chỗ nghỉ nào. Hãy tạo chỗ nghỉ đầu tiên.</Empty>
      ) : (
        <div className="motion-content divide-y border-y">
          {properties.data
            .filter((p) => !selected || p.id === selected)
            .map((p) => (
              <article
                key={p.id}
                className="grid gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_180px_240px] lg:items-center lg:gap-6"
              >
                <div className="flex min-w-0 gap-3">
                  <PropertyImage
                    src={p.images[0]?.url}
                    alt={p.name}
                    className="size-16 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0">
                    <h3 className="mb-2 break-words font-semibold">{p.name}</h3>
                    <StatusBadge status={p.status} />
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {p.district} ·{' '}
                      {p.type === 'HOTEL' ? 'Khách sạn' : 'Homestay'}
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-6 lg:text-right">
                  <strong>Từ {money(p.minPricePerNight ?? 0)}</strong> / đêm
                  <br />
                  <span className="text-xs text-muted-foreground">
                    Đặt cọc {p.depositPercent}%
                  </span>
                </p>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/host/properties/${p.id}/edit`}>
                      <Pencil size={14} />
                      Sửa
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/host/properties/${p.id}/edit`}>
                      Phòng & giá
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({
                        id: p.id,
                        status: p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                      })
                    }
                  >
                    {p.status === 'ACTIVE' ? 'Tạm ngưng' : 'Kích hoạt'}
                  </Button>
                </div>
              </article>
            ))}
        </div>
      )}
    </>
  );
}
