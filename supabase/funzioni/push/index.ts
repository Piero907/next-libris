// Next Libris · Edge Function «push» (16/11/2026, prima nella prova). Manda le notifiche push (Web Push, VAPID).
// La chiama il database (push_sveglia, con pg_net) quando c'è qualcosa da mandare; controlla il segreto in x-push.
// Il lavoro e le chiavi VAPID arrivano da push_lavoro() (Vault). Fino a 2 avvisi per utente: uno per uno;
// da 3 in su un solo riepilogo (scelta di Piero). Iscrizioni scadute (404/410) tolte con push_scadute().
import webpush from "npm:web-push@3.6.7";

const URL_DB = Deno.env.get("SUPABASE_URL")!;
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || (() => { try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || ""; } catch { return ""; } })();

type N = { id: string; tipo: string; titolo: string; rif: string; nome: string };
type Lavoro = { utente: string; nuove: N[]; non_lette: number; iscrizioni: { endpoint: string; keys: { p256dh: string; auth: string } }[] };

async function rpc(nome: string, body: unknown) {
  const r = await fetch(URL_DB + "/rest/v1/rpc/" + nome, {
    method: "POST",
    headers: SR.startsWith("sb_secret_") ? { apikey: SR, "Content-Type": "application/json" }
      : { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(nome + " " + r.status + " " + (await r.text()).slice(0, 200));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

// stessi testi della campanella (notifiche.js), senza grassetto
function testo(x: N): string {
  const chi = x.nome || "Un amico", libro = "«" + (x.titolo || "un libro") + "»";
  switch (x.tipo) {
    case "amicizia": return chi + " vuole essere tuo amico";
    case "amico": return chi + " ha accettato la tua amicizia";
    case "prestito": return chi + " ti ha prestato " + libro;
    case "regalo": return chi + " ti ha regalato " + libro;
    case "reso": return chi + " dice di averti restituito " + libro;
    case "reso_ok": return chi + " conferma di aver riavuto " + libro;
    case "reso_no": return chi + " dice di non avere ancora ricevuto " + libro;
    case "chiuso": return chi + " ha segnato come restituito " + libro;
    case "richiesta": return chi + " ti chiede in prestito " + libro;
    case "richiesta_si": return chi + " ti presta " + libro;
    case "richiesta_no": return chi + " ora non può prestarti " + libro;
    case "consiglio": return chi + " ti consiglia " + libro;
    case "chiavi": return chi + " condivide con te la sua chiave per cercare i libri";
    default: return "Hai una novità in Next Libris";
  }
}

function messaggi(l: Lavoro) {
  if (l.nuove.length > 2) {
    const nomi = [...new Set(l.nuove.map((x) => x.nome).filter(Boolean))];
    const da = nomi.length === 1 ? " da " + nomi[0] : nomi.length === 2 ? " da " + nomi[0] + " e " + nomi[1]
      : nomi.length > 2 ? " da " + nomi[0] + ", " + nomi[1] + " e altri" : "";
    return [{ title: "Next Libris", body: "Hai " + l.nuove.length + " novità" + da, tag: "nl-riepilogo", n: l.non_lette }];
  }
  return l.nuove.map((x) => ({ title: "Next Libris", body: testo(x), tag: "nl-" + x.id, n: l.non_lette }));
}

Deno.serve(async (req) => {
  const segreto = req.headers.get("x-push") || "";
  if (req.method !== "POST" || segreto.length < 32) return new Response("no", { status: 401 });
  let dati;
  try { dati = await rpc("push_lavoro", { segreto }); } catch (e) { return new Response(String(e), { status: 500 }); }
  if (!dati) return new Response("no", { status: 401 });
  const v = dati.vapid || {};
  if (!v.pub || !v.priv) return new Response("vapid mancanti", { status: 500 });
  webpush.setVapidDetails(v.subject || "mailto:nextlibris.app@gmail.com", v.pub, v.priv);
  const scadute: string[] = [];
  let ok = 0, ko = 0;
  for (const l of (dati.lavori || []) as Lavoro[]) {
    for (const m of messaggi(l)) {
      const payload = JSON.stringify(m);
      await Promise.all(l.iscrizioni.map(async (s) => {
        try { await webpush.sendNotification(s, payload, { TTL: 86400, urgency: "normal" }); ok++; }
        catch (e) {
          ko++;
          const c = (e as { statusCode?: number }).statusCode;
          if (c === 404 || c === 410) scadute.push(s.endpoint);
          else console.log("push non riuscito", c, String((e as { body?: string }).body || e).slice(0, 200));
        }
      }));
    }
  }
  if (scadute.length) { try { await rpc("push_scadute", { endpoints: [...new Set(scadute)] }); } catch (e) { console.log(String(e)); } }
  return new Response(JSON.stringify({ ok, ko, scadute: scadute.length }), { headers: { "Content-Type": "application/json" } });
});
