import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
import Parser from 'rss-parser';
import { getAllScraperQueries } from '@/lib/nichos';
import { appendEnrichedLeads } from '@/lib/leadsStore';
import { checkPhase2Env } from '@/lib/envCheck';
import { autoContactComputrabajo } from '@/lib/autoContactComputrabajo';
import { autoContactLinkedin } from '@/lib/autoContactLinkedin';
import { getCredentials } from '@/lib/credentials';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
  },
});

const JOBS_PER_QUERY = 2;

export async function GET() {
  checkPhase2Env();

  try {
    const queries = getAllScraperQueries();
    const newLeads = [];
    const seenLinks = new Set();

    for (const query of queries) {
      const feedUrl = `https://www.upwork.com/ab/feed/jobs/rss?q=${encodeURIComponent(query.keyword)}&sort=recency`;

      try {
        const feed = await parser.parseURL(feedUrl);
        const recentJobs = (feed.items || []).slice(0, JOBS_PER_QUERY);

        for (const job of recentJobs) {
          if (!job.link || seenLinks.has(job.link)) continue;
          seenLinks.add(job.link);

          const title = (job.title || 'Upwork Job').slice(0, 80);
          newLeads.push({
            nombre_negocio: `[Upwork] ${title}`,
            email: '',
            telefono: '',
            web: job.link,
            link: job.link,
            estado_pipeline: 'nuevo',
            calidad_lead: 'media',
            origen: 'Upwork Scraper',
            nicho: query.label,
            paquete: query.paquete,
            paquete_jom: query.paquete,
            idioma: query.idioma,
            case_referencia: query.case_referencia,
            gap_detectado: job.contentSnippet?.slice(0, 200) || job.content?.slice(0, 200) || 'Oferta freelance detectada vía RSS',
            fecha_contacto: new Date().toISOString(),
            categoria_ia: null,
          });
        }
      } catch (e) {
        console.warn(`[JOM Scraper] Feed falló (${query.keyword}):`, e.message);
      }
    }

    // --- NUEVO AGRESIVO: Scraping de Freelancer.com y Workana (vía RSS y Búsquedas HTML) ---
    const cheerio = require('cheerio');
    const fetchWithHeaders = async (url) => {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
          },
          signal: AbortSignal.timeout(10000)
        });
        return res.ok ? await res.text() : '';
      } catch (e) {
        return '';
      }
    };

    for (const query of queries) {
      try {
        // 1. Computrabajo (Búsqueda agresiva)
        const ctUrl = `https://co.computrabajo.com/trabajo-de-${encodeURIComponent(query.keyword.replace(/ /g, '-'))}`;
        const ctHtml = await fetchWithHeaders(ctUrl);
        if (ctHtml) {
          const $ = cheerio.load(ctHtml);
          $('.box_offer').slice(0, JOBS_PER_QUERY).each((_, el) => {
            const link = 'https://co.computrabajo.com' + ($(el).find('.js-o-link').attr('href') || '');
            const title = $(el).find('.js-o-link').text().trim();
            const desc = $(el).find('p').text().trim();
            
            if (title && link && !seenLinks.has(link)) {
              seenLinks.add(link);
              newLeads.push({
                nombre_negocio: `[Computrabajo] ${title.slice(0, 70)}`,
                email: '', telefono: '', web: link, link: link,
                estado_pipeline: 'nuevo', calidad_lead: 'media', origen: 'Computrabajo Scraper',
                nicho: query.label, paquete: query.paquete, paquete_jom: query.paquete, idioma: 'ES',
                case_referencia: query.case_referencia, gap_detectado: desc.slice(0, 200),
                fecha_contacto: new Date().toISOString(), categoria_ia: null, prioridad: 'baja'
              });
            }
          });
        }
      } catch(e) {
        console.warn('[JOM Scraper] Computrabajo falló:', e.message);
      }

      try {
        // 2. LinkedIn Guest Jobs (Búsqueda pública de empleo)
        const liUrl = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(query.keyword)}&location=Venezuela&start=0`;
        const liHtml = await fetchWithHeaders(liUrl);
        if (liHtml) {
          const $ = cheerio.load(liHtml);
          $('li').slice(0, JOBS_PER_QUERY).each((_, el) => {
            const rawLink = $(el).find('a.base-card__full-link').attr('href') || '';
            const link = rawLink.split('?')[0];
            const title = $(el).find('h3.base-search-card__title').text().trim();
            const company = $(el).find('h4.base-search-card__subtitle').text().trim();
            
            if (title && link && !seenLinks.has(link)) {
              seenLinks.add(link);
              newLeads.push({
                nombre_negocio: `[LinkedIn] ${company} - ${title.slice(0, 50)}`,
                email: '', telefono: '', web: link, link: link,
                estado_pipeline: 'nuevo', calidad_lead: 'media', origen: 'LinkedIn Scraper',
                nicho: query.label, paquete: query.paquete, paquete_jom: query.paquete, idioma: 'ES',
                case_referencia: query.case_referencia, gap_detectado: `Puesto de ${title} en ${company}`,
                fecha_contacto: new Date().toISOString(), categoria_ia: null, prioridad: 'baja'
              });
            }
          });
        }
      } catch(e) {
        console.warn('[JOM Scraper] LinkedIn guest jobs falló:', e.message);
      }
    }

    // WeWorkRemotely RSS (Trabajos de diseño internacionales, Fiverr/Freelancer proxy)
    const wwrFeeds = [
      'https://weworkremotely.com/categories/remote-design-jobs.rss',
      'https://weworkremotely.com/categories/remote-programming-jobs.rss',
      'https://www.freelancer.com/rss.xml' // Freelancer global feed
    ];
    for (const feedUrl of wwrFeeds) {
      try {
        const feed = await parser.parseURL(feedUrl);
        const recentJobs = (feed.items || []).slice(0, 5);
        for (const job of recentJobs) {
          const link = job.link || '';
          const title = job.title || '';
          if (title && link && !seenLinks.has(link)) {
            seenLinks.add(link);
            newLeads.push({
              nombre_negocio: `[Global] ${title.slice(0, 70)}`,
              email: '', telefono: '', web: link, link: link,
              estado_pipeline: 'nuevo', calidad_lead: 'media', origen: 'WWR/Freelancer RSS',
              nicho: 'DSGN', paquete: 'PROP', paquete_jom: 'PROP', idioma: 'EN',
              case_referencia: 'CASE_015 — Inmobiliaria Premium', gap_detectado: job.contentSnippet?.slice(0, 200) || 'Oferta freelance detectada',
              fecha_contacto: new Date().toISOString(), categoria_ia: null, prioridad: 'baja'
            });
          }
        }
      } catch(e) {
        console.warn('[JOM Scraper] RSS falló:', e.message);
      }
    }

    // --- NUEVO: Scraping de Reddit (Redes Sociales) ---
    const redditFeeds = [
      'https://www.reddit.com/r/forhire/new.rss',
      'https://www.reddit.com/r/VideoEditors_forhire/new.rss',
      'https://www.reddit.com/r/DesignJobs/new.rss'
    ];

    for (const feedUrl of redditFeeds) {
      try {
        const feed = await parser.parseURL(feedUrl);
        const recentJobs = (feed.items || []).slice(0, 15); // Traemos más para filtrar

        for (const job of recentJobs) {
          if (!job.link || seenLinks.has(job.link)) continue;
          
          const title = job.title || '';
          // Filtrar: solo queremos posts de gente contratando, no buscando empleo
          if (!title.toLowerCase().includes('[hiring]') && !title.toLowerCase().includes('hiring') && !title.toLowerCase().includes('busco')) continue;

          seenLinks.add(job.link);

          // Asignar nicho básico por la fuente o palabras clave
          let detectedNicho = 'DSGN';
          if (title.toLowerCase().includes('video') || title.toLowerCase().includes('edit')) detectedNicho = 'VFX';
          if (title.toLowerCase().includes('game') || title.toLowerCase().includes('play')) detectedNicho = 'PLAY';

          newLeads.push({
            nombre_negocio: `[Reddit] ${title.slice(0, 70)}...`,
            email: '',
            telefono: '',
            web: job.link,
            link: job.link,
            estado_pipeline: 'nuevo',
            calidad_lead: 'alta',
            origen: 'Reddit Scraper',
            nicho: detectedNicho,
            paquete: detectedNicho,
            paquete_jom: detectedNicho,
            idioma: 'EN',
            case_referencia: 'CASE_000',
            gap_detectado: job.contentSnippet?.slice(0, 200) || job.content?.slice(0, 200) || 'Lead extraído de Reddit',
            fecha_contacto: new Date().toISOString(),
            categoria_ia: null,
          });
          
          // Solo agregar 2 de reddit por ejecución para no saturar
          if (newLeads.filter(l => l.origen === 'Reddit Scraper').length >= 4) break;
        }
      } catch (e) {
        console.warn(`[JOM Scraper] Feed falló (Reddit):`, e.message);
      }
    }

    const added = appendEnrichedLeads(newLeads);

    // Disparar auto-aplicación en segundo plano de manera no bloqueante para Computrabajo y LinkedIn
    const { user: ctUser, pass: ctPass } = getCredentials('computrabajo');
    const { user: liUser, pass: liPass } = getCredentials('linkedin');

    const addedCtLeads = added.filter(l => l.link && l.link.includes('computrabajo'));
    if (ctUser && ctPass && addedCtLeads.length > 0) {
      for (const lead of addedCtLeads) {
        (async () => {
          try {
            console.log(`[Background Auto-Apply] Postulándose en Computrabajo para: ${lead.nombre_negocio}`);
            await autoContactComputrabajo(lead, ctUser, ctPass, true);
          } catch(err) {
            console.error(`[Background Auto-Apply Error Computrabajo] ${lead.nombre_negocio}:`, err.message);
          }
        })();
      }
    }

    const addedLiLeads = added.filter(l => l.link && l.link.includes('linkedin.com'));
    if (liUser && liPass && addedLiLeads.length > 0) {
      for (const lead of addedLiLeads) {
        (async () => {
          try {
            console.log(`[Background Auto-Apply] Postulándose en LinkedIn para: ${lead.nombre_negocio}`);
            await autoContactLinkedin(lead, liUser, liPass, true);
          } catch(err) {
            console.error(`[Background Auto-Apply Error LinkedIn] ${lead.nombre_negocio}:`, err.message);
          }
        })();
      }
    }

    if (global.io) {
      global.io.emit('leads_updated');
    }

    return NextResponse.json({
      success: true,
      added: added.length,
      scanned: queries.length,
      leads: added,
      message: added.length
        ? `${added.length} leads nuevos agregados desde Upwork RSS`
        : 'No hay leads nuevos (sin duplicados)',
    });
  } catch (error) {
    console.error('[JOM Scraper] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}