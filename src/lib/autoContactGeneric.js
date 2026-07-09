/**
 * autoContactGeneric.js
 * Bot de postulación automática genérico para otras plataformas
 * (Upwork, Fiverr, Workana, Freelancer, Bumeran)
 *
 * Utiliza answerEngine y Gemini (fallback) para llenar formularios.
 */

import { openTab, closeTab, ensurePlatformSession } from './browserManager';
import { updateLeadState }  from './leadsStore';
import { addPostulacion }   from './postulacionesStore';
import { GoogleGenAI }      from '@google/genai';
import { PROFILE, RESPUESTAS } from './profileData';
import { getAnswer, matchOption, detectLanguage } from './answerEngine';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const ai    = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function answeredByGemini(question, fieldType = 'text', options = []) {
  const isLong = fieldType === 'textarea';

  if (!isLong) {
    const ruled = getAnswer(question, fieldType, options);
    if (ruled !== null && ruled !== undefined && ruled !== '') {
      console.log(`[Bot] ✅ Regla: "${question.slice(0,50)}" → "${String(ruled).slice(0,60)}"`);
      return ruled;
    }
  }

  const lng    = detectLanguage(question);
  const optHint = options.length ? `\nOptions: ${options.join(' | ')}` : '';
  const prompt = lng === 'en'
    ? `You are filling a job application form for Jesús Omar Martínez.
${isLong ? `FULL CONTEXT ABOUT ME (Use this to craft a UNIQUE, tailored answer to the specific question, do NOT just repeat this text. Analyze the question and answer properly using these facts):\n${PROFILE.escrito_completo}` : `PROFILE:\n- Name: Jesús Omar Martínez | Venezuelan\n- Role: Creative Director & Web Developer | 3 years exp\n- Education: High school diploma (NO university degree)\n- English: Intermediate B1\n- Mode: 100% Remote | Salary: 800 USD/month`}

RULES:
- Answer in ENGLISH (question is in English)
- ${isLong ? 'Write a complete, unique professional paragraph (4-6 sentences) answering EXACTLY what is being asked based on my profile. DO NOT copy-paste the same generic intro. BE SPECIFIC.' : 'Give a concise, direct answer (number, word, or short phrase).'}
- Do NOT invent data not in the profile
- For options: pick the most accurate one${optHint}

Question: "${question}"
Reply with ONLY the answer, no quotes, no explanation:` 
    : `Eres Jesús Omar Martínez respondiendo una pregunta de postulación de empleo.
${isLong ? `CONTEXTO COMPLETO SOBRE MÍ (Usa esto para redactar una respuesta ÚNICA y adaptada a la pregunta. NO repitas el texto tal cual, analízalo y responde lo que se pide basándote en estos hechos):\n${PROFILE.escrito_completo}` : `PERFIL:\n- Nombre: Jesús Omar Martínez | Venezolano\n- Cargo: Director Creativo y Desarrollador Web | 3 años exp\n- Educación: Bachiller (NO universitario)\n- Inglés: Intermedio B1\n- Modalidad: 100% Remoto | Salario: 800 USD/mes`}

REGLAS:
- Responde en ESPAÑOL
- ${isLong ? 'Escribe un párrafo profesional ÚNICO (4-6 oraciones) respondiendo EXACTAMENTE a la pregunta usando la info de mi perfil. NO uses la misma introducción genérica de siempre. SÉ ESPECÍFICO a lo que se pregunta.' : 'Responde de forma concisa y directa (número, palabra, o frase corta).'}
- NO inventes datos que no están en el perfil
- Para opciones: elige la más precisa${optHint}

Pregunta: "${question}"
Responde SOLO con el valor, sin comillas ni explicación:`;

  try {
    const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    const a = r.text?.trim() || '';
    if (a) { console.log(`[Bot] 🤖 Gemini: "${question.slice(0,50)}" → "${a.slice(0,60)}"`); return a; }
  } catch (e) {
    console.warn('[Bot] Gemini no disponible:', e.message?.slice(0, 60));
  }

  const q = question.toLowerCase();
  if (isLong)                                                   return 'Disponible. Por favor, consultar mi perfil para más detalles.';
  if (q.includes('años') || q.includes('years'))               return '3';
  if (q.includes('salario') || q.includes('salary'))           return PROFILE.pretension_salarial_texto;
  if (q.includes('teléfono') || q.includes('phone'))           return PROFILE.telefono;
  if (q.includes('ciudad') || q.includes('city'))              return PROFILE.ciudad;
  if (q.includes('nombre') || q.includes('name'))              return PROFILE.nombre_completo;
  if (q.includes('presencial') || q.includes('vehículo') ||
      q.includes('c2') || q.includes('advanced') ||
      q.includes('university') || q.includes('universitario'))  return 'No';
  if (q.includes('remoto') || q.includes('remote'))            return 'Sí';
  return '';
}

async function fillGenericForm(page) {
  let filled = 0;

  const getLabel = async (el) => page.evaluate((node) => {
    const id = node.id || node.name;
    if (id) {
      const lbl = document.querySelector(`label[for="${id}"]`);
      if (lbl) return lbl.textContent.trim();
    }
    const parent = node.closest('div, fieldset, section');
    if (parent) {
      const lbl = parent.querySelector('label, legend, span.bold, h3, h4');
      if (lbl && lbl !== node) return lbl.textContent.trim();
    }
    return node.placeholder || node.name || node.id || '';
  }, el);

  // Inputs
  const inputs = await page.$$('input[type="text"], input[type="number"], input[type="tel"], input[type="email"]');
  for (const el of inputs) {
    try {
      const val = await page.evaluate(n => n.value, el);
      if (val?.trim()) continue;
      const label = await getLabel(el);
      if (!label) continue;
      const type  = await page.evaluate(n => n.type, el);
      const answer = await answeredByGemini(label, type || 'text');
      let finalAnswer = answer;
      if (!finalAnswer) {
        if (type === 'number') finalAnswer = '1';
        else if (type === 'email') finalAnswer = 'jomstudiovzla@gmail.com';
        else if (type === 'tel') finalAnswer = '+584120000000';
        else finalAnswer = 'N/A';
      }
      await el.click({ clickCount: 3 });
      await el.type(String(finalAnswer), { delay: 20 });
      filled++;
      await delay(150);
    } catch (e) {}
  }

  // Selects
  const selects = await page.$$('select');
  for (const el of selects) {
    try {
      const current = await page.evaluate(n => n.value, el);
      if (current && current !== '') continue;
      const label   = await getLabel(el);
      const options = await page.evaluate(n =>
        Array.from(n.options).filter(o => o.value && o.value !== '').map(o => o.text.trim())
      , el);
      if (!options.length) continue;
      const answer  = await answeredByGemini(label, 'select', options);
      const matched = answer ? matchOption(answer, options) || answer : null;
      if (!matched) continue;
      const set = await page.evaluate((node, ans) => {
        const opts = Array.from(node.options);
        if (ans) {
          const a = ans.toLowerCase();
          const hit = opts.find(o => o.text.toLowerCase().includes(a.slice(0, 6)) || a.includes(o.text.toLowerCase().slice(0,6)));
          if (hit) {
            node.value = hit.value;
            node.dispatchEvent(new Event('change', { bubbles: true }));
            return hit.text;
          }
        }
        const firstValid = opts.find(o => o.value && o.value !== '0' && o.value !== '');
        if (firstValid) {
          node.value = firstValid.value;
          node.dispatchEvent(new Event('change', { bubbles: true }));
          return firstValid.text;
        }
        return null;
      }, el, matched);
      if (set) { filled++; await delay(250); }
    } catch (e) {}
  }

  // Textareas
  const textareas = await page.$$('textarea');
  for (const el of textareas) {
    try {
      const val = await page.evaluate(n => n.value, el);
      if (val?.trim().length > 30) continue;
      const label  = await getLabel(el);
      const answer = await answeredByGemini(label || 'Carta de presentación / Proposal', 'textarea');
      let finalAnswer = answer;
      if (!finalAnswer) finalAnswer = 'Desarrollador Web y Director Creativo con 3 años de experiencia en el sector. Disponible inmediatamente.';
      await el.click({ clickCount: 3 });
      await page.evaluate(n => { n.value = ''; }, el);
      for (let i = 0; i < finalAnswer.length; i += 50) {
        await el.type(finalAnswer.slice(i, i + 50), { delay: 8 });
      }
      filled++;
      await delay(350);
    } catch (e) {}
  }

  console.log(`[Bot] ✅ ${filled} campo(s) llenados`);
  return filled;
}

export async function autoContactGeneric(lead, platformName, applySelectors) {
  if (!lead.link) throw new Error('El lead no tiene un enlace de postulación.');

  const { page } = await openTab(null, true);

  try {
    const loggedIn = await ensurePlatformSession(page, platformName);
    if (!loggedIn) {
      throw new Error(`No se pudo iniciar sesión en ${platformName}. Abre la plataforma manualmente desde Mailbox primero.`);
    }
    console.log(`[${platformName.toUpperCase()}] ✅ Sesión activa`);

    console.log(`[${platformName.toUpperCase()}] → ${lead.link}`);
    await page.goto(lead.link, { waitUntil: 'networkidle2', timeout: 20000 });
    await delay(3500);

    const jobInfo = await page.evaluate(() => ({
      puesto:  document.querySelector('h1')?.textContent?.trim() || document.title.split('|')[0].trim(),
      empresa: 'Sin especificar',
    })).catch(() => ({ puesto: lead.nombre_negocio || 'Oferta', empresa: 'Sin especificar' }));

    // Buscar botón de aplicar
    let applied = false;
    for (const sel of applySelectors) {
      const btn = await page.$(sel);
      if (btn) {
        const vis = await page.evaluate(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }, btn);
        if (vis) { await btn.click(); applied = true; break; }
      }
    }
    if (!applied) {
      const btns = await page.$$('button, a.btn, a.button');
      for (const btn of btns) {
        const t = await page.evaluate(el => (el.textContent || el.getAttribute('aria-label') || '').toLowerCase(), btn);
        if (t.includes('apply') || t.includes('postular') || t.includes('proposal') || t.includes('offer') || t.includes('bid')) {
          const vis = await page.evaluate(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, btn);
          if (vis) { await btn.click(); applied = true; break; }
        }
      }
    }
    
    if (!applied) {
      console.log(`[${platformName.toUpperCase()}] ⚠️ No se encontró botón de aplicación automático`);
      addPostulacion({
        plataforma: platformName,
        puesto:     jobInfo.puesto,
        empresa:    jobInfo.empresa,
        link:       lead.link,
        estado:     'pendiente',
        notas:      'No se pudo encontrar botón para aplicar, aplicar manualmente',
      });
      if (global.io) global.io.emit('postulaciones_updated');
      return { success: false, message: 'Requiere aplicación manual.' };
    }

    await delay(3500);

    let steps     = 0;
    let submitted = false;

    while (steps < 6 && !submitted) {
      steps++;
      await delay(1500);

      try { await fillGenericForm(page); } catch (e) {
        if (e.message?.includes('context') || e.message?.includes('destroyed')) { submitted = true; break; }
      }

      await delay(1000);

      let action = 'none';
      try {
        action = await page.evaluate(() => {
          const SUBMIT = ['enviar', 'submit', 'send', 'place bid'];
          const NEXT   = ['siguiente', 'next', 'continuar', 'continue'];
          const btns   = Array.from(document.querySelectorAll('button:not([disabled])')).filter(el => {
            const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
          });
          for (const btn of btns) {
            const t = (btn.textContent || btn.getAttribute('aria-label') || '').trim().toLowerCase();
            if (SUBMIT.some(w => t.includes(w))) { btn.click(); return 'submitted'; }
          }
          for (const btn of btns) {
            const t = (btn.textContent || btn.getAttribute('aria-label') || '').trim().toLowerCase();
            if (NEXT.some(w => t.includes(w))) { btn.click(); return 'next'; }
          }
          return 'none';
        });
      } catch (e) {
        if (e.message?.includes('context') || e.message?.includes('destroyed')) { submitted = true; break; }
      }

      console.log(`[${platformName.toUpperCase()}] Paso ${steps}: "${action}"`);
      if (action === 'submitted') {
        await delay(3500);
        submitted = true; break;
      }
      if (action === 'none') break;
    }

    addPostulacion({
      plataforma: platformName,
      puesto:     jobInfo.puesto,
      empresa:    jobInfo.empresa,
      link:       lead.link,
      estado:     submitted ? 'enviada' : 'pendiente',
      notas:      submitted ? 'Postulación completada' : 'Revisar manualmente',
    });

    await updateLeadState(lead.nombre_negocio || jobInfo.empresa, 'contactado', {
      fecha_contacto: new Date().toISOString(),
      origen:         `Auto-Bot ${platformName}`,
    });

    if (global.io) {
      global.io.emit('leads_updated');
      global.io.emit('postulaciones_updated');
    }

    console.log(`[${platformName.toUpperCase()}] 🎉 Postulación ${submitted ? 'enviado' : 'pendiente'}`);
    return { success: true, submitted, jobInfo };

  } finally {
    await closeTab(page);
  }
}
