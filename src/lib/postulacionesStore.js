/**
 * postulacionesStore.js
 * Store centralizado de postulaciones automáticas.
 * Persiste en JSON y emite eventos SSE para actualización en tiempo real.
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '..', 'ejecutar', 'leads');
const POSTULACIONES_FILE = path.join(DATA_DIR, 'postulaciones.json');

// Listeners SSE activos (uno por cliente conectado al endpoint /api/postulaciones/stream)
const sseClients = new Set();

function readFile() {
  try {
    if (!fs.existsSync(POSTULACIONES_FILE)) return [];
    return JSON.parse(fs.readFileSync(POSTULACIONES_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeFile(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(POSTULACIONES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('[PostulacionesStore] Error escribiendo:', e.message);
  }
}

/** Broadcast a todos los clientes SSE conectados */
function broadcast(event, payload) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch { sseClients.delete(res); }
  }
  // También via socket.io si está disponible
  if (global.io) global.io.emit(event, payload);
}

/** Registrar un cliente SSE y devolver función de limpieza */
export function registerSseClient(res) {
  sseClients.add(res);
  // Enviar estado actual inmediatamente al conectarse
  const current = readFile();
  res.write(`event: init\ndata: ${JSON.stringify(current)}\n\n`);
  return () => sseClients.delete(res);
}

/** Obtener todas las postulaciones */
export function getPostulaciones() {
  return readFile();
}

/** Agregar una nueva postulación */
export function addPostulacion({
  plataforma,        // 'computrabajo' | 'linkedin' | 'upwork' | 'fiverr' | 'workana'
  puesto,
  empresa,
  link,
  estado = 'enviada', // 'enviada' | 'pendiente' | 'error' | 'vista' | 'entrevista'
  respuesta = null,
  notas = '',
}) {
  const all = readFile();
  const nueva = {
    id: `p_${Date.now()}`,
    plataforma,
    puesto,
    empresa: empresa || 'Sin especificar',
    link: link || '',
    estado,
    respuesta,
    notas,
    fecha_postulacion: new Date().toISOString(),
    fecha_actualizacion: new Date().toISOString(),
  };
  all.unshift(nueva); // más reciente primero
  writeFile(all);
  broadcast('postulacion_nueva', nueva);
  broadcast('postulaciones_updated', { count: all.length, ultima: nueva });
  return nueva;
}

/** Actualizar estado de una postulación existente */
export function updatePostulacion(id, updates) {
  const all = readFile();
  const idx = all.findIndex(p => p.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...updates, fecha_actualizacion: new Date().toISOString() };
  writeFile(all);
  broadcast('postulacion_actualizada', all[idx]);
  return all[idx];
}

/** Eliminar una postulación */
export function deletePostulacion(id) {
  const all = readFile();
  const filtered = all.filter(p => p.id !== id);
  writeFile(filtered);
  broadcast('postulacion_eliminada', { id });
  return filtered.length < all.length;
}

/** Obtener estadísticas en tiempo real */
export function getStats() {
  const all = readFile();
  const byPlataforma = {};
  const byEstado = {};
  for (const p of all) {
    byPlataforma[p.plataforma] = (byPlataforma[p.plataforma] || 0) + 1;
    byEstado[p.estado] = (byEstado[p.estado] || 0) + 1;
  }
  return {
    total: all.length,
    byPlataforma,
    byEstado,
    hoy: all.filter(p => {
      const d = new Date(p.fecha_postulacion);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length,
  };
}
