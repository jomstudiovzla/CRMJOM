export const PRODUCTION_HOSTS = ['crmjom.vercel.app', 'crm-jom.onrender.com'];

export const PRODUCTION_HOST = PRODUCTION_HOSTS[0];

export function getCanonicalHost() {
  if (process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    try {
      return new URL(process.env.NEXT_PUBLIC_APP_URL.trim()).hostname;
    } catch {
      /* ignore */
    }
  }
  return PRODUCTION_HOST;
}

export function getProductionLoginUrl() {
  return `https://${getCanonicalHost()}/login`;
}

export function isVercelPreviewHost(hostname) {
  return hostname.endsWith('.vercel.app') && !PRODUCTION_HOSTS.includes(hostname);
}

export function getAppHost() {
  if (typeof window !== 'undefined') return window.location.hostname;
  return getCanonicalHost();
}

export function getLoginUrl() {
  if (typeof window !== 'undefined') return `${window.location.origin}/login`;
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  return base ? `${base}/login` : 'http://localhost:3000/login';
}