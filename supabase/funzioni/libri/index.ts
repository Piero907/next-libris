// Next Libris · Edge Function «libri» (18/11/2026, giro 8, prima nella prova). La chiave Google prestata resta sul server.
// Chi usa la chiave di un amico non la riceve più: l'app manda qui la ricerca (con l'accesso dell'utente), la funzione chiede
// la chiave a chiave_prestata() (solo service_role: controlla prestito e amicizia, conta, 300 al giorno per amico, 950 in tutto),
// fa la richiesta a Google Libri e rimanda la risposta così com'è. Togliendo il prestito si ferma subito.
//   GET /functions/v1/libri?da=<id di chi presta>&u=<percorso e domanda di Google, senza chiave>
//   GET /functions/v1/libri?da=<id di chi presta>&isbn=<ISBN>   (026, 18/11/2026: il worker SBN prestato, il cui indirizzo resta qui)
//   Intestazioni di risposta: x-nl-tot (ricerche di oggi con quella chiave), x-nl-mio (le tue), x-nl-stop (no | mio | pieno).
// verify_jwt spento: l'accesso si controlla qui chiedendo l'utente a /auth/v1/user (vale con ogni tipo di chiave del progetto).
const URL_DB = Deno.env.get("SUPABASE_URL")!;
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || (() => { try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || ""; } catch { return ""; } })();
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const ORIGINI = ["https://nextlibris.github.io", "https://piero907.github.io"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VISTI = new Map<string, { uid: string; fino: number }>();   // accesso già controllato (5 minuti), per non chiederlo a ogni ricerca

function cors(origine: string | null) {
  const o = origine && (ORIGINI.includes(origine) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origine)) ? origine : ORIGINI[0];
  return {
    "Access-Control-Allow-Origin": o, "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Expose-Headers": "x-nl-tot, x-nl-mio, x-nl-stop",
    "Access-Control-Max-Age": "86400",
  };
}
function risposta(stato: number, corpo: unknown, h: Record<string, string>, extra: Record<string, string> = {}) {
  return new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), {
    status: stato, headers: { ...h, ...extra, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
const errore = (c: number, m: string) => ({ error: { code: c, message: m } });   // stessa forma degli errori di Google

async function utente(req: Request): Promise<string> {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (t.length < 20) return "";
  const v = VISTI.get(t);
  if (v && v.fino > Date.now()) return v.uid;
  const r = await fetch(URL_DB + "/auth/v1/user", { headers: { apikey: req.headers.get("apikey") || ANON, Authorization: "Bearer " + t } });
  if (!r.ok) return "";
  const j = await r.json();
  const uid = String((j && j.id) || "");
  if (!UUID.test(uid)) return "";
  if (VISTI.size > 500) VISTI.clear();
  VISTI.set(t, { uid, fino: Date.now() + 300000 });
  return uid;
}
async function chiave(uid: string, da: string) {
  const r = await fetch(URL_DB + "/rest/v1/rpc/chiave_prestata", {
    method: "POST",
    headers: SR.startsWith("sb_secret_") ? { apikey: SR, "Content-Type": "application/json" }
      : { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" },
    body: JSON.stringify({ utente: uid, da }),
  });
  if (!r.ok) throw new Error("chiave_prestata " + r.status);
  return await r.json() as { k?: string; e?: string; tot?: number; mio?: number };
}

async function worker(uid: string, da: string): Promise<string> {
  const r = await fetch(URL_DB + "/rest/v1/rpc/worker_prestato", {
    method: "POST",
    headers: SR.startsWith("sb_secret_") ? { apikey: SR, "Content-Type": "application/json" }
      : { apikey: SR, Authorization: "Bearer " + SR, "Content-Type": "application/json" },
    body: JSON.stringify({ utente: uid, da }),
  });
  if (!r.ok) throw new Error("worker_prestato " + r.status);
  const j = await r.json();
  return typeof j === "string" ? j : "";
}

Deno.serve(async (req) => {
  const origine = req.headers.get("origin");
  const h = cors(origine);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "GET") return risposta(405, errore(405, "solo GET"), h);
  const q = new URL(req.url).searchParams;
  const da = q.get("da") || "", u = q.get("u") || "";
  const isbn = (q.get("isbn") || "").replace(/[^0-9Xx]/g, "").toUpperCase();
  if (q.has("isbn")) {                                   // worker SBN prestato: l'indirizzo non arriva mai al telefono dell'amico
    if (!UUID.test(da) || !/^(97[89]\d{10}|\d{9}[\dX])$/.test(isbn)) return risposta(400, { error: "richiesta non valida" }, h);
    let uidW = "";
    try { uidW = await utente(req); } catch { return risposta(503, { error: "accesso non controllabile" }, h); }
    if (!uidW) return risposta(401, { error: "accesso scaduto" }, h);
    let w = "";
    try { w = await worker(uidW, da); } catch (e) { console.log(String(e)); return risposta(503, { error: "servizio non disponibile" }, h); }
    if (!w || !/^https:\/\//.test(w)) return risposta(403, { error: "worker non prestato" }, h, { "x-nl-stop": "no" });
    try {
      const wu = new URL(w); wu.searchParams.set("isbn", isbn);
      const r = await fetch(wu.toString(), { headers: { Accept: "application/json" } });
      return risposta(r.status, (await r.text()).split(wu.origin).join("…"), h);   // l'indirizzo del worker non torna indietro
    } catch {
      return risposta(502, { error: "il worker non risponde" }, h);
    }
  }
  // solo la ricerca dei volumi di Google Libri, niente altro
  if (!UUID.test(da) || u.length > 1500 || !/^\/books\/v1\/volumes\?/.test(u)) return risposta(400, errore(400, "richiesta non valida"), h);
  let uid = "";
  try { uid = await utente(req); } catch { return risposta(503, errore(503, "accesso non controllabile"), h); }
  if (!uid) return risposta(401, errore(401, "accesso scaduto"), h);
  let c;
  try { c = await chiave(uid, da); } catch (e) { console.log(String(e)); return risposta(503, errore(503, "servizio non disponibile"), h); }
  const conti = { "x-nl-tot": String(c.tot ?? ""), "x-nl-mio": String(c.mio ?? "") };
  if (c.e === "no" || !c.k) {
    if (c.e === "mio" || c.e === "pieno") return risposta(429, errore(429, c.e === "mio" ? "limite del giorno per amico" : "limite del giorno della chiave"), h, { ...conti, "x-nl-stop": c.e });
    return risposta(403, errore(403, "chiave non prestata"), h, { "x-nl-stop": "no" });
  }
  const g = new URL("https://www.googleapis.com" + u);
  if (g.hostname !== "www.googleapis.com" || g.pathname !== "/books/v1/volumes") return risposta(400, errore(400, "richiesta non valida"), h);
  g.searchParams.delete("key"); g.searchParams.set("key", c.k);
  try {
    const r = await fetch(g.toString(), { headers: { Referer: (origine && ORIGINI.includes(origine) ? origine : ORIGINI[0]) + "/", Accept: "application/json" } });
    return risposta(r.status, (await r.text()).split(c.k).join("…"), h, conti);   // la chiave non torna mai indietro, neanche in un messaggio di errore
  } catch {
    return risposta(502, errore(502, "Google non risponde"), h, conti);
  }
});
