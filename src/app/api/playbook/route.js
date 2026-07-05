import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve(process.cwd(), '..');
const PLAYBOOK_DIR = path.join(ROOT_DIR, 'playbook');

const INDEX = [
  { title: '01 — Mapa general', path: '01-mapa-general-agencia-ia.md' },
  { title: '02 — Prospección', path: '02-prospeccion-scraping.md' },
  { title: '03 — GoHighLevel CRM', path: '03-gohighlevel-crm-automatizaciones.md' },
  { title: '04 — Claude Cowork + MCP', path: '04-claude-cowork-mcp.md' },
  { title: '05 — Servicios B2B', path: '05-servicios-ofertas-b2b.md' },
  { title: '06 — E-commerce', path: '06-ecommerce-dropshipping.md' },
  { title: 'Perfil JOM Studio', path: 'fuentes/jom-studio-perfil.md' },
  { title: 'Nichos JOM', path: 'fuentes/nichos-jom-studio.md' },
];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get('file');

    if (!file) {
      return NextResponse.json({ success: true, data: INDEX });
    }

    const safePath = path.normalize(file).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.join(PLAYBOOK_DIR, safePath);

    if (!fullPath.startsWith(PLAYBOOK_DIR)) {
      return NextResponse.json({ success: false, error: 'Ruta no permitida' }, { status: 400 });
    }

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ success: false, error: 'Archivo no encontrado' }, { status: 404 });
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    return NextResponse.json({ success: true, content });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}