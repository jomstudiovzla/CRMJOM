const WARNED = new Set();

export function warnMissingEnv(key, hint) {
  if (process.env[key] || WARNED.has(key)) return;
  WARNED.add(key);
  console.warn(`[JOM CRM] Falta variable de entorno: ${key}${hint ? ` — ${hint}` : ''}`);
}

export function checkPhase2Env() {
  warnMissingEnv('GEMINI_API_KEY', 'necesaria para clasificación IA de emails');
  warnMissingEnv('GMAIL_USER', 'correo administrador JOM Studio');
  warnMissingEnv('GMAIL_APP_PASSWORD', 'necesaria para IMAP y envío SMTP');
  warnMissingEnv('NEXT_PUBLIC_APP_URL', 'ej. http://localhost:3000');
}