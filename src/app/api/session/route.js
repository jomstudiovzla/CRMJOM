/**
 * /api/session — Gestión del Chrome compartido con sesión Google universal
 *
 * POLÍTICA:
 * - NUNCA abrir un segundo Chrome si ya hay uno activo
 * - Todas las plataformas: jomstudiovzla@gmail.com via Google OAuth
 * - Si una plataforma falla → dejar pestaña abierta para login manual
 */
import { NextResponse } from 'next/server';
import {
  getChromeStatus,
  getSharedBrowser,
  launchVisibleChrome,
  ensurePlatformSession,
  openAllSessions,
  isChromeRunning,
} from '@/lib/browserManager';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Todas las plataformas soportadas
const ALL_PLATFORMS = [
  'google', 'computrabajo', 'linkedin', 'upwork',
  'fiverr', 'workana', 'freelancer', 'bumeran', 'gmail',
];

// GET /api/session — estado actual en tiempo real
export async function GET() {
  try {
    const status = await getChromeStatus();
    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json({ running: false, error: err.message }, { status: 500 });
  }
}

// POST /api/session
export async function POST(req) {
  try {
    const { action, platform } = await req.json();

    // ──────────────────────────────────────────────────────────────────────
    // action: 'open' → Abrir/conectar Chrome y verificar todas las sesiones
    // ──────────────────────────────────────────────────────────────────────
    if (action === 'open') {
      // Si Chrome ya corre → conectar y verificar sesiones faltantes
      if (await isChromeRunning()) {
        console.log('[Session] Chrome ya activo — verificando sesiones...');
        const browser = await getSharedBrowser(false);
        const status  = await getChromeStatus();

        // Si todas están activas → devolver sin hacer nada más
        const loggedCount = Object.values(status.sessions).filter(Boolean).length;
        if (loggedCount >= ALL_PLATFORMS.length - 1) {
          if (global.io) global.io.emit('session_updated', status);
          return NextResponse.json({
            success: true,
            message: `✅ Chrome activo · ${loggedCount} plataformas con sesión`,
            sessions: status.sessions,
            alreadyRunning: true,
          });
        }

        // Abrir sesiones faltantes en paralelo secuencial
        const sessions = { ...status.sessions };
        for (const plat of ALL_PLATFORMS) {
          if (!sessions[plat]) {
            try {
              const p = await browser.newPage();
              sessions[plat] = await ensurePlatformSession(p, plat);
              if (!sessions[plat]) {
                // Dejar pestaña abierta para login manual
                console.log(`[Session] ${plat}: pestaña abierta para login manual`);
              }
              await delay(600);
            } catch (e) {
              console.warn(`[Session] Error ${plat}:`, e.message?.slice(0, 50));
              sessions[plat] = false;
            }
          }
        }

        if (global.io) global.io.emit('session_updated', { running: true, sessions });
        return NextResponse.json({ success: true, sessions });
      }

      // Chrome no está corriendo → lanzar
      console.log('[Session] Lanzando Chrome con perfil del usuario...');
      const browser = await launchVisibleChrome();
      await delay(2500);

      // Abrir todas las sesiones secuencialmente
      const sessions = Object.fromEntries(ALL_PLATFORMS.map(k => [k, false]));

      for (const plat of ALL_PLATFORMS) {
        try {
          const p = await browser.newPage();
          sessions[plat] = await ensurePlatformSession(p, plat);
          const icon = sessions[plat] ? '✅' : '⚠️';
          console.log(`[Session] ${plat}: ${icon}`);
          await delay(700);
        } catch (e) {
          console.warn(`[Session] Error ${plat}:`, e.message?.slice(0, 50));
        }
      }

      if (global.io) global.io.emit('session_updated', { running: true, sessions });

      const ok = Object.values(sessions).filter(Boolean).length;
      return NextResponse.json({
        success: true,
        message: `Chrome abierto · ${ok}/${ALL_PLATFORMS.length} plataformas con sesión Google`,
        sessions,
      });
    }

    // ──────────────────────────────────────────────────────────────────────
    // action: 'open-platform' → Abrir una plataforma específica
    // ──────────────────────────────────────────────────────────────────────
    if (action === 'open-platform' && platform) {
      const browser = await getSharedBrowser(true);
      const p = await browser.newPage();
      const ok = await ensurePlatformSession(p, platform);

      if (!ok) {
        console.log(`[Session] ${platform}: pestaña abierta para login manual`);
      }
      if (global.io) global.io.emit('session_updated', { platform, loggedIn: ok });
      return NextResponse.json({ success: true, loggedIn: ok, platform });
    }

    // ──────────────────────────────────────────────────────────────────────
    // action: 'status' / 'check-session'
    // ──────────────────────────────────────────────────────────────────────
    if (action === 'status' || action === 'check-session') {
      const status = await getChromeStatus();
      return NextResponse.json(status);
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });

  } catch (err) {
    console.error('[Session API] Error:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
