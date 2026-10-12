export function resolveApiUrl(value: string | undefined, production: boolean) {
  const configured = value?.trim();
  const fallback = production
    ? 'https://pentabug-stayhub.vercel.app/api'
    : 'http://localhost:4000/api';
  const baseUrl = (configured || fallback).replace(/\/+$/, '');

  // Accept either the backend origin or its /api endpoint.
  if (/^https?:\/\//i.test(baseUrl)) {
    const url = new URL(baseUrl);
    if (url.pathname === '/') return `${baseUrl}/api`;
  }
  return baseUrl;
}
