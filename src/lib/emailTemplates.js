const SIGNATURE = `Jesús Omar Martínez
JOM Studio — Digital Alchemy
https://jomstudiovzla.github.io/Jomstudiopage/`;

export function buildCamp01Email(lead) {
  const company = lead.nombre_negocio || 'su empresa';
  const subject =
    lead.email_subject ||
    `${company} — plataforma inmobiliaria con agenda (JOM Studio)`;

  const analisis =
    lead.analisis_claude ||
    'Analizamos su presencia digital en Caracas y detectamos oportunidades de mejora en captación de visitas.';

  const gap =
    lead.gap_detectado ||
    'Oportunidad de automatizar consultas y agenda de visitas desde su web.';

  const body = `Hola,

Soy Jesús Omar Martínez, Creative Director de JOM Studio.

Analicé la presencia digital de ${company} y noté algo relevante:

${analisis}

${gap}

Desarrollamos una plataforma inmobiliaria completa (CASE_015 — Inmobiliaria Premium):
• Buscador de propiedades avanzado
• Agenda de visitas integrada
• Stack: Next.js + Node.js + PostgreSQL

No es una plantilla genérica — es un sistema a medida que convierte consultas en visitas cualificadas.

¿Le interesa una llamada de 15 minutos para ver cómo quedaría para ${company}?

Un saludo,
${SIGNATURE}

P.D. Sin compromiso. Si no es el momento, sin problema.`;

  return { subject, body };
}

export function buildFollowUpEmail(lead) {
  const company = lead.nombre_negocio || 'su empresa';
  const subject = `Re: ${company} — CASE Inmobiliaria Premium (JOM Studio)`;
  const gap = lead.gap_detectado || 'mejorar la captación y agenda de visitas';

  const body = `Hola de nuevo,

Quería retomar el mensaje sobre ${company}.

El reto que detectamos — ${gap} — es exactamente lo que resolvemos con nuestro CASE_015:
buscador propio + agenda de visitas en una plataforma Next.js.

¿Tiene 15 minutos esta semana para ver un flujo aplicado a su inventario?

Ver caso: https://jomstudiovzla.github.io/Jomstudiopage/repository.html

${SIGNATURE}`;

  return { subject, body };
}