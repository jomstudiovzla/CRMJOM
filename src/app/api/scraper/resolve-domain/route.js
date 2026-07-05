import { NextResponse } from 'next/server';
import { guessCompanyDomain } from '@/lib/gemini';
import { normalizeUrl } from '@/lib/websiteUtils';

export async function POST(request) {
  try {
    const { nombre_negocio } = await request.json();

    if (!nombre_negocio) {
      return NextResponse.json(
        { success: false, error: 'nombre_negocio es requerido' },
        { status: 400 }
      );
    }

    const result = await guessCompanyDomain(nombre_negocio);
    const normalized = result.url ? normalizeUrl(result.url) : null;

    return NextResponse.json({
      success: true,
      data: {
        url: normalized,
        confidence: result.confidence,
      },
      message: normalized
        ? `🔎 Dominio sugerido: ${normalized}`
        : 'No se pudo inferir dominio — ingrésalo manualmente',
    });
  } catch (error) {
    console.error('Error in /api/scraper/resolve-domain:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}