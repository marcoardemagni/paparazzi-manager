import 'dotenv/config';
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { addDays, format, parseISO, isWithinInterval, startOfDay } from "date-fns";

// Init Firebase Admin (singleton)
if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    projectId: "paparazzi-manager",
  });
}

const db = getFirestore();

// ---------------------------------------------------------------------------
// WHITELIST
// ---------------------------------------------------------------------------

export async function isAllowed(phone) {
  const doc = await db.doc("data/bot_config").get();
  if (!doc.exists) return false;
  const whitelist = doc.data().whitelist || [];
  return whitelist.includes(phone);
}

// ---------------------------------------------------------------------------
// CONTEXT — dati da passare a Claude per interpretazione
// ---------------------------------------------------------------------------

export async function buildContext() {
  const today = startOfDay(new Date());
  const limit = addDays(today, 14);

  // Puntate (sections) nel range oggi+14gg
  const sectionsDoc = await db.doc("data/sections").get();
  const allSections = sectionsDoc.exists ? (sectionsDoc.data().sections || []) : [];

  // Le sezioni sono raggruppate per data (assignment.date = "YYYY-MM-DD")
  // Filtra quelle nel range
  const relevantSections = allSections.filter((sec) => {
    const d = sec.assignment?.date ? parseISO(sec.assignment.date) : null;
    return d && isWithinInterval(d, { start: today, end: limit });
  });

  // Ospiti
  const guestsDoc = await db.doc("data/guests").get();
  const guests = guestsDoc.exists ? (guestsDoc.data().guests || []) : [];

  // Calendario
  const calDoc = await db.doc("data/calEvents").get();
  const calEvents = calDoc.exists ? (calDoc.data().calEvents || []) : [];

  // Team members (per riconoscere nomi in "assegna a X")
  const teamDoc = await db.doc("data/teamMembers").get();
  const teamMembers = teamDoc.exists ? (teamDoc.data().teamMembers || []) : [];

  return {
    today: format(today, "yyyy-MM-dd"),
    sections: relevantSections,
    guests,
    calEvents,
    teamMembers,
  };
}

// ---------------------------------------------------------------------------
// APPLY OPERATION — esegue la modifica su Firestore
// ---------------------------------------------------------------------------

export async function applyOperation(op) {
  switch (op.intent) {

    // --- PUNTATE ---

    case "update_rvm_status": {
      const { section_id, rvm_index, new_status } = op.data;
      const sectionsDoc = await db.doc("data/sections").get();
      const sections = sectionsDoc.data().sections;
      const sec = sections.find((s) => s.id === section_id);
      if (!sec) throw new Error("Sezione non trovata");
      sec.rvms[rvm_index].status = new_status;
      await db.doc("data/sections").update({ sections });
      break;
    }

    case "update_copertura_status": {
      const { section_id, cop_index, new_status } = op.data;
      const sectionsDoc = await db.doc("data/sections").get();
      const sections = sectionsDoc.data().sections;
      const sec = sections.find((s) => s.id === section_id);
      if (!sec) throw new Error("Sezione non trovata");
      sec.coperture[cop_index].status = new_status;
      await db.doc("data/sections").update({ sections });
      break;
    }

    case "update_section_status": {
      const { section_id, new_status } = op.data;
      const sectionsDoc = await db.doc("data/sections").get();
      const sections = sectionsDoc.data().sections;
      const sec = sections.find((s) => s.id === section_id);
      if (!sec) throw new Error("Sezione non trovata");
      sec.status = new_status;
      await db.doc("data/sections").update({ sections });
      break;
    }

    case "update_section_responsabile": {
      const { section_id, new_responsabile } = op.data;
      const sectionsDoc = await db.doc("data/sections").get();
      const sections = sectionsDoc.data().sections;
      const sec = sections.find((s) => s.id === section_id);
      if (!sec) throw new Error("Sezione non trovata");
      sec.responsabile = new_responsabile;
      await db.doc("data/sections").update({ sections });
      break;
    }

    case "add_rvm": {
      const { section_id, rvm } = op.data;
      const sectionsDoc = await db.doc("data/sections").get();
      const sections = sectionsDoc.data().sections;
      const sec = sections.find((s) => s.id === section_id);
      if (!sec) throw new Error("Sezione non trovata");
      if (!sec.rvms) sec.rvms = [];
      sec.rvms.push({ desc: rvm.desc, status: "richiesto", notes: "" });
      await db.doc("data/sections").update({ sections });
      break;
    }

    // --- OSPITI ---

    case "update_guest_field": {
      const { guest_id, field, value } = op.data;
      const guestsDoc = await db.doc("data/guests").get();
      const guests = guestsDoc.data().guests;
      const g = guests.find((x) => x.id === guest_id);
      if (!g) throw new Error("Ospite non trovato");
      g[field] = value;
      await db.doc("data/guests").update({ guests });
      break;
    }

    case "add_guest": {
      const { guest } = op.data;
      const guestsDoc = await db.doc("data/guests").get();
      const guests = guestsDoc.data().guests || [];
      guests.push({
        id: `guest_${Date.now()}`,
        name: guest.name,
        phone: guest.phone || "",
        email: guest.email || "",
        agency: guest.agency || "",
        notes: guest.notes || "",
        ranking: 5,
      });
      await db.doc("data/guests").update({ guests });
      break;
    }

    // --- CALENDARIO ---

    case "add_cal_event": {
      const { event } = op.data;
      const calDoc = await db.doc("data/calEvents").get();
      const calEvents = calDoc.data().calEvents || [];
      calEvents.push({
        id: `evt_${Date.now()}`,
        title: event.title,
        date: event.date,        // "YYYY-MM-DD"
        time: event.time || "",
        notes: event.notes || "",
      });
      await db.doc("data/calEvents").update({ calEvents });
      break;
    }

    case "update_cal_event": {
      const { event_id, fields } = op.data;
      const calDoc = await db.doc("data/calEvents").get();
      const calEvents = calDoc.data().calEvents;
      const ev = calEvents.find((e) => e.id === event_id);
      if (!ev) throw new Error("Evento non trovato");
      Object.assign(ev, fields);
      await db.doc("data/calEvents").update({ calEvents });
      break;
    }

    case "delete_cal_event": {
      const { event_id } = op.data;
      const calDoc = await db.doc("data/calEvents").get();
      let calEvents = calDoc.data().calEvents;
      calEvents = calEvents.filter((e) => e.id !== event_id);
      await db.doc("data/calEvents").update({ calEvents });
      break;
    }

    default:
      throw new Error(`Intent sconosciuto: ${op.intent}`);
  }
}
