export const ADMIN_EMAIL = (
  process.env.ADMIN_EMAIL || 'jomstudiovzla@gmail.com'
).toLowerCase();

function getSessionPassword() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
    console.warn('[JOM CRM] SESSION_SECRET corto o ausente en Vercel — las cookies pueden fallar');
  }
  return secret || 'jom-studio-crm-dev-secret-min-32-chars!!';
}

const isProduction = process.env.NODE_ENV === 'production';

export const sessionOptions = {
  password: getSessionPassword(),
  cookieName: 'jom_crm_session',
  cookieOptions: {
    secure: isProduction,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  },
};

export const defaultSession = {
  isLoggedIn: false,
  user: null,
};