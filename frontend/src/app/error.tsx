'use client';
import { ErrorState } from '@/components/ui/states';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="container-shell page-section">
      <ErrorState
        message="Không thể hiển thị trang. Vui lòng thử lại."
        retry={reset}
      />
    </div>
  );
}
