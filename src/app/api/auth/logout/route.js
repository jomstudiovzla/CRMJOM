import { NextResponse } from 'next/server';
import { getSession } from '@/lib/requireAdmin';
import { defaultSession } from '@/lib/session';

export async function POST() {
  const session = await getSession();
  session.isLoggedIn = false;
  session.user = null;
  await session.save();

  return NextResponse.json({ success: true });
}