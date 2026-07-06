import { NextResponse } from 'next/server';
import { autoContactComputrabajo } from '@/lib/autoContactComputrabajo';
import { mergeAllLeads } from '@/lib/leadsStore';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { nombre_negocio } = await request.json();

    if (!nombre_negocio) {
      return NextResponse.json({ success: false, error: 'nombre_negocio es requerido' }, { status: 400 });
    }

    const allLeads = mergeAllLeads();
    const lead = allLeads.find(
      (l) => l.nombre_negocio?.toLowerCase() === nombre_negocio.toLowerCase()
    );

    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead no encontrado' }, { status: 404 });
    }

    const user = process.env.COMPUTRABAJO_USER;
    const pass = process.env.COMPUTRABAJO_PASS;

    if (!user || !pass) {
      return NextResponse.json({ 
        success: false, 
        error: 'Por favor, configura COMPUTRABAJO_USER y COMPUTRABAJO_PASS en tu archivo .env.local' 
      }, { status: 400 });
    }

    console.log(`[Auto-Contact API] Iniciando postulación automática para ${nombre_negocio}`);
    const result = await autoContactComputrabajo(lead, user, pass);

    return NextResponse.json({
      success: true,
      message: 'Postulación completada de forma 100% automática.',
      data: result
    });

  } catch (error) {
    console.error('Error in /api/leads/auto-contact:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
