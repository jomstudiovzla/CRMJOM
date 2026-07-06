import { NextResponse } from 'next/server';
import { generateWhatsAppDraft } from '@/lib/gemini';
import { mergeAllLeads } from '@/lib/leadsStore';

export async function POST(request) {
  try {
    const { nombre_negocio, lead: leadPayload } = await request.json();

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
    const draft = await generateWhatsAppDraft({ lead });

    return NextResponse.json({
      success: true,
      data: draft,
      message: draft.generatedByAi
        ? '✨ Mensaje de WhatsApp generado por IA'
        : '📝 Mensaje predeterminado de WhatsApp',
    });
  } catch (error) {
    console.error('Error in /api/whatsapp/draft:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
