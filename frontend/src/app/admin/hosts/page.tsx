'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import type { User } from '@/lib/types';
import { dateLabel } from '@/lib/utils';
import { RequireAuth } from '@/components/require-auth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Empty,
  ErrorState,
  Loading,
  StatusBadge,
} from '@/components/ui/states';
function ApprovalList() {
  const client = useQueryClient();
  const hosts = useQuery({
    queryKey: ['pending-hosts'],
    queryFn: api.pendingHosts,
  });
  const [decision, setDecision] = useState<{
    user: User;
    action: 'approve' | 'reject';
  } | null>(null);
  const mutation = useMutation({
    mutationFn: (data: NonNullable<typeof decision>) =>
      api.decideHost(data.user.id, data.action),
    onSuccess: () => {
      toast.success('Đã xét duyệt tài khoản.');
      setDecision(null);
      void client.invalidateQueries({ queryKey: ['pending-hosts'] });
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      void client.invalidateQueries({ queryKey: ['pending-hosts'] });
    },
  });
  return (
    <div className="container-shell page-section">
      <p className="eyebrow">QUẢN TRỊ VIÊN</p>
      <h1 className="page-title mt-3">Xét duyệt người cho thuê</h1>
      <p className="mb-8 mt-3 text-sm text-muted-foreground">
        Các tài khoản mới đang chờ được phê duyệt.
      </p>
      {hosts.isPending ? (
        <Loading />
      ) : hosts.isError ? (
        <ErrorState
          message={errorMessage(hosts.error)}
          retry={() => void hosts.refetch()}
        />
      ) : !hosts.data.length ? (
        <Empty>Không có tài khoản đang chờ phê duyệt.</Empty>
      ) : (
        <div className="space-y-4">
          {hosts.data.map((user) => (
            <article
              key={user.id}
              className="panel flex flex-wrap items-center justify-between gap-5 p-6"
            >
              <div className="min-w-0">
                <h2 className="font-semibold">{user.fullName}</h2>
                <p className="mt-2 break-all text-sm text-muted-foreground">
                  {user.email}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Đăng ký ngày {dateLabel(user.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={user.status} />
                <Button
                  variant="outline"
                  onClick={() => {
                    mutation.reset();
                    setDecision({ user, action: 'reject' });
                  }}
                >
                  Từ chối
                </Button>
                <Button
                  onClick={() => {
                    mutation.reset();
                    setDecision({ user, action: 'approve' });
                  }}
                >
                  Phê duyệt
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <Dialog
        open={!!decision}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setDecision(null);
        }}
      >
        <DialogContent>
          <DialogTitle className="text-lg font-semibold">
            {decision?.action === 'approve'
              ? 'Phê duyệt tài khoản'
              : 'Từ chối tài khoản'}
          </DialogTitle>
          <DialogDescription className="mt-4 text-sm leading-7 text-muted-foreground">
            {decision?.action === 'approve'
              ? `Cho phép ${decision.user.fullName} quản lý và đăng chỗ nghỉ?`
              : `Từ chối tài khoản của ${decision?.user.fullName}? Tài khoản bị từ chối không thể được phê duyệt lại trong phạm vi hiện tại.`}
          </DialogDescription>
          {mutation.isError && (
            <p role="alert" className="mt-3 field-error">
              {errorMessage(mutation.error)}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setDecision(null)}
            >
              Quay lại
            </Button>
            <Button
              variant={
                decision?.action === 'reject' ? 'destructive' : 'default'
              }
              disabled={mutation.isPending}
              onClick={() => {
                if (decision) mutation.mutate(decision);
              }}
            >
              {mutation.isPending ? 'Đang xử lý…' : 'Xác nhận'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default function AdminHostsPage() {
  return (
    <RequireAuth role="ADMIN">
      <ApprovalList />
    </RequireAuth>
  );
}
