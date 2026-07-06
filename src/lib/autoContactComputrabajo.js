import { openTab, closeTab } from './browserManager';
import { updateLeadState } from './leadsStore';
import { GoogleGenAI } from '@google/genai';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const HOME_URL = 'https://co.computrabajo.com/';

async function isLoggedIn(page) {
  try {
    await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await delay(1500);
    return await page.evaluate(() => {
      const sels = ['a[href*="/candidato/"]','.user-menu','.avatar','[data-qa="user-name"]','a[href*="/mi-cuenta"]','.logged-user'];
      return sels.some(s => !!document.querySelector(s));
    });
  } catch { return false; }
}

async function loginWithGoogle(page) {
  await page.goto('https://candidato.co.computrabajo.com/acceso/', { waitUntil: 'networkidle2', timeout: 20000 });
  await delay(1500);

  let btn = null;
  for (const sel of ['a[href*="google"]','button[class*="google"]','[data-provider="google"]','.btn-google']) {
    btn = await page.$(sel);
    if (btn) break;
  }
  if (!btn) {
    for (const el of await page.$$('a, button')) {
      const t = await page.evaluate(e => e.textContent?.toLowerCase() || '', el);
      if (t.includes('google')) { btn = el; break; }
    }
  }

  if (!btn) {
    console.warn('[CT Bot] Sin botón Google. Esperando sesión ya activa...');
    return;
  }

  await btn.click();
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
  await delay(2000);
  console.log('[CT Bot] Login Google completado.');
}

export async function autoContactComputrabajo(lead, _u, _p, headlessOverride = false) {
  if (!lead.link) throw new Error('Lead sin link de postulación.');

  // Usa el Chrome compartido — no lanza un nuevo browser
  const { page } = await openTab(null, !headlessOverride);

  try {
    // ── Login si es necesario ──────────────────────────────────────────────
    const logged = await isLoggedIn(page);
    if (!logged) {
      console.log('[CT Bot] Sin sesión. Iniciando Google OAuth en Chrome compartido...');
      await loginWithGoogle(page);
    } else {
      console.log('[CT Bot] ✅ Sesión activa en Chrome compartido.');
    }

    // ── Navegar a la oferta ────────────────────────────────────────────────
    await page.goto(lead.link, { waitUntil: 'networkidle2', timeout: 20000 });
    await delay(2000);

    // ── Botón Aplicar ──────────────────────────────────────────────────────
    let clicked = false;
    for (const sel of ['.js-btn-apply','#btn-apply','a[href*="aplicar"]','a[href*="postular"]','button.btn-apply']) {
      const b = await page.$(sel);
      if (b) { await b.click(); clicked = true; break; }
    }
    if (!clicked) {
      for (const b of await page.$$('a, button')) {
        const t = await page.evaluate(el => el.textContent?.toLowerCase() || '', b);
        if (t.includes('aplicar') || t.includes('postularme') || t.includes('postular')) {
          await b.click(); clicked = true; break;
        }
      }
    }
    if (!clicked) throw new Error('No se encontró botón de aplicar.');
    await delay(3000);

    // ── Carta con Gemini ───────────────────────────────────────────────────
    let pitch = `Postulación automática para ${lead.nombre_negocio}.`;
    const textareas = await page.$$('textarea');
    if (textareas.length > 0) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const r = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Carta de presentación (máx 120 palabras) para oferta en "${lead.nombre_negocio}". Contexto: "${lead.gap_detectado || ''}". Nicho: "${lead.nicho || ''}". Soy Jesús Omar Martínez, Creative Director de JOM Studio. Directo, profesional. Firma: "Jesús Omar Martínez — JOM Studio".`,
        });
        pitch = r.text?.trim() || pitch;
      } catch (e) { console.warn('[CT Bot] Gemini error:', e.message); }

      await textareas[0].click();
      await textareas[0].evaluate(el => { el.value = ''; });
      await page.type('textarea', pitch, { delay: 8 });
      await delay(800);

      for (const b of await page.$$('button, input[type="submit"]')) {
        const t = await page.evaluate(el => (el.textContent || el.value || '').toLowerCase(), b);
        if (t.includes('enviar') || t.includes('postular') || t.includes('finalizar')) {
          await b.click(); break;
        }
      }
    }

    await delay(3000);

    // ── Registrar en CRM ───────────────────────────────────────────────────
    await updateLeadState(lead.nombre_negocio, 'contactado', {
      fecha_contacto: new Date().toISOString(),
      origen: 'Computrabajo (Chrome compartido)',
    });
    try {
      const { upsertMessage } = require('./emailStore');
      upsertMessage(lead, {
        id: `ct_${Date.now()}`,
        subject: `🤖 Auto-Postulado: ${lead.nombre_negocio}`,
        body: `✅ Postulación completada en Computrabajo.\n\n${pitch}`,
        sentAt: new Date().toISOString(), direction: 'outbound', status: 'sent', from: 'Auto-Postulador JOM',
      });
    } catch {}

    if (global.io) { global.io.emit('leads_updated'); global.io.emit('emails_updated'); }
    console.log('[CT Bot] 🎉 ¡Postulación completada!');
    return { success: true };

  } finally {
    await closeTab(page); // Solo cierra la pestaña, NO el browser compartido
  }
}
