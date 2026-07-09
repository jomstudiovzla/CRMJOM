/**
 * POST /api/postulaciones/autoapply
 * Busca ofertas en Computrabajo y postula automáticamente usando la sesión Google activa.
 *
 * REQUISITO: Chrome debe estar corriendo con sesión Google activa.
 * Llama a "Abrir Sesiones" desde el CRM primero si no lo está.
 */
import { NextResponse } from 'next/server';
import { addPostulacion, getStats } from '@/lib/postulacionesStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min timeout para postulaciones masivas

const CATEGORIAS = {
  'director-creativo':  'https://co.computrabajo.com/trabajo-de-director-creativo',
  'desarrollador-web':  'https://co.computrabajo.com/trabajo-de-desarrollador-web',
  'diseno-grafico':     'https://co.computrabajo.com/trabajo-de-diseno-grafico',
  'marketing-digital':  'https://co.computrabajo.com/trabajo-de-marketing-digital',
  'programador':        'https://co.computrabajo.com/trabajo-de-programador',
  'community-manager':  'https://co.computrabajo.com/trabajo-de-community-manager',
  'ui-ux':              'https://co.computrabajo.com/trabajo-de-diseno-ux-ui',
  'wordpress':          'https://co.computrabajo.com/trabajo-de-wordpress',
  'react':              'https://co.computrabajo.com/trabajo-de-react',
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));

export async function POST(req) {
  try {
    const {
      categorias = ['desarrollador-web', 'diseno-grafico', 'marketing-digital'],
      maxPerCategoria = 5,
    } = await req.json();

    // Importar dinámicamente para evitar problemas con SSR
    const { getSharedBrowser, ensureComputrabajoSession, isChromeRunning } = await import('@/lib/browserManager');

    // VERIFICAR que Chrome esté corriendo con sesión activa
    const chromeUp = await isChromeRunning();
    if (!chromeUp) {
      return NextResponse.json({
        success: false,
        error: 'Chrome no está corriendo. Ve al CRM → Mails → "Abrir Sesiones" primero.',
      }, { status: 503 });
    }

    const browser = await getSharedBrowser(false); // conectar al existente
    const results = [];
    const errors = [];

    // PASO 1: Verificar sesión de Computrabajo una sola vez
    const sessionPage = await browser.newPage();
    const sessionOk = await ensureComputrabajoSession(sessionPage);
    await sessionPage.close().catch(() => {});

    if (!sessionOk) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo iniciar sesión en Computrabajo con Google. Ve al CRM → "Abrir Sesiones" e inicia sesión manualmente.',
      }, { status: 401 });
    }

    console.log('[AutoApply] ✅ Sesión Computrabajo confirmada. Iniciando postulaciones...');
    if (global.io) global.io.emit('autoapply_started', { categorias, maxPerCategoria });

    // PASO 2: Iterar categorías
    for (const cat of categorias) {
      const listUrl = CATEGORIAS[cat];
      if (!listUrl) { errors.push(`Categoría desconocida: ${cat}`); continue; }

      let listPage;
      try {
        listPage = await browser.newPage();
        await listPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        await listPage.goto(listUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await delay(2500);

        // Extraer ofertas no aplicadas
        const ofertas = await listPage.evaluate((max) => {
          const items = [];
          // Selectores de Computrabajo para tarjetas de oferta
          const cards = document.querySelectorAll(
            'article.box_offer, .offer_item, article[class*="offer"], div[class*="job-item"], .offerBlock'
          );

          for (const card of cards) {
            if (items.length >= max) break;

            // Saltar si ya fue postulado
            const applied = card.querySelector('[class*="applied"], [class*="postulado"], .inscrito, .applied');
            if (applied) continue;

            const titleEl = card.querySelector('h2 a, h3 a, a[class*="title"], a[title], .title-offer a');
            if (!titleEl || !titleEl.href) continue;

            const companyEl = card.querySelector('[class*="company"], [class*="empresa"], .company-name, span[itemprop="name"]');
            const link = titleEl.href;

            // Excluir links que ya hemos procesado o que no son ofertas
            if (!link.includes('computrabajo.com')) continue;

            items.push({
              puesto: titleEl.textContent?.trim() || titleEl.title || 'Sin título',
              empresa: companyEl?.textContent?.trim() || 'Sin especificar',
              link,
            });
          }
          return items;
        }, maxPerCategoria);

        console.log(`[AutoApply] ${cat}: ${ofertas.length} ofertas encontradas`);
        if (global.io) global.io.emit('autoapply_progress', { cat, found: ofertas.length });

        // PASO 3: Postular a cada oferta
        for (const oferta of ofertas) {
          if (!oferta.link) continue;

          let jobPage;
          try {
            jobPage = await browser.newPage();
            await jobPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36');
            await jobPage.goto(oferta.link, { waitUntil: 'networkidle2', timeout: 25000 });
            await delay(2000);

            // Verificar si ya está postulado
            const alreadyApplied = await jobPage.evaluate(() => {
              const body = document.body.textContent.toLowerCase();
              return body.includes('ya te has postulado') ||
                     body.includes('ya aplicaste') ||
                     body.includes('inscrito') ||
                     !!document.querySelector('.applied, .postulado, [class*="applied"]');
            }).catch(() => false);

            if (alreadyApplied) {
              console.log(`[AutoApply] Ya postulado: ${oferta.puesto}`);
              await jobPage.close().catch(() => {});
              continue;
            }

            // Buscar botón "Aplicar" / "Postularme"
            let applied = false;
            const selectors = [
              '.js-btn-apply', '#btn-apply', 'a.btn-apply',
              'button.btn-apply', '.apply-btn', '#applyBtn',
            ];

            for (const sel of selectors) {
              const btn = await jobPage.$(sel);
              if (btn) {
                const isVisible = await jobPage.evaluate(el => {
                  const rect = el.getBoundingClientRect();
                  return rect.width > 0 && rect.height > 0;
                }, btn);
                if (isVisible) { await btn.click(); applied = true; break; }
              }
            }

            if (!applied) {
              const allBtns = await jobPage.$$('a, button');
              for (const btn of allBtns) {
                const text = await jobPage.evaluate(el => el.textContent?.toLowerCase() || '', btn);
                if (['aplicar', 'postularme', 'postular ahora', 'inscribirme', 'apply'].some(w => text.includes(w))) {
                  const isVisible = await jobPage.evaluate(el => {
                    const rect = el.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                  }, btn);
                  if (isVisible) { await btn.click(); applied = true; break; }
                }
              }
            }

            if (!applied) {
              errors.push(`Sin botón aplicar: ${oferta.puesto} (${oferta.link})`);
              await jobPage.close().catch(() => {});
              continue;
            }

            await delay(2500);

            // Verificar formulario y llenarlo si existe
            let submitted = false;
            const hasForm = await jobPage.$('form, [class*="modal"], [class*="form-group"]').then(el => !!el).catch(() => false);

            if (hasForm) {
              // Importar lógica de formulario desde el bot principal
              const { autoContactComputrabajo } = await import('@/lib/autoContactComputrabajo');
              // Sólo rellenar los inputs del form actual (no navegar de nuevo)
              try {
                const inputs = await jobPage.$$('input[type="text"], input[type="number"], input[type="tel"], textarea, select');
                for (const input of inputs) {
                  const tag = await jobPage.evaluate(el => el.tagName.toLowerCase(), input);
                  const type = await jobPage.evaluate(el => el.type || '', input);
                  const placeholder = await jobPage.evaluate(el => el.placeholder || el.name || '', input);

                  if (tag === 'select') {
                    const options = await jobPage.evaluate(el =>
                      Array.from(el.options).map(o => o.text), input
                    );
                    if (options.length > 1) {
                      await jobPage.evaluate(el => { el.selectedIndex = 1; el.dispatchEvent(new Event('change')); }, input);
                    }
                  } else {
                    const val = await jobPage.evaluate(el => el.value, input);
                    if (!val) {
                      await input.type('Sí');
                    }
                  }
                }

                // Submit
                const submitBtn = await jobPage.$('button[type="submit"], input[type="submit"], button.btn-primary');
                if (submitBtn) { await submitBtn.click(); submitted = true; }
              } catch {}
            } else {
              // Sin formulario extra → la postulación se confirma directamente
              submitted = true;
            }

            // Verificar confirmación
            await delay(1500);
            const confirmed = await jobPage.evaluate(() => {
              const body = document.body.textContent.toLowerCase();
              return body.includes('¡aplicaste') || body.includes('postulación enviada') ||
                     body.includes('gracias por aplicar') || body.includes('aplicaste correctamente') ||
                     body.includes('inscripción exitosa');
            }).catch(() => submitted);

            // Registrar en store → broadcast SSE instantáneo
            const postulacion = addPostulacion({
              plataforma: 'computrabajo',
              puesto: oferta.puesto,
              empresa: oferta.empresa,
              link: oferta.link,
              estado: confirmed ? 'enviada' : 'pendiente',
              notas: `Categoría: ${cat}${confirmed ? ' · Confirmada' : ' · Sin confirmar'}`,
            });

            results.push({ ...oferta, confirmed, id: postulacion.id });
            console.log(`[AutoApply] ✅ ${oferta.puesto} @ ${oferta.empresa} — ${confirmed ? 'CONFIRMADA' : 'PENDIENTE'}`);
            if (global.io) global.io.emit('postulacion_nueva', postulacion);

          } catch (jobErr) {
            errors.push(`Error en ${oferta.puesto}: ${jobErr.message}`);
            console.error(`[AutoApply] Error:`, jobErr.message);
          } finally {
            if (jobPage) await jobPage.close().catch(() => {});
          }

          // Pausa humana entre postulaciones
          await delay(2000 + Math.random() * 2000);
        }

      } catch (catErr) {
        errors.push(`Error en categoría ${cat}: ${catErr.message}`);
      } finally {
        if (listPage) await listPage.close().catch(() => {});
      }
    }

    const stats = getStats();
    if (global.io) {
      global.io.emit('autoapply_done', { applied: results.length, errors: errors.length });
      global.io.emit('postulaciones_updated', stats);
    }

    return NextResponse.json({
      success: true,
      applied: results.length,
      errors: errors.length,
      results,
      errorList: errors,
      stats,
    });

  } catch (e) {
    console.error('[AutoApply] Error general:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
