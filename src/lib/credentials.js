import fs from 'fs';
import path from 'path';

export function getCredentials(platform) {
  const prefix = platform.toUpperCase();
  let user = process.env[`${prefix}_USER`];
  let pass = process.env[`${prefix}_PASS`];

  if (user && pass) {
    return { user, pass };
  }

  try {
    const filePath = path.resolve(process.cwd(), '../ejecutar/config/credentials.json');
    if (fs.existsSync(filePath)) {
      const creds = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (creds[platform]) {
        return {
          user: creds[platform].user || '',
          pass: creds[platform].pass || ''
        };
      }
    }
  } catch (e) {
    console.error(`[Credentials] Error leyendo credentials.json para ${platform}:`, e.message);
  }

  return { user: '', pass: '' };
}
