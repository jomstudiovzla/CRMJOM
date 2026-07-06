import { openTab, closeTab } from './browserManager';
import { updateLeadState } from './leadsStore';
import { GoogleGenAI } from '@google/genai';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function isLinkedInLoggedIn(page) {
  try {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 12000 });
    await delay(1500);
    const url = page.url();
    return !url.includes('/login') && !url.includes('/authwall');
  } catch { return false; }
}

export async function autoContactLinkedin(lead, _u, _p, headlessOverride = false) {
  if (!lead.link) throw new Error('El lead no tiene un enlace de postulación.');

  console.log(`[LinkedIn Bot] Usando Chrome compartido para LinkedIn...`);

  // Usa el Chrome compartido — no lanza un nuevo browser
  const { page } = await openTab(null, !headlessOverride);

  try {
    // ── Verificar sesión ───────────────────────────────────────────────────
    const logged = await isLinkedInLoggedIn(page);
    if (!logged) {
      console.log('[LinkedIn Bot] Sin sesión. Abre LinkedIn en el Chrome compartido y haz login.');
      await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2' });
      // Espera hasta 2 minutos para que el usuario complete el login manualmente
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120000 }).catch(() => {});
      await delay(2000);
    } else {
      console.log('[LinkedIn Bot] ✅ Sesión activa de LinkedIn en Chrome compartido.');
    }

    // ── Ir a la oferta ─────────────────────────────────────────────────────
    await page.goto(lead.link, { waitUntil: 'networkidle2', timeout: 20000 });
    await delay(3000);

    // ── Botón Easy Apply ───────────────────────────────────────────────────
    const applyBtn = await page.$('.jobs-apply-button, button.jobs-apply-button');
    if (!applyBtn) throw new Error('No se encontró botón "Easy Apply" en esta oferta.');
    await applyBtn.click();
    await delay(2000);

    // ── Procesar formulario paso a paso con Gemini ─────────────────────────
    let pitch = 'Postulación en LinkedIn Easy Apply.';
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    let isFinished = false;
    let attempts = 0;

    while (!isFinished && attempts < 10) {
      attempts++;

      // Responder preguntas del formulario con Gemini
      const questions = await page.evaluate(() =>
        Array.from(document.querySelectorAll('label')).map(l => ({
          text: l.textContent?.trim() || '',
          htmlFor: l.getAttribute('for') || ''
        })).filter(q => q.text.length > 0)
      );

      for (const q of questions) {
        if (!q.htmlFor) continue;
        const input = await page.$(`#${q.htmlFor}, [name="${q.htmlFor}"]`);
        if (!input) continue;
        const val = await page.evaluate(el => el.value, input);
        if (val?.trim()) continue;
        const r = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Pregunta de postulación LinkedIn: "${q.text}". Soy Jesús Omar Martínez, 5 años en desarrollo web premium. Responde MUY corto (1-2 palabras o número). Si es sí/no: "Sí". Si es años de experiencia: "4".`,
        });
        await page.type(`#${q.htmlFor}`, r.text?.trim() || 'Sí', { delay: 30 });
      }

      // Carta de presentación
      const textarea = await page.$('textarea');
      if (textarea) {
        const val = await page.evaluate(el => el.value, textarea);
        if (!val?.trim()) {
          const r = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Carta de presentación (máx 120 palabras) para oferta en "${lead.nombre_negocio}". Contexto: "${lead.gap_detectado || ''}". Soy Jesús Omar Martínez, Creative Director de JOM Studio (web premium, e-commerce, WebGL). Firma: "Jesús Omar Martínez — JOM Studio".`,
          });
          pitch = r.text?.trim() || pitch;
          await page.type('textarea', pitch, { delay: 10 });
          await delay(800);
        }
      }

      // Navegación del formulario
      let navigated = false;
      for (const btn of await page.$$('button')) {
        const t = await page.evaluate(el => el.textContent?.trim().toLowerCase(), btn);
        const a = await page.evaluate(el => el.getAttribute('aria-label')?.toLowerCase() || '', btn);
        if (t.includes('enviar') || t.includes('submit') || a.includes('submit')) {
          await btn.click(); isFinished = true; navigated = true; break;
        }
        if (t.includes('siguiente') || t.includes('next') || t.includes('revisar') || t.includes('review')) {
          await btn.click(); navigated = true; await delay(2000); break;
        }
      }

      if (!navigated) break;
    }

    await delay(4000);

    // ── Registrar en CRM ───────────────────────────────────────────────────
    await updateLeadState(lead.nombre_negocio, 'contactado', {
      fecha_contacto: new Date().toISOString(),
      origen: 'LinkedIn Easy Apply (Chrome compartido)',
    });

    try {
      const { upsertMessage } = require('./emailStore');
      upsertMessage(lead, {
        id: `li_${Date.now()}`,
        subject: `🤖 Auto-Postulado (LinkedIn): ${lead.nombre_negocio}`,
        body: `✅ Postulación LinkedIn Easy Apply completada.\n\n${pitch}`,
        sentAt: new Date().toISOString(), direction: 'outbound', status: 'sent', from: 'Auto-Postulador JOM',
      });
    } catch {}

    if (global.io) { global.io.emit('leads_updated'); global.io.emit('emails_updated'); }
    console.log('[LinkedIn Bot] 🎉 Postulación completada!');
    return { success: true, message: '¡Postulación LinkedIn completada!' };

  } finally {
    await closeTab(page); // Solo cierra pestaña, NO el browser compartido
  }
}
