import fs from 'fs';
import { THREADS_JSON } from './paths.js';

function ensureFile() {
  const dir = THREADS_JSON.replace(/threads\.json$/, '');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(THREADS_JSON)) {
    fs.writeFileSync(THREADS_JSON, JSON.stringify({ threads: [] }, null, 2), 'utf-8');
  }
}

export function readThreads() {
  ensureFile();
  const raw = fs.readFileSync(THREADS_JSON, 'utf-8');
  const data = JSON.parse(raw);
  return data.threads || [];
}

export function writeThreads(threads) {
  ensureFile();
  fs.writeFileSync(THREADS_JSON, JSON.stringify({ threads }, null, 2), 'utf-8');
}

export function getThreadByLead(leadKey) {
  const key = leadKey.toLowerCase();
  return readThreads().find(
    (t) => t.lead_key?.toLowerCase() === key || t.nombre_negocio?.toLowerCase() === key
  );
}

export function upsertMessage(lead, message) {
  const threads = readThreads();
  const leadKey = lead.nombre_negocio;
  let thread = threads.find((t) => t.lead_key?.toLowerCase() === leadKey.toLowerCase());

  if (!thread) {
    thread = {
      id: `thread_${Date.now()}`,
      lead_key: leadKey,
      nombre_negocio: lead.nombre_negocio,
      to: lead.email || '',
      telefono: lead.telefono || '',
      messages: [],
      updated_at: new Date().toISOString(),
    };
    threads.unshift(thread);
  }

  thread.messages.push(message);
  thread.updated_at = message.sentAt || new Date().toISOString();
  thread.last_subject = message.subject;
  thread.last_preview = (message.body || '').slice(0, 120);

  writeThreads(threads);
  return thread;
}