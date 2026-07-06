import { autoContactComputrabajo } from '@/lib/autoContactComputrabajo';
import { autoContactLinkedin } from '@/lib/autoContactLinkedin';
import { mergeAllLeads } from '@/lib/leadsStore';
import { getCredentials } from '@/lib/credentials';

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

    const isLinkedin = lead.link && lead.link.includes('linkedin.com');

    if (isLinkedin) {
      const { user, pass } = getCredentials('linkedin');

      if (!user || !pass) {
        return NextResponse.json({ 
          success: false, 
          error: 'Por favor, configura tu cuenta de LinkedIn en la pestaña de Empresa del CRM para automatizar postulaciones.' 
        }, { status: 400 });
      }

      console.log(`[Auto-Contact API] Iniciando postulación automática en LinkedIn para ${nombre_negocio}`);
      const result = await autoContactLinkedin(lead, user, pass);

      return NextResponse.json({
        success: true,
        message: 'Postulación en LinkedIn (Easy Apply) completada con éxito.',
        data: result
      });
    } else {
      const { user, pass } = getCredentials('computrabajo');

      if (!user || !pass) {
        return NextResponse.json({ 
          success: false, 
          error: 'Por favor, configura tu cuenta de Computrabajo en la pestaña de Empresa del CRM para automatizar postulaciones.' 
        }, { status: 400 });
      }

      console.log(`[Auto-Contact API] Iniciando postulación automática para ${nombre_negocio}`);
      const result = await autoContactComputrabajo(lead, user, pass);

      return NextResponse.json({
        success: true,
        message: 'Postulación completada de forma 100% automática.',
        data: result
      });
    }

  } catch (error) {
    console.error('Error in /api/leads/auto-contact:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
