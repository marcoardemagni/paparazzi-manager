import 'dotenv/config';
import express from "express";
import twilio from "twilio";
import { handleIncoming } from "./handler.js";

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const { TWILIO_AUTH_TOKEN, TWILIO_ACCOUNT_SID, PORT = 3000 } = process.env;

app.post("/webhook", async (req, res) => {
  const from = req.body.From;
  const body = (req.body.Body || "").trim();
  const mediaUrl = req.body.MediaUrl0 || null;
  const mediaType = req.body.MediaContentType0 || null;

  try {
    const reply = await handleIncoming({ from, body, mediaUrl, mediaType });
    console.log("Reply da inviare:", reply);
    const cleanReply = (reply || "Errore").replace(/[^\x00-\x7F\u00C0-\u024F\u0400-\u04FF\n*_]/g, "");
    console.log("cleanReply lunghezza:", cleanReply.length);
    console.log("cleanReply:", cleanReply);
res.set("Connection", "close");
    res.set("Content-Type", "text/xml");
    res.send(`<Response><Message>${escapeXml(cleanReply)}</Message></Response>`);
res.end();
  } catch (err) {
    console.error("Webhook error:", err);
res.set("Connection", "close");
    res.set("Content-Type", "text/xml");
    res.send(`<Response><Message>Errore interno. Riprova.</Message></Response>`);
res.end();
  }
});

app.get("/health", (_, res) => res.send("ok"));

const server = app.listen(PORT, () => console.log(`Bot in ascolto su porta ${PORT}`));
server.timeout = 25000;

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}