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
    return { intent: 'mas_informacion', priority: 'media' };
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Eres un cerrador de ventas B2B y asistente personal de JOM Studio. 
Clasifica la intención y urgencia del correo recibido.

Responde EXCLUSIVAMENTE en formato JSON válido con la siguiente estructura:
{
  "intent": "una de las categorias validas",
  "priority": "alta, media o baja"
}

Categorías válidas para "intent":
- interesado (intención de pago, reunión, cotización)
- mas_informacion (preguntas, dudas, pide detalles)
- no_interesado (rechazo cordial)
- importante (temas de trabajo, audiovisuales, diseño, branding, clientes potenciales nuevos)
- spam (ofertas de empleo tipo Computrabajo, newsletters, promociones no solicitadas, basura)

Prioridades para "priority":
- alta (clientes VIP, dinero en mesa, problemas graves, oportunidad inmediata)
- media (dudas estándar, seguimientos)
- baja (spam, rechazos, newsletters)

Correo:
"""
${emailBody.slice(0, 4000)}
"""`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    const intent = parsed.intent?.toLowerCase().replace(/[^a-z_]/g, '') || 'mas_informacion';
    const priority = parsed.priority?.toLowerCase() || 'media';
    
    const validIntents = [...AI_CATEGORY_KEYS, 'importante', 'spam'];
    const finalIntent = validIntents.includes(intent) ? intent : 'mas_informacion';
    
    return { intent: finalIntent, priority };
  } catch (error) {
    console.error('[JOM CRM] Error Gemini:', error.message);
    return { intent: 'mas_informacion', priority: 'media' };
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
    descripcion_empresa: 'Empresa proveedora de servicios y contenidos.',
    historia: 'Trayectoria activa',
    paleta_colores: 'Por definir / colores corporativos estándar',
    nicho_detectado: 'Servicios',
    generatedByAi: false,
  };

  if (!apiKey || !text || text.length < 50) {
    return fallback;
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Eres un experto en UI/UX, branding y marketing digital B2B de JOM Studio (Digital Alchemy).
Analiza el contenido del sitio web de "${company}" (${url}) para extraer la siguiente información de perfil.

Responde EXCLUSIVAMENTE en formato JSON válido con la siguiente estructura (no agregues bloque de código markdown, solo el JSON plano):
{
  "gap_detectado": "Fallo crítico directo de 1 oración relacionado con conversiones o UI/UX",
  "solucion_jom": "Servicio de JOM Studio que resuelve el gap en 1 oración",
  "descripcion_empresa": "Resumen corto y profesional de qué es la empresa y a qué se dedica",
  "historia": "Desde cuándo opera o su trayectoria/antigüedad si la indica (si no se especifica, pon 'Trayectoria activa' o haz una estimación)",
  "paleta_colores": "Los colores principales de su marca observados o recomendados según su rubro (ej. Negro, oro y acentos grises)",
  "nicho_detectado": "Nicho principal (ej. Inmobiliaria, E-commerce, Agencia, etc.)"
}

Contenido del sitio:
"""
${text.slice(0, 8000)}
"""`;

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
      descripcion_empresa: parsed.descripcion_empresa || fallback.descripcion_empresa,
      historia: parsed.historia || fallback.historia,
      paleta_colores: parsed.paleta_colores || fallback.paleta_colores,
      nicho_detectado: parsed.nicho_detectado || fallback.nicho_detectado,
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

export async function generateWhatsAppDraft({ lead }) {
  const apiKey = getGeminiApiKey();
  const company = lead?.nombre_negocio || 'su negocio';
  const gap = lead?.gap_detectado || 'mejoras en su presencia digital';
  
  if (!apiKey) {
    return {
      body: `Hola, ¿cómo están? Me comunico de parte de JOM Studio por el puesto/proyecto de ${lead.nicho || 'desarrollo/diseño'} que tienen abierto en ${company}. ¿Cuándo tendrían 5 minutos para conversar? Un saludo, Jesús Omar Martínez.`,
      generatedByAi: false
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Eres el cerrador de ventas y director creativo de JOM Studio, Jesús Omar Martínez. 
Redacta un mensaje de WhatsApp directo, profesional y corto (máximo 3 párrafos cortos) para contactar a un lead frío/cliente potencial.

Reglas de WhatsApp de JOM Studio:
- Tono directo, persuasivo e informal pero sumamente profesional.
- Español natural de Latinoamérica (Venezuela/LATAM).
- Sin lenguaje corporativo aburrido ni rodeos.
- Menciona brevemente el puesto o necesidad detectada (${gap}).
- Ofrece una auditoría rápida o una llamada directa de 10 minutos.
- Incluye un saludo directo al grano y firma al final como "Jesús Omar Martínez, Creative Director de JOM Studio".
- Usa emojis con extrema moderación (máximo 1 o 2 en todo el mensaje, por ejemplo un check o un saludo).
- Mantén el formato legible con espacios entre párrafos para lectura móvil rápida.

Datos de la empresa:
Nombre de negocio: ${company}
Nicho de servicio: ${lead.nicho || 'General'}
Gap detectado: ${gap}

Redacta únicamente el cuerpo del mensaje de WhatsApp.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return {
      body: response.text?.trim() || '',
      generatedByAi: true
    };
  } catch (error) {
    console.error('[JOM CRM] Error generando WhatsApp draft:', error.message);
    return {
      body: `Hola, ¿cómo están? Me comunico de parte de JOM Studio por el puesto/proyecto de ${lead.nicho || 'desarrollo/diseño'} que tienen abierto en ${company}. ¿Cuándo tendrían 5 minutos para conversar? Un saludo, Jesús Omar Martínez.`,
      generatedByAi: false
    };
  }
}