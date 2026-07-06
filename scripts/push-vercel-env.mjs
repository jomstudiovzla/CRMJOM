#!/usr/bin/env node
/**
 * Sube variables de .env.local a Vercel sin pasar por Git.
 * Uso: npm run vercel:env
 * Requiere: npx vercel login (una vez) + proyecto vinculado (npx vercel link)
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env.local');
const TARGETS = ['production', 'preview', 'development'];

const SKIP_KEYS = new Set([
  'VERCEL_OIDC_TOKEN',
  'VERCEL',
  'VERCEL_ENV',
  'VERCEL_URL',
  'VERCEL_GIT_COMMIT_SHA',
  'VERCEL_GIT_COMMIT_REF',
  'VERCEL_GIT_REPO_SLUG',
]);
const vercelHostArg = process.argv[2]?.replace(/^https?:\/\//, '').replace(/\/$/, '');

function parseEnvFile(content) {
  const vars = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!key || SKIP_KEYS.has(key)) continue;
    if (key === 'NEXT_PUBLIC_APP_URL' && vercelHostArg) {
      vars.push({ key, value: `https://${vercelHostArg}` });
      continue;
    }
    vars.push({ key, value });
  }
  return vars;
}

function runVercel(args, input) {
  const result = spawnSync('npx', ['vercel', ...args], {
    cwd: ROOT,
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return result;
}

function main() {
  if (!fs.existsSync(ENV_FILE)) {
    console.error('❌ No existe .env.local');
    process.exit(1);
  }

  const vars = parseEnvFile(fs.readFileSync(ENV_FILE, 'utf8'));
  console.log(`📦 Subiendo ${vars.length} variables a Vercel (${TARGETS.join(', ')})…\n`);

  let ok = 0;
  let fail = 0;

  for (const { key, value } of vars) {
    for (const target of TARGETS) {
      const rm = runVercel(['env', 'rm', key, target, '--yes'], '');
      if (rm.status !== 0 && !/Environment Variable not found/i.test(rm.stderr || '')) {
        // ignorar si no existía
      }

      const add = runVercel(['env', 'add', key, target], `${value}\n`);
      if (add.status === 0) {
        console.log(`  ✅ ${key} → ${target}`);
        ok++;
      } else {
        const err = (add.stderr || add.stdout || '').trim();
        if (/not logged in|login/i.test(err)) {
          console.error('\n🔐 Primero ejecuta: npx vercel login');
          process.exit(1);
        }
        if (/not linked|link/i.test(err)) {
          console.error('\n🔗 Primero ejecuta: npx vercel link');
          process.exit(1);
        }
        console.error(`  ❌ ${key} → ${target}: ${err.slice(0, 120)}`);
        fail++;
      }
    }
  }

  console.log(`\n✨ Listo: ${ok} ok, ${fail} fallos`);
  if (fail === 0) {
    console.log('🚀 Ahora redeploy: npx vercel --prod');
  }
}

main();