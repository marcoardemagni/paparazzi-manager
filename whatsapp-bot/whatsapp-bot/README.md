# Paparazzi! WhatsApp Bot

Bot WhatsApp per aggiornare il database di Paparazzi! Manager via messaggi di testo.

## Setup

### 1. Firebase — Service Account

1. Firebase Console → Impostazioni progetto → Account di servizio
2. Clicca "Genera nuova chiave privata" → scarica il JSON
3. Copia il contenuto del JSON (tutto su una riga) come variabile `FIREBASE_SERVICE_ACCOUNT` su Railway

### 2. Firestore — strutture iniziali da creare

Apri Firebase Console → Firestore e crea manualmente:

**`data/bot_config`** (documento):
```json
{
  "whitelist": ["+393401234567", "+393409876543"]
}
```

**`data/bot_sessions`** (documento vuoto, la sottocollezione `pending` si crea da sola):
```json
{}
```

### 3. Twilio — Sandbox WhatsApp

1. Vai su [console.twilio.com](https://console.twilio.com)
2. Messaging → Try it out → Send a WhatsApp message
3. Ogni membro del team deve mandare il codice sandbox al numero Twilio
4. In Sandbox Settings → "When a message comes in" → inserisci l'URL Railway:
   `https://tuo-progetto.up.railway.app/webhook`
5. Metodo: POST

### 4. Railway

1. Crea nuovo progetto Railway → "Deploy from GitHub repo"
2. Aggiungi le variabili d'ambiente (vedi `.env.example`)
3. Railway usa automaticamente `npm start` (da `package.json`)
4. Dopo il deploy, copia l'URL pubblico e:
   - Aggiornalo su Twilio come webhook URL
   - Aggiornalo nella variabile `WEBHOOK_URL` su Railway

### 5. Test

Manda "ciao" dal tuo numero WhatsApp al numero Twilio sandbox.
Se il numero è in whitelist, il bot risponde. Se non risponde, controlla i log su Railway.

---

## Comandi supportati

### Puntate
- "il materiale dei Maneskin è arrivato"
- "la copertura del festival è montata"
- "dimmi i materiali mancanti di domani"
- "com'è messa la puntata del 15 settembre?"
- "assegna la sezione Trending a Micaela"
- "aggiungi un RVM sulla dichiarazione di Meloni alla sezione Trending del 12"

### Ospiti
- "dimmi il numero di telefono di Mario Rossi"
- "aggiorna l'email di Carlo Conti: carlo@example.com"
- "aggiungi ospite: Giorgia Meloni, agenzia Palazzo Chigi, tel +39060000"

### Calendario
- "dimmi gli eventi del 14 febbraio"
- "aggiungi evento: Festival della Castagna, 23 ottobre"
- "aggiungi evento: Premio Regia TV, 5 novembre alle 18:00"

---

## Struttura file

```
index.js      — Server Express + webhook Twilio
handler.js    — Orchestrazione: whitelist, sessioni, Claude, Firestore
firestore.js  — Lettura contesto + applicazione operazioni
claude.js     — Chiamata Claude API con prompt sistema
sessions.js   — Sessioni pendenti su Firestore
whisper.js    — Trascrizione audio (v2, non attivo)
```

## Prossimi step (v2)

- [ ] Whisper: trascrizione messaggi vocali
- [ ] Switch da Twilio sandbox a numero WhatsApp Business dedicato
- [ ] Comando "annulla ultima modifica" (undo con snapshot)
