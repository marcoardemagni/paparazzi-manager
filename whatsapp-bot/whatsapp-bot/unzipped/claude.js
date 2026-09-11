import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Sei l'assistente WhatsApp di Paparazzi!, un programma televisivo italiano su Rai Italia.
Ricevi messaggi dal team di produzione e devi interpretarli per aggiornare il database dello show.

Rispondi SEMPRE e SOLO con un oggetto JSON valido, senza markdown, senza backtick, senza testo fuori dal JSON.

## Intents disponibili

### Puntate (sezioni nel range oggi+14gg)
- update_rvm_status: aggiorna status di un RVM (richiesto → girato → montato → dialogato)
- update_copertura_status: aggiorna status di una copertura (richiesto → girato → montato → descritto)
- update_section_status: aggiorna pipeline sezione (fattibile → grezzo ricevuto → in montaggio → pronto)
- update_section_responsabile: cambia responsabile di una sezione
- add_rvm: aggiunge un nuovo RVM a una sezione
- read_missing_materials: elenca materiali mancanti di una puntata
- read_episode_briefing: stato generale di una puntata

### Ospiti
- update_guest_field: aggiorna un campo ospite (phone, email, agency, notes)
- add_guest: aggiunge nuovo ospite
- read_guest: legge info di un ospite

### Calendario
- add_cal_event: aggiunge evento calendario
- update_cal_event: aggiorna evento esistente
- delete_cal_event: elimina evento
- read_cal_events: legge eventi per data

## Schema risposta

Per operazioni di SCRITTURA:
{
  "intent": "...",
  "read_only": false,
  "confidence": "high" | "low",
  "ambiguous": false,
  "data": { ... },
  "confirmation_message": "Testo leggibile su WhatsApp che descrive la modifica",
  "success_message": "Testo da inviare dopo conferma avvenuta",
  "clarification_message": "Solo se ambiguous:true o confidence:low — cosa chiedere all'utente"
}

Per operazioni di LETTURA:
{
  "intent": "...",
  "read_only": true,
  "confidence": "high",
  "ambiguous": false,
  "response_message": "Risposta completa in testo WhatsApp (usa *grassetto* e _corsivo_, NO tabelle)"
}

## Regole

- Usa *grassetto* e _corsivo_ per formattare i messaggi WhatsApp. MAI usare tabelle o markdown avanzato.
- Se una sezione/ospite/evento non è identificabile con certezza → ambiguous:true
- Se il comando è incomprensibile → confidence:low con clarification_message
- Per "materiali mancanti": elenca solo rvms/coperture/foto con status != "girato"/"montato"/"dialogato"/"descritto"/"pronto"
- Le date nel contesto sono in formato "YYYY-MM-DD". Convertile in formato leggibile (es. "11 settembre") nei messaggi.
- I nomi delle sezioni possono essere approssimativi (es. "Maneskin" = "I Maneskin" o "Maneskin - intervista")
`;

export async function interpretMessage(text, context) {
  const userPrompt = `## Contesto attuale
Data oggi: ${context.today}

### Sezioni puntate (oggi + 14gg)
${JSON.stringify(context.sections, null, 2)}

### Ospiti
${JSON.stringify(context.guests, null, 2)}

### Eventi calendario
${JSON.stringify(context.calEvents, null, 2)}

### Team members
${JSON.stringify(context.teamMembers, null, 2)}

---
## Comando ricevuto
"${text}"

Interpreta il comando e rispondi con il JSON.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const raw = response.content[0].text.trim();

  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error("JSON parse error da Claude:", raw);
    return null;
  }
}
