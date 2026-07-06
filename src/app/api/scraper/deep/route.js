import { NextResponse } from 'next/server';
import { auditWebsiteForGap } from '@/lib/gemini';
import { updateLeadGap } from '@/lib/leadsStore';
import { fetchWebsiteText, normalizeUrl } from '@/lib/websiteUtils';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { url, nombre_negocio } = await request.json();

    if (!url) {
      return NextResponse.json({ success: false, error: 'url es requerida' }, { status: 400 });
    }

    const normalized = normalizeUrl(url);
    if (!normalized) {
      return NextResponse.json({ success: false, error: 'URL inválida' }, { status: 400 });
    }

    const { url: fetchedUrl, text, email, telefono } = await fetchWebsiteText(normalized);

    if (!text || text.length < 30) {
      return NextResponse.json(
        { success: false, error: 'No se pudo extraer contenido útil del sitio web' },
        { status: 422 }
      );
    }

    const audit = await auditWebsiteForGap({
      url: fetchedUrl,
      text,
      companyName: nombre_negocio || 'Empresa',
    });

    const gapFull = audit.solucion_jom
      ? `${audit.gap_detectado} → Solución JOM: ${audit.solucion_jom}`
      : audit.gap_detectado;

    if (nombre_negocio) {
      updateLeadGap(nombre_negocio, {
        gap_detectado: gapFull,
        web: fetchedUrl,
        solucion_jom: audit.solucion_jom,
        email: email || undefined,
        telefono: telefono || undefined
      });
    }

    if (global.io) {
      global.io.emit('leads_updated');
    }

    return NextResponse.json({
      success: true,
      data: {
        url: fetchedUrl,
        gap_detectado: gapFull,
        solucion_jom: audit.solucion_jom,
        generatedByAi: audit.generatedByAi,
        email: email || '',
        telefono: telefono || ''
      },
      message: '🕵️ Auditoría web completada',
    });
  } catch (error) {
    console.error('Error in /api/scraper/deep:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}