import { NextResponse } from 'next/server';
import { getGmailStatus } from '@/lib/gmailConfig';

export async function GET() {
  const status = getGmailStatus();

  return NextResponse.json({
    success: true,
    ...status,
    gmailConfigured: status.smtpReady,
    mode: status.smtpReady ? 'smtp' : 'mailto',
  });
}