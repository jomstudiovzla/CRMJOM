import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { AI_CATEGORY_KEYS } from './nichos';
import { warnMissingEnv } from './envCheck';
import { getGeminiApiKey } from './envHelper';

function loadPlaybookExcerpt() {
  try {
    const playbookPath = path.resolve(process.cwd(), '..', 'playbook', '05-servicios-ofertas-b2b.md');
    if (!fs.existsSync(playbookPath)) return '';
    const content = fs.readFileSync(playbookPath, 'utf8');
    return content.slice(0, 1500);
  } catch {
    return '';
  }
}

export async function classifyEmailIntent(emailBody) {
  const apiKey = getGeminiApiKey();
  warnMissingEnv('GEMINI_API_KEY');

  if (!apiKey) {
    console.warn('[JOM CRM] Gemini no configurado — categoría por defecto: mas_informacion');
    return 'mas_informacion';
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Eres un cerrador de ventas B2B y asistente personal de JOM Studio. 
Clasifica la intención y relevancia del correo recibido.

Responde EXCLUSIVAMENTE con UNA de estas etiquetas (sin puntuación ni texto extra):
- interesado (intención de pago, reunión, cotización)
- mas_informacion (preguntas, dudas, pide detalles)
- no_interesado (rechazo cordial)
- importante (temas de trabajo, audiovisuales, diseño, branding, clientes potenciales nuevos)
- spam (ofertas de empleo tipo Computrabajo, newsletters, promociones no solicitadas, basura)

Correo:
"""
${emailBody.slice(0, 4000)}
"""`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const intent = response.text?.trim().toLowerCase().replace(/[^a-z_]/g, '');
    const validIntents = [...AI_CATEGORY_KEYS, 'importante', 'spam'];
    if (validIntents.includes(intent)) return intent;
    return 'mas_informacion';
  } catch (error) {
    console.error('[JOM CRM] Error Gemini:', error.message);
    return 'mas_informacion';
  }
}

const JOM_PLAYBOOK_RULES = `Reglas del Playbook JOM Studio (Digital Alchemy):
- Tono directo, persuasivo y profesional — sin rodeos ni lenguaje corporativo vacío.
- Firma siempre como Jesús Omar Martínez, Creative Director de JOM Studio.
- Ofrece auditorías gratuitas de UI/UX o llamadas cortas de 15 minutos.
- Conecta el gap detectado con un CASE de JOM (CASE_015 inmobiliaria, CASE_020 web/UI, CASE_021 video, CASE_022 interactivo, CASE_023 branding).
- CTA claro: reunión, auditoría o demo — nunca presionar.
- Español natural (Venezuela/LATAM). Sin emojis en el cuerpo del correo.
- Cierre con link: https://jomstudiovzla.github.io/Jomstudiopage/`;

export async function generateReplyDraft({ lead, messages }) {
  const apiKey = getGeminiApiKey();
  const company = lead?.nombre_negocio || 'la empresa';
  const playbookExcerpt = loadPlaybookExcerpt();
  const gap = lead?.gap_detectado || 'oportunidades de mejora en su presencia digital';

  const threadHistory = (messages || [])
    .slice()
    .sort((a, b) => new Date(a.sentAt || 0) - new Date(b.sentAt || 0))
    .map((m, i) => {
      const role = m.status === 'received' || m.direction === 'inbound' ? 'CLIENTE' : 'JOM STUDIO';
      return `--- Mensaje ${i + 1} [${role}] (${m.sentAt || 'sin fecha'}) ---
Asunto: ${m.subject || '(sin asunto)'}
${(m.body || '').slice(0, 2000)}`;
    })
    .join('\n\n');

  if (!apiKey) {
    const { buildFollowUpEmail } = await import('./emailTemplates');
    return { ...buildFollowUpEmail(lead || { nombre_negocio: company }), generatedByAi: false };
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Eres el Ghostwriter de ventas B2B de JOM Studio. Redacta la SIGUIENTE respuesta de correo para cerrar o avanzar la conversación.

${JOM_PLAYBOOK_RULES}

Extracto del Playbook JOM (servicios B2B):
"""
${playbookExcerpt || 'JOM Studio ofrece desarrollo web, UI/UX, branding, video y plataformas a medida.'}
"""

Datos del lead:
- Empresa: ${company}
- Email: ${lead?.email || 'desconocido'}
- Gap detectado: ${gap}
- Estado pipeline: ${lead?.estado_pipeline || lead?.categoria_ia || 'mas_informacion'}

Historial del hilo:
"""
${threadHistory || 'Sin historial previo — es un primer contacto de seguimiento.'}
"""

Devuelve EXCLUSIVAMENTE un JSON (sin markdown) con esta estructura:
{
  "subject": "Asunto del correo",
  "body": "Cuerpo completo del correo con saludo, propuesta y firma"
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text?.trim() || '{}';
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    if (!parsed.body) throw new Error('Respuesta vacía de Gemini');

    return {
      subject: parsed.subject || `Re: ${company} — JOM Studio`,
      body: parsed.body,
      generatedByAi: true,
    };
  } catch (error) {
    console.error('[JOM CRM] Error Ghostwriter:', error.message);
    const { buildFollowUpEmail } = await import('./emailTemplates');
    return { ...buildFollowUpEmail(lead || { nombre_negocio: company }), generatedByAi: false };
  }
}

export async function auditWebsiteForGap({ url, text, companyName }) {
  const apiKey = getGeminiApiKey();
  const company = companyName || 'la empresa';

  const fallback = {
    gap_detectado: `La web de ${company} no comunica con claridad su propuesta de valor — pierde conversiones en la primera visita.`,
    solucion_jom: 'Auditoría UI/UX + rediseño web con CASE_020 (Next.js, conversión optimizada).',
    generatedByAi: false,
  };

  if (!apiKey || !text || text.length < 50) {
    return fallback;
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Eres un experto en UI/UX y Marketing Digital trabajando para JOM Studio (agencia de Digital Alchemy en Venezuela).

Evalúa el contenido extraído del sitio web de "${company}" (${url}).

Objetivo:
1. Detecta 1 fallo crítico (Gap) que impacte conversiones, confianza o captación de leads.
2. Propón 1 solución concreta que JOM Studio pueda vender (desarrollo web, branding, video, plataforma).

Contenido del sitio:
"""
${text.slice(0, 8000)}
"""

Devuelve EXCLUSIVAMENTE JSON (sin markdown):
{
  "gap_detectado": "1 oración directa describiendo el fallo crítico",
  "solucion_jom": "1 oración con el servicio CASE de JOM que resuelve el gap"
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const raw = response.text?.trim() || '{}';
    const jsonStr = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    return {
      gap_detectado: parsed.gap_detectado || fallback.gap_detectado,
      solucion_jom: parsed.solucion_jom || fallback.solucion_jom,
      generatedByAi: true,
    };
  } catch (error) {
    console.error('[JOM CRM] Error Website Audit:', error.message);
    return fallback;
  }
}

export async function guessCompanyDomain(companyName) {
  const { slugifyCompanyName } = await import('./websiteUtils');
  const slug = slugifyCompanyName(companyName);

  if (!slug) return { url: null, confidence: 'none' };

  const heuristicUrl = `https://www.${slug}.com`;
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    return { url: heuristicUrl, confidence: 'low' };
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Dada la empresa "${companyName}", devuelve su sitio web oficial más probable.

Responde EXCLUSIVAMENTE JSON:
{
  "url": "https://dominio.com o null si no puedes inferirlo",
  "confidence": "high|medium|low"
}

Prioriza dominios .com, .com.ve, .ve. Si no hay certeza, devuelve url: null.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const raw = response.text?.trim() || '{}';
    const jsonStr = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    if (parsed.url && parsed.url !== 'null') {
      return { url: parsed.url, confidence: parsed.confidence || 'medium' };
    }
    return { url: heuristicUrl, confidence: 'low' };
  } catch (error) {
    console.error('[JOM CRM] Error Domain Guess:', error.message);
    return { url: heuristicUrl, confidence: 'low' };
  }
}

export async function extractCompanyFromEmail(emailBody) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurado');

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Eres un investigador corporativo de JOM Studio. Lee el siguiente correo (frecuentemente de portales como Computrabajo) y extrae los datos de la EMPRESA ORIGINAL (el empleador real), NO los datos del portal de empleo.

Si no encuentras el nombre de la empresa real o está oculta, devuelve "No detectado" en el nombre.

Devuelve EXCLUSIVAMENTE un JSON con esta estructura exacta (sin markdown, sin comillas extra, solo JSON puro):
{
  "nombre_negocio": "Nombre de la empresa real",
  "email": "correo_de_contacto@empresa.com o null",
  "telefono": "numero o null",
  "gap_detectado": "Pequeño resumen de 1 oración del puesto que buscan o el problema que tienen"
}

Correo:
"""
${emailBody.slice(0, 4000)}
"""`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    const text = response.text?.trim() || '{}';
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('[JOM CRM] Error Gemini Extraction:', error.message);
    throw error;
  }
}