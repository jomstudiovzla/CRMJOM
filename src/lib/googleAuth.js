import { OAuth2Client } from 'google-auth-library';

export function getGoogleClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!clientId || !clientSecret) {
    return null;
  }

  return new OAuth2Client(clientId, clientSecret, `${baseUrl}/api/auth/callback/google`);
}

export function getGoogleAuthUrl() {
  const client = getGoogleClient();
  if (!client) return null;

  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
  });
}

export async function getGoogleUserFromCode(code) {
  const client = getGoogleClient();
  if (!client) throw new Error('Google OAuth no configurado');

  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!res.ok) throw new Error('No se pudo obtener perfil de Google');
  return res.json();
}