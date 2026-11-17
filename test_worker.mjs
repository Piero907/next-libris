import assert from 'assert';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(process.env.APP_DIR || path.join(here, '..', 'next-libris'), 'cloudflare-sbn-worker.js'), 'utf8');
const W = (await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(src))).default;
const calls = [];
let mode = 'ok';
globalThis.fetch = async (url, opt) => {
  calls.push(url);
  if (mode === 'down') return new Response('err', { status: 503 });
  if (url.includes('search.json')) return new Response(JSON.stringify({ numFound: 1, briefRecords: [{ codiceIdentificativo: 'IT\\ICCU\\RAV\\2002745', titolo: 'Il nome della rosa / Umberto Eco', autorePrincipale: 'Eco, Umberto', pubblicazione: 'Milano : Bompiani, 2012' }] }), { headers: { 'Content-Type': 'application/json' } });
  if (url.includes('full.json')) return new Response(JSON.stringify({ descrizioneFisica: '623 p. ; 20 cm' }), { headers: { 'Content-Type': 'application/json' } });
  return new Response('nf', { status: 404 });
};
const req = (path, origin, method = 'GET') => new Request('https://sbn-libri.x.workers.dev' + path, { method, headers: origin ? { Origin: origin } : {} });
const APP = 'https://piero907.github.io';
let r = await W.fetch(req('/?isbn=978-88-06-21935-2', APP));
let j = await r.json();
assert.strictEqual(r.status, 200); assert.strictEqual(r.headers.get('Access-Control-Allow-Origin'), APP);
assert.strictEqual(j.full.descrizioneFisica, '623 p. ; 20 cm');
assert.deepStrictEqual(calls, ['https://opac.sbn.it/opacmobilegw/search.json?isbn=9788806219352', 'https://opac.sbn.it/opacmobilegw/full.json?bid=IT%5CICCU%5CRAV%5C2002745']);
r = await W.fetch(req('/?isbn=9788806219352', APP, 'OPTIONS')); assert.strictEqual(r.status, 204);
r = await W.fetch(req('/?isbn=123', APP)); assert.strictEqual(r.status, 400);
r = await W.fetch(req('/?isbn=9788806219352', 'https://altro.sito')); assert.strictEqual(r.status, 403);
r = await W.fetch(req('/?isbn=9788806219352', null)); assert.strictEqual(r.status, 200);     // prova a mano dal browser
mode = 'down'; r = await W.fetch(req('/?isbn=9788806219352', APP)); assert.strictEqual(r.status, 502); console.log((await r.json()).error);
// la risposta dell'intermediario si legge con il parser dell'app
const L = (await import(path.join(process.env.APP_DIR || path.join(here, '..', 'next-libris'), 'lib.js'))).default;
const p = L.parseSbn(j, '9788806219352'); console.log(p.t, '|', p.a, '|', p.e, p.y, p.pg);
assert.strictEqual(p.pg, '623');
console.log('worker OK');
