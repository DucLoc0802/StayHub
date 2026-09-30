'use client';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import type { Property } from '@/lib/types';
import { districts } from '@/lib/utils';
import { Button } from './ui/button';
import { ErrorState, Loading } from './ui/states';
const schema = z.object({
  type: z.enum(['HOMESTAY', 'HOTEL']),
  name: z.string().trim().min(3, 'Tên cần ít nhất 3 ký tự.').max(150),
  description: z
    .string()
    .trim()
    .min(20, 'Mô tả cần ít nhất 20 ký tự.')
    .max(10000),
  district: z.string().min(1, 'Vui lòng chọn khu vực.'),
  address: z.string().trim().min(5, 'Vui lòng nhập địa chỉ đầy đủ.').max(250),
  pricePerNight: z.number().int().min(1, 'Giá phải lớn hơn 0.').max(50000000),
  depositPercent: z.number().int().min(1).max(100),
  maxGuests: z.number().int().min(1).max(50),
  bedrooms: z.number().int().min(0).max(50),
  beds: z.number().int().min(1).max(50),
  bathrooms: z.number().int().min(1).max(50),
  imagesText: z.string().min(1, 'Cần ít nhất một ảnh.'),
  amenityIds: z.array(z.string()).min(1, 'Chọn ít nhất một tiện ích.'),
});
type Values = z.infer<typeof schema>;
function Editor({ property }: { property?: Property }) {
  const router = useRouter();
  const client = useQueryClient();
  const amenities = useQuery({
    queryKey: ['amenities'],
    queryFn: api.amenities,
  });
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: property
      ? {
          ...property,
          imagesText: property.images.map((i) => i.url).join('\n'),
          amenityIds: property.amenities.map((a) => a.amenityId),
        }
      : {
          type: 'HOMESTAY',
          name: '',
          description: '',
          district: '',
          address: '',
          pricePerNight: 850000,
          depositPercent: 30,
          maxGuests: 2,
          bedrooms: 1,
          beds: 1,
          bathrooms: 1,
          imagesText: '',
          amenityIds: [],
        },
  });
  const mutation = useMutation({
    mutationFn: (values: Values) => {
      const { imagesText, ...data } = values;
      return api.saveProperty(
        {
          ...data,
          images: imagesText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        },
        property?.id,
      );
    },
    onSuccess: () => {
      toast.success(property ? 'Đã cập nhật chỗ nghỉ.' : 'Đã tạo chỗ nghỉ.');
      void client.invalidateQueries({ queryKey: ['my-properties'] });
      void client.invalidateQueries({ queryKey: ['properties'] });
      void client.invalidateQueries({ queryKey: ['property'] });
      void client.invalidateQueries({ queryKey: ['owned-property'] });
      router.push('/host');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const error = (name: keyof Values) =>
    form.formState.errors[name] && (
      <p role="alert" className="field-error">
        {form.formState.errors[name]?.message?.toString().match(/[À-ỹ]/)
          ? form.formState.errors[name]?.message?.toString()
          : 'Giá trị không hợp lệ hoặc vượt giới hạn cho phép.'}
      </p>
    );
  return (
    <form
      className="mx-auto max-w-3xl space-y-7"
      onSubmit={form.handleSubmit((values) => {
        const urls = values.imagesText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        if (
          urls.length > 20 ||
          new Set(urls).size !== urls.length ||
          urls.some((url) => {
            try {
              const parsed = new URL(url);
              return (
                parsed.protocol !== 'https:' ||
                !parsed.hostname.includes('.') ||
                url.length > 2048
              );
            } catch {
              return true;
            }
          })
        ) {
          form.setError('imagesText', {
            message:
              'Nhập 1–20 URL HTTPS hợp lệ, không trùng nhau; mỗi dòng một ảnh.',
          });
          return;
        }
        mutation.mutate(values);
      })}
    >
      <h2 className="text-xl font-semibold">
        {property ? 'Cập nhật chỗ nghỉ' : 'Thêm chỗ nghỉ mới'}
      </h2>
      <div className="panel space-y-5 p-6">
        <h3 className="font-semibold">Thông tin cơ bản</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="field">
            <label htmlFor="type">Loại chỗ nghỉ</label>
            <select id="type" {...form.register('type')}>
              <option value="HOMESTAY">Homestay</option>
              <option value="HOTEL">Khách sạn</option>
            </select>
            {error('type')}
          </div>
          <div className="field">
            <label htmlFor="district">Khu vực tại TP. Hồ Chí Minh</label>
            <select id="district" {...form.register('district')}>
              <option value="">Chọn khu vực</option>
              {districts.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            {error('district')}
          </div>
        </div>
        {(
          [
            ['name', 'Tên chỗ nghỉ'],
            ['address', 'Địa chỉ đầy đủ'],
          ] as const
        ).map(([name, label]) => (
          <div key={name} className="field">
            <label htmlFor={name}>{label}</label>
            <input id={name} {...form.register(name)} />
            {error(name)}
          </div>
        ))}
        <div className="field">
          <label htmlFor="description">Mô tả chỗ nghỉ</label>
          <textarea
            id="description"
            rows={5}
            {...form.register('description')}
          />
          {error('description')}
        </div>
      </div>
      <div className="panel p-6">
        <h3 className="mb-5 font-semibold">Giá và sức chứa</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          {(
            [
              ['pricePerNight', 'Giá mỗi đêm (₫)', 1, 50000000],
              ['depositPercent', 'Tiền cọc (%)', 1, 100],
              ['maxGuests', 'Số khách tối đa', 1, 50],
              ['bedrooms', 'Số phòng ngủ', 0, 50],
              ['beds', 'Số giường', 1, 50],
              ['bathrooms', 'Số phòng tắm', 1, 50],
            ] as const
          ).map(([name, label, min, max]) => (
            <div key={name} className="field">
              <label htmlFor={name}>{label}</label>
              <input
                id={name}
                type="number"
                min={min}
                max={max}
                step={1}
                {...form.register(name, { valueAsNumber: true })}
              />
              {error(name)}
            </div>
          ))}
        </div>
      </div>
      <div className="panel p-6">
        <fieldset>
          <legend className="mb-5 font-semibold">Tiện ích</legend>
          {amenities.isPending ? (
            <Loading />
          ) : amenities.isError ? (
            <ErrorState
              message={errorMessage(amenities.error)}
              retry={() => void amenities.refetch()}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {amenities.data.map((a) => (
                <label key={a.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    value={a.id}
                    {...form.register('amenityIds')}
                  />
                  {a.nameVi}
                </label>
              ))}
            </div>
          )}
          {error('amenityIds')}
        </fieldset>
      </div>
      <div className="panel p-6">
        <div className="field">
          <label htmlFor="imagesText">Ảnh chỗ nghỉ</label>
          <p className="text-xs leading-6 text-muted-foreground">
            Dán URL ảnh HTTPS, mỗi dòng một ảnh. Ảnh đầu tiên là ảnh đại diện.
            Tối đa 20 ảnh.
          </p>
          <textarea
            id="imagesText"
            rows={5}
            placeholder="https://images.unsplash.com/..."
            {...form.register('imagesText')}
          />
          {error('imagesText')}
        </div>
      </div>
      {mutation.isError && (
        <ErrorState message={errorMessage(mutation.error)} />
      )}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          type="button"
          disabled={mutation.isPending}
          onClick={() => router.push('/host')}
        >
          Quay lại
        </Button>
        <Button
          disabled={mutation.isPending || !amenities.data?.length}
          type="submit"
        >
          {mutation.isPending ? 'Đang lưu…' : 'Lưu chỗ nghỉ'}
        </Button>
      </div>
    </form>
  );
}
export function PropertyForm({ id }: { id?: string }) {
  const property = useQuery({
    queryKey: ['owned-property', id],
    queryFn: () => api.ownedProperty(id!),
    enabled: !!id,
  });
  if (!id) return <Editor />;
  if (property.isPending) return <Loading />;
  if (property.isError)
    return (
      <ErrorState
        message={errorMessage(property.error)}
        retry={() => void property.refetch()}
      />
    );
  return <Editor property={property.data} />;
}
