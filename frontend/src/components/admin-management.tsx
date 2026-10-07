'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { dateLabel, money, roleLabel } from '@/lib/utils';
import type { Amenity, User } from '@/lib/types';
import { Button } from './ui/button';
import { ErrorState, Loading, StatusBadge } from './ui/states';
import { BookingSummary } from './booking-extras';

function Pager({
  page,
  limit,
  total,
  onChange,
}: {
  page: number;
  limit: number;
  total: number;
  onChange: (n: number) => void;
}) {
  return (
    <nav
      aria-label="Phân trang quản trị"
      className="mt-6 flex flex-wrap items-center justify-center gap-4"
    >
      <Button
        variant="outline"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Trước
      </Button>
      <span className="text-sm">
        Trang {page} · {total} kết quả
      </span>
      <Button
        variant="outline"
        disabled={page * limit >= total}
        onClick={() => onChange(page + 1)}
      >
        Sau
      </Button>
    </nav>
  );
}
export function AdminDashboard() {
  const query = useQuery({
    queryKey: ['admin-statistics'],
    queryFn: api.adminStatistics,
  });
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} />;
  const s = query.data;
  return (
    <div className="container-shell page-section">
      <h1 className="page-title mb-7">Thống kê StayHub</h1>
      <div className="motion-content grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ['Khách thuê', s.guests],
          ['Người cho thuê', s.hosts],
          ['Cơ sở lưu trú', s.properties],
          ['Loại phòng', s.roomTypes],
          ['Tổng đặt phòng', s.totalBookings],
          ['Đã xác nhận', s.confirmed],
          ['Chờ thanh toán', s.pending],
          ['Hết hạn', s.expired],
          ['Đã hủy', s.cancelled],
          ['Tổng cọc thanh toán thành công', money(s.successfulDepositAmount)],
        ].map(([label, value]) => (
          <article className="panel p-5" key={label}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-3 break-words text-2xl font-semibold">{value}</p>
          </article>
        ))}
      </div>
      <p className="mt-5 text-sm text-muted-foreground">
        Số liệu từ cơ sở dữ liệu. Tổng cọc bao gồm cọc giữ lại khi khách hủy,
        không phải tổng doanh thu lưu trú.
      </p>
    </div>
  );
}
export function AdminUsers() {
  const [q, setQ] = useState(''),
    [role, setRole] = useState(''),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1);
  const client = useQueryClient();
  const params = {
    q: q || undefined,
    role: role || undefined,
    accountStatus: status || undefined,
    page,
  };
  const query = useQuery({
    queryKey: ['admin-users', params],
    queryFn: () => api.adminUsers(params),
  });
  const mutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { role?: 'HOST'; status?: 'ACTIVE' | 'REJECTED' };
    }) => api.changeUser(id, body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin-users'] });
      void client.invalidateQueries({ queryKey: ['pending-hosts'] });
      void client.invalidateQueries({ queryKey: ['admin-statistics'] });
      toast.success('Đã cập nhật người dùng.');
    },
  });
  const change = (
    user: User,
    body: { role?: 'HOST'; status?: 'ACTIVE' | 'REJECTED' },
  ) => {
    if (
      window.confirm(
        body.role
          ? 'Chuyển khách thành Host chờ duyệt? Người dùng chỉ được quản lý cơ sở sau khi Admin phê duyệt.'
          : 'Cập nhật trạng thái tài khoản khách thuê?',
      )
    )
      mutation.mutate({ id: user.id, body });
  };
  return (
    <div className="container-shell page-section">
      <h1 className="page-title mb-6">Người dùng & phân quyền</h1>
      <div className="panel mb-6 grid gap-3 p-5 md:grid-cols-3">
        <div className="field">
          <label htmlFor="user-search">Tên hoặc email</label>
          <input
            id="user-search"
            maxLength={191}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="user-role">Vai trò</label>
          <select
            id="user-role"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả</option>
            {['GUEST', 'HOST', 'ADMIN'].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="user-status">Trạng thái</label>
          <select
            id="user-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả</option>
            {['ACTIVE', 'PENDING', 'REJECTED'].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Admin được bảo vệ. Khách chuyển sang Host luôn chờ duyệt. Host được quản
        lý tại tab Duyệt Host.
      </p>
      {mutation.isError && (
        <ErrorState message={errorMessage(mutation.error)} />
      )}
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} />
      ) : (
        <>
          <div className="motion-content grid gap-4 md:grid-cols-2">
            {query.data.items.map((user) => (
              <article className="panel space-y-3 p-5" key={user.id}>
                <h2 className="font-semibold">{user.fullName}</h2>
                <p className="break-all text-sm">{user.email}</p>
                <p className="text-sm">
                  {user.phoneNumber || 'Chưa có số điện thoại'} ·{' '}
                  {roleLabel[user.role]}
                </p>
                <StatusBadge status={user.status} />
                <p className="text-xs text-muted-foreground">
                  Tạo ngày {dateLabel(user.createdAt)}
                </p>
                {user.role === 'GUEST' && (
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/customers/${user.id}`}>
                        Lịch sử khách hàng
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={mutation.isPending}
                      onClick={() => change(user, { role: 'HOST' })}
                    >
                      Chuyển Host chờ duyệt
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={mutation.isPending}
                      onClick={() =>
                        change(user, {
                          status:
                            user.status === 'ACTIVE' ? 'REJECTED' : 'ACTIVE',
                        })
                      }
                    >
                      {user.status === 'ACTIVE'
                        ? 'Từ chối tài khoản'
                        : 'Kích hoạt lại'}
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>
          {!query.data.items.length && <p>Không có người dùng phù hợp.</p>}
          <Pager {...query.data} onChange={setPage} />
        </>
      )}
    </div>
  );
}
export function AdminBookings() {
  const [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [page, setPage] = useState(1);
  const params = {
    q: q || undefined,
    status: status || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
  };
  const query = useQuery({
    queryKey: ['admin-bookings', params],
    queryFn: () => api.adminBookings(params),
  });
  return (
    <div className="container-shell page-section">
      <h1 className="page-title mb-6">Tra cứu đặt phòng</h1>
      <div className="panel mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="field">
          <label htmlFor="admin-booking-q">
            Mã, khách, cơ sở hoặc loại phòng
          </label>
          <input
            id="admin-booking-q"
            maxLength={191}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="admin-booking-status">Trạng thái</label>
          <select
            id="admin-booking-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả</option>
            {['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'EXPIRED'].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </select>
        </div>
        <div className="field">
          <label htmlFor="admin-booking-from">Nhận phòng từ ngày</label>
          <input
            id="admin-booking-from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="admin-booking-to">Nhận phòng đến ngày</label>
          <input
            id="admin-booking-to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {query.data.items.map((b) => (
              <article className="panel p-5" key={b.id}>
                <BookingSummary booking={b} />
                <p className="mt-3 break-all text-sm">
                  {b.guest?.fullName} · {b.guest?.email}
                </p>
                <Link
                  href={`/bookings/${b.id}`}
                  className="mt-4 inline-block text-sm underline"
                >
                  Xem đơn đặt phòng
                </Link>
              </article>
            ))}
          </div>
          {!query.data.items.length && <p>Không có đặt phòng phù hợp.</p>}
          <Pager {...query.data} onChange={setPage} />
        </>
      )}
    </div>
  );
}
export function AdminCustomer({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['admin-customer', id],
    queryFn: () => api.customerHistory(id),
  });
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} />;
  const s = query.data;
  return (
    <div className="container-shell page-section">
      <h1 className="page-title mb-6">Lịch sử khách hàng</h1>
      <section className="panel space-y-3 p-6">
        <h2 className="text-lg font-semibold">{s.user.fullName}</h2>
        <p className="break-all">{s.user.email}</p>
        <p>{s.user.phoneNumber || 'Chưa có số điện thoại'}</p>
        <StatusBadge status={s.user.status} />
        <dl className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Tổng đơn', s.totalBookings],
            ['Đã xác nhận', s.confirmed],
            ['Chờ cọc', s.pending],
            ['Hết hạn', s.expired],
            ['Đã hủy', s.cancelled],
            ['Cọc thành công', money(s.successfulDepositAmount)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-2 font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <h2 className="my-6 text-xl font-semibold">20 đặt phòng gần nhất</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {s.recentBookings.map((b) => (
          <article key={b.id} className="panel p-5">
            <BookingSummary booking={b} />
            <Link
              className="mt-4 inline-block text-sm underline"
              href={`/bookings/${b.id}`}
            >
              Xem đơn đặt phòng
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
export function AdminAmenities() {
  const [editing, setEditing] = useState<Amenity | null>(null),
    [code, setCode] = useState(''),
    [name, setName] = useState('');
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['admin-amenities'],
    queryFn: api.adminAmenities,
  });
  const mutation = useMutation({
    mutationFn: ({
      body,
      id,
    }: {
      body: Partial<Pick<Amenity, 'code' | 'nameVi' | 'active'>>;
      id?: string;
    }) => api.saveAmenity(body, id),
    onSuccess: () => {
      for (const key of [
        'admin-amenities',
        'amenities',
        'property',
        'owned-property',
      ])
        void client.invalidateQueries({ queryKey: [key] });
      setEditing(null);
      setCode('');
      setName('');
      toast.success('Đã lưu tiện ích.');
    },
  });
  return (
    <div className="container-shell page-section">
      <h1 className="page-title mb-6">Quản lý tiện ích</h1>
      <form
        className="panel mb-6 grid items-end gap-4 p-5 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate({
            id: editing?.id,
            body: {
              code,
              nameVi: name.trim(),
              active: editing?.active ?? true,
            },
          });
        }}
      >
        <div className="field">
          <label htmlFor="amenity-code">Mã tiện ích</label>
          <input
            id="amenity-code"
            required
            minLength={2}
            maxLength={50}
            pattern="[A-Z][A-Z0-9_]+"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </div>
        <div className="field">
          <label htmlFor="amenity-name">Tên tiếng Việt</label>
          <input
            id="amenity-name"
            required
            minLength={2}
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={mutation.isPending}>
            {editing ? 'Lưu chỉnh sửa' : 'Thêm tiện ích'}
          </Button>
          {editing && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditing(null);
                setCode('');
                setName('');
              }}
            >
              Hủy sửa
            </Button>
          )}
        </div>
      </form>
      {mutation.isError && (
        <ErrorState message={errorMessage(mutation.error)} />
      )}
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {query.data.map((a) => (
            <article className="panel p-5" key={a.id}>
              <h2 className="font-semibold">{a.nameVi}</h2>
              <p className="mt-2 break-all text-xs">
                {a.code} · {a.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(a);
                    setCode(a.code);
                    setName(a.nameVi);
                    window.scrollTo({ top: 0 });
                  }}
                >
                  Sửa
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({ id: a.id, body: { active: !a.active } })
                  }
                >
                  {a.active ? 'Ngừng hoạt động' : 'Kích hoạt'}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="mt-5 text-sm text-muted-foreground">
        Ngừng hoạt động không xóa liên kết với chỗ nghỉ cũ. Host chỉ thêm tiện
        ích đang hoạt động.
      </p>
    </div>
  );
}
export function AdminFeedback() {
  const query = useQuery({
    queryKey: ['admin-feedback'],
    queryFn: api.adminFeedback,
  });
  return (
    <div className="container-shell page-section">
      <h1 className="page-title mb-6">Đánh giá của khách</h1>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} />
      ) : (
        <div className="space-y-4">
          {query.data.map((f) => (
            <article className="panel p-5" key={f.id}>
              <h2 className="font-semibold">
                {f.property.name} · {f.rating}/5
              </h2>
              <p className="mt-2 text-sm">
                {f.guest.fullName} · {dateLabel(f.createdAt)}
              </p>
              <p className="mt-3 whitespace-pre-line break-words text-sm">
                {f.content}
              </p>
            </article>
          ))}
          {!query.data.length && <p>Chưa có đánh giá.</p>}
        </div>
      )}
    </div>
  );
}
