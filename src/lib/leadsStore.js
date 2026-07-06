import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { LEADS_CSV, ENRICHED_JSON } from './paths';

function readEnriched() {
  if (!fs.existsSync(ENRICHED_JSON)) return [];
  return JSON.parse(fs.readFileSync(ENRICHED_JSON, 'utf-8'));
}

function writeEnriched(data) {
  fs.writeFileSync(ENRICHED_JSON, JSON.stringify(data, null, 2), 'utf-8');
}

function readCsvLeads() {
  if (!fs.existsSync(LEADS_CSV)) return [];
  const csvContent = fs.readFileSync(LEADS_CSV, 'utf-8');
  return parse(csvContent, { columns: true, skip_empty_lines: true });
}

function writeCsvLeads(leads) {
  fs.writeFileSync(LEADS_CSV, stringify(leads, { header: true }), 'utf-8');
}

function matchLead(a, b) {
  if (a.nombre_negocio && b.nombre_negocio &&
    a.nombre_negocio.toLowerCase() === b.nombre_negocio.toLowerCase()) return true;
  if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) return true;
  if (a.telefono && b.telefono && a.telefono === b.telefono) return true;
  if (a.link && b.link && a.link === b.link) return true;
  return false;
}

export function mergeAllLeads() {
  const csvLeads = readCsvLeads();
  const enriched = readEnriched();

  const combined = csvLeads.map((lead) => {
    const extra = enriched.find((e) => matchLead(lead, e));
    return { ...lead, ...extra };
  });

  for (const entry of enriched) {
    const exists = combined.some((c) => matchLead(c, entry));
    if (!exists) {
      combined.push({
        estado_pipeline: entry.estado_pipeline || 'nuevo',
        calidad_lead: entry.prioridad || entry.calidad_lead || 'media',
        ...entry,
      });
    }
  }

  return combined;
}

export function appendEnrichedLeads(newLeads) {
  const current = readEnriched();
  const existingLinks = new Set(current.map((l) => l.link).filter(Boolean));
  const existingNames = new Set(current.map((l) => l.nombre_negocio?.toLowerCase()).filter(Boolean));

  const unique = newLeads.filter((l) => {
    if (l.link && existingLinks.has(l.link)) return false;
    if (l.nombre_negocio && existingNames.has(l.nombre_negocio.toLowerCase())) return false;
    return true;
  });

  if (unique.length > 0) {
    writeEnriched([...current, ...unique]);
  }

  return unique;
}

export function updateLeadState(nombre_negocio, nuevo_estado, extra = {}) {
  const key = nombre_negocio.toLowerCase();
  let updated = false;

  const csvLeads = readCsvLeads();
  for (const lead of csvLeads) {
    if (lead.nombre_negocio?.toLowerCase() === key) {
      lead.estado_pipeline = nuevo_estado;
      updated = true;
      break;
    }
  }
  if (updated) writeCsvLeads(csvLeads);

  const enriched = readEnriched();
  let jsonUpdated = false;
  for (const lead of enriched) {
    if (lead.nombre_negocio?.toLowerCase() === key) {
      lead.estado_pipeline = nuevo_estado;
      Object.assign(lead, extra);
      jsonUpdated = true;
      break;
    }
  }

  if (!updated && !jsonUpdated) {
    enriched.push({
      nombre_negocio,
      estado_pipeline: nuevo_estado,
      ...extra,
    });
    jsonUpdated = true;
  }

  if (jsonUpdated) writeEnriched(enriched);

  return updated || jsonUpdated;
}

export function updateLeadByEmail(email, updates) {
  const addr = email.toLowerCase();
  let count = 0;

  const csvLeads = readCsvLeads();
  let csvChanged = false;
  for (const lead of csvLeads) {
    if (lead.email?.toLowerCase() === addr) {
      Object.assign(lead, updates);
      csvChanged = true;
      count++;
    }
  }
  if (csvChanged) writeCsvLeads(csvLeads);

  const enriched = readEnriched();
  let jsonChanged = false;
  for (const lead of enriched) {
    if (lead.email?.toLowerCase() === addr) {
      Object.assign(lead, updates);
      jsonChanged = true;
      count++;
    }
  }
  if (jsonChanged) writeEnriched(enriched);

  return count;
}

export function readEnrichedLeads() {
  return readEnriched();
}

export function writeEnrichedLeads(data) {
  writeEnriched(data);
}

export function updateLeadGap(nombre_negocio, updates = {}) {
  const key = nombre_negocio.toLowerCase();
  let updated = false;

  const csvLeads = readCsvLeads();
  for (const lead of csvLeads) {
    if (lead.nombre_negocio?.toLowerCase() === key) {
      if (updates.gap_detectado) lead.gap_detectado = updates.gap_detectado;
      if (updates.web) lead.web = updates.web;
      if (updates.solucion_jom) lead.solucion_jom = updates.solucion_jom;
      if (updates.email) lead.email = updates.email;
      if (updates.telefono) lead.telefono = updates.telefono;
      updated = true;
      break;
    }
  }
  if (updated) writeCsvLeads(csvLeads);

  const enriched = readEnriched();
  let jsonUpdated = false;
  let found = false;

  for (const lead of enriched) {
    if (lead.nombre_negocio?.toLowerCase() === key) {
      if (updates.gap_detectado) lead.gap_detectado = updates.gap_detectado;
      if (updates.web) lead.web = updates.web;
      if (updates.solucion_jom) lead.solucion_jom = updates.solucion_jom;
      if (updates.email) lead.email = updates.email;
      if (updates.telefono) lead.telefono = updates.telefono;
      lead.fecha_actualizacion = new Date().toISOString();
      jsonUpdated = true;
      found = true;
      break;
    }
  }

  if (!found) {
    enriched.push({
      nombre_negocio,
      estado_pipeline: 'nuevo',
      gap_detectado: updates.gap_detectado || '',
      web: updates.web || '',
      solucion_jom: updates.solucion_jom || '',
      fecha_actualizacion: new Date().toISOString(),
    });
    jsonUpdated = true;
  }

  if (jsonUpdated) writeEnriched(enriched);

  return updated || jsonUpdated;
}