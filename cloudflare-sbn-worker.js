/*
 * Next Libris · worker SBN «della casa» (20/11/2026, scelte di Piero). Uno solo per tutti gli utenti.
 *
 * Il catalogo delle biblioteche italiane (opac.sbn.it) non si lascia interrogare da una pagina web. Questo piccolo programma
 * gira gratis su Cloudflare Workers: riceve un ISBN, chiede i dati a SBN (ricerca + scheda completa) e li rimanda.
 * Dal 21/11/2026 anche la ricerca per titolo (?t=): solo libri a stampa (niente audiolibri, braille, manoscritti), 25 risultati al massimo.
 *
 * SICUREZZA: risponde solo alle richieste FIRMATE dal server di Next Libris (la funzione «libri» di Supabase, che conta le
 * ricerche di ogni utente). La firma si controlla con le chiavi pubbliche qui sotto (CHIAVI: non sono segrete; le chiavi
 * private stanno solo nel Vault di Supabase). L'indirizzo di questo worker non sta nell'app: anche chi lo conosce, senza
 * la firma non ottiene niente.
 *
 * Come si aggiorna: Cloudflare › Workers & Pages › il worker › «Edit code» › cancella tutto › incolla questo file › «Deploy».
 */
const CHIAVI = [   // chiavi pubbliche (P-256, SPKI in base64) con cui il server firma: una per copia dell'app
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEQbd26g1xHij8QzyIJ+ZIjOUGAP5Bem5870RRiqJHfxR3Js8PkLyI7ikLvDKYXmo4hmPw0sl/0wkEaX5ydGAK7g==',   // prova
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAECwvMkiM62g5QsC+mXCytHdUyqU9qDRqLuEWibS9czzznmREIaB3hVYbbzdwV6ruhhP1UhjEUG1D87dREamh1QA=='    // vera
];
const TOLLERANZA = 120;                                    // secondi: una firma vale per quell'ISBN (o quel titolo) e per due minuti
/* Passaggio dalla versione 111: fino a questa data rispondono ancora anche le richieste senza firma che arrivano dall'app
   (come prima), così chi non ha ancora l'app aggiornata non resta senza SBN. Dopo, solo richieste firmate: non serve rifare niente. */
const VECCHIO_FINO = Date.parse('2026-11-27T00:00:00Z');
const ORIGINI_AMMESSE = ['https://nextlibris.app', 'https://nextlibris.github.io', 'https://piero907.github.io'];   // nextlibris.app dalla 120 (21/11/2026)
const SBN = 'https://opac.sbn.it/opacmobilegw/';

let IMPORTATE = null;
function daBase64(s) {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/')), a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return a;
}
async function chiavi() {
  if (!IMPORTATE) IMPORTATE = await Promise.all(CHIAVI.map((k) => crypto.subtle.importKey('spki', daBase64(k), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])));
  return IMPORTATE;
}
/* intestazione x-nl-firma: «secondi.firma» (ECDSA P-256 con SHA-256 del testo «isbn.secondi», o «t:titolo.secondi», firma in base64 per indirizzi) */
async function firmata(valore, isbn) {
  const m = /^(\d{9,11})\.([A-Za-z0-9_-]{80,100})$/.exec(valore || '');
  if (!m || Math.abs(Date.now() / 1000 - Number(m[1])) > TOLLERANZA) return false;
  try {
    const firma = daBase64(m[2]), testo = new TextEncoder().encode(isbn + '.' + m[1]);
    for (const k of await chiavi()) if (await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, firma, testo)) return true;
  } catch (e) { /* firma illeggibile */ }
  return false;
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ORIGINI_AMMESSE.includes(origin) ? origin : ORIGINI_AMMESSE[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Vary': 'Origin'
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return risposta({ error: 'solo GET' }, 405, cors);

    const sp = new URL(request.url).searchParams;
    const opzioni = { headers: { 'Accept': 'application/json', 'User-Agent': 'NextLibris/1.0 (catalogo personale di libri)' }, cf: { cacheTtl: 86400, cacheEverything: true } };
    if (sp.has('t')) {                                       // ricerca per titolo (21/11/2026): sempre firmata, testo firmato «t:<titolo>»
      const t = (sp.get('t') || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
      if (t.length < 2 || t.length > 100) return risposta({ error: 'titolo mancante o troppo lungo' }, 400, cors);
      if (!(await firmata(request.headers.get('x-nl-firma'), 't:' + t))) return risposta({ error: 'richiesta non firmata' }, 403, cors);
      let d;
      try {
        const r = await fetch(SBN + 'search.json?any=' + encodeURIComponent(t) + '&rows=40', opzioni);
        if (!r.ok) return risposta({ error: 'SBN ha risposto con errore ' + r.status }, 502, cors);
        d = await r.json();
      } catch (e) {
        return risposta({ error: 'SBN non raggiungibile' }, 502, cors);
      }
      const libri = (Array.isArray(d.briefRecords) ? d.briefRecords : [])
        .filter((x) => x && x.tipo === 'Testo a stampa' && (!x.livello || x.livello === 'Monografia'))
        .slice(0, 25)
        .map((x) => ({ codiceIdentificativo: x.codiceIdentificativo, isbn: x.isbn || '', autorePrincipale: x.autorePrincipale || '', titolo: x.titolo || '', pubblicazione: x.pubblicazione || '' }));
      return risposta({ numFound: d.numFound || 0, briefRecords: libri }, 200, cors);
    }
    const isbn = (sp.get('isbn') || '').replace(/[^0-9Xx]/g, '').toUpperCase();
    if (!/^(97[89]\d{10}|\d{9}[\dX])$/.test(isbn)) return risposta({ error: 'ISBN mancante o non valido' }, 400, cors);

    const firma = request.headers.get('x-nl-firma');
    if (firma) {
      if (!(await firmata(firma, isbn))) return risposta({ error: 'firma non valida' }, 403, cors);
    } else if (Date.now() >= VECCHIO_FINO) {
      return risposta({ error: 'richiesta non firmata' }, 403, cors);
    } else if (origin && !ORIGINI_AMMESSE.includes(origin)) {     // fino a VECCHIO_FINO: come prima
      return risposta({ error: 'origine non ammessa' }, 403, cors);
    }

    let dati;
    try {
      const r = await fetch(SBN + 'search.json?isbn=' + isbn, opzioni);
      if (!r.ok) return risposta({ error: 'SBN ha risposto con errore ' + r.status }, 502, cors);
      dati = await r.json();
    } catch (e) {
      return risposta({ error: 'SBN non raggiungibile' }, 502, cors);
    }
    // scheda completa del primo risultato: pagine, collana, classificazione Dewey
    const primo = Array.isArray(dati.briefRecords) ? dati.briefRecords[0] : null;
    if (primo && primo.codiceIdentificativo) {
      try {
        const f = await fetch(SBN + 'full.json?bid=' + encodeURIComponent(primo.codiceIdentificativo), opzioni);
        if (f.ok) dati.full = await f.json();
      } catch (e) { /* la scheda completa e' un di piu' */ }
    }
    return risposta(dati, 200, cors);
  }
};

function risposta(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, cors)
  });
}
