import fs from 'fs';
import path from 'path';
import { isGeminiReady } from './envHelper';

const DEFAULT_USER = 'jomstudiovzla@gmail.com';

export function normalizeAppPassword(raw) {
  if (!raw) return '';
  return String(raw).replace(/["'\s]/g, '').trim();
}

export function getGmailCredentials() {
  let user = (process.env.GMAIL_USER || DEFAULT_USER).trim();
  let pass = normalizeAppPassword(process.env.GMAIL_APP_PASSWORD);
  
  // HOT RELOAD: Leer .env.local manualmente si no está en process.env (evita pedir reinicio del servidor)
  if (!pass) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const passMatch = envContent.match(/^GMAIL_APP_PASSWORD=(.+)$/m);
        const userMatch = envContent.match(/^GMAIL_USER=(.+)$/m);
        if (passMatch) pass = normalizeAppPassword(passMatch[1]);
        if (userMatch) user = userMatch[1].replace(/["'\s]/g, '').trim();
      }
    } catch (e) {
      // Ignorar error de lectura manual
    }
  }
  
  return { user, pass, ready: Boolean(user && pass.length >= 16) };
}

export const GMAIL_SETUP_STEPS = [
  'Entra a https://myaccount.google.com/security con jomstudiovzla@gmail.com',
  'Activa la Verificación en dos pasos si no está activa',
  'Busca "Contraseñas de aplicación" y crea una llamada "CRM JOM IA"',
  'Copia las 16 letras (sin espacios) en crm-home/.env.local → GMAIL_APP_PASSWORD=',
  'Guarda el archivo y reinicia el servidor: npm run dev',
];

export function getGmailStatus() {
  const { user, pass, ready } = getGmailCredentials();
  const geminiReady = isGeminiReady();

  const missing = [];
  if (!user) missing.push('GMAIL_USER');
  if (!pass) missing.push('GMAIL_APP_PASSWORD');
  if (!geminiReady) missing.push('GEMINI_API_KEY');

  return {
    fromEmail: user,
    fromName: process.env.GMAIL_FROM_NAME || 'Jesús Omar Martínez · JOM Studio',
    gmailConfigured: ready,
    imapReady: ready,
    smtpReady: ready,
    geminiReady,
    missing,
    setupUrl: 'https://myaccount.google.com/apppasswords',
    securityUrl: 'https://myaccount.google.com/security',
    mode: ready ? 'imap' : 'setup_required',
  };
}

export function gmailSetupResponse() {
  return {
    success: false,
    code: 'GMAIL_SETUP_REQUIRED',
    error: 'Falta la Contraseña de Aplicación de Google para leer tu bandeja (IMAP).',
    hint: 'El inicio de sesión Firebase ya funciona — esto es un paso aparte para que la IA lea correos.',
    steps: GMAIL_SETUP_STEPS,
    setupUrl: 'https://myaccount.google.com/apppasswords',
    envExample: {
      GMAIL_USER: 'jomstudiovzla@gmail.com',
      GMAIL_APP_PASSWORD: 'abcdefghijklmnop',
      GEMINI_API_KEY: 'tu-api-key-de-google-ai-studio',
    },
  };
}