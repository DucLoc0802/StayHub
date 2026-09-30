'use client';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PropertyImage } from '@/components/property-image';
import {
  Empty,
  ErrorState,
  Loading,
  StatusBadge,
} from '@/components/ui/states';
export default function HostPage() {
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
        <div className="grid gap-5 md:grid-cols-2">
          {properties.data.map((p) => (
            <article key={p.id} className="panel overflow-hidden">
              <div className="flex gap-4 p-5">
                <PropertyImage
                  src={p.images[0]?.url}
                  alt={p.name}
                  className="size-24 rounded-xl object-cover"
                />
                <div className="min-w-0">
                  <StatusBadge status={p.status} />
                  <h3 className="mb-1 mt-3 font-semibold">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {p.district} ·{' '}
                    {p.type === 'HOTEL' ? 'Khách sạn' : 'Homestay'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t p-5">
                <p className="text-sm">
                  <strong>{money(p.pricePerNight)}</strong> / đêm
                  <br />
                  <span className="text-xs text-muted-foreground">
                    Đặt cọc {p.depositPercent}%
                  </span>
                </p>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/host/properties/${p.id}/edit`}>
                      <Pencil size={14} />
                      Sửa
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
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
