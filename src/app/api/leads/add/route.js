import { NextResponse } from 'next/server';
import { updateLeadState, updateLeadGap } from '@/lib/leadsStore';
import { fetchWebsiteText, normalizeUrl } from '@/lib/websiteUtils';
import { auditWebsiteForGap } from '@/lib/gemini';

export async function POST(request) {
  try {
    const lead = await request.json();

    if (!lead.nombre_negocio) {
      return NextResponse.json({ success: false, error: 'nombre_negocio es requerido' }, { status: 400 });
    }

    let gapDetectado = lead.gap_detectado || 'Descubierto por IA desde portales';
    let web = lead.web || '';
    let solucionJom = lead.solucion_jom || '';

    if (lead.web && lead.runDeepAudit !== false && !lead.gap_from_audit) {
      const normalized = normalizeUrl(lead.web);
      if (normalized) {
        try {
          const { url: fetchedUrl, text } = await fetchWebsiteText(normalized);
          const audit = await auditWebsiteForGap({
            url: fetchedUrl,
            text,
            companyName: lead.nombre_negocio,
          });
          gapDetectado = audit.solucion_jom
            ? `${audit.gap_detectado} → Solución JOM: ${audit.solucion_jom}`
            : audit.gap_detectado;
          web = fetchedUrl;
          solucionJom = audit.solucion_jom || '';
        } catch (auditError) {
          console.warn('[JOM CRM] Deep audit en add falló:', auditError.message);
        }
      }
    }

    updateLeadState(lead.nombre_negocio, 'nuevo', {
      email: lead.email || '',
      telefono: lead.telefono || '',
      gap_detectado: gapDetectado,
      web,
      solucion_jom: solucionJom,
      origen: lead.origen || 'IA Inbox Extractor',
      fecha_creacion: new Date().toISOString(),
    });

    if (web || gapDetectado) {
      updateLeadGap(lead.nombre_negocio, {
        gap_detectado: gapDetectado,
        web,
        solucion_jom: solucionJom,
      });
    }

    return NextResponse.json({
      success: true,
      message: '✅ Lead guardado exitosamente.',
      data: { gap_detectado: gapDetectado, web },
    });
  } catch (error) {
    console.error('Error in /api/leads/add:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}