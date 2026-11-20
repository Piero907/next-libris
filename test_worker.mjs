import assert from 'assert';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
// Il worker SBN della casa (031, 20/11/2026) sta in questo ramo (cloudflare-sbn-worker.js), non più nell'app.
// Risponde solo alle richieste firmate dalla funzione «libri»: qui al posto delle chiavi pubbliche vere se ne mette una di prova.
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pub = Buffer.from(await crypto.subtle.exportKey('spki', publicKey)).toString('base64');
const vero = fs.readFileSync(path.join(here, 'cloudflare-sbn-worker.js'), 'utf8');
const src = vero.replace(/const CHIAVI = \[[\s\S]*?\];/, "const CHIAVI = ['" + pub + "'];");
assert(src !== vero && (vero.match(/'MFkw[A-Za-z0-9+\/=]{100,}'/g) || []).length === 2, 'nel worker ci sono le due chiavi pubbliche (prova e vera)');
const W = (await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(src))).default;
async function firma(chiave, isbn, ts) {   // come nella funzione «libri» (supabase/funzioni/libri/index.ts)
  const f = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, chiave, new TextEncoder().encode(isbn + '.' + ts)));
  return ts + '.' + btoa(String.fromCharCode(...f)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const ora = () => Math.floor(Date.now() / 1000);
const calls = [];
let mode = 'ok';
globalThis.fetch = async (url, opt) => {
  calls.push(url);
  if (mode === 'down') return new Response('err', { status: 503 });
  if (url.includes('search.json')) return new Response(JSON.stringify({ numFound: 1, briefRecords: [{ codiceIdentificativo: 'IT\\ICCU\\RAV\\2002745', titolo: 'Il nome della rosa / Umberto Eco', autorePrincipale: 'Eco, Umberto', pubblicazione: 'Milano : Bompiani, 2012' }] }), { headers: { 'Content-Type': 'application/json' } });
  if (url.includes('full.json')) return new Response(JSON.stringify({ descrizioneFisica: '623 p. ; 20 cm' }), { headers: { 'Content-Type': 'application/json' } });
  return new Response('nf', { status: 404 });
};
const ISBN = '9788806219352';
const req = (path, h, method = 'GET') => new Request('https://sbn-libri.x.workers.dev' + path, { method, headers: h || {} });
const firmata = async (isbn = ISBN, ts = ora(), k = privateKey) => ({ 'x-nl-firma': await firma(k, isbn, ts) });
const APP = 'https://piero907.github.io';
// richiesta firmata dal server: risponde, con ricerca + scheda completa
let r = await W.fetch(req('/?isbn=978-88-06-21935-2', await firmata()));
let j = await r.json();
assert.strictEqual(r.status, 200);
assert.strictEqual(j.full.descrizioneFisica, '623 p. ; 20 cm');
assert.deepStrictEqual(calls, ['https://opac.sbn.it/opacmobilegw/search.json?isbn=9788806219352', 'https://opac.sbn.it/opacmobilegw/full.json?bid=IT%5CICCU%5CRAV%5C2002745']);
r = await W.fetch(req('/?isbn=' + ISBN, { Origin: APP }, 'OPTIONS')); assert.strictEqual(r.status, 204);
r = await W.fetch(req('/?isbn=123', await firmata('123'))); assert.strictEqual(r.status, 400);
// firme non buone: un altro ISBN, vecchia di 10 minuti, chiave sconosciuta, inventata. SBN non viene nemmeno chiamato.
const n0 = calls.length;
r = await W.fetch(req('/?isbn=9788804668237', await firmata(ISBN))); assert.strictEqual(r.status, 403, 'firma di un altro ISBN');
r = await W.fetch(req('/?isbn=' + ISBN, await firmata(ISBN, ora() - 600))); assert.strictEqual(r.status, 403, 'firma vecchia');
const altra = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])).privateKey;
r = await W.fetch(req('/?isbn=' + ISBN, await firmata(ISBN, ora(), altra))); assert.strictEqual(r.status, 403, 'chiave sconosciuta');
r = await W.fetch(req('/?isbn=' + ISBN, { 'x-nl-firma': ora() + '.' + 'A'.repeat(86) })); assert.strictEqual(r.status, 403, 'firma inventata');
// senza firma: fino al 27/11/2026 come prima (dall'app sì, da altri siti no), poi mai, nemmeno dall'app
const adesso = Date.now;
Date.now = () => Date.parse('2026-11-21T00:00:00Z');
r = await W.fetch(req('/?isbn=' + ISBN, { Origin: 'https://altro.sito' })); assert.strictEqual(r.status, 403);
assert.strictEqual(calls.length, n0, 'le richieste respinte non arrivano a SBN');
r = await W.fetch(req('/?isbn=' + ISBN, { Origin: APP })); assert.strictEqual(r.status, 200, 'passaggio dalla 111');
Date.now = () => Date.parse('2026-11-27T00:00:01Z');
const n1 = calls.length;
r = await W.fetch(req('/?isbn=' + ISBN, { Origin: APP })); assert.strictEqual(r.status, 403, 'dopo il 27/11 senza firma no');
r = await W.fetch(req('/?isbn=' + ISBN)); assert.strictEqual(r.status, 403, 'nemmeno a mano dal browser');
assert.strictEqual(calls.length, n1);
Date.now = adesso;
mode = 'down'; r = await W.fetch(req('/?isbn=' + ISBN, await firmata())); assert.strictEqual(r.status, 502); console.log((await r.json()).error);
// la risposta dell'intermediario si legge con il parser dell'app
const L = (await import(path.join(process.env.APP_DIR || path.join(here, '..', 'next-libris'), 'lib.js'))).default;
const p = L.parseSbn(j, '9788806219352'); console.log(p.t, '|', p.a, '|', p.e, p.y, p.pg);
assert.strictEqual(p.pg, '623');
// ricerca per titolo (21/11/2026): sempre firmata («t:titolo»), solo libri a stampa, campi ridotti; il parser dell'app la legge
mode = 'ok'; calls.length = 0;
const T_REC = [
  { codiceIdentificativo: 'A1', isbn: '88-04-41117-1', autorePrincipale: 'Buzzati, Dino', titolo: 'Il deserto dei tartari / Dino Buzzati', pubblicazione: 'Milano : A. Mondadori, 1995', tipo: 'Testo a stampa', livello: 'Monografia', nomi: [] },
  { codiceIdentificativo: 'A2', autorePrincipale: 'Buzzati, Dino', titolo: 'Il deserto dei Tartari / Dino Buzzati', pubblicazione: 'Milano : Mondadori, 1972', tipo: 'Testo a stampa', livello: 'Monografia' },
  { codiceIdentificativo: 'A3', autorePrincipale: 'Buzzati, Dino', titolo: 'Il deserto dei Tartari / letto da X', pubblicazione: 'Roma : Emons, 2019', tipo: 'Registrazione sonora non musicale', livello: 'Monografia' },
  { codiceIdentificativo: 'A4', titolo: 'Il deserto dei Tartari', pubblicazione: 'Firenze : Stamperia braille', tipo: 'Testo a stampa', livello: 'Spoglio' }];
globalThis.fetch = async (url) => { calls.push(url); return new Response(JSON.stringify({ numFound: 4, briefRecords: T_REC }), { headers: { 'Content-Type': 'application/json' } }); };
const TT = 'il deserto dei tartari';
r = await W.fetch(req('/?t=' + encodeURIComponent(TT), await firmata('t:' + TT)));
j = await r.json();
assert.strictEqual(r.status, 200);
assert.deepStrictEqual(calls, ['https://opac.sbn.it/opacmobilegw/search.json?any=il%20deserto%20dei%20tartari&rows=40']);
assert.deepStrictEqual(j.briefRecords.map((x) => x.codiceIdentificativo), ['A1', 'A2'], 'solo libri a stampa (monografie)');
assert(!('nomi' in j.briefRecords[0]) && !('tipo' in j.briefRecords[0]), 'campi ridotti');
r = await W.fetch(req('/?t=' + encodeURIComponent(TT))); assert.strictEqual(r.status, 403, 'senza firma no, neanche prima del 27/11');
r = await W.fetch(req('/?t=' + encodeURIComponent(TT), await firmata('t:altro titolo'))); assert.strictEqual(r.status, 403, 'firma di un altro titolo');
r = await W.fetch(req('/?t=x', await firmata('t:x'))); assert.strictEqual(r.status, 400);
assert.strictEqual(calls.length, 1, 'SBN chiamato una volta sola');
const lst = L.parseSbnList(j);
assert.strictEqual(lst.length, 2);
assert.strictEqual(lst[0].i, '9788804411178'); assert.strictEqual(lst[0].a, 'Dino Buzzati'); assert.strictEqual(lst[0].e, 'A. Mondadori'); assert.strictEqual(lst[0].y, '1995');
assert(/covers\.openlibrary\.org\/b\/isbn\/9788804411178/.test(lst[0].img) && lst[0].lang === 'it');
assert.strictEqual(lst[1].i, ''); assert.strictEqual(lst[1].y, '1972'); assert.strictEqual(lst[1].img, '');
console.log('titolo:', lst.map((c) => c.t + ' (' + c.e + ', ' + c.y + ')').join(' · '));
console.log('worker OK');
