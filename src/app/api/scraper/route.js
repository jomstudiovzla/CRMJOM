import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
import Parser from 'rss-parser';
import { getAllScraperQueries } from '@/lib/nichos';
import { appendEnrichedLeads } from '@/lib/leadsStore';
import { checkPhase2Env } from '@/lib/envCheck';

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