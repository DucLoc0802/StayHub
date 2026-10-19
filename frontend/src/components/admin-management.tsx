'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import {
  dateLabel,
  money,
  roleLabel,
  statusLabel,
  timestampLabel,
} from '@/lib/utils';
import type { Amenity, Booking, User } from '@/lib/types';
import { Button } from './ui/button';
import { ErrorState, Loading, StatusBadge } from './ui/states';
function AdminBookingRecord({ booking: b }: { booking: Booking }) {
  const failed =
    b.payment?.status === 'FAILED' ||
    b.paymentAttempts?.at(-1)?.status === 'FAILED';
  return (
    <article className="grid gap-3 py-3 text-sm sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,.9fr)_auto] lg:gap-5">
      <div className="min-w-0 space-y-1 sm:col-span-2 lg:col-span-1">
        <p className="text-xs text-muted-foreground">{b.bookingCode}</p>
        {b.createdAt && (
          <p className="text-xs text-muted-foreground">
            Tạo {timestampLabel(b.createdAt)}
          </p>
        )}
        <h2 className="font-semibold">
          {b.propertyNameSnapshot || b.property.name}
        </h2>
        <p>
          {b.roomTypeNameSnapshot} · {b.quantity}{' '}
          {b.property.type === 'HOTEL' ? 'phòng' : 'căn'} · {b.guestCount} khách
        </p>
        {b.guest && (
          <p className="break-words text-muted-foreground">
            {b.guest.fullName}
            {b.guest.email && ` · ${b.guest.email}`}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <StatusBadge status={b.status} />
        <p>
          <span className="text-muted-foreground">Nhận: </span>
          {dateLabel(b.checkIn)} {b.checkInTimeSnapshot}
        </p>
        <p>
          <span className="text-muted-foreground">Trả: </span>
          {dateLabel(b.checkOut)} {b.checkOutTimeSnapshot}{' '}
          <span className="text-xs text-muted-foreground">(UTC+7)</span>
        </p>
        <p className="text-xs">
          {b.payment?.status === 'SUCCESS'
            ? b.payment.method === 'FAKE'
              ? 'Đã hoàn thành giao dịch'
              : 'Cọc đã được xác minh'
            : failed
              ? 'Thanh toán cọc chưa thành công'
              : 'Chưa ghi nhận thanh toán cọc'}
        </p>
        {b.status === 'PENDING_PAYMENT' && (
          <p className="text-xs">
            Hạn cọc: {timestampLabel(b.paymentDeadlineAt)}
          </p>
        )}
      </div>
      <dl className="grid grid-cols-[1fr_auto] content-start gap-x-3 gap-y-1 tabular-nums">
        <dt>Tổng tiền</dt>
        <dd className="text-right font-semibold">{money(b.totalAmount)}</dd>
        <dt>Tiền cọc</dt>
        <dd className="text-right">{money(b.depositAmount)}</dd>
        <dt>Còn lại</dt>
        <dd className="text-right">{money(b.remainingAmount)}</dd>
      </dl>
      <Link
        href={`/admin/bookings/${b.id}`}
        aria-label={`Xem đơn đặt phòng ${b.bookingCode}`}
        className="inline-flex min-h-11 items-center justify-self-start self-start underline underline-offset-4 sm:col-span-2 lg:col-span-1"
      >
        Xem đơn
      </Link>
    </article>
  );
}

function BookingColumns() {
  return (
    <div
      aria-hidden="true"
      className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,.9fr)_auto] gap-5 border-b py-2 text-xs font-semibold text-muted-foreground lg:grid"
    >
      <span>Chỗ nghỉ / Khách</span>
      <span>Lưu trú / Thanh toán</span>
      <span>Số tiền</span>
      <span className="w-[3.5rem]">Thao tác</span>
    </div>
  );
}

export function Pager({
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
      className="mt-4 flex flex-wrap items-center justify-center gap-3 border-t pt-4"
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
    <div className="container-shell py-6 sm:py-8">
      <h1 className="mb-5 text-2xl font-semibold">Thống kê StayHub</h1>
      <div className="panel grid gap-6 p-5 sm:grid-cols-[1.2fr_1fr] sm:p-6">
        <section>
          <h2 className="mb-3 font-semibold">Đặt phòng</h2>
          <dl className="divide-y border-y tabular-nums">
            {[
              ['Tổng đặt phòng', s.totalBookings],
              ['Đã xác nhận', s.confirmed],
              ['Chờ thanh toán', s.pending],
              ['Hết hạn', s.expired],
              ['Đã hủy', s.cancelled],
            ].map(([label, value]) => (
              <div
                key={label}
                className={`flex items-center justify-between gap-4 px-2 py-2 ${label === 'Chờ thanh toán' ? 'bg-accent font-semibold' : ''}`}
              >
                <dt className="text-sm">{label}</dt>
                <dd className="text-lg font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h2 className="mb-3 font-semibold">Tài khoản & chỗ nghỉ</h2>
          <dl className="divide-y border-y tabular-nums">
            {[
              ['Khách thuê', s.guests],
              ['Người cho thuê', s.hosts],
              ['Cơ sở lưu trú', s.properties],
              ['Loại phòng', s.roomTypes],
            ].map(([label, value]) => (
              <div
                className="flex items-center justify-between gap-4 py-2"
                key={label}
              >
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="text-lg font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      <dl className="panel mt-6 flex flex-wrap items-baseline justify-between gap-2 p-5">
        <dt className="text-sm">Tổng cọc MoMo đã xác minh</dt>
        <dd className="text-xl font-semibold tabular-nums">
          {money(s.successfulDepositAmount)}
        </dd>
      </dl>
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
    <div className="container-shell py-6 sm:py-8">
      <h1 className="mb-5 text-2xl font-semibold">Người dùng & phân quyền</h1>
      <div className="panel mb-6 grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
        <div className="field col-span-2 sm:col-span-1">
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
              <option key={r} value={r}>
                {roleLabel[r as keyof typeof roleLabel]}
              </option>
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
              <option key={r} value={r}>
                {statusLabel[r as keyof typeof statusLabel]}
              </option>
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
          <div className="panel divide-y px-5 sm:px-6">
            <div
              aria-hidden="true"
              className="hidden grid-cols-[minmax(0,1fr)_minmax(0,.7fr)_minmax(0,1.4fr)] gap-6 py-2 text-xs font-semibold text-muted-foreground lg:grid"
            >
              <span>Người dùng / Liên hệ</span>
              <span>Vai trò / Trạng thái</span>
              <span>Thao tác</span>
            </div>
            {query.data.items.map((user) => (
              <article
                className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,.7fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,.7fr)_minmax(0,1.4fr)] lg:gap-6"
                key={user.id}
              >
                <div className="min-w-0 space-y-1">
                  <h2 className="font-semibold">{user.fullName}</h2>
                  <p className="break-all text-sm">{user.email}</p>
                  <p className="text-sm">
                    {user.phoneNumber || 'Chưa có số điện thoại'}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm">{roleLabel[user.role]}</p>
                  <StatusBadge status={user.status} />
                  <p className="text-xs text-muted-foreground">
                    Tạo ngày {dateLabel(user.createdAt)}
                  </p>
                </div>
                {user.role === 'GUEST' && (
                  <div className="flex flex-wrap content-start items-start gap-2 sm:col-span-2 lg:col-span-1">
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
export function AdminBookings({
  initialPropertyId = '',
}: {
  initialPropertyId?: string;
}) {
  const [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [paymentStatus, setPaymentStatus] = useState(''),
    [propertyId, setPropertyId] = useState(initialPropertyId),
    [hostId, setHostId] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [page, setPage] = useState(1);
  const params = {
    q: q || undefined,
    status: status || undefined,
    paymentStatus: paymentStatus || undefined,
    propertyId: propertyId || undefined,
    hostId: hostId || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
  };
  const query = useQuery({
    queryKey: ['admin-bookings', params],
    queryFn: () => api.adminBookings(params),
  });
  const filters = useQuery({
    queryKey: ['admin-booking-filters'],
    queryFn: api.adminBookingFilters,
  });
  const hosts = [
    ...new Map(
      (filters.data ?? []).map((p) => [p.hostId, p.host.fullName]),
    ).entries(),
  ];
  return (
    <div className="container-shell py-6 sm:py-8">
      <h1 className="mb-5 text-2xl font-semibold">Tra cứu đặt phòng</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Lịch sử đặt phòng và thanh toán trên toàn hệ thống. Chế độ chỉ xem.
      </p>
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
                <option key={s} value={s}>
                  {statusLabel[s as keyof typeof statusLabel]}
                </option>
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
        <div className="field">
          <label htmlFor="admin-payment-status">Thanh toán cọc</label>
          <select
            id="admin-payment-status"
            value={paymentStatus}
            onChange={(e) => {
              setPaymentStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả</option>
            <option value="SUCCESS">Thành công</option>
            <option value="FAILED">Thất bại, chưa thanh toán</option>
            <option value="UNPAID">Chưa thanh toán thành công</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="admin-host">Chủ cơ sở</label>
          <select
            id="admin-host"
            disabled={filters.isError || filters.isPending}
            value={hostId}
            onChange={(e) => {
              setHostId(e.target.value);
              setPropertyId('');
              setPage(1);
            }}
          >
            <option value="">Tất cả chủ cơ sở</option>
            {hosts.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="admin-property">Cơ sở / chi nhánh</label>
          <select
            id="admin-property"
            disabled={filters.isError || filters.isPending}
            value={propertyId}
            onChange={(e) => {
              setPropertyId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả cơ sở</option>
            {filters.data
              ?.filter((p) => !hostId || p.hostId === hostId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      </div>
      {filters.isError && (
        <div
          role="status"
          className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border bg-white p-4 text-sm"
        >
          <p className="min-w-0 flex-1">
            Chưa tải được bộ lọc chủ cơ sở / chi nhánh. Danh sách đặt phòng và
            các bộ lọc còn lại vẫn sử dụng được.
          </p>
          <Button variant="outline" onClick={() => void filters.refetch()}>
            Tải lại bộ lọc
          </Button>
        </div>
      )}
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState
          message={errorMessage(query.error)}
          retry={() => void query.refetch()}
        />
      ) : (
        <>
          <div className="panel divide-y px-5 sm:px-6">
            <BookingColumns />
            {query.data.items.map((b) => (
              <AdminBookingRecord key={b.id} booking={b} />
            ))}
          </div>
          {!query.data.items.length && (
            <div className="py-8 text-sm">
              <p>Không có đặt phòng phù hợp với bộ lọc.</p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => {
                  setQ('');
                  setStatus('');
                  setPaymentStatus('');
                  setPropertyId('');
                  setHostId('');
                  setFrom('');
                  setTo('');
                  setPage(1);
                }}
              >
                Xóa bộ lọc
              </Button>
            </div>
          )}
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
    <div className="container-shell py-6 sm:py-8">
      <h1 className="mb-5 text-2xl font-semibold">Lịch sử khách hàng</h1>
      <section className="grid gap-4 border-y py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{s.user.fullName}</h2>
          <p className="break-all">{s.user.email}</p>
          <p>{s.user.phoneNumber || 'Chưa có số điện thoại'}</p>
          <StatusBadge status={s.user.status} />
        </div>
        <dl className="grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-3 lg:border-t-0 lg:pt-0">
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
              <dd className="mt-1 font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <h2 className="my-6 text-xl font-semibold">20 đặt phòng gần nhất</h2>
      <div className="panel divide-y px-5 sm:px-6">
        <BookingColumns />
        {s.recentBookings.map((b) => (
          <AdminBookingRecord key={b.id} booking={b} />
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
    <div className="container-shell py-6 sm:py-8">
      <h1 className="mb-5 text-2xl font-semibold">Quản lý tiện ích</h1>
      <form
        className="mb-4 grid items-end gap-3 border-b pb-4 sm:grid-cols-2 lg:grid-cols-3"
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
        <div className="panel divide-y px-5 sm:px-6">
          <div
            aria-hidden="true"
            className="hidden grid-cols-[minmax(0,1fr)_minmax(0,.7fr)_minmax(0,1fr)_auto] gap-3 py-2 text-xs font-semibold text-muted-foreground sm:grid"
          >
            <span>Tiện ích</span>
            <span>Mã</span>
            <span>Trạng thái</span>
            <span className="w-[14rem]">Thao tác</span>
          </div>
          {query.data.map((a) => (
            <article
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,.7fr)_minmax(0,1fr)_auto] sm:gap-3"
              key={a.id}
            >
              <h2 className="col-span-2 break-words font-semibold sm:col-span-1">
                {a.nameVi}
              </h2>
              <p className="break-all text-xs text-muted-foreground">
                {a.code}
              </p>
              <p className="text-sm">
                {a.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}
              </p>
              <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:w-[14rem]">
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
