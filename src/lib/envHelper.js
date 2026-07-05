import fs from 'fs';
import path from 'path';

function readEnvLocal() {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, 'utf8');
    const vars = {};
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match) vars[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
    }
    return vars;
  } catch {
    return {};
  }
}

export function getGeminiApiKey() {
  const fromEnv = process.env.GEMINI_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  return readEnvLocal().GEMINI_API_KEY?.trim() || '';
}

export function isGeminiReady() {
  return Boolean(getGeminiApiKey());
}