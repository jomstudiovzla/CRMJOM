export const PRODUCTION_HOST = 'crmjom.vercel.app';

export function getProductionLoginUrl() {
  return `https://${PRODUCTION_HOST}/login`;
}

export function isVercelPreviewHost(hostname) {
  return hostname.endsWith('.vercel.app') && hostname !== PRODUCTION_HOST;
}