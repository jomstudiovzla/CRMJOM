#!/usr/bin/env node
/**
 * Prepara login con Google en Vercel:
 * 1. Genera .env.production con URL de Vercel
 * 2. Copia al portapapeles
 * 3. Abre Firebase Authorized Domains + Vercel Env Vars
 *
 * Uso: node scripts/vercel-google-setup.mjs tu-proyecto.vercel.app
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENV_LOCAL = path.join(ROOT, '.env.local');
const PROJECT_ID = 'crm-jom';

const vercelHost = process.argv[2]?.replace(/^https?:\/\//, '').replace(/\/$/, '');

if (!vercelHost) {
  console.log('Uso: node scripts/vercel-google-setup.mjs TU-PROYECTO.vercel.app');
  console.log('Ejemplo: node scripts/vercel-google-setup.mjs crmjom.vercel.app');
  process.exit(1);
}

if (!fs.existsSync(ENV_LOCAL)) {
  console.error('❌ No existe .env.local');
  process.exit(1);
}

const lines = fs.readFileSync(ENV_LOCAL, 'utf8').split('\n');
const out = [];
let hasAppUrl = false;

for (const line of lines) {
  if (line.startsWith('NEXT_PUBLIC_APP_URL=')) {
    out.push(`NEXT_PUBLIC_APP_URL=https://${vercelHost}`);
    hasAppUrl = true;
  } else {
    out.push(line);
  }
}

if (!hasAppUrl) {
  out.unshift(`NEXT_PUBLIC_APP_URL=https://${vercelHost}`);
}

const productionEnv = out.join('\n');
const tmpFile = path.join(ROOT, '.env.vercel-paste');
fs.writeFileSync(tmpFile, productionEnv, 'utf8');

spawnSync('pbcopy', [], { input: productionEnv, encoding: 'utf8' });

console.log(`\n✅ Variables copiadas al portapapeles (APP_URL=https://${vercelHost})`);
console.log(`📄 Backup: .env.vercel-paste\n`);
console.log('PASO 1 — Vercel: Settings → Environment Variables → pegar → Save');
console.log('PASO 2 — Firebase: añade este dominio en Authorized domains:');
console.log(`         → ${vercelHost}\n`);
console.log('PASO 3 — Vercel: Deployments → Redeploy\n');

const firebaseAuthUrl = `https://console.firebase.google.com/project/${PROJECT_ID}/authentication/settings`;
const vercelEnvUrl = `https://vercel.com/jomstudiovzla/crmjom/settings/environment-variables`;

spawnSync('open', [firebaseAuthUrl]);
spawnSync('open', [vercelEnvUrl]);

console.log('🌐 Abriendo Firebase + Vercel en tu navegador…\n');