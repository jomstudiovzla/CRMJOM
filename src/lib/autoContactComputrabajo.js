import puppeteer from 'puppeteer';
import { updateLeadState } from './leadsStore';
import { GoogleGenAI } from '@google/genai';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function autoContactComputrabajo(lead, username, password, headlessOverride = false) {
  if (!lead.link) throw new Error('El lead no tiene un enlace de postulación.');
  if (!username || !password) throw new Error('Credenciales de Computrabajo no configuradas.');

  // Extraer dominio del link (ej. co.computrabajo.com)
  const urlObj = new URL(lead.link);
  const domain = urlObj.hostname;

  console.log(`[Autocontact] Iniciando Puppeteer para Computrabajo en ${domain} (Headless: ${headlessOverride})`);

  const browser = await puppeteer.launch({
    headless: headlessOverride ? 'new' : false, // Usar modo headless para ejecuciones automáticas en segundo plano
    defaultViewport: null,
    args: headlessOverride ? [] : ['--start-maximized']
  });

  const page = await browser.newPage();

  try {
    // 1. Ir al portal de Computrabajo (evita redirecciones directas al home)
    const portalUrl = `https://${domain}/`;
    await page.goto(portalUrl, { waitUntil: 'networkidle2' });

    // Aceptar cookies si aparece
    try {
      const cookieButtons = await page.$$('button, a');
      for (const btn of cookieButtons) {
        const text = await page.evaluate(el => el.textContent?.trim().toLowerCase(), btn);
        if (text.includes('acepto') || text.includes('aceptar') || text.includes('entendido')) {
          await btn.click();
          await delay(1000);
          break;
        }
      }
    } catch (e) {}

    // Intentar ir a la página de login dando click al botón "Login" o "Ingresar"
    let loginClicked = false;
    const navButtons = await page.$$('a, button');
    for (const btn of navButtons) {
      const text = await page.evaluate(el => el.textContent?.trim().toLowerCase(), btn);
      if (text === 'login' || text === 'ingresar' || text === 'iniciar sesión') {
        await btn.click();
        loginClicked = true;
        break;
      }
    }

    if (!loginClicked) {
      // Si falló el clic, intentamos ir al subdominio de candidato
      await page.goto(`https://${domain}/candidato/`, { waitUntil: 'networkidle2' });
    } else {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    }

    // Rellenar email
    const emailSelector = 'input[type="email"], input[name*="mail"], #LoginModel_Email, #Username';
    await page.waitForSelector(emailSelector, { timeout: 15000 });
    await page.type(emailSelector, username, { delay: 50 });

    // Rellenar password
    const passSelector = 'input[type="password"], input[name*="pass"], #LoginModel_Password, #Password';
    await page.waitForSelector(passSelector, { timeout: 5000 });
    await page.type(passSelector, password, { delay: 50 });

    // Click ingresar
    const submitBtn = 'button[type="submit"], #btnIngresar, button.btn-primary';
    await page.click(submitBtn);

    // Esperar a que loguee
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 });
    await delay(3000);

    // 2. Ir a la oferta de trabajo
    await page.goto(lead.link, { waitUntil: 'networkidle2' });

    // 3. Buscar y hacer clic en el botón "Aplicar"
    const applySelector = '.js-btn-apply, button, a';
    const buttons = await page.$$(applySelector);
    let applyBtnClicked = false;

    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.toLowerCase().includes('aplicar')) {
        await btn.click();
        applyBtnClicked = true;
        break;
      }
    }

    if (!applyBtnClicked) {
      throw new Error('No se encontró el botón de "Aplicar" en la página.');
    }

    await delay(3000); // Esperar transiciones de postulación

    // 4. Escribir carta de presentación si la requiere
    const textareaSelector = 'textarea';
    const textareas = await page.$$(textareaSelector);
    if (textareas.length > 0) {
      console.log('[Autocontact] Generando propuesta hiper-personalizada con Gemini...');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Redacta una postulación y propuesta de valor de desarrollo y diseño web para el cliente "${lead.nombre_negocio}".
Detalles de la oferta/empresa: "${lead.gap_detectado || ''}".
Nicho del cliente: "${lead.nicho || ''}".

La propuesta debe ser de parte de Jesús Omar Martínez, Creative Director de JOM Studio (desarrollo creativo web premium, alta gama, e-commerce, WebGL).
Debe:
1. Ser corta, directa y persuasiva para canales de chat (máximo 120 palabras).
2. Explicar específicamente por qué les escribimos basado en su oferta/brecha tecnológica.
3. Indicar por qué podemos trabajar juntos y cómo nuestra experiencia premium aporta valor real.
4. Firmar como Jesús Omar Martínez, Creative Director de JOM Studio.
Usa tono profesional pero atrevido y directo, sin emojis excesivos.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const pitch = response.text?.trim() || 'Hola, vi su oferta...';
      
      await page.type(textareaSelector, pitch, { delay: 10 });
      await delay(1000);
      
      // Enviar
      const finalButtons = await page.$$('button');
      for (const btn of finalButtons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text.toLowerCase().includes('enviar') || text.toLowerCase().includes('postular') || text.toLowerCase().includes('continuar')) {
          await btn.click();
          break;
        }
      }
    }

    await delay(4000);

    // Actualizar estado
    await updateLeadState(lead.nombre_negocio, 'contactado', {
      fecha_contacto: new Date().toISOString(),
      origen: 'Computrabajo Auto-Contact'
    });

    if (global.io) {
      global.io.emit('leads_updated');
    }

    return { success: true, message: '¡Postulación completada con éxito!' };

  } catch (err) {
    console.error('[Autocontact] Error durante el proceso:', err.message);
    throw err;
  } finally {
    await delay(2000);
    await browser.close();
  }
}
