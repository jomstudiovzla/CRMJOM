import { NextResponse } from 'next/server';
import { getAppUrl } from '@/lib/appUrl';

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
    adminEmail: process.env.ADMIN_EMAIL || 'jomstudiovzla@gmail.com',
    hints: buildHints({ firebaseReady, sessionReady, appUrl }),
  });
}

function buildHints({ firebaseReady, sessionReady, appUrl }) {
  const hints = [];
  if (!firebaseReady) {
    hints.push('Añade NEXT_PUBLIC_FIREBASE_* en Vercel y haz Redeploy');
  }
  if (!sessionReady) {
    hints.push('Añade SESSION_SECRET (mín. 32 caracteres) en Vercel');
  }
  if (appUrl.includes('localhost')) {
    hints.push('En producción define NEXT_PUBLIC_APP_URL=https://crmjom.vercel.app');
  }
  if (appUrl.includes('vercel.app')) {
    const host = appUrl.replace(/^https?:\/\//, '');
    hints.push(`Firebase → Authorized domains: añade "${host}" si el login falla`);
  }
  return hints;
}