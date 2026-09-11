import express from "express";
import twilio from "twilio";
import { handleIncoming } from "./handler.js";

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const { TWILIO_AUTH_TOKEN, PORT = 3000 } = process.env;

app.post("/webhook", async (req, res) => {
  // Valida firma Twilio (salta in sviluppo locale)
  if (process.env.NODE_ENV === "production") {
    const signature = req.headers["x-twilio-signature"];
    const url = process.env.WEBHOOK_URL;
    const valid = twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, url, req.body);
    if (!valid) return res.status(403).send("Forbidden");
  }

  const from = req.body.From;       // es. "whatsapp:+393401234567"
  const body = (req.body.Body || "").trim();
  const mediaUrl = req.body.MediaUrl0 || null;
  const mediaType = req.body.MediaContentType0 || null;

  try {
    const reply = await handleIncoming({ from, body, mediaUrl, mediaType });
    // Risponde con TwiML
    res.set("Content-Type", "text/xml");
    res.send(`<Response><Message>${escapeXml(reply)}</Message></Response>`);
  } catch (err) {
    console.error("Webhook error:", err);
    res.set("Content-Type", "text/xml");
    res.send(`<Response><Message>⚠️ Errore interno. Riprova tra qualche momento.</Message></Response>`);
  }
});

app.get("/health", (_, res) => res.send("ok"));

app.listen(PORT, () => console.log(`Bot in ascolto su porta ${PORT}`));

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
