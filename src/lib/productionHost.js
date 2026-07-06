export function getAppHost() {
  if (typeof window !== 'undefined') return window.location.hostname;
  return process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname : 'localhost';
}

export function getLoginUrl() {
  if (typeof window !== 'undefined') return `${window.location.origin}/login`;
  return process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/login` : 'http://localhost:3000/login';
}