import { NextResponse } from 'next/server';
import { getGmailStatus } from '@/lib/gmailConfig';
import { isLocalRuntime } from '@/lib/runtimeMode';
import { mergeAllLeads } from '@/lib/leadsStore';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const gmail = getGmailStatus();
  const leads = mergeAllLeads();

  const playbookRoot = path.resolve(process.cwd(), '../playbook');
  const playbookFiles = fs.existsSync(playbookRoot)
    ? fs.readdirSync(playbookRoot).filter((f) => f.endsWith('.md')).length
    : 0;

  return NextResponse.json({
    success: true,
    mode: 'local',
    runtime: isLocalRuntime() ? 'localhost' : 'cloud',
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`,
    modules: {
      login: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim()),
      gmail: gmail.smtpReady,
      gmailImap: gmail.imapReady,
      gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
      session: Boolean(process.env.SESSION_SECRET?.trim()?.length >= 32),
      leads: leads.length,
      playbook: playbookFiles,
      websockets: true,
      imapIdle: gmail.imapReady,
      ghostwriter: Boolean(process.env.GEMINI_API_KEY?.trim()),
      deepScraper: Boolean(process.env.GEMINI_API_KEY?.trim()),
      upworkScraper: true,
    },
    hints: buildHints(gmail),
  });
}

function buildHints(gmail) {
  const hints = [];
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim()) {
    hints.push('Añade NEXT_PUBLIC_FIREBASE_* en .env.local para login Google');
  }
  if (!gmail.smtpReady) {
    hints.push('Añade GMAIL_USER + GMAIL_APP_PASSWORD en .env.local');
  }
  if (!process.env.GEMINI_API_KEY?.trim()) {
    hints.push('Añade GEMINI_API_KEY para Ghostwriter + clasificación IA');
  }
  return hints;
}