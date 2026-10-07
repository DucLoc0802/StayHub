import { z } from 'zod';

export const profilePhone = z.string()
  .transform((value) => value.replace(/[\s.-]/g, '').replace(/^\+84/, '0'))
  .pipe(z.string().regex(/^0[35789]\d{8}$/, 'Số điện thoại Việt Nam không hợp lệ. Ví dụ: 090 123 4567.'));
