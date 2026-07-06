#!/usr/bin/env node
/**
 * Sube leads locales (CSV + JSON enriquecido) a Firestore.
 * Uso: node scripts/seed-firestore-leads.mjs [ruta-service-account.json]
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CSV_PATH = path.join(ROOT, 'ejecutar/leads/camp-01-inmobiliarias-caracas.csv');
const JSON_PATH = path.join(ROOT, 'ejecutar/leads/camp-01-enriquecido.json');

function resolveServiceAccountPath(arg) {
  if (arg && fs.existsSync(arg)) return arg;
  const candidates = [
    path.resolve(__dirname, '../../correccion/crm-jom-firebase-adminsdk-fbsvc-3a085e2fcf.json'),
    path.resolve(__dirname, '../firebase-service-account.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function matchLead(a, b) {
  if (a.nombre_negocio && b.nombre_negocio &&
    a.nombre_negocio.toLowerCase() === b.nombre_negocio.toLowerCase()) return true;
  if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) return true;
  return false;
}

function mergeLeads() {
  const csvLeads = fs.existsSync(CSV_PATH)
    ? parse(fs.readFileSync(CSV_PATH, 'utf8'), { columns: true, skip_empty_lines: true })
    : [];
  const enriched = fs.existsSync(JSON_PATH)
    ? JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'))
    : [];

  const combined = csvLeads.map((lead) => {
    const extra = enriched.find((e) => matchLead(lead, e));
    return { ...lead, ...extra, fecha_actualizacion: new Date().toISOString() };
  });

  for (const entry of enriched) {
    if (!combined.some((c) => matchLead(c, entry))) {
      combined.push({
        estado_pipeline: entry.estado_pipeline || 'nuevo',
        calidad_lead: entry.prioridad || entry.calidad_lead || 'media',
        ...entry,
        fecha_actualizacion: new Date().toISOString(),
      });
    }
  }
  return combined;
}

async function main() {
  const saPath = resolveServiceAccountPath(process.argv[2]);
  if (!saPath) {
    console.error('❌ No se encontró service account JSON.');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });

  const db = getFirestore(app);
  const leads = mergeLeads();

  console.log(`📦 Subiendo ${leads.length} leads a Firestore…`);

  let ok = 0;
  for (const lead of leads) {
    const id = lead.email || lead.nombre_negocio || lead.telefono || String(Date.now());
    const docId = encodeURIComponent(id).slice(0, 500);
    await db.collection('leads').doc(docId).set(
      { ...lead, fecha_actualizacion: new Date().toISOString() },
      { merge: true }
    );
    ok++;
  }

  console.log(`✅ ${ok} leads en Firestore (${serviceAccount.project_id})`);
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});