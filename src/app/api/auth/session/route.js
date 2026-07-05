import { NextResponse } from 'next/server';
import { getSession } from '@/lib/requireAdmin';
import { defaultSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();

    if (!session.isLoggedIn) {
      return NextResponse.json({ success: true, user: null, isLoggedIn: false });
    }

    return NextResponse.json({
      success: true,
      isLoggedIn: true,
      user: session.user,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}