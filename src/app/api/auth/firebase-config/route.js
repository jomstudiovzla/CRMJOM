import { NextResponse } from 'next/server';
import { getAppUrl } from '@/lib/appUrl';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const firebaseReady = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim());
  const sessionReady = Boolean(process.env.SESSION_SECRET?.trim()?.length >= 32);
  const appUrl = getAppUrl();
  const requestHost =
    request.nextUrl.searchParams.get('host') ||
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    request.headers.get('host')?.split(':')[0] ||
    null;

  return NextResponse.json({
    success: true,
    firebaseReady,
    sessionReady,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || null,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || null,
    appUrl,
    requestHost,
    adminEmail: process.env.ADMIN_EMAIL || 'jomstudiovzla@gmail.com',
    hints: buildHints({ firebaseReady, sessionReady, appUrl }),
  });
}

function buildHints({ firebaseReady, sessionReady, appUrl }) {
  const hints = [];
  if (!firebaseReady) {
    hints.push('Faltan variables NEXT_PUBLIC_FIREBASE_* en .env');
  }
  if (!sessionReady) {
    hints.push('Añade SESSION_SECRET (mín. 32 caracteres) en .env');
  }
  if (appUrl.includes('localhost')) {
    hints.push(`Define NEXT_PUBLIC_APP_URL para producción`);
  }
  return hints;
}