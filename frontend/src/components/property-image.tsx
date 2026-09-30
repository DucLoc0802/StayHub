'use client';
/* eslint-disable @next/next/no-img-element -- Host URLs are intentionally loaded directly by the browser. */
import type { ComponentProps } from 'react';
// The host supplies HTTPS URLs. Load them in the browser instead of proxying arbitrary URLs through the server.
export function PropertyImage({ alt, ...props }: ComponentProps<'img'>) {
  return (
    <img
      {...props}
      alt={alt}
      onError={(event) => {
        if (!event.currentTarget.src.endsWith('/room-placeholder.svg'))
          event.currentTarget.src = '/room-placeholder.svg';
      }}
    />
  );
}
