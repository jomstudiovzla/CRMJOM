/** Tier S — constante global de nichos JOM Studio (Fase 2) */
export const TIER_S_NICHOS = {
  DSGN: {
    id: 'DSGN',
    label: 'Diseño UI/UX y Desarrollo Web',
    case: 'CASE_020',
    keywords: {
      en: ['UI UX Design', 'Web Development', 'Frontend Developer'],
      es: ['Diseño UI UX', 'Desarrollo Web', 'Diseñador Web'],
    },
  },
  VFX: {
    id: 'VFX',
    label: 'Edición de Video, Motion Graphics y Postproducción',
    case: 'CASE_021',
    keywords: {
      en: ['Video Editing', 'Motion Graphics', 'Post Production'],
      es: ['Edición de Video', 'Motion Graphics', 'Postproducción'],
    },
  },
  PLAY: {
    id: 'PLAY',
    label: 'Gamificación, WebGL y Lógica Interactiva',
    case: 'CASE_022',
    keywords: {
      en: ['Gamification', 'WebGL', 'Interactive Development'],
      es: ['Gamificación', 'Desarrollo Interactivo', 'WebGL'],
    },
  },
  BRAND: {
    id: 'BRAND',
    label: 'Identidad de Marca Corporativa',
    case: 'CASE_023',
    keywords: {
      en: ['Brand Identity', 'Corporate Branding', 'Logo Design'],
      es: ['Identidad de Marca', 'Branding Corporativo', 'Diseño de Logo'],
    },
  },
  PROP: {
    id: 'PROP',
    label: 'Inmobiliarias y Plataformas PROP',
    case: 'CASE_015',
    keywords: {
      en: ['Real Estate Platform', 'Property Portal'],
      es: ['Plataforma Inmobiliaria', 'Portal de Propiedades'],
    },
  },
};

export const AI_CATEGORIES = {
  interesado: { label: 'Interesado', className: 'ai-interesado' },
  mas_informacion: { label: 'Más información', className: 'ai-mas-info' },
  no_interesado: { label: 'No interesado', className: 'ai-no-interesado' },
};

export const AI_CATEGORY_KEYS = Object.keys(AI_CATEGORIES);

export function getAllScraperQueries() {
  const queries = [];
  for (const niche of Object.values(TIER_S_NICHOS)) {
    for (const lang of ['en', 'es']) {
      for (const keyword of niche.keywords[lang]) {
        queries.push({
          keyword,
          paquete: niche.id,
          idioma: lang,
          case_referencia: niche.case,
          label: niche.label,
        });
      }
    }
  }
  return queries;
}

export function detectIdioma(text = '') {
  const esMarkers = /\b(hola|gracias|necesito|busco|empresa|servicio|cotización)\b/i;
  return esMarkers.test(text) ? 'es' : 'en';
}