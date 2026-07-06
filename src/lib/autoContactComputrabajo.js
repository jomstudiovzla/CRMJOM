import puppeteer from 'puppeteer';
import { updateLeadState } from './leadsStore';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function autoContactComputrabajo(lead, username, password) {
  if (!lead.link) throw new Error('El lead no tiene un enlace de postulación.');
  if (!username || !password) throw new Error('Credenciales de Computrabajo no configuradas.');

  // Extraer dominio del link (ej. co.computrabajo.com)
  const urlObj = new URL(lead.link);
  const domain = urlObj.hostname;

  console.log(`[Autocontact] Iniciando Puppeteer para Computrabajo en ${domain}`);

  const browser = await puppeteer.launch({
    headless: false, // Visible para resolver Captchas en el login la primera vez
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();

  try {
    // 1. Ir al login de Computrabajo
    const loginUrl = `https://${domain}/login`;
    await page.goto(loginUrl, { waitUntil: 'networkidle2' });

    // Rellenar email
    const emailSelector = 'input[type="email"], #LoginModel_Email';
    await page.waitForSelector(emailSelector, { timeout: 10000 });
    await page.type(emailSelector, username, { delay: 50 });

    // Rellenar password
    const passSelector = 'input[type="password"], #LoginModel_Password';
    await page.type(passSelector, password, { delay: 50 });

    // Click ingresar
    const submitBtn = 'button[type="submit"], #btnIngresar';
    await page.click(submitBtn);

    // Esperar a que loguee
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    await delay(2000);

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
      const pitch = `Hola,

Vi su oferta para ${lead.nicho || 'este proyecto'} y detecté oportunidades de mejora en su presencia digital.
En JOM Studio nos dedicamos a crear desarrollo creativo web premium de alta gama.

¿Cuándo tendrían 10 minutos para una llamada o auditoría rápida de sus canales?

Jesús Omar Martínez,
Creative Director de JOM Studio.`;
      
      await page.type(textareaSelector, pitch, { delay: 20 });
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
