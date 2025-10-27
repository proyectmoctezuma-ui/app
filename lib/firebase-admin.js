// src/lib/firebase-admin.js
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// ---- Helpers de ENV ----
function readEnv(name, { required = false } = {}) {
  const val = process.env[name];
  if (required && !val) {
    throw new Error(`[ENV] Falta ${name}`);
  }
  return val || '';
}

function decodeMaybeBase64(str) {
  if (!str) return '';
  // Si parece base64 (sin llaves y largo razonable), intenta decode
  const looksBase64 = !str.trim().startsWith('{');
  try {
    const decoded = Buffer.from(str, 'base64').toString('utf8');
    // heurística: si tras decode aparece JSON, úsalo
    if (decoded.trim().startsWith('{') && decoded.includes('project_id')) {
      return decoded;
    }
  } catch {}
  return str;
}

function getServiceAccountObject() {
  // 1) Preferir JSON completo
  let saRaw = readEnv('FIREBASE_SERVICE_ACCOUNT');              // JSON crudo o base64
  if (!saRaw) saRaw = readEnv('FIREBASE_SERVICE_ACCOUNT_BASE64'); // alterna base64
  if (saRaw) {
    const maybeJson = decodeMaybeBase64(saRaw);
    try {
      const obj = JSON.parse(maybeJson);
      // Validación explícita
      const pid = obj.project_id;
      const email = obj.client_email;
      const key = (obj.private_key || '').replace(/\\n/g, '\n');
      if (!pid || !email || !key) {
        throw new Error('Faltan campos en FIREBASE_SERVICE_ACCOUNT: project_id, client_email o private_key');
      }
      return { projectId: pid, clientEmail: email, privateKey: key, _mode: 'service_account_json' };
    } catch (e) {
      throw new Error(`[ENV] FIREBASE_SERVICE_ACCOUNT inválido: ${e.message}`);
    }
  }

  // 2) Modo variables sueltas
  const projectId = readEnv('FIREBASE_PROJECT_ID', { required: true });
  const clientEmail = readEnv('FIREBASE_CLIENT_EMAIL', { required: true });

  let privateKey = readEnv('FIREBASE_PRIVATE_KEY');
  if (!privateKey) {
    const b64 = readEnv('FIREBASE_PRIVATE_KEY_BASE64', { required: true });
    privateKey = Buffer.from(b64, 'base64').toString('utf8');
  }
  // Quitar comillas y normalizar \n
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, '\n');

  if (!privateKey.includes('BEGIN PRIVATE KEY')) {
    throw new Error('[ENV] FIREBASE_PRIVATE_KEY( *_BASE64 ) no parece una private key válida');
  }

  return { projectId, clientEmail, privateKey, _mode: 'split_envs' };
}

let appInstance;

export function getAdminApp() {
  if (appInstance) return appInstance;
  if (getApps().length) {
    appInstance = getApp();
    return appInstance;
  }

  const sa = getServiceAccountObject();
  if (process.env.DEBUG_ADMIN === '1') {
    console.log('[admin:init]', { projectId: sa.projectId, clientEmail: sa.clientEmail, mode: sa._mode });
  }
  appInstance = initializeApp({
    credential: cert({
      projectId: sa.projectId,
      clientEmail: sa.clientEmail,
      privateKey: sa.privateKey,
    }),
  });
  return appInstance;
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}
