/**
 * /api/leads/auto-contact
 * Router de postulación automática multi-plataforma
 *
 * Detecta la plataforma por la URL del lead y llama al bot correspondiente.
 * La sesión Google ya está activa en el Chrome compartido → no necesita credenciales.
 */
import { NextResponse }              from 'next/server';
import { autoContactComputrabajo }   from '@/lib/autoContactComputrabajo';
import { autoContactLinkedin }       from '@/lib/autoContactLinkedin';
import { autoContactGeneric }        from '@/lib/autoContactGeneric';
import { mergeAllLeads }             from '@/lib/leadsStore';

export const runtime = 'nodejs';

/** Detectar plataforma desde la URL del lead */
function detectPlatform(lead) {
  const url = (lead.link || '').toLowerCase();
  if (url.includes('linkedin.com'))      return 'linkedin';
  if (url.includes('computrabajo.com'))  return 'computrabajo';
  if (url.includes('upwork.com'))        return 'upwork';
  if (url.includes('fiverr.com'))        return 'fiverr';
  if (url.includes('workana.com'))       return 'workana';
  if (url.includes('freelancer.com'))    return 'freelancer';
  if (url.includes('bumeran.com'))       return 'bumeran';
  // Por tipo de lead si no hay URL clara
  if (lead.tipo === 'linkedin')          return 'linkedin';
  if (lead.tipo === 'upwork')            return 'upwork';
  return 'computrabajo'; // fallback
}

export async function POST(request) {
  try {
    const { nombre_negocio } = await request.json();

    if (!nombre_negocio) {
      return NextResponse.json(
        { success: false, error: 'nombre_negocio es requerido' },
        { status: 400 }
      );
    }

    const allLeads = mergeAllLeads();
    const lead     = allLeads.find(
      (l) => l.nombre_negocio?.toLowerCase() === nombre_negocio.toLowerCase()
    );

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead no encontrado' },
        { status: 404 }
      );
    }

    const platform = detectPlatform(lead);
    console.log(`[Auto-Contact API] [${platform.toUpperCase()}] ${nombre_negocio}`);

    let result;

    switch (platform) {
      case 'linkedin':
        result = await autoContactLinkedin(lead);
        break;

      case 'upwork':
        result = await autoContactGeneric(lead, 'upwork', ['.up-btn-primary', 'button[aria-label="Submit a Proposal"]']);
        break;
      case 'fiverr':
        result = await autoContactGeneric(lead, 'fiverr', ['.btn-standard', 'button:contains("Contact")']);
        break;
      case 'workana':
        result = await autoContactGeneric(lead, 'workana', ['.btn-success', 'a.btn-primary']);
        break;
      case 'freelancer':
        result = await autoContactGeneric(lead, 'freelancer', ['.btn-primary', '.Button--primary']);
        break;
      case 'bumeran':
        result = await autoContactGeneric(lead, 'bumeran', ['#postularme-btn', 'button[id*="postular"]']);
        break;

      case 'computrabajo':
      default:
        result = await autoContactComputrabajo(lead);
        break;
    }

    return NextResponse.json({
      success: true,
      message: `Postulación en ${platform} completada.`,
      data: result,
      platform,
    });

  } catch (error) {
    console.error('Error in /api/leads/auto-contact:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
