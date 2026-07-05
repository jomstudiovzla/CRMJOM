import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`;
  
  if (!clientId) {
    return NextResponse.json({ error: "Falta GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env.local" }, { status: 400 });
  }

  // Solicitamos acceso para leer y modificar (para marcar como leído)
  const scope = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify";
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;

  return NextResponse.redirect(authUrl);
}