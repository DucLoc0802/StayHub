import Link from 'next/link';
import { Button } from '@/components/ui/button';
export default function NotFound() {
  return (
    <div className="container-shell py-24 text-center">
      <p className="eyebrow">404 · Lạc đường một chút</p>
      <h1 className="page-title my-5">Không tìm thấy trang bạn cần.</h1>
      <Button asChild>
        <Link href="/">Về trang chủ</Link>
      </Button>
    </div>
  );
}
