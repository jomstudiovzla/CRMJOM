import puppeteer from 'puppeteer';
import { updateLeadState } from './leadsStore';
import { GoogleGenAI } from '@google/genai';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function autoContactLinkedin(lead, username, password, headlessOverride = false) {
  if (!lead.link) throw new Error('El lead no tiene un enlace de postulación.');
  if (!username || !password) throw new Error('Credenciales de LinkedIn no configuradas.');

  console.log(`[LinkedIn Bot] Iniciando Puppeteer para LinkedIn (Headless: ${headlessOverride})`);

  const browser = await puppeteer.launch({
    headless: headlessOverride ? 'new' : false,
    defaultViewport: null,
    args: headlessOverride ? [] : ['--start-maximized']
  });

  const page = await browser.newPage();

  try {
    // 1. Ir a login de LinkedIn
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2' });

    // Ingresar credenciales
    await page.waitForSelector('#username', { timeout: 10000 });
    await page.type('#username', username, { delay: 50 });
    await page.type('#password', password, { delay: 50 });
    
    // Clic entrar
    await page.click('button[type="submit"]');
    
    // Esperar a que pase la verificación / login
    // Si aparece PIN o captcha, el usuario lo resuelve en pantalla porque headless = false
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
    await delay(3000);

    // 2. Ir al enlace del trabajo
    await page.goto(lead.link, { waitUntil: 'networkidle2' });
    await delay(3000);

    // 3. Buscar el botón de "Easy Apply" / "Solicitud sencilla"
    // Los selectores comunes son .jobs-apply-button o botón con texto descriptivo
    const applyButtonSelector = '.jobs-apply-button, button.jobs-apply-button';
    const hasApplyBtn = await page.$(applyButtonSelector);

    if (!hasApplyBtn) {
      throw new Error('No se encontró el botón de "Solicitud Sencilla" (Easy Apply) en esta oferta de LinkedIn.');
    }

    await page.click(applyButtonSelector);
    await delay(2000);

    // 4. Procesar el modal paso a paso (Formulario de postulación)
    let isFinished = false;
    let attempts = 0;
    const maxSteps = 10; // límite de pasos

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    while (!isFinished && attempts < maxSteps) {
      attempts++;

      // Buscar si hay preguntas en el paso actual
      const formQuestions = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('label'));
        return labels.map(l => ({
          text: l.textContent?.trim() || '',
          htmlFor: l.getAttribute('for') || ''
        })).filter(q => q.text.length > 0);
      });

      // Responder preguntas con Gemini si hay alguna
      for (const q of formQuestions) {
        if (q.htmlFor) {
          const inputEl = await page.$(`#${q.htmlFor}, [name="${q.htmlFor}"]`);
          if (inputEl) {
            const val = await page.evaluate(el => el.value, inputEl);
            if (!val || val.trim() === '') {
              // Consultar a Gemini la respuesta más adecuada según la pregunta
              const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Pregunta de postulación de LinkedIn: "${q.text}".
Basado en que soy Jesús Omar Martínez, Creative Director de JOM Studio con 5 años de experiencia en desarrollo creativo web premium (Next.js, WebGL, React, CSS), responde la pregunta de forma ultra corta (máximo 1 o 2 palabras o un número). Si es experiencia pon un número entre 3 y 5. Si es sí/no responde 'Yes' o 'Sí'.`,
              });

              const answer = response.text?.trim() || 'Yes';
              await page.type(`#${q.htmlFor}`, answer, { delay: 30 });
            }
          }
        }
      }

      // Buscar botones de navegación
      const buttons = await page.$$('button');
      let clickedNav = false;

      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent?.trim().toLowerCase(), btn);
        const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label')?.toLowerCase() || '', btn);

        // Si es el botón de enviar
        if (text.includes('enviar') || text.includes('submit') || ariaLabel.includes('submit') || ariaLabel.includes('enviar')) {
          await btn.click();
          isFinished = true;
          clickedNav = true;
          break;
        }

        // Si es el botón de siguiente/revisar
        if (text.includes('siguiente') || text.includes('next') || text.includes('revisar') || text.includes('review') || ariaLabel.includes('next') || ariaLabel.includes('siguiente')) {
          await btn.click();
          clickedNav = true;
          await delay(2000);
          break;
        }
      }

      if (!clickedNav) {
        // Si no encontramos ningún botón que haga avanzar, cerramos la postulación
        throw new Error('No se detectaron botones de avance en el formulario de LinkedIn.');
      }
    }

    await delay(4000);

    // Actualizar estado del lead a contactado
    await updateLeadState(lead.nombre_negocio, 'contactado', {
      fecha_contacto: new Date().toISOString(),
      origen: 'LinkedIn Auto-Apply'
    });

    if (global.io) {
      global.io.emit('leads_updated');
    }

    return { success: true, message: '¡Postulación por LinkedIn (Easy Apply) completada!' };

  } catch (err) {
    console.error('[LinkedIn Bot] Error:', err.message);
    throw err;
  } finally {
    await delay(3000);
    await browser.close();
  }
}
