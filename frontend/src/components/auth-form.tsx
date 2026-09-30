'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, House, KeyRound, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from './providers';
import { Button } from './ui/button';
const schema = z.object({
  email: z.email('Email không hợp lệ.').max(191, 'Email tối đa 191 ký tự.'),
  password: z
    .string()
    .min(8, 'Mật khẩu cần ít nhất 8 ký tự.')
    .max(72, 'Mật khẩu tối đa 72 ký tự.'),
  fullName: z.string().optional(),
  role: z.enum(['GUEST', 'HOST']),
});
type Values = z.infer<typeof schema>;
export function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const auth = useAuth();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
      fullName: '',
      role: params.get('role') === 'HOST' ? 'HOST' : 'GUEST',
    },
  });
  const mutation = useMutation({
    mutationFn: (data: Values) =>
      register
        ? api.register(data)
        : api.login({ email: data.email, password: data.password }),
    onSuccess: (session) => {
      auth.login(session);
      toast.success(register ? 'Đăng ký thành công.' : 'Đăng nhập thành công.');
      const next = params.get('next');
      const safeNext =
        next &&
        /^\/(properties(?:\/|\?|$)|bookings(?:\/|\?|$))/.test(next) &&
        !next.includes('\\')
          ? next
          : '/';
      router.push(
        session.user.role === 'ADMIN'
          ? '/admin/hosts'
          : session.user.role === 'HOST'
            ? session.user.status === 'ACTIVE'
              ? '/host'
              : '/account'
            : safeNext,
      );
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <div className="container-shell grid gap-10 py-12 lg:grid-cols-2 lg:py-16">
      <div className="hidden flex-col justify-center rounded-3xl bg-cream p-12 lg:flex">
        <Sun className="text-secondary-foreground" size={36} />
        <p className="eyebrow mt-8">MỖI CHUYẾN ĐI, MỘT CÂU CHUYỆN</p>
        <h2 className="mt-5 text-4xl font-semibold leading-snug tracking-tight">
          Chào bạn,
          <br />
          mừng bạn về StayHub.
        </h2>
        <p className="mt-6 max-w-sm text-sm leading-7 text-muted-foreground">
          Một nơi dừng chân ấm áp, một trải nghiệm thật riêng. Hãy để những kỷ
          niệm đẹp bắt đầu từ đây.
        </p>
        <div className="mt-12 flex gap-3 text-sm">
          <House className="text-secondary-foreground" />
          Những chỗ nghỉ tại TP. Hồ Chí Minh
        </div>
      </div>
      <div className="mx-auto w-full max-w-md py-4">
        <span className="mb-5 inline-flex rounded-2xl bg-accent p-3">
          <KeyRound className="text-secondary-foreground" />
        </span>
        <h1 className="page-title">
          {register ? 'Tạo tài khoản StayHub' : 'Chào mừng bạn trở lại'}
        </h1>
        <p className="mb-8 mt-3 text-sm text-muted-foreground">
          {register
            ? 'Chỉ một chút thông tin, sẵn sàng cho chuyến đi.'
            : 'Đăng nhập để tiếp tục hành trình của bạn.'}
        </p>
        <form
          className="space-y-5"
          onSubmit={form.handleSubmit((data) => {
            if (
              register &&
              (!data.fullName ||
                data.fullName.trim().length < 2 ||
                data.fullName.trim().length > 100)
            ) {
              form.setError('fullName', {
                message: 'Họ tên cần từ 2 đến 100 ký tự.',
              });
              return;
            }
            mutation.mutate(data);
          })}
        >
          {register && (
            <>
              <fieldset>
                <legend className="mb-3 text-sm font-medium">
                  Bạn tham gia với vai trò
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['GUEST', 'Khách thuê'],
                    ['HOST', 'Người cho thuê'],
                  ].map(([value, label]) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border p-3 has-[:checked]:border-primary has-[:checked]:bg-accent"
                    >
                      <input
                        type="radio"
                        value={value}
                        {...form.register('role')}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="field">
                <label htmlFor="fullName">Họ và tên</label>
                <input
                  id="fullName"
                  autoComplete="name"
                  {...form.register('fullName')}
                />
                <p className="field-error">
                  {form.formState.errors.fullName?.message}
                </p>
              </div>
            </>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="ban@example.com"
              {...form.register('email')}
            />
            <p className="field-error">
              {form.formState.errors.email?.message}
            </p>
          </div>
          <div className="field">
            <label htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              type="password"
              autoComplete={register ? 'new-password' : 'current-password'}
              placeholder="Tối thiểu 8 ký tự"
              {...form.register('password')}
            />
            <p className="field-error">
              {form.formState.errors.password?.message}
            </p>
          </div>
          {mutation.isError && (
            <p role="alert" className="field-error">
              {errorMessage(mutation.error)}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? 'Đang xử lý…'
              : register
                ? 'Tạo tài khoản'
                : 'Đăng nhập'}
            <ArrowRight size={17} />
          </Button>
        </form>
        <p className="mt-7 text-center text-sm text-muted-foreground">
          {register ? 'Bạn đã có tài khoản?' : 'Bạn chưa có tài khoản?'}{' '}
          <Link
            className="font-semibold text-secondary-foreground hover:underline"
            href={register ? '/login' : '/register'}
          >
            {register ? 'Đăng nhập' : 'Đăng ký ngay'}
          </Link>
        </p>
        {register && (
          <p className="mt-7 text-xs leading-6 text-muted-foreground">
            Tài khoản Người cho thuê cần được Quản trị viên phê duyệt trước khi
            quản lý chỗ nghỉ.
          </p>
        )}
      </div>
    </div>
  );
}
