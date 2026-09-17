"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/components/auth-provider";
import { Button, Card, Field, Input } from "@/components/ui";
import { authService } from "@/lib/services";
import { apiError } from "@/lib/utils";

const schema = z.object({
  email: z.email("Email không hợp lệ."),
  password: z.string().min(1, "Vui lòng nhập mật khẩu."),
});
type FormData = z.infer<typeof schema>;
function LoginForm() {
  const { setSession } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  const login = useMutation({
    mutationFn: authService.login,
    onSuccess: ({ accessToken, user }) => {
      setSession(accessToken, user);
      toast.success("Đăng nhập thành công.");
      router.push(
        params.get("next") ||
          (user.role === "HOST"
            ? "/host"
            : user.role === "ADMIN"
              ? "/admin/hosts"
              : "/"),
      );
    },
    onError: (e) => toast.error(apiError(e)),
  });
  return (
    <AuthShell
      title="Chào mừng trở lại"
      subtitle="Đăng nhập để tiếp tục hành trình cùng StayHub"
    >
      <form
        onSubmit={form.handleSubmit((data) => login.mutate(data))}
        className="grid gap-4"
      >
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input
            type="email"
            autoComplete="email"
            {...form.register("email")}
          />
        </Field>
        <Field label="Mật khẩu" error={form.formState.errors.password?.message}>
          <Input
            type="password"
            autoComplete="current-password"
            {...form.register("password")}
          />
        </Field>
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? "Đang đăng nhập..." : "Đăng nhập"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        Chưa có tài khoản?{" "}
        <Link href="/register" className="font-bold text-primary-dark">
          Đăng ký ngay
        </Link>
      </p>
    </AuthShell>
  );
}
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="auth-warm relative grid min-h-[70vh] place-items-center overflow-hidden px-4 py-12">
      <div
        className="absolute -right-20 top-10 size-64 rounded-full bg-accent/20 blur-3xl"
        aria-hidden="true"
      />
      <Card className="relative w-full max-w-md p-6 sm:p-8">
        <div className="mb-7 text-center">
          <span className="mb-3 inline-block text-sm font-extrabold uppercase tracking-[0.18em] text-primary-dark">
            StayHub
          </span>
          <h1 className="text-3xl font-extrabold">{title}</h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>
        </div>
        {children}
      </Card>
    </div>
  );
}
