import { NextResponse } from 'next/server';
import { readThreads } from '@/lib/emailStore';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lead = searchParams.get('lead');

    let threads = readThreads();

    if (lead) {
      const key = lead.toLowerCase();
      threads = threads.filter(
        (t) =>
          t.lead_key?.toLowerCase() === key ||
          t.nombre_negocio?.toLowerCase() === key
      );
    }

    return NextResponse.json({ success: true, data: threads });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}