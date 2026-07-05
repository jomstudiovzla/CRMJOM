import { NextResponse } from 'next/server';
import { generateReplyDraft } from '@/lib/gemini';
import { getThreadByLead } from '@/lib/emailStore';
import { mergeAllLeads } from '@/lib/leadsStore';

export async function POST(request) {
  try {
    const { nombre_negocio, messages, lead: leadPayload } = await request.json();

    if (!nombre_negocio) {
      return NextResponse.json(
        { success: false, error: 'nombre_negocio es requerido' },
        { status: 400 }
      );
    }

    const allLeads = mergeAllLeads();
    const storedLead = allLeads.find(
      (l) => l.nombre_negocio?.toLowerCase() === nombre_negocio.toLowerCase()
    );

    const lead = { ...storedLead, ...leadPayload, nombre_negocio };
    const thread = getThreadByLead(nombre_negocio);
    const threadMessages = messages?.length ? messages : thread?.messages || [];

    const draft = await generateReplyDraft({ lead, messages: threadMessages });

    return NextResponse.json({
      success: true,
      data: draft,
      message: draft.generatedByAi
        ? '✨ Borrador generado por IA'
        : '📝 Borrador desde plantilla (configura GEMINI_API_KEY para IA)',
    });
  } catch (error) {
    console.error('Error in /api/email/draft:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}