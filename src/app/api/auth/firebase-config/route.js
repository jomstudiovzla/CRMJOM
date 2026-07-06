import { NextResponse } from 'next/server';
import { getAppUrl } from '@/lib/appUrl';
import { isLocalRuntime } from '@/lib/runtimeMode';

export const dynamic = 'force-dynamic';

export async function GET() {
  const firebaseReady = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim());
  const sessionReady = Boolean(process.env.SESSION_SECRET?.trim()?.length >= 32);
  const appUrl = getAppUrl();

  return NextResponse.json({
    success: true,
    firebaseReady,
    sessionReady,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || null,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || null,
    appUrl,
    mode: isLocalRuntime() ? 'local' : 'cloud',
    adminEmail: process.env.ADMIN_EMAIL || 'jomstudiovzla@gmail.com',
    hints: buildHints({ firebaseReady, sessionReady }),
  });
}

function buildHints({ firebaseReady, sessionReady }) {
  const hints = [];
  if (!firebaseReady) {
    hints.push('Copia NEXT_PUBLIC_FIREBASE_* a .env.local');
  }
  if (!sessionReady) {
    hints.push('Añade SESSION_SECRET (mín. 32 caracteres) en .env.local');
  }
  if (isLocalRuntime()) {
    hints.push('Modo local — http://localhost:3000');
  }
  return hints;
}