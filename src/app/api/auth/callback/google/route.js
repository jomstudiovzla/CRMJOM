import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const TOKEN_PATH = path.resolve(process.cwd(), '../ejecutar/google-tokens.json');

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: "No code provided by Google" }, { status: 400 });
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    
    // Redirigir de vuelta al CRM
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?tab=leads&success=gmail-connected`);
  } catch (error) {
    return NextResponse.json({ error: "Error authenticating with Google", details: error.message }, { status: 500 });
  }
}