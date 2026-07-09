/**
 * answerEngine.js — Motor de Respuestas Inteligente
 * CRM JOM Studio — Jesús Omar Martínez
 *
 * FLUJO:
 * pregunta → classifyQuestion → buildAnswer → matchOption
 *
 * REGLAS:
 * - Leer la pregunta COMPLETA antes de responder
 * - Si se espera respuesta larga → párrafo completo (nunca cortado)
 * - Si se espera número → solo número
 * - Si se espera sí/no → exactamente Sí o No
 * - Responder en el idioma de la pregunta (español o inglés)
 * - NUNCA devolver vacío en textareas
 * - NUNCA inventar datos no confirmados
 */

import { PROFILE, RESPUESTAS, RESPUESTAS_COMUNES } from './profileData';

/* ═══════════════════════════════════════════════════════════════════════════
   DETECTAR IDIOMA DE LA PREGUNTA
   ═══════════════════════════════════════════════════════════════════════════ */
export function detectLanguage(text) {
  const t = text.toLowerCase();
  const enWords = [
    'your', 'you', 'have', 'what', 'how', 'describe', 'experience',
    'please', 'tell', 'about', 'are', 'can', 'would', 'the', 'which',
    'do you', 'will you', 'years of', 'skill', 'tool', 'role',
  ];
  const enCount = enWords.filter(w => t.includes(w)).length;
  return enCount >= 2 ? 'en' : 'es';
}

/* ═══════════════════════════════════════════════════════════════════════════
   CLASIFICAR PREGUNTA
   Detecta de qué trata y qué tipo de respuesta se espera
   ═══════════════════════════════════════════════════════════════════════════ */
export function classifyQuestion(question, fieldType = 'text') {
  const q   = question.toLowerCase().trim();
  const lng = detectLanguage(question);

  // ── Datos personales ──────────────────────────────────────────────────────
  if ((q.includes('nombre') || q.includes('name')) && !q.includes('empresa') && !q.includes('company')) return { cat: 'nombre', lng };
  if (q.includes('apellido') || q.includes('last name') || q.includes('surname'))  return { cat: 'apellido', lng };
  if (q.includes('email') || q.includes('correo'))                                  return { cat: 'email', lng };
  if (q.includes('teléfono') || q.includes('celular') || q.includes('phone') || q.includes('mobile')) return { cat: 'telefono', lng };
  if ((q.includes('ciudad') || q.includes('city') || q.includes('localidad')) && !q.includes('trabajo')) return { cat: 'ciudad', lng };
  if (q.includes('país') || q.includes('pais') || (q.includes('country') && !q.includes('account')))    return { cat: 'pais', lng };
  if (q.includes('nacionalidad') || q.includes('nationality') || q.includes('citizenship'))              return { cat: 'nacionalidad', lng };
  if (q.includes('linkedin'))                                                                             return { cat: 'linkedin', lng };
  if (q.includes('portafolio') || q.includes('portfolio') || q.includes('website') || q.includes('página web personal')) return { cat: 'portafolio', lng };

  // ── Salario ───────────────────────────────────────────────────────────────
  if (q.includes('salario') || q.includes('sueldo') || q.includes('pretensión') || q.includes('pretension') ||
      q.includes('remuneración') || q.includes('aspiración') || q.includes('salary') || q.includes('compensation') ||
      q.includes('expected pay') || q.includes('wage')) return { cat: 'salario', lng };

  // ── Años / experiencia (número) ───────────────────────────────────────────
  if ((q.includes('años') || q.includes('years') || q.includes('anios')) && q.includes('experiencia')) return { cat: 'anos', lng };
  if (fieldType === 'number' && (q.includes('experiencia') || q.includes('experience')))               return { cat: 'anos', lng };

  // ── Educación ─────────────────────────────────────────────────────────────
  if (q.includes('nivel educativo') || q.includes('escolaridad') || q.includes('nivel de estudios') ||
      q.includes('grado de instrucción') || q.includes('education level') || q.includes('degree'))     return { cat: 'educacion_nivel', lng };
  if (q.includes('universitario') || q.includes('universidad') || q.includes('university') ||
      q.includes('college') || q.includes('professional degree') || q.includes('técnico'))             return { cat: 'educacion_universidad', lng };
  if (q.includes('postgrado') || q.includes('maestría') || q.includes('master') || q.includes('doctorado') || q.includes('phd')) return { cat: 'educacion_postgrado', lng };

  // ── Idiomas ───────────────────────────────────────────────────────────────
  if ((q.includes('inglés') || q.includes('english')) &&
      (q.includes('c2') || q.includes('c1') || q.includes('avanzado') || q.includes('fluido') ||
       q.includes('advanced') || q.includes('fluent') || q.includes('native') || q.includes('nativo'))) return { cat: 'ingles_avanzado', lng };
  if (q.includes('inglés') || q.includes('english') || (q.includes('idioma') && !q.includes('nativo'))) return { cat: 'ingles', lng };
  if (q.includes('español') || q.includes('spanish'))                                                    return { cat: 'espanol', lng };

  // ── Modalidad ─────────────────────────────────────────────────────────────
  if (q.includes('remoto') || q.includes('remote') || q.includes('teletrabajo') ||
      q.includes('home office') || q.includes('work from home'))                                         return { cat: 'remoto', lng };
  if ((q.includes('presencial') && !q.includes('semi')) || q.includes('on-site') || q.includes('in-person') ||
      q.includes('in the office'))                                                                        return { cat: 'presencial', lng };
  if (q.includes('híbrido') || q.includes('hybrid'))                                                     return { cat: 'hibrido', lng };

  // ── Movilidad ─────────────────────────────────────────────────────────────
  if (q.includes('vehículo') || q.includes('carro') || q.includes('coche') || q.includes('moto') ||
      q.includes('car') || q.includes('vehicle'))                                                         return { cat: 'vehiculo', lng };
  if (q.includes('licencia') && (q.includes('conducir') || q.includes('driver')))                        return { cat: 'licencia', lng };
  if (q.includes('viajar') || q.includes('travel') || q.includes('viajes frecuentes'))                   return { cat: 'viajar', lng };
  if (q.includes('mudarse') || q.includes('reubicarse') || q.includes('relocate') || q.includes('move'))return { cat: 'mudarse', lng };

  // ── Disponibilidad ────────────────────────────────────────────────────────
  if (q.includes('disponibilidad') || q.includes('availability') || q.includes('cuándo puedes') ||
      q.includes('cuando puedes') || q.includes('when can you'))                                          return { cat: 'disponibilidad', lng };

  // ── Skills técnicas específicas ───────────────────────────────────────────
  const techSkills = ['react','next.js','javascript','typescript','node.js','html','css','wordpress',
    'shopify','figma','photoshop','illustrator','after effects','premiere','canva','webgl','three.js'];
  if (techSkills.some(s => q.includes(s)))                                                                return { cat: 'skill_si', lng };

  // ── Diseño / marketing ────────────────────────────────────────────────────
  if (q.includes('diseño') || q.includes('design') || q.includes('ui') || q.includes('ux') ||
      q.includes('branding') || q.includes('identidad visual'))                                           return { cat: 'diseno', lng };
  if (q.includes('marketing') || q.includes('seo') || q.includes('google ads') ||
      q.includes('redes sociales') || q.includes('social media') || q.includes('contenido'))             return { cat: 'marketing', lng };

  // ── Textareas de descripción ───────────────────────────────────────────────
  if (fieldType === 'textarea' || fieldType === 'text-long') {
    if (q.includes('carta de presentación') || q.includes('cover letter') ||
        q.includes('preséntate') || q.includes('introduce yourself'))                                    return { cat: 'carta', lng };
    if (q.includes('experiencia') || q.includes('experience') || q.includes('background') ||
        q.includes('trayectoria'))                                                                        return { cat: 'experiencia_larga', lng };
    if (q.includes('rol') || q.includes('role') || q.includes('proceso') || q.includes('process'))      return { cat: 'rol_contenido', lng };
    if (q.includes('herramienta') || q.includes('tool') || q.includes('software') ||
        q.includes('programa') || q.includes('application'))                                             return { cat: 'herramientas', lng };
    if (q.includes('métrica') || q.includes('medir') || q.includes('metric') || q.includes('measure') ||
        q.includes('resultado') || q.includes('result') || q.includes('éxito') || q.includes('success')) return { cat: 'metricas', lng };
    if (q.includes('por qué') || q.includes('why') || q.includes('motivo') || q.includes('reason') ||
        q.includes('interés') || q.includes('interest') || q.includes('postulas') || q.includes('applying')) return { cat: 'por_que', lng };
    if (q.includes('equipo') || q.includes('team') || q.includes('colabor') || q.includes('collab'))    return { cat: 'equipo', lng };
    if (q.includes('idea') || q.includes('contenido para') || q.includes('content for') ||
        q.includes('estrategia') || q.includes('strategy'))                                              return { cat: 'ideas_contenido', lng };
    if (q.includes('logro') || q.includes('achievement') || q.includes('resultado') || q.includes('impacto')) return { cat: 'logros', lng };
    if (q.includes('proceso') || q.includes('metodología') || q.includes('methodology') ||
        q.includes('cómo trabajas') || q.includes('how do you work'))                                    return { cat: 'proceso', lng };
    if (q.includes('diseño') || q.includes('design'))                                                    return { cat: 'diseno', lng };
    if (q.includes('desarrollo') || q.includes('development') || q.includes('programar') ||
        q.includes('coding') || q.includes('web dev'))                                                    return { cat: 'desarrollo', lng };
    // Fallback para textareas no clasificadas → carta de presentación
    return { cat: 'carta', lng };
  }

  return { cat: 'desconocido', lng };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTRUIR RESPUESTA
   Devuelve la respuesta exacta según la categoría clasificada
   ═══════════════════════════════════════════════════════════════════════════ */
export function buildAnswer(cat, lng, fieldType = 'text', options = []) {
  const es = lng === 'es';

  const findOpt = (terms) => options.find(o => terms.some(t => o.toLowerCase().includes(t)));
  const findYes = () => options.find(o => ['sí','si','yes'].includes(o.toLowerCase().trim()));
  const findNo  = () => options.find(o => o.toLowerCase().trim() === 'no');

  switch (cat) {
    // ── Datos personales ────────────────────────────────────────────────────
    case 'nombre':       return PROFILE.nombre_completo;
    case 'apellido':     return PROFILE.apellido;
    case 'email':        return PROFILE.email;
    case 'telefono':     return PROFILE.telefono;
    case 'ciudad':       return PROFILE.ciudad;
    case 'pais':         return PROFILE.pais;
    case 'nacionalidad': return PROFILE.nacionalidad;
    case 'linkedin':     return PROFILE.linkedin;
    case 'portafolio':   return PROFILE.portafolio;

    // ── Salario ──────────────────────────────────────────────────────────────
    case 'salario': {
      if (options.length) {
        // Opciones en COP → buscar rango cercano a 3.2M
        const cop = findOpt(['2.500','2500','3.000','3000','3.200','3200','2 a 3','3 a 4','2,5','3,0']);
        if (cop) return cop;
        return options[0];
      }
      return fieldType === 'number' ? PROFILE.pretension_salarial_cop : PROFILE.pretension_salarial_texto;
    }

    // ── Años de experiencia ────────────────────────────────────────────────
    case 'anos':
      return fieldType === 'number' ? '3' : '3 años';

    // ── Educación ─────────────────────────────────────────────────────────
    case 'educacion_nivel': {
      if (options.length) {
        return findOpt(['bachiller','secundar','media vocacional','11 grado','media','high school']) || options[0];
      }
      return 'Bachiller';
    }
    case 'educacion_universidad':
    case 'educacion_postgrado':
      if (fieldType === 'radio' || fieldType === 'select') return findNo() || 'No';
      return es ? 'No' : 'No';

    // ── Idiomas ───────────────────────────────────────────────────────────
    case 'ingles_avanzado':
      if (fieldType === 'radio' || fieldType === 'select') return findNo() || 'No';
      return es
        ? 'No, mi nivel de inglés es intermedio (B1), no avanzado'
        : 'No, my English level is intermediate (B1), not advanced';

    case 'ingles': {
      if (fieldType === 'radio') return findYes() || 'Sí';
      if (fieldType === 'select') {
        // Buscar B1 primero, luego intermedio
        const b1 = findOpt(['b1','intermedio','intermediat','básico','basic','a2','elementar']);
        if (b1) return b1;
        // Filtrar opciones avanzadas
        const safe = options.filter(o => {
          const ol = o.toLowerCase();
          return !ol.includes('c1') && !ol.includes('c2') && !ol.includes('avanzad') &&
                 !ol.includes('fluido') && !ol.includes('nativ') && !ol.includes('advanced') &&
                 !ol.includes('fluent') && !ol.includes('bilingü');
        });
        return safe[0] || options[0] || 'B1';
      }
      return es ? 'Intermedio (B1)' : 'Intermediate (B1)';
    }

    case 'espanol':
      if (fieldType === 'radio' || fieldType === 'select')
        return findOpt(['nativo','native','c2','fluido','fluent']) || findYes() || 'Sí';
      return es ? 'Nativo (C2)' : 'Native (C2)';

    // ── Modalidad ─────────────────────────────────────────────────────────
    case 'remoto':
      if (fieldType === 'radio') return findYes() || 'Sí';
      return es ? 'Sí, trabajo 100% remoto' : 'Yes, I work 100% remotely';

    case 'presencial':
    case 'hibrido':
      if (fieldType === 'radio') return findNo() || 'No';
      return es ? 'No, solo trabajo de forma remota' : 'No, I only work remotely';

    // ── Movilidad ─────────────────────────────────────────────────────────
    case 'vehiculo':
    case 'licencia':
    case 'viajar':
    case 'mudarse':
      if (fieldType === 'radio') return findNo() || 'No';
      return 'No';

    // ── Disponibilidad ────────────────────────────────────────────────────
    case 'disponibilidad': {
      if (fieldType === 'radio' || fieldType === 'select') {
        return findOpt(['inmediata','inmediato','sí','si','yes','immediately','now']) || findYes() || options[0] || 'Sí';
      }
      return es ? 'Inmediata' : 'Immediate';
    }

    // ── Skills que tengo ────────────────────────────────────────────────────
    case 'skill_si':
      if (fieldType === 'radio') return findYes() || 'Sí';
      return es ? 'Sí' : 'Yes';

    // ── Textareas largas ────────────────────────────────────────────────────
    case 'carta':
      return es ? RESPUESTAS.carta_presentacion_es : RESPUESTAS.carta_presentacion_en;

    case 'experiencia_larga':
      return es ? RESPUESTAS.descripcion_experiencia_es : RESPUESTAS.descripcion_experiencia_en;

    case 'rol_contenido':
      return es ? RESPUESTAS.rol_en_contenido_es : RESPUESTAS.rol_en_contenido_en;

    case 'herramientas':
      return es ? RESPUESTAS.herramientas_es : RESPUESTAS.herramientas_en;

    case 'metricas':
      return es ? RESPUESTAS.metricas_es : RESPUESTAS.metricas_en;

    case 'por_que':
      return es ? RESPUESTAS.por_que_postulo_es : RESPUESTAS.por_que_postulo_en;

    case 'equipo':
      return es ? RESPUESTAS.trabajo_equipo_es : RESPUESTAS.trabajo_equipo_en;

    case 'ideas_contenido':
      return es ? RESPUESTAS.ideas_contenido_es : RESPUESTAS.ideas_contenido_en;

    case 'logros':
      return es ? RESPUESTAS.logros_es : RESPUESTAS.logros_en;

    case 'proceso':
      return es ? RESPUESTAS.proceso_es : RESPUESTAS.proceso_en;

    case 'diseno':
      return fieldType === 'textarea'
        ? (es ? RESPUESTAS.diseno_es : RESPUESTAS.diseno_en)
        : (fieldType === 'radio' ? findYes() || 'Sí' : 'Sí');

    case 'marketing':
      return fieldType === 'textarea'
        ? (es ? RESPUESTAS.metricas_es : RESPUESTAS.metricas_en)
        : (fieldType === 'radio' ? findYes() || 'Sí' : 'Sí');

    case 'desarrollo':
      return fieldType === 'textarea'
        ? (es ? RESPUESTAS.desarrollo_web_es : RESPUESTAS.desarrollo_web_en)
        : (fieldType === 'radio' ? findYes() || 'Sí' : 'Sí');

    // ── Fallback ─────────────────────────────────────────────────────────
    default:
      if (fieldType === 'textarea') {
        // NUNCA devolver vacío en textarea
        return es ? RESPUESTAS.carta_presentacion_es : RESPUESTAS.carta_presentacion_en;
      }
      return null; // null = pasar a Gemini
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   FUNCIÓN PRINCIPAL: getAnswer(question, fieldType, options)
   ═══════════════════════════════════════════════════════════════════════════ */
export function getAnswer(question, fieldType = 'text', options = []) {
  // Verificar RESPUESTAS_COMUNES primero (respuestas exactas sí/no)
  const q = question.toLowerCase().trim();
  for (const [key, val] of Object.entries(RESPUESTAS_COMUNES)) {
    if (q.includes(key)) {
      if (fieldType === 'radio') {
        // Buscar la opción que corresponde a val
        const isNo  = val.toLowerCase().startsWith('no');
        const isYes = val.toLowerCase().startsWith('sí') || val.toLowerCase() === 'si' || val.toLowerCase() === 'yes';
        if (isNo)  return options.find(o => o.toLowerCase().trim() === 'no') || null;
        if (isYes) return options.find(o => ['sí','si','yes'].includes(o.toLowerCase().trim())) || null;
      }
      if (fieldType === 'select') {
        // Buscar opción que coincida con la respuesta
        const match = options.find(o => o.toLowerCase().includes(val.toLowerCase().slice(0, 5)));
        if (match) return match;
      }
      if (fieldType === 'text' || fieldType === 'textarea') return val;
    }
  }

  // Clasificar y construir respuesta
  const { cat, lng } = classifyQuestion(question, fieldType);

  if (cat === 'desconocido' && fieldType !== 'textarea') return null;

  return buildAnswer(cat, lng, fieldType, options);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SELECCIONAR MEJOR OPCIÓN de una lista (select/radio)
   ═══════════════════════════════════════════════════════════════════════════ */
export function matchOption(answer, options) {
  if (!answer || !options.length) return null;
  const a = answer.toLowerCase().trim();

  // Exacta
  const exact = options.find(o => o.toLowerCase().trim() === a);
  if (exact) return exact;

  // La respuesta contiene la opción
  const contains = options.find(o => a.includes(o.toLowerCase().trim()));
  if (contains) return contains;

  // La opción contiene la respuesta
  const contained = options.find(o => o.toLowerCase().includes(a));
  if (contained) return contained;

  // Partial match (primeras 3 letras)
  const partial = options.find(o => a.slice(0, 3) === o.toLowerCase().slice(0, 3));
  if (partial) return partial;

  return null;
}
