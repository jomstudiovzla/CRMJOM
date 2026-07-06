#!/usr/bin/env node
/** Copia FIREBASE_SERVICE_ACCOUNT_JSON al portapapeles para pegar en Vercel. */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV = path.resolve(__dirname, '../.env.local');
const SA = path.resolve(__dirname, '../../correccion/crm-jom-firebase-adminsdk-fbsvc-3a085e2fcf.json');

let json = '';
if (fs.existsSync(ENV)) {
  const m = fs.readFileSync(ENV, 'utf8').match(/^FIREBASE_SERVICE_ACCOUNT_JSON=(.+)$/m);
  if (m) {
    json = m[1].trim();
    if ((json.startsWith('"') && json.endsWith('"')) || (json.startsWith("'") && json.endsWith("'"))) {
      json = json.slice(1, -1);
    }
  }
}
if (!json && fs.existsSync(SA)) {
  json = fs.readFileSync(SA, 'utf8').trim();
}
if (!json) {
  console.error('❌ No hay service account en .env.local ni en correccion/');
  process.exit(1);
}

spawnSync('pbcopy', [], { input: json, encoding: 'utf8' });
spawnSync('open', ['https://vercel.com/jomstudiovzla/crmjom/settings/environment-variables']);

console.log('✅ JSON copiado al portapapeles');
console.log('📋 En Vercel crea: FIREBASE_SERVICE_ACCOUNT_JSON → Production + Preview');
console.log('   Pega el valor (una sola línea JSON) y haz Redeploy');