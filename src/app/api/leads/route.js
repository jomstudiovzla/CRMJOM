import { NextResponse } from 'next/server';
import { mergeAllLeads } from '@/lib/leadsStore';

export async function GET() {
  try {
    const combinedLeads = mergeAllLeads();
    return NextResponse.json({ success: true, data: combinedLeads });
  } catch (error) {
    console.error('Error reading leads:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}