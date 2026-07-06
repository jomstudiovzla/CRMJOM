#!/usr/bin/env node
/**
 * Añade dominios autorizados en Firebase Auth (Identity Toolkit API).
 * Uso: node scripts/firebase-authorize-domains.mjs [ruta-service-account.json] [dominio-extra...]
 */

import fs from 'fs';
import path from 'path';
import { GoogleAuth } from 'google-auth-library';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'crm-jom';

const DEFAULT_DOMAINS = [
  'localhost',
  '127.0.0.1',
  'crmjom.vercel.app',
  'crm-jom.firebaseapp.com',
  'crm-jom.web.app',
];

function resolveServiceAccountPath(arg) {
  if (arg && fs.existsSync(arg)) return arg;
  const candidates = [
    path.resolve(__dirname, '../../correccion/crm-jom-firebase-adminsdk-fbsvc-3a085e2fcf.json'),
    path.resolve(__dirname, '../firebase-service-account.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function getAccessToken(credentials) {
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/identitytoolkit'],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error('No se pudo obtener access token');
  return token.token;
}

async function main() {
  const saPath = resolveServiceAccountPath(process.argv[2]);
  if (!saPath) {
    console.error('❌ No se encontró service account JSON.');
    console.error('   Coloca el archivo en correccion/ o pásalo como argumento.');
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  const extraDomains = process.argv.slice(3).map((d) => d.replace(/^https?:\/\//, '').replace(/\/$/, ''));
  const token = await getAccessToken(credentials);

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const configUrl = `https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/config`;
  const getRes = await fetch(configUrl, { headers });
  const current = await getRes.json();

  if (!getRes.ok) {
    console.error('❌ Error leyendo config:', current.error?.message || JSON.stringify(current));
    process.exit(1);
  }

  const merged = [...new Set([...(current.authorizedDomains || []), ...DEFAULT_DOMAINS, ...extraDomains])];

  const patchRes = await fetch(`${configUrl}?updateMask=authorizedDomains`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ authorizedDomains: merged }),
  });
  const result = await patchRes.json();

  if (!patchRes.ok) {
    console.error('❌ Error actualizando dominios:', result.error?.message || JSON.stringify(result));
    process.exit(1);
  }

  console.log(`✅ Dominios autorizados en Firebase (${PROJECT_ID}):`);
  for (const d of result.authorizedDomains || merged) {
    console.log(`   · ${d}`);
  }
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});