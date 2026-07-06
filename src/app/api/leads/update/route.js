import { NextResponse } from 'next/server';
import { updateLeadState } from '@/lib/leadsStoreFirestore';

export async function POST(request) {
  try {
    const { nombre_negocio, nuevo_estado } = await request.json();

    if (!nombre_negocio || !nuevo_estado) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos requeridos (nombre_negocio, nuevo_estado)' },
        { status: 400 }
      );
    }

    const updated = await updateLeadState(nombre_negocio, nuevo_estado);

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Lead no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: `Estado actualizado a ${nuevo_estado}` });
  } catch (error) {
    console.error('Error updating lead:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}