/**
 * browserManager.js — Chrome compartido con sesión Google universal
 *
 * REGLA FUNDAMENTAL:
 * - NUNCA lanzar Chrome si ya hay uno corriendo con CDP → usar el existente
 * - TODAS las plataformas usan jomstudiovzla@gmail.com vía Google OAuth
 * - Abrir siempre PESTAÑAS nuevas, nunca ventanas nuevas
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const CDP_PORT  = 9222;
const CDP_BASE  = `http://127.0.0.1:${CDP_PORT}`;
const GOOGLE_EMAIL = 'jomstudiovzla@gmail.com';

// Perfil de respaldo (solo si el perfil real no está disponible)
const FALLBACK_PROFILE = path.resolve(process.cwd(), '../ejecutar/config/chrome-profile-jom');

let _browser = null;

/* ═══════════════════════════════════════════════════════════════════════════
   CONFIGURACIÓN DE PLATAFORMAS
   Login URL, URL de verificación, selectores del botón Google
   ═══════════════════════════════════════════════════════════════════════════ */
const PLATFORM_CONFIG = {
  google: {
    name:      'Google',
    loginUrl:  'https://accounts.google.com/',
    homeUrl:   'https://myaccount.google.com/',
    loggedIn:  (url) => url.includes('myaccount.google.com') || (url.includes('google.com') && !url.includes('/signin')),
    googleBtn: [], // es google → ya está logueado
  },
  computrabajo: {
    name:      'Computrabajo',
    loginUrl:  'https://candidato.co.computrabajo.com/acceso/',
    homeUrl:   'https://candidato.co.computrabajo.com/candidate/home',
    loggedIn:  (url) => url.includes('/candidate/') && !url.includes('/acceso'),
    googleBtn: [
      'a[href*="google"]',
      'a[href*="oauth/google"]',
      '.btn-google',
      '[data-provider="google"]',
      'a.btn-social--google',
    ],
    googleText: ['continuar con google','iniciar con google','entrar con google','google'],
  },
  linkedin: {
    name:      'LinkedIn',
    loginUrl:  'https://www.linkedin.com/login',
    homeUrl:   'https://www.linkedin.com/feed/',
    loggedIn:  (url) => url.includes('/feed') || url.includes('/in/') || url.includes('/mynetwork') || url.includes('/jobs'),
    googleBtn: [
      '[data-tracking-control-name*="google"]',
      '.btn__primary--large[href*="google"]',
      'a[href*="authwall"]',
    ],
    googleText: ['iniciar sesión con google','sign in with google','continue with google','google'],
    // LinkedIn no siempre tiene botón Google en la página de login
    // Si ya hay sesión de Chrome con LinkedIn → entra solo
    altLoginUrl: 'https://www.linkedin.com/',
  },
  upwork: {
    name:      'Upwork',
    loginUrl:  'https://www.upwork.com/ab/account-security/login',
    homeUrl:   'https://www.upwork.com/nx/find-work/',
    loggedIn:  (url) => url.includes('/find-work') || url.includes('/freelancer/') || url.includes('/ab/dashboard'),
    googleBtn: [
      'button[data-qa="btn-google"]',
      '[class*="google"]',
      'button[aria-label*="Google"]',
    ],
    googleText: ['continue with google','continuar con google','google'],
  },
  fiverr: {
    name:      'Fiverr',
    loginUrl:  'https://www.fiverr.com/login',
    homeUrl:   'https://www.fiverr.com/',
    loggedIn:  (url) => url.includes('fiverr.com') && !url.includes('/login') && !url.includes('/join'),
    googleBtn: [
      '[class*="google"]',
      'button[data-testid*="google"]',
      '[aria-label*="Google"]',
    ],
    googleText: ['continue with google','continuar con google','google'],
  },
  workana: {
    name:      'Workana',
    loginUrl:  'https://www.workana.com/login',
    homeUrl:   'https://www.workana.com/dashboard',
    loggedIn:  (url) => url.includes('/dashboard') || (url.includes('workana.com') && !url.includes('/login') && !url.includes('/register')),
    googleBtn: [
      '[class*="google"]',
      'a[href*="google"]',
      'button[data-provider="google"]',
    ],
    googleText: ['iniciar con google','entrar con google','google'],
  },
  freelancer: {
    name:      'Freelancer',
    loginUrl:  'https://www.freelancer.com/login',
    homeUrl:   'https://www.freelancer.com/dashboard',
    loggedIn:  (url) => url.includes('/dashboard') || url.includes('/u/') || (url.includes('freelancer.com') && !url.includes('/login')),
    googleBtn: [
      '[class*="google"]',
      'a[href*="google"]',
      'button[aria-label*="Google"]',
    ],
    googleText: ['sign in with google','google'],
  },
  bumeran: {
    name:      'Bumeran',
    loginUrl:  'https://www.bumeran.com.ve/login',
    homeUrl:   'https://www.bumeran.com.ve/',
    loggedIn:  (url) => url.includes('bumeran.com') && !url.includes('/login') && !url.includes('/registro'),
    googleBtn: [
      'a[href*="google"]',
      '[class*="google"]',
    ],
    googleText: ['google','iniciar con google'],
  },
  gmail: {
    name:      'Gmail',
    loginUrl:  'https://accounts.google.com/',
    homeUrl:   'https://mail.google.com/mail/u/0/',
    loggedIn:  (url) => url.includes('mail.google.com'),
    googleBtn: [],
    googleText: [],
  },
  whatsapp: {
    name:      'WhatsApp Web',
    loginUrl:  'https://web.whatsapp.com/',
    homeUrl:   'https://web.whatsapp.com/',
    loggedIn:  (url) => url.includes('web.whatsapp.com'),
    googleBtn: [],
    googleText: [],
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   CDP — Verificar si Chrome con remote debugging está activo
   ═══════════════════════════════════════════════════════════════════════════ */
export async function isChromeRunning() {
  try {
    const res = await fetch(`${CDP_BASE}/json/version`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONECTAR al Chrome existente via CDP
   ═══════════════════════════════════════════════════════════════════════════ */
async function connectExisting() {
  console.log('[BrowserManager] 🔌 Conectando al Chrome existente via CDP...');
  _browser = await puppeteer.connect({
    browserURL: CDP_BASE,
    defaultViewport: null,
  });
  _browser.on('disconnected', () => { _browser = null; });
  return _browser;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LANZAR Chrome visible (solo si NO hay uno corriendo)
   ═══════════════════════════════════════════════════════════════════════════ */
export async function launchVisibleChrome() {
  // Si ya está corriendo → SOLO conectar, NUNCA abrir segundo proceso
  if (await isChromeRunning()) {
    console.log('[BrowserManager] ✅ Chrome ya activo — conectando al existente');
    return connectExisting();
  }

  const chromePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  const executablePath = chromePaths.find(p => fs.existsSync(p));
  if (!executablePath) throw new Error('Google Chrome no encontrado en /Applications/');

  console.log('[BrowserManager] 🚀 Lanzando Chrome con CDP...');

  // Lanzar Chrome con el perfil REAL del usuario (tiene todas las sesiones Google)
  // --no-profile-dir-in-window-title evita conflictos visuales
  spawn(executablePath, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--restore-last-session',
    '--disable-features=ChromeWhatsNewUI',
  ], { detached: true, stdio: 'ignore' }).unref();

  // Esperar que CDP arranque
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 800));
    if (await isChromeRunning()) break;
  }

  if (await isChromeRunning()) {
    return connectExisting();
  }

  // Fallback: lanzar con puppeteer y perfil de respaldo
  console.warn('[BrowserManager] ⚠️ Fallback: usando perfil de respaldo');
  if (!fs.existsSync(FALLBACK_PROFILE)) fs.mkdirSync(FALLBACK_PROFILE, { recursive: true });

  _browser = await puppeteer.launch({
    headless: false,
    executablePath,
    userDataDir: FALLBACK_PROFILE,
    defaultViewport: null,
    args: [
      `--remote-debugging-port=${CDP_PORT}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--start-maximized',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  _browser.on('disconnected', () => { _browser = null; });
  return _browser;
}

/* ═══════════════════════════════════════════════════════════════════════════
   OBTENER el browser compartido
   ═══════════════════════════════════════════════════════════════════════════ */
export async function getSharedBrowser(launchIfNeeded = false) {
  // Reusar instancia viva
  if (_browser) {
    try { await _browser.pages(); return _browser; }
    catch { _browser = null; }
  }
  // CDP disponible → conectar
  if (await isChromeRunning()) return connectExisting();
  // Lanzar si se solicita
  if (launchIfNeeded) return launchVisibleChrome();
  // Error claro
  throw new Error(
    'Chrome no está activo. Ve al CRM → Mails → "Abrir con Google" para iniciar el navegador.'
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BUSCAR PESTAÑA YA LOGUEADA de una plataforma
   ═══════════════════════════════════════════════════════════════════════════ */
async function findLoggedInTab(browser, platform) {
  const cfg = PLATFORM_CONFIG[platform];
  if (!cfg) return null;
  try {
    const pages = await browser.pages();
    return pages.find(p => cfg.loggedIn(p.url())) || null;
  } catch { return null; }
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIN CON GOOGLE en una plataforma
   ═══════════════════════════════════════════════════════════════════════════ */
async function clickGoogleButton(page, platform) {
  const cfg = PLATFORM_CONFIG[platform];
  if (!cfg?.googleBtn?.length && !cfg?.googleText?.length) return false;

  // Intentar por selector CSS
  for (const sel of (cfg.googleBtn || [])) {
    try {
      const btn = await page.$(sel);
      if (btn) {
        const vis = await page.evaluate(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }, btn);
        if (vis) { await btn.click(); return true; }
      }
    } catch {}
  }

  // Intentar por texto
  try {
    const allEls = await page.$$('a, button, [role="button"]');
    for (const el of allEls) {
      const text = await page.evaluate(e => e.textContent?.toLowerCase().trim() || '', el).catch(() => '');
      const terms = cfg.googleText || [];
      if (terms.some(t => text.includes(t))) {
        const vis = await page.evaluate(e => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }, el).catch(() => false);
        if (vis) { await el.click(); return true; }
      }
    }
  } catch {}

  return false;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MANEJAR POPUP DE SELECCIÓN DE CUENTA GOOGLE
   ═══════════════════════════════════════════════════════════════════════════ */
async function handleGoogleAccountPicker(browser) {
  await new Promise(r => setTimeout(r, 2500));
  try {
    const allPages = await browser.pages();
    for (const p of allPages) {
      const url = p.url();
      if (url.includes('accounts.google.com/o/oauth') || url.includes('accounts.google.com/signin/oauth')) {
        console.log('[BrowserManager] 🔑 Popup OAuth Google detectado');
        await new Promise(r => setTimeout(r, 1500));
        // Seleccionar la cuenta correcta
        const accountBtn = await p.$(
          `[data-email="${GOOGLE_EMAIL}"], [data-identifier="${GOOGLE_EMAIL}"], .qhFLie, li[data-authuser="0"]`
        ).catch(() => null);
        if (accountBtn) {
          await accountBtn.click();
          console.log('[BrowserManager] ✅ Cuenta Google seleccionada');
        } else {
          // Si solo hay una cuenta, hacer click en el primer elemento de cuenta
          const firstAccount = await p.$('.yRFVme, .bLzI3e, .Jh2mqd, li[data-authuser]').catch(() => null);
          if (firstAccount) await firstAccount.click();
        }
        await new Promise(r => setTimeout(r, 3000));
        return true;
      }
    }
  } catch {}
  return false;
}

/* ═══════════════════════════════════════════════════════════════════════════
   FUNCIÓN PRINCIPAL: ensurePlatformSession(page, platform)
   Garantiza sesión activa en cualquier plataforma via Google
   ═══════════════════════════════════════════════════════════════════════════ */
export async function ensurePlatformSession(page, platform) {
  const cfg = PLATFORM_CONFIG[platform];
  if (!cfg) return false;

  const browser = page.browser();

  // PASO 1: Buscar pestaña ya logueada → reutilizar
  const existing = await findLoggedInTab(browser, platform);
  if (existing) {
    console.log(`[BrowserManager] ✅ ${cfg.name}: pestaña logueada → ${existing.url()}`);
    return true;
  }

  // PASO 2: Navegar a la home y verificar si ya hay sesión (por cookies de Google)
  console.log(`[BrowserManager] 🔍 Verificando sesión ${cfg.name}...`);
  try {
    await page.goto(cfg.homeUrl, { waitUntil: 'domcontentloaded', timeout: 18000 });
    await new Promise(r => setTimeout(r, 1500));
    if (cfg.loggedIn(page.url())) {
      console.log(`[BrowserManager] ✅ ${cfg.name}: sesión activa (cookies) → ${page.url()}`);
      return true;
    }
  } catch (e) {
    console.warn(`[BrowserManager] ⚠️ ${cfg.name}: error navegando a home:`, e.message?.slice(0, 60));
  }

  // PASO 3: Ir al login y clicar Google
  // Plataformas sin botón Google (WhatsApp, Gmail) → ya deberían tener sesión
  if (!cfg.googleBtn?.length && !cfg.googleText?.length) {
    console.warn(`[BrowserManager] ⚠️ ${cfg.name}: sin botón Google, sesión no establecida automáticamente`);
    return false;
  }

  console.log(`[BrowserManager] 🔐 ${cfg.name}: iniciando login con Google...`);
  try {
    await page.goto(cfg.loginUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    const clicked = await clickGoogleButton(page, platform);
    if (!clicked) {
      console.warn(`[BrowserManager] ❌ ${cfg.name}: no se encontró botón de Google`);
      // Dejar pestaña abierta para login manual
      return false;
    }

    console.log(`[BrowserManager] ✅ ${cfg.name}: click en botón Google realizado`);

    // Manejar popup de cuenta Google
    await handleGoogleAccountPicker(browser);

    // Esperar que la sesión se establezca
    await new Promise(r => setTimeout(r, 3000));

    // Verificar resultado
    const finalUrl = page.url();
    const success  = cfg.loggedIn(finalUrl);
    console.log(`[BrowserManager] ${success ? '✅' : '❌'} ${cfg.name}: ${finalUrl}`);
    return success;

  } catch (e) {
    console.error(`[BrowserManager] Error en ${cfg.name}:`, e.message?.slice(0, 80));
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   ALIAS DE COMPATIBILIDAD (para código existente)
   ═══════════════════════════════════════════════════════════════════════════ */
export async function ensureComputrabajoSession(page) {
  return ensurePlatformSession(page, 'computrabajo');
}

export async function ensureLinkedInSession(page) {
  return ensurePlatformSession(page, 'linkedin');
}

/* ═══════════════════════════════════════════════════════════════════════════
   ABRIR PESTAÑA en el Chrome compartido
   ═══════════════════════════════════════════════════════════════════════════ */
export async function openTab(url = null, launchIfNeeded = false) {
  const browser = await getSharedBrowser(launchIfNeeded);

  // Reutilizar pestaña vacía si existe
  let page = null;
  try {
    const pages = await browser.pages();
    page = pages.find(p => p.url() === 'about:blank') || null;
  } catch {}

  if (!page) page = await browser.newPage();

  // Anti-detección básica
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    try { window.chrome = { runtime: {} }; } catch {}
    Object.defineProperty(navigator, 'languages', { get: () => ['es-CO', 'es', 'en'] });
  }).catch(() => {});

  if (url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  }

  return { browser, page };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CERRAR PESTAÑA sin cerrar el browser
   ═══════════════════════════════════════════════════════════════════════════ */
export async function closeTab(page) {
  try { await page.close(); } catch {}
}

/* ═══════════════════════════════════════════════════════════════════════════
   ESTADO COMPLETO del Chrome (todas las plataformas)
   ═══════════════════════════════════════════════════════════════════════════ */
export async function getChromeStatus() {
  const running = await isChromeRunning();
  const sessions = Object.fromEntries(
    Object.keys(PLATFORM_CONFIG).map(k => [k, false])
  );
  let openTabs = 0;

  if (running) {
    try {
      const browser = await getSharedBrowser(false);
      const pages   = await browser.pages();
      openTabs = pages.length;

      for (const page of pages) {
        let url = '';
        try { url = page.url(); } catch {}
        for (const [platform, cfg] of Object.entries(PLATFORM_CONFIG)) {
          if (!sessions[platform] && url && cfg.loggedIn(url)) {
            sessions[platform] = true;
          }
        }
      }
    } catch {}
  }

  return { running, cdpUrl: CDP_BASE, openTabs, sessions };
}

/* ═══════════════════════════════════════════════════════════════════════════
   ABRIR TODAS LAS SESIONES EN PARALELO
   ═══════════════════════════════════════════════════════════════════════════ */
export async function openAllSessions(browser) {
  const PLATFORMS_AUTO = [
    'computrabajo', 'linkedin', 'upwork', 'fiverr',
    'workana', 'freelancer', 'bumeran', 'gmail',
  ];

  const results = {};
  // Secuencial para no saturar el browser
  for (const platform of PLATFORMS_AUTO) {
    try {
      const page = await browser.newPage();
      results[platform] = await ensurePlatformSession(page, platform);
      if (results[platform]) {
        // Mantener la pestaña abierta (sesión activa)
        console.log(`[BrowserManager] ✅ ${platform} → sesión activa`);
      } else {
        // Dejar pestaña abierta para login manual si falló
        console.log(`[BrowserManager] ⚠️ ${platform} → login manual requerido`);
      }
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      results[platform] = false;
      console.warn(`[BrowserManager] Error ${platform}:`, e.message?.slice(0, 50));
    }
  }
  return results;
}
