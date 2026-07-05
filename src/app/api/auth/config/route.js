import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    googleConfigured: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ),
    adminEmail: process.env.ADMIN_EMAIL || 'jomstudiovzla@gmail.com',
  });
}