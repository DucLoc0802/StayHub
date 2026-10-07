'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import type { Property } from '@/lib/types';
import { districts } from '@/lib/utils';
import { Button } from './ui/button';
import { ErrorState, Loading } from './ui/states';
const roomSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(100),
  description: z.string().max(5000),
  pricePerNight: z.number().int().min(1).max(50000000),
  totalUnits: z.number().int().min(1).max(100),
  maxGuests: z.number().int().min(1).max(50),
  bedrooms: z.number().int().min(0).max(50),
  beds: z.number().int().min(1).max(50),
  bathrooms: z.number().int().min(1).max(50),
  status: z.enum(['ACTIVE', 'INACTIVE']),
});
const defaultRoom = {
  name: 'Nguyên căn homestay',
  description: '',
  pricePerNight: 850000,
  totalUnits: 1,
  maxGuests: 2,
  bedrooms: 1,
  beds: 1,
  bathrooms: 1,
  status: 'ACTIVE' as const,
};
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
  depositPercent: z.number().int().min(1).max(100),
  paymentWindowHours: z.number().int().min(1).max(24),
  roomTypes: z.array(roomSchema).min(1).max(20),
  checkInTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ nhận phòng không hợp lệ.'),
  checkOutTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ trả phòng không hợp lệ.'),
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
  const amenityOptions = [
    ...(amenities.data ?? []),
    ...(property?.amenities
      .map((a) => a.amenity)
      .filter((a) => !amenities.data?.some((active) => active.id === a.id)) ??
      []),
  ];
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
          depositPercent: 30,
          paymentWindowHours: undefined,
          roomTypes: [defaultRoom],
          checkInTime: '14:00',
          checkOutTime: '12:00',
          imagesText: '',
          amenityIds: [],
        },
  });
  const rooms = useFieldArray({
    control: form.control,
    name: 'roomTypes',
    keyName: 'fieldKey',
  });
  const kind = useWatch({ control: form.control, name: 'type' });
  const roomValues = useWatch({ control: form.control, name: 'roomTypes' });
  const policy = useQuery({
    queryKey: ['booking-policy'],
    queryFn: api.bookingPolicy,
  });
  const defaultWindow = policy.data?.defaultPaymentWindowHours;
  useEffect(() => {
    if (!property && defaultWindow && !form.getValues('paymentWindowHours'))
      form.setValue('paymentWindowHours', defaultWindow);
  }, [defaultWindow, form, property]);
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
      void client.invalidateQueries({ queryKey: ['availability'] });
      void client.invalidateQueries({ queryKey: ['quote'] });
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
      className="motion-content mx-auto max-w-3xl space-y-7"
      onSubmit={form.handleSubmit((values) => {
        if (
          values.type === 'HOMESTAY' &&
          (values.roomTypes.length !== 1 ||
            values.roomTypes[0].totalUnits !== 1)
        ) {
          form.setError('roomTypes', {
            message: 'Homestay cần đúng một loại chỗ ở với số lượng bằng 1.',
          });
          return;
        }
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
        <h3 className="mb-5 font-semibold">Chính sách đặt cọc</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="field">
            <label htmlFor="depositPercent">Tiền cọc (%)</label>
            <input
              id="depositPercent"
              type="number"
              min={1}
              max={100}
              {...form.register('depositPercent', { valueAsNumber: true })}
            />
            {error('depositPercent')}
          </div>
          <div className="field">
            <label htmlFor="paymentWindowHours">Thời hạn thanh toán cọc</label>
            <select
              id="paymentWindowHours"
              {...form.register('paymentWindowHours', { valueAsNumber: true })}
            >
              {(policy.data?.paymentWindowOptions ?? []).map((hours) => (
                <option key={hours} value={hours}>
                  {hours} giờ
                </option>
              ))}
            </select>
            {error('paymentWindowHours')}
          </div>
        </div>
        <p className="mt-3 text-xs leading-6 text-muted-foreground">
          Đặt trong vòng {policy.data?.lastMinuteThresholdHours ?? '…'} giờ
          trước nhận phòng: hạn cọc tối đa{' '}
          {policy.data?.lastMinutePaymentWindowHours ?? '…'} giờ, đồng thời phải
          trước giờ nhận phòng ít nhất{' '}
          {policy.data?.minimumLeadTimeHours ?? '…'} giờ.
        </p>
      </div>
      <section className="panel space-y-5 p-6">
        <h3 className="font-semibold">Loại phòng / chỗ ở có thể đặt</h3>
        {rooms.fields.map((room, i) => (
          <fieldset
            key={room.fieldKey}
            className="space-y-4 rounded-xl border p-4"
          >
            <legend className="px-2 font-medium">
              {roomValues[i]?.name || 'Loại phòng mới'}
            </legend>
            <div className="field">
              <label htmlFor={`room-name-${i}`}>Tên loại phòng</label>
              <input
                id={`room-name-${i}`}
                {...form.register(`roomTypes.${i}.name`)}
              />
            </div>
            <div className="field">
              <label htmlFor={`room-description-${i}`}>Mô tả loại phòng</label>
              <textarea
                id={`room-description-${i}`}
                rows={2}
                {...form.register(`roomTypes.${i}.description`)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['pricePerNight', 'Giá mỗi đêm (₫)', 1, 50000000],
                  [
                    'totalUnits',
                    'Số đơn vị có thể bán',
                    1,
                    kind === 'HOMESTAY' ? 1 : 100,
                  ],
                  ['maxGuests', 'Khách tối đa mỗi đơn vị', 1, 50],
                  ['bedrooms', 'Phòng ngủ mỗi đơn vị', 0, 50],
                  ['beds', 'Giường mỗi đơn vị', 1, 50],
                  ['bathrooms', 'Phòng tắm mỗi đơn vị', 1, 50],
                ] as const
              ).map(([name, label, min, max]) => (
                <div className="field" key={name}>
                  <label htmlFor={`room-${i}-${name}`}>{label}</label>
                  <input
                    id={`room-${i}-${name}`}
                    type="number"
                    min={min}
                    max={max}
                    {...form.register(`roomTypes.${i}.${name}`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
              ))}
            </div>
            <div className="field">
              <label htmlFor={`room-status-${i}`}>Trạng thái loại phòng</label>
              <select
                id={`room-status-${i}`}
                {...form.register(`roomTypes.${i}.status`)}
              >
                <option value="ACTIVE">Mở bán</option>
                <option value="INACTIVE">Ngừng bán</option>
              </select>
            </div>
            {!room.id && rooms.fields.length > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => rooms.remove(i)}
              >
                Bỏ loại phòng mới
              </Button>
            )}
            {form.formState.errors.roomTypes?.[i] && (
              <p role="alert" className="field-error">
                Kiểm tra tên, giá, số lượng và sức chứa của loại phòng này.
              </p>
            )}
          </fieldset>
        ))}
        {error('roomTypes')}
        {kind === 'HOTEL' && rooms.fields.length < 20 && (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              rooms.append({
                ...defaultRoom,
                name: 'Phòng đôi tiêu chuẩn',
                totalUnits: 5,
              })
            }
          >
            Thêm loại phòng
          </Button>
        )}
        {kind === 'HOMESTAY' && (
          <p className="text-xs text-muted-foreground">
            Homestay có một loại chỗ ở nguyên căn, số đơn vị có thể bán bằng 1.
          </p>
        )}
      </section>
      <div className="panel p-6">
        <h3 className="mb-5 font-semibold">Giờ nhận và trả phòng</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          {(
            [
              ['checkInTime', 'Giờ nhận phòng'],
              ['checkOutTime', 'Giờ trả phòng'],
            ] as const
          ).map(([name, label]) => (
            <div key={name} className="field">
              <label htmlFor={name}>{label}</label>
              <input id={name} type="time" step={60} {...form.register(name)} />
              {error(name)}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-6 text-muted-foreground">
          Giờ Việt Nam (UTC+7). Khách cần đặt đủ sớm để đáp ứng thời gian chuẩn
          bị trước nhận phòng.
        </p>
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
              {amenityOptions.map((a) => (
                <label key={a.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    value={a.id}
                    {...form.register('amenityIds')}
                  />
                  {a.nameVi}
                  {a.active === false ? ' (đã ngừng hoạt động)' : ''}
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
          disabled={
            mutation.isPending || !amenityOptions.length || !policy.data
          }
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
