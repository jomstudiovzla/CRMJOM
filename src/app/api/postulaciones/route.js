/**
 * GET  /api/postulaciones        → lista todas
 * POST /api/postulaciones        → agregar nueva
 * PATCH /api/postulaciones       → actualizar estado
 * DELETE /api/postulaciones      → eliminar
 */
import { NextResponse } from 'next/server';
import {
  getPostulaciones,
  addPostulacion,
  updatePostulacion,
  deletePostulacion,
  getStats,
} from '@/lib/postulacionesStore';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('stats') === '1') {
    return NextResponse.json({ success: true, data: getStats() });
  }
  const plataforma = searchParams.get('plataforma');
  let data = getPostulaciones();
  if (plataforma) data = data.filter(p => p.plataforma === plataforma);
  return NextResponse.json({ success: true, data, count: data.length });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const nueva = addPostulacion(body);
    return NextResponse.json({ success: true, data: nueva }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }
}

export async function PATCH(req) {
  try {
    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    const updated = updatePostulacion(id, updates);
    if (!updated) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }
}

export async function DELETE(req) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    const ok = deletePostulacion(id);
    return NextResponse.json({ success: ok });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }
}
