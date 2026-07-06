const FETCH_TIMEOUT_MS = 15000;
const MAX_TEXT_LENGTH = 12000;

export function normalizeUrl(input) {
  if (!input || typeof input !== 'string') return null;
  let url = input.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('.')) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function stripHtmlToText(html) {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

export async function fetchWebsiteText(url) {
  const normalized = normalizeUrl(url);
  if (!normalized) {
    throw new Error('URL inválida');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(normalized, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} al acceder a ${normalized}`);
    }

    const contentType = res.headers.get('content-type') || '';
    const raw = await res.text();
    const contactInfo = extractContactInfo(raw);

    if (contentType.includes('text/html') || raw.includes('<html')) {
      return { 
        url: normalized, 
        text: stripHtmlToText(raw),
        email: contactInfo.email,
        telefono: contactInfo.telefono
      };
    }

    return { 
      url: normalized, 
      text: raw.slice(0, MAX_TEXT_LENGTH),
      email: contactInfo.email,
      telefono: contactInfo.telefono
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Timeout al cargar ${normalized}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function extractContactInfo(html) {
  const info = {
    email: '',
    telefono: ''
  };

  if (!html) return info;

  // 1. Buscar emails en enlaces mailto: o texto plano
  const mailtoMatch = html.match(/href="mailto:([^"]+)"/i);
  if (mailtoMatch) {
    info.email = mailtoMatch[1].split('?')[0].trim();
  } else {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = html.match(emailRegex);
    if (emails) {
      // Filtrar extensiones comunes falsas
      const clean = emails.filter(e => !/\.(png|jpg|jpeg|gif|webp|svg|js|css|woff)$/i.test(e));
      if (clean.length > 0) info.email = clean[0];
    }
  }

  // 2. Buscar teléfonos en enlaces tel: o wa.me o api.whatsapp
  const telMatch = html.match(/href="tel:([^"\s>]+)"/i);
  if (telMatch) {
    info.telefono = telMatch[1].trim();
  } else {
    // Buscar links de WhatsApp con código de país
    const waMatch = html.match(/href="https:\/\/(wa\.me|api\.whatsapp\.com\/send\?phone=)([^"&]+)"/i);
    if (waMatch) {
      const extracted = waMatch[2].replace(/[^0-9]/g, '');
      if (extracted.length >= 8) {
        info.telefono = '+' + extracted;
      }
    }
  }

  return info;
}

export function slugifyCompanyName(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}