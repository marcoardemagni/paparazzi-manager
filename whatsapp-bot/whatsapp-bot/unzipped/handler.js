import { isAllowed } from "./firestore.js";
import { getPendingSession, clearSession, saveSession } from "./sessions.js";
import { buildContext, applyOperation } from "./firestore.js";
import { interpretMessage } from "./claude.js";
import { transcribeAudio } from "./whisper.js";

/**
 * Punto d'ingresso per ogni messaggio WhatsApp in arrivo.
 */
export async function handleIncoming({ from, body, mediaUrl, mediaType }) {
  console.log("Messaggio ricevuto da:", from, "Testo:", body);
  try {
    const phone = from.replace("whatsapp:", "");

    // --- Whitelist ---
    const allowed = await isAllowed(phone);
    if (!allowed) {
      console.log(`Numero non autorizzato: ${phone}`);
      return "Non autorizzato";
    }
    console.log("Whitelist OK");

    // --- Trascrizione audio (v2, Whisper) ---
    let text = body;
    if (mediaUrl && mediaType && mediaType.startsWith("audio/")) {
      text = await transcribeAudio(mediaUrl);
      if (!text) return "⚠️ Non sono riuscito a trascrivere il vocale. Puoi scriverlo?";
    }

    if (!text) return "Non ho ricevuto testo. Scrivi un comando o manda un vocale.";

    // --- Gestione conferma pendente ---
    const pending = await getPendingSession(phone);
    console.log("Sessione pendente:", pending);

    if (pending) {
      return handleConfirmation(phone, text, pending);
    }

    // --- Interpretazione nuovo comando ---
    console.log("Chiamo Claude...");
    const context = await buildContext();
    const result = await interpretMessage(text, context);
    console.log("Risultato Claude:", JSON.stringify(result));

    if (!result) return "⚠️ Non sono riuscito a interpretare il comando.";

    if (result.read_only) {
      return result.response_message || result.clarification_message;
    }

    if (result.confidence === "low" || result.ambiguous) {
      return `🤔 ${result.clarification_message}`;
    }

    await saveSession(phone, result);
    return `📋 *Conferma operazione:*\n${result.confirmation_message}\n\nRispondi *SI* per confermare o *NO* per annullare.`;

  } catch (err) {
    console.error("ERRORE handler:", err);
    return "⚠️ Errore interno.";
  }
}

/**
 * Gestisce la risposta SI/NO a una operazione pendente.
 */
async function handleConfirmation(phone, text, pending) {
  const normalized = text.toLowerCase().trim();

  if (["si", "sì", "yes", "ok", "confermo"].includes(normalized)) {
    await clearSession(phone);
    try {
      await applyOperation(pending);
      return `✅ ${pending.success_message}`;
    } catch (err) {
      console.error("applyOperation error:", err);
      return "⚠️ Errore durante l'aggiornamento. Controlla l'app.";
    }
  }

  if (["no", "annulla", "cancel", "stop"].includes(normalized)) {
    await clearSession(phone);
    return "❌ Operazione annullata.";
  }

  return `⚠️ Risposta non riconosciuta.\n\n📋 *In attesa di conferma:*\n${pending.confirmation_message}\n\nRispondi *SI* o *NO*.`;
}