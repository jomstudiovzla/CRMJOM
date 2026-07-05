import { NextResponse } from 'next/server';
import { getSession } from '@/lib/requireAdmin';

export async function POST(request) {
  try {
    const { email } = await request.json();
    
    if (email !== 'jomstudiovzla@gmail.com') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const session = await getSession();
    session.isLoggedIn = true;
    session.user = {
      email,
      name: 'Admin PRO',
      picture: '/logo_jom_square.jpg',
    };
    await session.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
