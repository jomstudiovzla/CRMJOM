import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_DIR = path.resolve(process.cwd(), '../ejecutar/config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'credentials.json');

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function readCredentials() {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeCredentials(data) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export async function GET() {
  try {
    const creds = readCredentials();
    const publicCreds = {};

    // Mask passwords for security
    for (const [platform, value] of Object.entries(creds)) {
      publicCreds[platform] = {
        user: value.user || '',
        pass: value.pass ? '********' : ''
      };
    }

    return NextResponse.json({ success: true, data: publicCreds });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const current = readCredentials();

    for (const [platform, value] of Object.entries(body)) {
      if (!current[platform]) {
        current[platform] = {};
      }
      if (value.user !== undefined) {
        current[platform].user = value.user;
      }
      if (value.pass !== undefined && value.pass !== '********') {
        current[platform].pass = value.pass;
      }
    }

    writeCredentials(current);

    // Sync with process.env for local runtime fallback
    for (const [platform, value] of Object.entries(current)) {
      const prefix = platform.toUpperCase();
      process.env[`${prefix}_USER`] = value.user || '';
      process.env[`${prefix}_PASS`] = value.pass || '';
    }

    return NextResponse.json({ success: true, message: 'Credenciales guardadas y sincronizadas con éxito.' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
