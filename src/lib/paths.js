import path from 'path';

export const ROOT_DIR = path.resolve(process.cwd(), '..');
export const LEADS_CSV = path.join(ROOT_DIR, 'ejecutar/leads/camp-01-inmobiliarias-caracas.csv');
export const ENRICHED_JSON = path.join(ROOT_DIR, 'ejecutar/leads/camp-01-enriquecido.json');
export const THREADS_JSON = path.join(ROOT_DIR, 'ejecutar/comunicaciones/threads.json');