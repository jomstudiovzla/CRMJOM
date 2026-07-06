/**
 * browserManager.js — Chrome compartido para todos los bots del CRM JOM
 * 
 * Un solo Chrome instance con remote debugging en puerto 9222.
 * Todos los bots se conectan via puppeteer.connect() en lugar de launch().
 * El usuario hace login una sola vez en ese Chrome y la sesión se reutiliza.
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const CDP_PORT = 9222;
const CDP_URL  = `http://127.0.0.1:${CDP_PORT}`;

// Perfil compartido para TODOS los bots — guarda todas las sesiones
const SHARED_PROFILE_DIR = path.resolve(process.cwd(), '../ejecutar/config/chrome-profile-jom');

let _browser = null; // Instancia compartida en memoria

/**
 * Verifica si el Chrome con CDP está corriendo
 */
export async function isChromeRunning() {
  try {
    const res = await fetch(`${CDP_URL}/json/version`);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Lanza Chrome con remote debugging si no está corriendo.
 * Si ya está corriendo, solo conecta.
 * @param {boolean} visible - false = headless (background), true = ventana visible
 */
export async function getSharedBrowser(visible = false) {
  // Si ya tenemos instancia viva, devolverla
  if (_browser) {
    try {
      await _browser.pages(); // ping
      return _browser;
    } catch {
      _browser = null;
    }
  }

  // Intentar conectar a Chrome ya corriendo con CDP
  const running = await isChromeRunning();
  if (running) {
    console.log('[BrowserManager] Conectando a Chrome existente via CDP...');
    _browser = await puppeteer.connect({
      browserURL: CDP_URL,
      defaultViewport: null,
    });
    return _browser;
  }

  // Lanzar Chrome nuevo con CDP + perfil compartido
  console.log('[BrowserManager] Lanzando Chrome compartido con CDP...');

  if (!fs.existsSync(SHARED_PROFILE_DIR)) {
    fs.mkdirSync(SHARED_PROFILE_DIR, { recursive: true });
  }

  _browser = await puppeteer.launch({
    headless: visible ? false : 'new',
    userDataDir: SHARED_PROFILE_DIR,
    defaultViewport: null,
    args: [
      `--remote-debugging-port=${CDP_PORT}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      ...(visible ? ['--start-maximized'] : []),
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  // Ocultar webdriver en todas las páginas nuevas
  _browser.on('targetcreated', async (target) => {
    try {
      const p = await target.page();
      if (p) await p.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });
    } catch {}
  });

  console.log(`[BrowserManager] Chrome lanzado con CDP en ${CDP_URL}`);
  return _browser;
}

/**
 * Abre una nueva pestaña en el Chrome compartido y navega a una URL.
 * Retorna { browser, page }
 */
export async function openTab(url, visible = false) {
  const browser = await getSharedBrowser(visible);
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  if (url) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  return { browser, page };
}

/**
 * Cierra solo la pestaña (NO cierra el browser compartido)
 */
export async function closeTab(page) {
  try { await page.close(); } catch {}
}

/**
 * Estado del Chrome compartido para el API
 */
export async function getChromeStatus() {
  const running = await isChromeRunning();
  let pages = 0;
  if (running && _browser) {
    try { pages = (await _browser.pages()).length; } catch {}
  }
  return {
    running,
    cdpUrl: CDP_URL,
    profileDir: SHARED_PROFILE_DIR,
    openTabs: pages,
  };
}
