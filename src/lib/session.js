export const ADMIN_EMAIL = (
  process.env.ADMIN_EMAIL || 'jomstudiovzla@gmail.com'
).toLowerCase();

export const sessionOptions = {
  password: process.env.SESSION_SECRET || 'jom-studio-crm-dev-secret-min-32-chars!!',
  cookieName: 'jom_crm_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
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