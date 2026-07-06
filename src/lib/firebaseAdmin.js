// lib/firebaseAdmin.js
// Firebase Admin SDK para operaciones de servidor (Vercel/Node.js)
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  // En Vercel usamos las variables de entorno NEXT_PUBLIC para inicializar Admin
  // con una service account mínima (solo Firestore)
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID no configurado');
  }

  // Si hay credenciales de service account (FIREBASE_SERVICE_ACCOUNT_JSON), úsalas
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    return initializeApp({ credential: cert(serviceAccount), projectId });
  }

  // Fallback: modo sin credenciales (funciona con reglas de Firestore abiertas en dev)
  return initializeApp({ projectId });
}

let _db;
export function getAdminDb() {
  if (!_db) {
    getAdminApp();
    _db = getFirestore();
  }
  return _db;
}
