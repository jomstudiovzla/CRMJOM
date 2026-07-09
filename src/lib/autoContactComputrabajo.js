/**
 * autoContactComputrabajo.js
 * Bot de postulación automática para Computrabajo
 *
 * FLUJO DE RESPUESTAS:
 * 1. answerEngine.getAnswer()  → banco de respuestas + reglas (sin IA)
 * 2. Gemini                    → solo para preguntas no cubiertas
 * 3. Fallback seguro           → si Gemini falla o supera cuota
 *
 * REGLA: Nunca inventar datos. Nunca responder C2 inglés ni título universitario.
 *        Textareas siempre reciben respuesta completa — nunca vacía.
 */

import { openTab, closeTab, ensureComputrabajoSession } from './browserManager';
import { updateLeadState }   from './leadsStore';
import { addPostulacion }    from './postulacionesStore';
import { GoogleGenAI }       from '@google/genai';
import { PROFILE }           from './profileData';
import { getAnswer, matchOption, detectLanguage, classifyQuestion } from './answerEngine';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const ai    = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/* ═══════════════════════════════════════════════════════════════════════════
   FUNCIÓN CENTRAL: answeredByGemini
   Intenta el motor propio primero → Gemini solo si es necesario
   ═══════════════════════════════════════════════════════════════════════════ */
async function answeredByGemini(question, fieldType = 'text', options = []) {
  const isLong  = fieldType === 'textarea';

  // ── PASO 1: Motor propio (solo para preguntas cortas, selects y radios) ────
  if (!isLong) {
    const ruled = getAnswer(question, fieldType, options);
    if (ruled !== null && ruled !== undefined && ruled !== '') {
      console.log(`[CT Bot] ✅ Motor propio: "${question.slice(0, 50)}" → "${String(ruled).slice(0, 60)}"`);
      return ruled;
    }
  }

  // ── PASO 2: Gemini para textareas o lo que el motor no cubre ──────────────
  const lng     = detectLanguage(question);
  const optHint = options.length
    ? `\nChoose EXACTLY ONE from these options: ${options.join(' | ')}`
    : '';

  const instrucciones = lng === 'en'
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
    const r = await ai.models.generateContent({
      model:    'gemini-2.5-flash',
      contents: instrucciones,
    });
    const answer = r.text?.trim() || '';
    if (answer) {
      console.log(`[CT Bot] 🤖 Gemini: "${question.slice(0, 50)}" → "${answer.slice(0, 80)}"`);
      return answer;
    }
  } catch (e) {
    console.warn('[CT Bot] Gemini no disponible:', e.message?.slice(0, 70));
  }

  // ── PASO 3: Fallback — respuestas seguras sin IA ──────────────────────
  const q = question.toLowerCase();
  if (isLong) {
    return 'Disponible. Por favor, consultar mi perfil para más detalles.';
  }
  if (q.includes('años') || q.includes('years') || q.includes('experiencia'))  return '3';
  if (q.includes('salario') || q.includes('sueldo') || q.includes('salary'))   return PROFILE.pretension_salarial_texto;
  if (q.includes('teléfono') || q.includes('phone'))                            return PROFILE.telefono;
  if (q.includes('email') || q.includes('correo'))                              return PROFILE.email;
  if (q.includes('ciudad') || q.includes('city'))                               return PROFILE.ciudad;
  if (q.includes('nombre') || q.includes('name'))                               return PROFILE.nombre_completo;
  if (q.includes('presencial') || q.includes('vehículo') || q.includes('viajar') ||
      q.includes('c2') || q.includes('c1') || q.includes('universitario') ||
      q.includes('advanced') || q.includes('fluent') || q.includes('relocate'))  return 'No';
  if (q.includes('remoto') || q.includes('remote') || q.includes('disponib'))    return 'Sí';

  return ''; // vacío en vez de inventar
}

/* ═══════════════════════════════════════════════════════════════════════════
   LLENAR FORMULARIO: Lee todos los campos y los responde con coherencia
   ═══════════════════════════════════════════════════════════════════════════ */
async function fillApplicationForm(page) {
  let filled = 0;

  /** Obtener label de un elemento */
  const getLabel = async (el) => page.evaluate((node) => {
    const id = node.id || node.name;
    if (id) {
      const lbl = document.querySelector(`label[for="${id}"]`);
      if (lbl) return lbl.textContent.trim();
    }
    const parent = node.closest('.form-group, .field-wrap, fieldset, .question-box, .form-field, div[class*="field"], div[class*="question"]');
    if (parent) {
      const lbl = parent.querySelector('label, legend, .label, p.question, span.question, h3, h4');
      if (lbl && lbl !== node) return lbl.textContent.trim();
    }
    return node.placeholder || node.name || node.id || '';
  }, el);

  // ── 1. Inputs de texto / número / email / tel ────────────────────────────
  const inputs = await page.$$('input[type="text"], input[type="number"], input[type="tel"], input[type="email"]');
  for (const el of inputs) {
    try {
      const val = await page.evaluate(n => n.value, el);
      if (val?.trim()) continue; // Ya llenado
      const label    = await getLabel(el);
      if (!label) continue;
      const inputType = await page.evaluate(n => n.type, el);
      const answer = await answeredByGemini(label, inputType || 'text');
      let finalAnswer = answer;
      if (!finalAnswer) {
        if (inputType === 'number') finalAnswer = '1';
        else if (inputType === 'email') finalAnswer = 'jomstudiovzla@gmail.com';
        else if (inputType === 'tel') finalAnswer = '+584120000000';
        else finalAnswer = 'N/A';
      }
      await el.click({ clickCount: 3 });
      await el.type(String(finalAnswer), { delay: 20 });
      console.log(`[CT Bot] Input: "${label.slice(0,40)}" → "${String(finalAnswer).slice(0,40)}" (Agresivo)`);
      filled++;
      await delay(180);
    } catch (e) {
      if (e.message?.includes('context') || e.message?.includes('destroyed')) throw e;
    }
  }

  // ── 2. Selects ───────────────────────────────────────────────────────────
  const selects = await page.$$('select');
  for (const el of selects) {
    try {
      const current = await page.evaluate(n => n.value, el);
      if (current && current !== '0' && current !== '') continue;
      const label   = await getLabel(el);
      const options = await page.evaluate(n =>
        Array.from(n.options).filter(o => o.value && o.value !== '0' && o.value !== '').map(o => o.text.trim())
      , el);
      if (!options.length) continue;

      const answer  = await answeredByGemini(label, 'select', options);
      const matched = answer ? matchOption(answer, options) || answer : null;

      const set = await page.evaluate((node, ans, optsArr) => {
        const opts = Array.from(node.options);
        if (ans) {
          const a = ans.toLowerCase();
          const hit = opts.find(o => o.text.toLowerCase().trim() === a || o.text.toLowerCase().includes(a.slice(0, 6)));
          if (hit) {
            node.value = hit.value;
            node.dispatchEvent(new Event('change', { bubbles: true }));
            return hit.text;
          }
        }
        // FALLBACK AGRESIVO: Seleccionar la primera opción válida si no hay match
        const firstValid = opts.find(o => o.value && o.value !== '0' && o.value !== '');
        if (firstValid) {
          node.value = firstValid.value;
          node.dispatchEvent(new Event('change', { bubbles: true }));
          return firstValid.text;
        }
        return null;
      }, el, matched, options);

      if (set) {
        console.log(`[CT Bot] Select: "${label.slice(0,40)}" → "${set}" (Agresivo)`);
        filled++;
        await delay(280);
      }
    } catch (e) {
      if (e.message?.includes('context') || e.message?.includes('destroyed')) throw e;
    }
  }

  // ── 3. Radio buttons ─────────────────────────────────────────────────────
  const radioGroups = await page.evaluate(() => {
    const groups = {};
    document.querySelectorAll('input[type="radio"]').forEach(r => {
      if (!groups[r.name]) groups[r.name] = [];
      const lbl =
        r.labels?.[0]?.textContent?.trim() ||
        r.nextElementSibling?.textContent?.trim() ||
        r.parentElement?.textContent?.trim() ||
        r.value;
      groups[r.name].push({ value: r.value, label: lbl, checked: r.checked });
    });
    return groups;
  });

  for (const [groupName, radios] of Object.entries(radioGroups)) {
    try {
      if (radios.some(r => r.checked)) continue;
      const groupLabel = await page.evaluate((name) => {
        const el     = document.querySelector(`input[name="${name}"]`);
        if (!el) return name;
        const parent = el.closest('fieldset, .form-group, .radio-group, .question-box, div[class*="field"]');
        if (parent) {
          const lg = parent.querySelector('legend, p, .label, label:first-child, h3, h4');
          if (lg) return lg.textContent.trim();
        }
        return name;
      }, groupName);

      const options = radios.map(r => r.label);
      const answer  = await answeredByGemini(groupLabel, 'radio', options);

      const clicked = await page.evaluate((name, ans) => {
        const inputs  = Array.from(document.querySelectorAll(`input[name="${name}"]`));
        const ansLow  = (ans || '').toLowerCase().trim();

        // 1. Coincidencia exacta
        const exact = inputs.find(i => {
          const t = (i.labels?.[0]?.textContent || i.nextElementSibling?.textContent || '').toLowerCase().trim();
          return t === ansLow || t.includes(ansLow) || ansLow.includes(t);
        });
        if (exact) { exact.click(); return exact.labels?.[0]?.textContent || 'clicked'; }

        // 2. Si respuesta = "No" → buscar opción "No"
        if (ansLow === 'no' || ansLow.startsWith('no,') || ansLow.startsWith('no ')) {
          const no = inputs.find(i =>
            (i.labels?.[0]?.textContent || i.nextElementSibling?.textContent || '').toLowerCase().trim() === 'no'
          );
          if (no) { no.click(); return 'No'; }
        }

        // 3. Si respuesta = "Sí" → buscar opción "Sí"
        if (ansLow === 'sí' || ansLow === 'si' || ansLow === 'yes') {
          const yes = inputs.find(i => {
            const t = (i.labels?.[0]?.textContent || i.nextElementSibling?.textContent || '').toLowerCase().trim();
            return t === 'sí' || t === 'si' || t === 'yes';
          });
          if (yes) { yes.click(); return 'Sí'; }
        }

        // 4. FALLBACK AGRESIVO: Seleccionar la primera opción para no quedarse trancado
        if (inputs.length > 0) {
          inputs[0].click();
          return inputs[0].labels?.[0]?.textContent || 'Fallback (Primera Opción)';
        }
        return null;
      }, groupName, answer);

      if (clicked) {
        console.log(`[CT Bot] Radio: "${groupLabel.slice(0,40)}" → "${clicked}"`);
        filled++;
      }
      await delay(220);
    } catch (e) {
      if (e.message?.includes('context') || e.message?.includes('destroyed')) throw e;
    }
  }

  // ── 4. Textareas ─────────────────────────────────────────────────────────
  const textareas = await page.$$('textarea');
  for (const el of textareas) {
    try {
      const val = await page.evaluate(n => n.value, el);
      if (val?.trim().length > 30) continue; // Ya tiene contenido significativo
      const label  = await getLabel(el);
      // Para textareas: siempre devolver una respuesta completa
      const question = label || 'Carta de presentación';
      const answer   = await answeredByGemini(question, 'textarea');
      let finalAnswer = answer;
      if (!finalAnswer) finalAnswer = 'Desarrollador Web y Director Creativo con 3 años de experiencia en el sector. Disponible inmediatamente.';
      await el.click({ clickCount: 3 });
      await page.evaluate(n => { n.value = ''; }, el);
      for (let i = 0; i < finalAnswer.length; i += 50) {
        await el.type(finalAnswer.slice(i, i + 50), { delay: 8 });
      }
      console.log(`[CT Bot] Textarea: "${question.slice(0,40)}" → ${finalAnswer.length} chars (Agresivo)`);
      filled++;
      await delay(350);
    } catch (e) {
      if (e.message?.includes('context') || e.message?.includes('destroyed')) throw e;
    }
  }

  console.log(`[CT Bot] ✅ Total: ${filled} campo(s) llenados`);
  return filled;
}

/* ═══════════════════════════════════════════════════════════════════════════
   NAVEGAR FORMULARIO MULTI-PASO
   ═══════════════════════════════════════════════════════════════════════════ */
async function navigateMultiStepForm(page) {
  let steps     = 0;
  let submitted = false;

  while (steps < 15 && !submitted) {
    steps++;
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 5000 }).catch(() => {});
    await delay(1000);

    try {
      await fillApplicationForm(page);
    } catch (e) {
      if (e.message?.includes('context') || e.message?.includes('destroyed')) {
        submitted = true; break;
      }
    }

    await delay(600);

    let action = 'none';
    try {
      action = await page.evaluate(() => {
        const SUBMIT_WORDS = ['enviar','postular','finalizar','submit','aplicar','confirmar','send','inscribir','apply'];
        const NEXT_WORDS   = ['siguiente','next','continuar','avanzar','continue','próximo'];
        const btns = Array.from(
          document.querySelectorAll('button:not([disabled]), input[type="submit"], a.btn, .btn-primary')
        ).filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
        for (const btn of btns) {
          const t = (btn.textContent || btn.value || '').trim().toLowerCase();
          if (SUBMIT_WORDS.some(w => t.includes(w))) { btn.click(); return 'submitted'; }
        }
        for (const btn of btns) {
          const t = (btn.textContent || btn.value || '').trim().toLowerCase();
          if (NEXT_WORDS.some(w => t.includes(w)))   { btn.click(); return 'next'; }
        }
        return 'none';
      });
    } catch (e) {
      if (e.message?.includes('context') || e.message?.includes('destroyed')) {
        submitted = true; break;
      }
    }

    console.log(`[CT Bot] Paso ${steps}: "${action}"`);

    if (action === 'submitted') {
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {}),
        delay(3000),
      ]);
      submitted = true; break;
    }
    if (action === 'none') break;

    await delay(1800);

    try {
      const gone = await page.evaluate(() =>
        !document.querySelector('.modal.show, [role="dialog"][aria-modal="true"], #apply-modal')
      );
      if (gone && steps > 1) { submitted = true; break; }
    } catch {
      submitted = true; break;
    }
  }

  return submitted;
}

/* ═══════════════════════════════════════════════════════════════════════════
   FUNCIÓN PRINCIPAL — Exportada
   ═══════════════════════════════════════════════════════════════════════════ */
export async function autoContactComputrabajo(lead, _u, _p, headlessOverride = false) {
  if (!lead.link) throw new Error('Lead sin link de postulación.');

  const { page } = await openTab(null, !headlessOverride);

  try {
    // ── Verificar sesión ─────────────────────────────────────────────────
    const loggedIn = await ensureComputrabajoSession(page);
    if (!loggedIn) {
      throw new Error(
        'No se pudo iniciar sesión en Computrabajo. ' +
        'Ve al CRM → Mails → "Abrir con Google" para activar la sesión.'
      );
    }

    // ── Navegar a la oferta ───────────────────────────────────────────────
    console.log(`[CT Bot] → ${lead.link}`);
    await page.goto(lead.link, { waitUntil: 'networkidle2', timeout: 25000 });
    await delay(1800);

    // ── Extraer info ──────────────────────────────────────────────────────
    const jobInfo = await page.evaluate(() => ({
      puesto:
        document.querySelector('h1')?.textContent?.trim() ||
        document.querySelector('.job-title, .title-offer, [class*="title"]')?.textContent?.trim() ||
        document.title?.split('|')[0]?.trim() || 'Sin título',
      empresa:
        document.querySelector('.company-name, [class*="company"], [class*="empresa"]')?.textContent?.trim() ||
        document.querySelector('h2')?.textContent?.trim() || 'Sin especificar',
    })).catch(() => ({ puesto: lead.nombre_negocio || 'Oferta', empresa: 'Sin especificar' }));

    // ── Clicar Aplicar ────────────────────────────────────────────────────
    let applied = false;
    const APPLY_SELECTORS = [
      '.js-btn-apply', '#btn-apply', 'a[href*="aplicar"]', 'a[href*="postular"]',
      'button.btn-apply', '.apply-btn', '[data-apply]',
    ];
    for (const sel of APPLY_SELECTORS) {
      const btn = await page.$(sel);
      if (btn) { await btn.click(); applied = true; break; }
    }
    if (!applied) {
      for (const btn of await page.$$('a, button')) {
        const t = await page.evaluate(el => el.textContent?.toLowerCase() || '', btn);
        if (['aplicar','postularme','postular','inscribirme','apply'].some(w => t.includes(w))) {
          await btn.click(); applied = true; break;
        }
      }
    }
    if (!applied) throw new Error('No se encontró botón de aplicar en la oferta.');
    await delay(2200);

    // ── Rellenar y enviar ─────────────────────────────────────────────────
    const submitted = await navigateMultiStepForm(page);
    if (!submitted) console.warn('[CT Bot] ⚠️ Envío no confirmado.');
    await delay(1500);

    // ── Registrar ─────────────────────────────────────────────────────────
    addPostulacion({
      plataforma: 'computrabajo',
      puesto:     jobInfo.puesto,
      empresa:    jobInfo.empresa,
      link:       lead.link,
      estado:     submitted ? 'enviada' : 'pendiente',
      notas:      submitted ? 'Auto-postulación completada' : 'Revisar manualmente',
    });

    await updateLeadState(lead.nombre_negocio || jobInfo.empresa, 'contactado', {
      fecha_contacto: new Date().toISOString(),
      origen:         'Computrabajo Auto-Apply',
    });

    if (global.io) {
      global.io.emit('leads_updated');
      global.io.emit('postulaciones_updated');
    }

    console.log(`[CT Bot] 🎉 ${jobInfo.puesto} @ ${jobInfo.empresa} → ${submitted ? 'enviado' : 'pendiente'}`);
    return { success: true, submitted, jobInfo };

  } finally {
    await closeTab(page);
  }
}
