import { NextResponse } from 'next/server';
import { getAppUrl } from '@/lib/appUrl';
import { PRODUCTION_HOST } from '@/lib/productionHost';

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
    productionHost: PRODUCTION_HOST,
    adminEmail: process.env.ADMIN_EMAIL || 'jomstudiovzla@gmail.com',
    hints: buildHints({ firebaseReady, sessionReady, appUrl, requestHost }),
  });
}

function buildHints({ firebaseReady, sessionReady, appUrl, requestHost }) {
  const hints = [];
  if (!firebaseReady) {
    hints.push('Añade NEXT_PUBLIC_FIREBASE_* en Vercel y haz Redeploy');
  }
  if (!sessionReady) {
    hints.push('Añade SESSION_SECRET (mín. 32 caracteres) en Vercel');
  }
  if (appUrl.includes('localhost')) {
    hints.push(`En producción define NEXT_PUBLIC_APP_URL=https://${PRODUCTION_HOST}`);
  }
  const host = requestHost || appUrl.replace(/^https?:\/\//, '').split(':')[0];
  // Eliminado el hint de dominio autorizado por petición del usuario
  if (host && host.endsWith('.vercel.app') && host !== PRODUCTION_HOST) {
    hints.push(`Usa siempre https://${PRODUCTION_HOST}/login (los previews de Vercel no sirven para Google)`);
  }
  return hints;
}