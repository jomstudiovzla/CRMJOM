// lib/leadsStoreFirestore.js
// Capa de persistencia: Firestore como backend principal en producción,
// filesystem como fallback local para desarrollo.

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const IS_VERCEL = Boolean(process.env.VERCEL || process.env.VERCEL_URL);

// ─── Helpers Firestore ────────────────────────────────────────────────────────

async function getDb() {
  const { getAdminDb } = await import('./firebaseAdmin.js');
  return getAdminDb();
}

async function firestoreGetLeads() {
  const db = await getDb();
  const snap = await db.collection('leads').orderBy('fecha_actualizacion', 'desc').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function firestoreSaveLead(lead) {
  const db = await getDb();
  const id = lead.id || lead.link || lead.email || lead.nombre_negocio || Date.now().toString();
  const docId = encodeURIComponent(id).slice(0, 500);
  await db.collection('leads').doc(docId).set(
    { ...lead, fecha_actualizacion: new Date().toISOString() },
    { merge: true }
  );
  return docId;
}

async function firestoreUpdateLead(docId, updates) {
  const db = await getDb();
  await db.collection('leads').doc(docId).set(
    { ...updates, fecha_actualizacion: new Date().toISOString() },
    { merge: true }
  );
}

async function firestoreDeleteLead(docId) {
  const db = await getDb();
  await db.collection('leads').doc(docId).delete();
}

// ─── Helpers Filesystem (desarrollo local) ────────────────────────────────────

import path from 'path';
const ROOT_DIR = path.resolve(process.cwd(), '..');
const LEADS_CSV = path.join(ROOT_DIR, 'ejecutar/leads/camp-01-inmobiliarias-caracas.csv');
const ENRICHED_JSON = path.join(ROOT_DIR, 'ejecutar/leads/camp-01-enriquecido.json');

function readEnrichedLocal() {
  if (!fs.existsSync(ENRICHED_JSON)) return [];
  return JSON.parse(fs.readFileSync(ENRICHED_JSON, 'utf-8'));
}

function writeEnrichedLocal(data) {
  fs.mkdirSync(path.dirname(ENRICHED_JSON), { recursive: true });
  fs.writeFileSync(ENRICHED_JSON, JSON.stringify(data, null, 2), 'utf-8');
}

function readCsvLeadsLocal() {
  if (!fs.existsSync(LEADS_CSV)) return [];
  return parse(fs.readFileSync(LEADS_CSV, 'utf-8'), { columns: true, skip_empty_lines: true });
}

function writeCsvLeadsLocal(leads) {
  fs.mkdirSync(path.dirname(LEADS_CSV), { recursive: true });
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

function mergeLocalLeads() {
  const csvLeads = readCsvLeadsLocal();
  const enriched = readEnrichedLocal();
  const combined = csvLeads.map((lead) => {
    const extra = enriched.find((e) => matchLead(lead, e));
    return { ...lead, ...extra };
  });
  for (const entry of enriched) {
    if (!combined.some((c) => matchLead(c, entry))) {
      combined.push({
        estado_pipeline: entry.estado_pipeline || 'nuevo',
        calidad_lead: entry.prioridad || entry.calidad_lead || 'media',
        ...entry,
      });
    }
  }
  return combined;
}

// ─── API Pública ──────────────────────────────────────────────────────────────

export async function mergeAllLeads() {
  if (IS_VERCEL) {
    return await firestoreGetLeads();
  }
  return mergeLocalLeads();
}

export async function appendEnrichedLeads(newLeads) {
  if (IS_VERCEL) {
    const current = await firestoreGetLeads();
    const existingLinks = new Set(current.map((l) => l.link).filter(Boolean));
    const existingNames = new Set(current.map((l) => l.nombre_negocio?.toLowerCase()).filter(Boolean));
    const unique = newLeads.filter((l) => {
      if (l.link && existingLinks.has(l.link)) return false;
      if (l.nombre_negocio && existingNames.has(l.nombre_negocio.toLowerCase())) return false;
      return true;
    });
    await Promise.all(unique.map((l) => firestoreSaveLead(l)));
    return unique;
  }

  // Local
  const current = readEnrichedLocal();
  const existingLinks = new Set(current.map((l) => l.link).filter(Boolean));
  const existingNames = new Set(current.map((l) => l.nombre_negocio?.toLowerCase()).filter(Boolean));
  const unique = newLeads.filter((l) => {
    if (l.link && existingLinks.has(l.link)) return false;
    if (l.nombre_negocio && existingNames.has(l.nombre_negocio.toLowerCase())) return false;
    return true;
  });
  if (unique.length > 0) writeEnrichedLocal([...current, ...unique]);
  return unique;
}

export async function updateLeadState(nombre_negocio, nuevo_estado, extra = {}) {
  if (IS_VERCEL) {
    const leads = await firestoreGetLeads();
    const lead = leads.find((l) => l.nombre_negocio?.toLowerCase() === nombre_negocio.toLowerCase());
    if (lead) {
      await firestoreUpdateLead(lead.id, { estado_pipeline: nuevo_estado, ...extra });
    } else {
      await firestoreSaveLead({ nombre_negocio, estado_pipeline: nuevo_estado, ...extra });
    }
    return true;
  }

  // Local
  const key = nombre_negocio.toLowerCase();
  const csvLeads = readCsvLeadsLocal();
  let updated = false;
  for (const lead of csvLeads) {
    if (lead.nombre_negocio?.toLowerCase() === key) { lead.estado_pipeline = nuevo_estado; updated = true; break; }
  }
  if (updated) writeCsvLeadsLocal(csvLeads);
  const enriched = readEnrichedLocal();
  let jsonUpdated = false;
  for (const lead of enriched) {
    if (lead.nombre_negocio?.toLowerCase() === key) {
      lead.estado_pipeline = nuevo_estado; Object.assign(lead, extra); jsonUpdated = true; break;
    }
  }
  if (!updated && !jsonUpdated) { enriched.push({ nombre_negocio, estado_pipeline: nuevo_estado, ...extra }); jsonUpdated = true; }
  if (jsonUpdated) writeEnrichedLocal(enriched);
  return updated || jsonUpdated;
}

export async function updateLeadByEmail(email, updates) {
  if (IS_VERCEL) {
    const leads = await firestoreGetLeads();
    const matches = leads.filter((l) => l.email?.toLowerCase() === email.toLowerCase());
    await Promise.all(matches.map((l) => firestoreUpdateLead(l.id, updates)));
    return matches.length;
  }

  const addr = email.toLowerCase();
  const csvLeads = readCsvLeadsLocal();
  let csvChanged = false;
  for (const lead of csvLeads) { if (lead.email?.toLowerCase() === addr) { Object.assign(lead, updates); csvChanged = true; } }
  if (csvChanged) writeCsvLeadsLocal(csvLeads);
  const enriched = readEnrichedLocal();
  let jsonChanged = false;
  let count = 0;
  for (const lead of enriched) { if (lead.email?.toLowerCase() === addr) { Object.assign(lead, updates); jsonChanged = true; count++; } }
  if (jsonChanged) writeEnrichedLocal(enriched);
  return count;
}

export async function updateLeadGap(nombre_negocio, updates = {}) {
  if (IS_VERCEL) {
    const leads = await firestoreGetLeads();
    const lead = leads.find((l) => l.nombre_negocio?.toLowerCase() === nombre_negocio.toLowerCase());
    if (lead) {
      await firestoreUpdateLead(lead.id, updates);
    } else {
      await firestoreSaveLead({ nombre_negocio, estado_pipeline: 'nuevo', ...updates });
    }
    return true;
  }

  const key = nombre_negocio.toLowerCase();
  const enriched = readEnrichedLocal();
  let found = false;
  for (const lead of enriched) {
    if (lead.nombre_negocio?.toLowerCase() === key) {
      if (updates.gap_detectado) lead.gap_detectado = updates.gap_detectado;
      if (updates.web) lead.web = updates.web;
      if (updates.solucion_jom) lead.solucion_jom = updates.solucion_jom;
      if (updates.email) lead.email = updates.email;
      if (updates.telefono) lead.telefono = updates.telefono;
      if (updates.descripcion_empresa) lead.descripcion_empresa = updates.descripcion_empresa;
      if (updates.historia) lead.historia = updates.historia;
      if (updates.paleta_colores) lead.paleta_colores = updates.paleta_colores;
      if (updates.nicho_detectado) lead.nicho_detectado = updates.nicho_detectado;
      lead.fecha_actualizacion = new Date().toISOString();
      found = true;
      break;
    }
  }
  if (!found) enriched.push({ nombre_negocio, estado_pipeline: 'nuevo', fecha_actualizacion: new Date().toISOString(), ...updates });
  writeEnrichedLocal(enriched);
  return true;
}

export function readEnrichedLeads() {
  return readEnrichedLocal();
}

export function writeEnrichedLeads(data) {
  writeEnrichedLocal(data);
}
