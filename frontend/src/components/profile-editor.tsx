'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from './providers';
import { Button } from './ui/button';
import { profilePhone } from '@/lib/profile-phone';
export function ProfileEditor() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [name, setName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phoneNumber ?? '');
  const [saved, setSaved] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const mutation = useMutation({
    mutationFn: (phoneNumber: string) =>
      api.updateProfile({
        fullName: name.trim(),
        phoneNumber,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['me'] });
      setSaved(true);
      toast.success('Đã cập nhật thông tin cá nhân.');
    },
  });
  if (!user) return null;
  return (
    <form
      className="mt-6 space-y-4 border-t pt-6"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = profilePhone.safeParse(phone);
        if (!parsed.success) {
          setPhoneError(parsed.error.issues[0].message);
          return;
        }
        setPhoneError('');
        mutation.mutate(parsed.data);
      }}
    >
      <h3 className="font-semibold">Thông tin liên hệ</h3>
      <p className="text-sm text-muted-foreground">
        Họ tên và số điện thoại là bắt buộc trước khi đặt phòng. Bạn vẫn có thể
        khám phá chỗ nghỉ.
      </p>
      <div className="field">
        <label htmlFor="profile-name">Họ và tên *</label>
        <input
          id="profile-name"
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="profile-phone">Số điện thoại *</label>
        <input
          id="profile-phone"
          type="tel"
          required
          maxLength={20}
          autoComplete="tel"
          placeholder="Số điện thoại Việt Nam"
          aria-invalid={!!phoneError}
          aria-describedby={phoneError ? 'profile-phone-error' : undefined}
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setPhoneError(''); setSaved(false); }}
        />
      </div>
      {phoneError && <p id="profile-phone-error" role="alert" className="text-sm text-destructive">{phoneError}</p>}
      {mutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(mutation.error)}
        </p>
      )}
      <Button disabled={mutation.isPending}>
        {mutation.isPending ? 'Đang lưu…' : 'Lưu thông tin'}
      </Button>
      {saved && (
        <p role="status" className="text-sm text-success">
          Thông tin đã được lưu.{' '}
          <Link
            className="underline"
            href={
              typeof window !== 'undefined' &&
              /^\/properties\/[a-z0-9-]+$/.test(
                new URLSearchParams(window.location.search).get('next') ?? '',
              )
                ? new URLSearchParams(window.location.search).get('next')!
                : '/properties'
            }
          >
            Tiếp tục đặt phòng
          </Link>
        </p>
      )}
    </form>
  );
}
