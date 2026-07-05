import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, ADMIN_EMAIL } from './session';

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession(cookieStore, sessionOptions);
}

export async function requireAdmin() {
  const session = await getSession();

  if (!session.isLoggedIn || !session.user?.email) {
    return { authorized: false, session: null, error: 'No autenticado' };
  }

  if (session.user.email.toLowerCase() !== ADMIN_EMAIL) {
    return { authorized: false, session, error: 'Sin permisos de administrador' };
  }

  return { authorized: true, session, error: null };
}