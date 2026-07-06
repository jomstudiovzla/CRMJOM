import { NextResponse } from 'next/server';
import { getChromeStatus, getSharedBrowser, openTab } from '@/lib/browserManager';

// GET /api/session — estado actual del Chrome compartido
export async function GET() {
  try {
    const status = await getChromeStatus();
    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json({ running: false, error: err.message }, { status: 500 });
  }
}

// POST /api/session — acciones: open, open-platform
export async function POST(req) {
  try {
    const { action, platform } = await req.json();

    const PLATFORM_URLS = {
      computrabajo: 'https://candidato.co.computrabajo.com/acceso/',
      linkedin:     'https://www.linkedin.com/login',
      gmail:        'https://mail.google.com/',
      whatsapp:     'https://web.whatsapp.com/',
      fiverr:       'https://www.fiverr.com/login',
      upwork:       'https://www.upwork.com/ab/account-security/login',
    };

    if (action === 'open') {
      // Abrir Chrome visible para que el usuario haga login
      await getSharedBrowser(true);
      
      // Abrir todas las plataformas de una vez
      const platforms = Object.entries(PLATFORM_URLS);
      for (const [name, url] of platforms) {
        await openTab(url, true);
        console.log(`[Session] Pestaña abierta: ${name} → ${url}`);
      }

      if (global.io) global.io.emit('session_updated', { running: true });
      return NextResponse.json({ success: true, message: 'Chrome abierto con todas las plataformas' });
    }

    if (action === 'open-platform' && platform) {
      const url = PLATFORM_URLS[platform];
      if (!url) return NextResponse.json({ error: 'Plataforma no reconocida' }, { status: 400 });
      await openTab(url, true);
      if (global.io) global.io.emit('session_updated', { platform, running: true });
      return NextResponse.json({ success: true, url });
    }

    if (action === 'status') {
      const status = await getChromeStatus();
      return NextResponse.json(status);
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (err) {
    console.error('[Session API] Error:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
