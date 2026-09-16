"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/components/auth-provider";
import { Button, Field, Input, Select } from "@/components/ui";
import { authService } from "@/lib/services";
import { apiError } from "@/lib/utils";
import { AuthShell } from "../login/page";

const schema = z.object({
  fullName: z.string().min(2, "Họ tên phải có ít nhất 2 ký tự."),
  email: z.email("Email không hợp lệ."),
  password: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự."),
  role: z.enum(["GUEST", "HOST"]),
});
type FormData = z.infer<typeof schema>;
export default function RegisterPage() {
  const { setSession } = useAuth();
  const router = useRouter();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", password: "", role: "GUEST" },
  });
  const selectedRole = useWatch({ control: form.control, name: "role" });
  const register = useMutation({
    mutationFn: authService.register,
    onSuccess: ({ accessToken, user }) => {
      setSession(accessToken, user);
      toast.success("Đăng ký thành công.");
      router.push(user.role === "HOST" ? "/account" : "/");
    },
    onError: (e) => toast.error(apiError(e)),
  });
  return (
    <AuthShell
      title="Tạo tài khoản StayHub"
      subtitle="Bắt đầu đặt chỗ hoặc trở thành chủ nhà"
    >
      <form
        onSubmit={form.handleSubmit((data) => register.mutate(data))}
        className="grid gap-4"
      >
        <Field
          label="Họ và tên"
          error={form.formState.errors.fullName?.message}
        >
          <Input {...form.register("fullName")} />
        </Field>
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input type="email" {...form.register("email")} />
        </Field>
        <Field label="Mật khẩu" error={form.formState.errors.password?.message}>
          <Input type="password" {...form.register("password")} />
        </Field>
        <Field label="Loại tài khoản">
          <Select {...form.register("role")}>
            <option value="GUEST">Khách đặt phòng</option>
            <option value="HOST">Chủ nhà</option>
          </Select>
        </Field>
        {selectedRole === "HOST" && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Tài khoản chủ nhà cần được quản trị viên phê duyệt trước khi đăng
            chỗ nghỉ.
          </p>
        )}
        <Button type="submit" disabled={register.isPending}>
          {register.isPending ? "Đang tạo..." : "Đăng ký"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        Đã có tài khoản?{" "}
        <Link href="/login" className="font-bold text-primary-dark">
          Đăng nhập
        </Link>
      </p>
    </AuthShell>
  );
}
