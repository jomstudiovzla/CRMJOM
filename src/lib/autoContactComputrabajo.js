import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { updateLeadState } from './leadsStore';
import { GoogleGenAI } from '@google/genai';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Perfil de Chrome persistente — guarda la sesión Google/Computrabajo entre ejecuciones
const CHROME_PROFILE_DIR = path.resolve(process.cwd(), '../ejecutar/config/chrome-profile-computrabajo');
const LOGIN_URL = 'https://candidato.co.computrabajo.com/acceso/';
const HOME_URL  = 'https://co.computrabajo.com/';

/** Verifica si ya hay sesión activa usando el perfil guardado */
async function isAlreadyLoggedIn(page) {
  try {
    await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await delay(2000);
    return await page.evaluate(() => {
      const sels = ['a[href*="/candidato/"]','.user-menu','.avatar','[data-qa="user-name"]','a[href*="/mi-cuenta"]','.logged-user'];
      return sels.some(sel => document.querySelector(sel) !== null);
    });
  } catch { return false; }
}

/**
 * Login con "Continuar con Google".
 * Si el perfil Chrome ya tiene sesión Google activa → fluye solo.
 * Si no → abre navegador visible y espera hasta 120s para que el usuario apruebe.
 */
async function loginViaGoogle(page, browser) {
  console.log('[CT Bot] Abriendo página de login...');
  await page.goto(LOGIN_URL, { waitUntil: 'networkidle2', timeout: 20000 });
  await delay(1500);

  // Buscar botón Google por selector
  let googleBtn = null;
  for (const sel of ['a[href*="google"]','button[class*="google"]','[data-provider="google"]','.btn-google']) {
    googleBtn = await page.$(sel);
    if (googleBtn) { console.log(`[CT Bot] Botón Google encontrado con: ${sel}`); break; }
  }
  // Fallback: buscar por texto
  if (!googleBtn) {
    for (const el of await page.$$('a, button')) {
      const t = await page.evaluate(e => e.textContent?.toLowerCase() || '', el);
      if (t.includes('google')) { googleBtn = el; break; }
    }
  }
  if (!googleBtn) throw new Error('[CT Bot] No se encontró el botón "Continuar con Google".');

  console.log('[CT Bot] Clic en "Continuar con Google"...');

  // Manejar popup o redirección en misma pestaña
  const popupPromise = new Promise(resolve => {
    const t = setTimeout(() => resolve(null), 4000);
    browser.once('targetcreated', async target => {
      clearTimeout(t);
      resolve(target.type() === 'page' ? await target.page() : null);
    });
  });

  await googleBtn.click();
  const popup = await popupPromise;

  if (popup) {
    console.log('[CT Bot] Popup Google detectado. Esperando login (máx 120s)...');
    await popup.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120000 }).catch(() => {});
  } else {
    console.log('[CT Bot] Redirección en misma pestaña. Esperando (máx 120s)...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120000 }).catch(() => {});
  }
  await delay(3000);

  if (await isAlreadyLoggedIn(page)) {
    console.log('[CT Bot] ✅ Login Google exitoso. Sesión guardada en perfil persistente.');
  } else {
    console.warn('[CT Bot] ⚠️  No se confirmó el login. Continuando de todas formas...');
  }
}

/**
 * Función principal: auto-postulación en Computrabajo vía Google OAuth.
 * @param {object} lead            - Lead con { nombre_negocio, link, gap_detectado, nicho }
 * @param {string} _username       - Ignorado (se usa Google OAuth)
 * @param {string} _password       - Ignorado (se usa Google OAuth)
 * @param {boolean} headlessOverride - true para correr sin ventana en segundo plano
 */
export async function autoContactComputrabajo(lead, _username, _password, headlessOverride = false) {
  if (!lead.link) throw new Error('El lead no tiene un enlace de postulación (link).');

  if (!fs.existsSync(CHROME_PROFILE_DIR)) {
    fs.mkdirSync(CHROME_PROFILE_DIR, { recursive: true });
    console.log(`[CT Bot] Creado perfil persistente: ${CHROME_PROFILE_DIR}`);
  }

  console.log(`[CT Bot] Lanzando Chrome (headless=${headlessOverride})...`);

  const browser = await puppeteer.launch({
    headless: headlessOverride ? 'new' : false,
    userDataDir: CHROME_PROFILE_DIR,
    defaultViewport: null,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-blink-features=AutomationControlled','--disable-infobars',...(headlessOverride ? [] : ['--start-maximized'])],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  try {
    // ── PASO 1: Login ─────────────────────────────────────────────────────
    if (await isAlreadyLoggedIn(page)) {
      console.log('[CT Bot] ✅ Sesión activa. Saltando login.');
    } else {
      console.log('[CT Bot] Sin sesión. Iniciando Google OAuth...');
      await loginViaGoogle(page, browser);
    }

    // ── PASO 2: Navegar a la oferta ───────────────────────────────────────
    console.log(`[CT Bot] Navegando a: ${lead.link}`);
    await page.goto(lead.link, { waitUntil: 'networkidle2', timeout: 20000 });
    await delay(2000);

    // ── PASO 3: Clic en "Aplicar" ─────────────────────────────────────────
    let applyBtnClicked = false;
    for (const sel of ['.js-btn-apply','#btn-apply','a[href*="aplicar"]','a[href*="postular"]','button.btn-apply']) {
      const btn = await page.$(sel);
      if (btn) { await btn.click(); applyBtnClicked = true; console.log(`[CT Bot] Botón aplicar: ${sel}`); break; }
    }
    if (!applyBtnClicked) {
      for (const btn of await page.$$('a, button')) {
        const t = await page.evaluate(el => el.textContent?.toLowerCase() || '', btn);
        if (t.includes('aplicar') || t.includes('postularme') || t.includes('postular') || t.includes('inscribirme')) {
          await btn.click(); applyBtnClicked = true;
          console.log(`[CT Bot] Botón aplicar por texto: "${t.trim()}"`); break;
        }
      }
    }
    if (!applyBtnClicked) throw new Error('[CT Bot] No se encontró botón de aplicar.');
    await delay(3000);

    // ── PASO 4: Carta generada por Gemini ─────────────────────────────────
    let appliedPitch = `Postulación automática para ${lead.nombre_negocio}.`;

    const textareas = await page.$$('textarea');
    if (textareas.length > 0) {
      console.log('[CT Bot] Campo de carta detectado. Generando con Gemini...');
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const resp = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Redacta una carta de presentación (máx 120 palabras) para postularme a una oferta en "${lead.nombre_negocio}". Contexto: "${lead.gap_detectado || lead.descripcion || ''}". Nicho: "${lead.nicho || ''}". Soy Jesús Omar Martínez, Creative Director de JOM Studio (web premium, e-commerce, WebGL, branding). Directo, profesional, sin emojis excesivos. Firma: "Jesús Omar Martínez — JOM Studio".`,
        });
        appliedPitch = resp.text?.trim() || appliedPitch;
        console.log('[CT Bot] ✅ Propuesta Gemini generada.');
      } catch (e) { console.warn('[CT Bot] Gemini falló, usando texto genérico:', e.message); }

      await textareas[0].click();
      await textareas[0].evaluate(el => { el.value = ''; });
      await page.type('textarea', appliedPitch, { delay: 8 });
      await delay(1000);

      for (const btn of await page.$$('button, input[type="submit"]')) {
        const t = await page.evaluate(el => (el.textContent || el.value || '').toLowerCase(), btn);
        if (t.includes('enviar') || t.includes('postular') || t.includes('continuar') || t.includes('finalizar')) {
          await btn.click(); console.log('[CT Bot] ✅ Formulario enviado.'); break;
        }
      }
    }

    await delay(4000);

    // ── PASO 5: Registrar en CRM ──────────────────────────────────────────
    await updateLeadState(lead.nombre_negocio, 'contactado', {
      fecha_contacto: new Date().toISOString(),
      origen: 'Computrabajo Auto-Contact (Google OAuth)',
    });

    try {
      const { upsertMessage } = require('./emailStore');
      upsertMessage(lead, {
        id: `auto_ct_${Date.now()}`,
        subject: `🤖 Auto-Postulado: ${lead.nombre_negocio || 'Vacante'}`,
        body: `✅ Postulación automática completada en Computrabajo.\n\n📝 Propuesta:\n\n${appliedPitch}`,
        sentAt: new Date().toISOString(),
        direction: 'outbound',
        status: 'sent',
        from: 'Auto-Postulador JOM',
      });
    } catch (e) { console.warn('[CT Bot] emailStore:', e.message); }

    if (global.io) { global.io.emit('leads_updated'); global.io.emit('emails_updated'); }

    console.log('[CT Bot] 🎉 Postulación completada con éxito!');
    return { success: true, message: '¡Postulación completada con éxito!' };

  } catch (err) {
    console.error('[CT Bot] ❌ Error:', err.message);
    throw err;
  } finally {
    await delay(2000);
    await browser.close();
  }
}
