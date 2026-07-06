import { NextResponse } from 'next/server';
import { getSession } from '@/lib/requireAdmin';
import { ADMIN_EMAIL } from '@/lib/session';
import { verifyFirebaseIdToken } from '@/lib/verifyFirebaseToken';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { idToken, email: legacyEmail } = body;

    let user;
    if (idToken) {
      user = await verifyFirebaseIdToken(idToken);
    } else if (legacyEmail) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { success: false, error: 'Se requiere verificación con Google (idToken)' },
          { status: 400 }
        );
      }
      user = { email: legacyEmail, name: 'Admin PRO', picture: '/logo_jom_square.jpg' };
    } else {
      return NextResponse.json(
        { success: false, error: 'Falta idToken de Firebase' },
        { status: 400 }
      );
    }

    if (user.email.toLowerCase() !== ADMIN_EMAIL) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const session = await getSession();
    session.isLoggedIn = true;
    session.user = {
      email: user.email,
      name: user.name,
      picture: user.picture,
    };
    await session.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[firebase-login]', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 401 });
  }
}