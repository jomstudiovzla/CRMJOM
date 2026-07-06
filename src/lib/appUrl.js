import { getLocalBaseUrl, isLocalRuntime } from './runtimeMode';

export function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, '');
  }
  if (isLocalRuntime()) {
    return getLocalBaseUrl();
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return getLocalBaseUrl();
}