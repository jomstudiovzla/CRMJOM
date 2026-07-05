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
        'User-Agent': 'JOM-Studio-CRM/1.0 (Website Audit Bot)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} al acceder a ${normalized}`);
    }

    const contentType = res.headers.get('content-type') || '';
    const raw = await res.text();

    if (contentType.includes('text/html') || raw.includes('<html')) {
      return { url: normalized, text: stripHtmlToText(raw) };
    }

    return { url: normalized, text: raw.slice(0, MAX_TEXT_LENGTH) };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Timeout al cargar ${normalized}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function slugifyCompanyName(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}