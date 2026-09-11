import { getFirestore } from "firebase-admin/firestore";

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minuti

function sessionRef(phone) {
  const db = getFirestore();
  // Sanitizza il numero per usarlo come document ID
  const id = phone.replace(/\+/g, "00").replace(/[^0-9]/g, "");
  return db.doc(`data/bot_sessions/pending/${id}`);
}

export async function getPendingSession(phone) {
  const ref = sessionRef(phone);
  const doc = await ref.get();
  if (!doc.exists) return null;

  const data = doc.data();
  // Controlla scadenza
  if (Date.now() > data.expires) {
    await ref.delete();
    return null;
  }
  return data.operation;
}

export async function saveSession(phone, operation) {
  const ref = sessionRef(phone);
  await ref.set({
    operation,
    expires: Date.now() + SESSION_TTL_MS,
    createdAt: new Date().toISOString(),
  });
}

export async function clearSession(phone) {
  const ref = sessionRef(phone);
  await ref.delete();
}
