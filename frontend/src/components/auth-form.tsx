'use client';
import Link from 'next/link';
import { useId } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from './providers';
import { Button } from './ui/button';
const schema = (register: boolean) =>
  z.object({
    email: register
      ? z.email('Email không hợp lệ.').max(191, 'Email tối đa 191 ký tự.')
      : z
          .string()
          .trim()
          .toLowerCase()
          .max(191, 'Tài khoản tối đa 191 ký tự.')
          .refine(
            (value) =>
              ['admin', 'host', 'guest'].includes(value) ||
              z.email().safeParse(value).success,
            'Nhập email hoặc tài khoản demo admin, host, guest.',
          ),
    password: z
      .string()
      .min(
        register ? 8 : 1,
        register ? 'Mật khẩu cần ít nhất 8 ký tự.' : 'Vui lòng nhập mật khẩu.',
      )
      .max(72, 'Mật khẩu tối đa 72 ký tự.'),
    fullName: z.string().optional(),
    role: z.enum(['GUEST', 'HOST']),
  });
type Values = z.infer<ReturnType<typeof schema>>;
export function AuthForm({ register = false }: { register?: boolean }) {
  const errorIdPrefix = useId();
  const errorIds = {
    fullName: `${errorIdPrefix}-fullName-error`,
    email: `${errorIdPrefix}-email-error`,
    password: `${errorIdPrefix}-password-error`,
  };
  const router = useRouter();
  const params = useSearchParams();
  const auth = useAuth();
  const form = useForm<Values>({
    resolver: zodResolver(schema(register)),
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
    <div className="container-shell py-8 md:py-10">
      <div className="mx-auto w-full max-w-md">
        <h1 className="mb-6 text-2xl font-semibold leading-snug tracking-tight">
          {register ? 'Tạo tài khoản StayHub' : 'Đăng nhập StayHub'}
        </h1>
        <form
          className="motion-content space-y-4"
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
                <legend className="mb-2 text-sm font-medium">
                  Loại tài khoản
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['GUEST', 'Khách thuê'],
                    ['HOST', 'Người cho thuê'],
                  ].map(([value, label]) => (
                    <label
                      key={value}
                      className="flex min-h-11 cursor-pointer items-center gap-2 border-b px-2 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent"
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
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  Tài khoản Người cho thuê cần được Quản trị viên phê duyệt
                  trước khi quản lý chỗ nghỉ.
                </p>
              </fieldset>
              <div className="field">
                <label htmlFor="fullName">Họ và tên</label>
                <input
                  id="fullName"
                  autoComplete="name"
                  aria-invalid={!!form.formState.errors.fullName}
                  aria-describedby={
                    form.formState.errors.fullName
                      ? errorIds.fullName
                      : undefined
                  }
                  {...form.register('fullName')}
                />
                <p
                  id={errorIds.fullName}
                  aria-live="polite"
                  aria-atomic="true"
                  className="field-error"
                >
                  {form.formState.errors.fullName?.message}
                </p>
              </div>
            </>
          )}
          <div className="field">
            <label htmlFor="email">
              {register ? 'Email' : 'Tài khoản hoặc email'}
            </label>
            <input
              id="email"
              type={register ? 'email' : 'text'}
              autoComplete={register ? 'email' : 'username'}
              aria-invalid={!!form.formState.errors.email}
              aria-describedby={
                form.formState.errors.email ? errorIds.email : undefined
              }
              placeholder={
                register ? 'ban@example.com' : 'Email hoặc tài khoản demo'
              }
              {...form.register('email')}
            />
            <p id={errorIds.email} className="field-error">
              {form.formState.errors.email?.message}
            </p>
          </div>
          <div className="field">
            <label htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              type="password"
              autoComplete={register ? 'new-password' : 'current-password'}
              aria-invalid={!!form.formState.errors.password}
              aria-describedby={
                form.formState.errors.password ? errorIds.password : undefined
              }
              placeholder={register ? 'Tối thiểu 8 ký tự' : 'Nhập mật khẩu'}
              {...form.register('password')}
            />
            <p id={errorIds.password} className="field-error">
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
        <p className="mt-5 border-t pt-4 text-center text-sm text-muted-foreground">
          {register ? 'Bạn đã có tài khoản?' : 'Bạn chưa có tài khoản?'}{' '}
          <Link
            className="font-semibold text-secondary-foreground hover:underline"
            href={register ? '/login' : '/register'}
          >
            {register ? 'Đăng nhập' : 'Đăng ký ngay'}
          </Link>
        </p>
      </div>
    </div>
  );
}
