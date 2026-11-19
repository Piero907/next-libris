const CFG = require("./_config");
const HN = require('./_harness');
// moduli: social, ricerche   (senza questi file nell'app la prova si salta: vedi esegui.js)
// 029 (Piero, 19/11/2026): ISBN che nessuna banca dati conosce (979-8, autopubblicati su Amazon).
// 1) non trovato: «Amazon (pubblicazione in proprio)» e messaggio della scansione; completato a mano (titolo e autore) → proponi_archivio
//    dopo la pausa, con i dati scritti, e il grazie una volta sola; 2) libro trovato e poi corretto: nessuna proposta;
// 3) libro che solo l'archivio conosce (approvato, senza editore né anno): si cerca come sempre e, se nessuno lo trova, vale l'archivio.
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const KDP = '9798333295538', SOLO = '9798000000007', OK = '9788845292613';
const DB = { archive: { [SOLO]: { t: 'Solo nell\'archivio', a: 'Autrice Approvata' } }, props: [] };
const uidOf = (req) => { const m = /Bearer AT-(\w+)/.exec(req.headers.authorization || ''); return m ? m[1] : null; };
function fake(req, res, body, url) {
  const send = (st, j) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(j === undefined ? '' : JSON.stringify(j)); };
  const p = url.pathname.replace(/^\/finto/, '');
  if (req.headers.apikey !== 'chiave-finta') return send(401, { message: 'no api key' });
  if (p === '/auth/v1/settings') return send(200, { external: { google: true } });
  if (p === '/auth/v1/token') { const id = String(body.refresh_token || '').slice(3); return send(200, { access_token: 'AT-' + id, refresh_token: 'RT-' + id, expires_in: 3600, user: { id } }); }
  const me = uidOf(req); if (!me) return send(401, { message: 'JWT' });
  if (p === '/rest/v1/libri') return send(req.method === 'GET' ? 200 : 201, req.method === 'GET' ? [] : undefined);
  if (p === '/rest/v1/profili' && req.method === 'GET') return send(200, [{ utente: 'Anna', nome: 'Anna', desideri: false, libreria: false }]);
  if (p === '/rest/v1/rpc/da_archivio') return send(200, DB.archive[body.isbn] || null);
  if (p === '/rest/v1/rpc/archivia') return send(204);
  if (p === '/rest/v1/rpc/proponi_archivio') { DB.props.push(body); return send(200, DB.archive[body.isbn] ? 'c_e' : 'ok'); }
  if (p.startsWith('/rest/v1/rpc/')) return send(200, []);
  send(404, { message: 'finto: ' + p });
}
const srv = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/finto/')) { let b = ''; req.on('data', c => b += c); req.on('end', () => { let j = {}; try { j = b ? JSON.parse(b) : {}; } catch (e) {} fake(req, res, j, url); }); return; }
  const p = decodeURIComponent(url.pathname), m = p.match(/^\/next-libris-prova(\/.*)?$/);
  if (!m) { res.writeHead(404); return res.end(); }
  if (!m[1]) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
  const f = path.join(ROOT, m[1] === '/' ? '/index.html' : m[1]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
}).listen(CFG.port(8335));
const base = 'http://localhost:' + CFG.port(8335);
let gHits = [];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [], wait = HN.wait;
  const json = o => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
  const ctx = await browser.createBrowserContext(); const A = await ctx.newPage();
  await A.setViewport({ width: 360, height: 780, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  A.on('pageerror', e => errors.push(e.message));
  await A.evaluateOnNewDocument((u) => {
    window.NL_SOCIAL = { url: u, key: 'chiave-finta', gClient: 'client-finto' };
    if (!localStorage.getItem('prova:catalogo-libri-social-auth')) localStorage.setItem('prova:catalogo-libri-social-auth', JSON.stringify({ at: 'AT-uA', rt: 'RT-uA', exp: Date.now() + 3e6, uid: 'uA', email: 'anna@esempio.it' }));
    localStorage.setItem('prova:catalogo-libri-guida', JSON.stringify({ seen: 1, v: 99 }));
  }, base + '/finto');
  await A.setRequestInterception(true);
  A.on('request', r => {
    const u = decodeURIComponent(r.url());
    if (u.startsWith(base)) return r.continue();
    const isbn = (u.match(/97[89]\d{10}/) || [])[0];
    if (u.includes('googleapis.com/books/')) {
      gHits.push(u);
      if (isbn !== OK) return r.respond(json({ totalItems: 0 }));
      return r.respond(json({ items: [{ id: 'v1', volumeInfo: { title: 'Il nome della rosa', authors: ['Umberto Eco'], publisher: 'Bompiani', publishedDate: '2012', industryIdentifiers: [{ type: 'ISBN_13', identifier: OK }] } }] }));
    }
    if (u.includes('openlibrary.org/api/books')) return r.respond(json({}));
    if (u.includes('openlibrary.org/search')) return r.respond(json({ numFound: 0, docs: [] }));
    if (/openlibrary|crossref|covers/.test(u)) return r.respond({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '' });
    r.respond(json({}));
  });
  await A.goto(base + '/next-libris-prova/?vista=elenco', { waitUntil: 'load' }); await wait(2600);
  await A.evaluate(() => { window.NL.settings.gbKey = 'AIzaFinta'; window.NL.saveSettings(); });
  const byIsbn = i => A.evaluate(i => JSON.parse(JSON.stringify(window.NL.books().find(b => b.i === i) || null)), i);
  const done = i => A.waitForFunction(i => { const b = window.NL.books().find(x => x.i === i); return b && (b.t || b.nf); }, { timeout: 15000 }, i).catch(async e => { console.log(await A.evaluate(i => { const b = window.NL.books().find(x => x.i === i); return JSON.stringify([b, b && window.__app.S[b.id]]); }, i)); throw e; });
  // il campo cambiato come lo fa la matita: un input con data-k dentro la riga del libro, evento «change»
  const edit = (i, k, v) => A.evaluate((i, k, v) => {
    const b = window.NL.books().find(x => x.i === i); const row = document.querySelector('.row[data-id="' + b.id + '"]');
    const el = document.createElement('input'); el.dataset.k = k; row.appendChild(el); el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); el.remove();
  }, i, k, v);

  // 1) 979-8 sconosciuto
  gHits = [];
  await A.evaluate(i => window.__app.addIsbn(i), KDP); await done(KDP); await wait(500);
  let b = await byIsbn(KDP);
  assert(b.nf && !b.t && b.e === 'Amazon (pubblicazione in proprio)', 'non trovato, editore Amazon');
  assert(gHits.length >= 1, 'Google provato');
  await edit(KDP, 't', 'Investigazioni Pernice: Storie di corna, omicidi e bei sentimenti');
  await wait(1500); assert.strictEqual(DB.props.length, 0, 'solo il titolo: niente proposta');
  await edit(KDP, 'a', 'Nicolò Zuliani');
  await wait(1500); assert.strictEqual(DB.props.length, 0, 'aspetta la pausa');
  await A.waitForFunction(() => /Controlliamo i dati/.test(document.body.innerText), { timeout: 8000 });
  assert.strictEqual(DB.props.length, 1);
  assert.deepStrictEqual(DB.props[0], { isbn: KDP, dati: { t: 'Investigazioni Pernice: Storie di corna, omicidi e bei sentimenti', a: 'Nicolò Zuliani', e: 'Amazon (pubblicazione in proprio)' } });
  await edit(KDP, 'y', '2024'); await wait(5000);
  assert.strictEqual(DB.props.length, 2); assert.strictEqual(DB.props[1].dati.y, '2024');
  // 2) libro trovato e poi corretto: nessuna proposta
  await A.evaluate(i => window.__app.addIsbn(i), OK); await done(OK); await wait(800);
  assert.strictEqual((await byIsbn(OK)).t, 'Il nome della rosa');
  await edit(OK, 'a', 'U. Eco'); await wait(5000);
  assert.strictEqual(DB.props.length, 2, 'trovato: niente proposta');
  // 3) solo l'archivio lo conosce (senza editore né anno): si cerca come sempre, poi vale l'archivio
  gHits = [];
  await A.evaluate(i => window.__app.addIsbn(i), SOLO); await done(SOLO); await wait(500);
  b = await byIsbn(SOLO);
  assert(b.t === 'Solo nell\'archivio' && b.a === 'Autrice Approvata' && !b.nf, 'dall\'archivio');
  assert(gHits.length >= 1, 'prima la ricerca solita');

  assert.deepStrictEqual(errors, [], 'nessun errore JavaScript');
  console.log('e2e135 OK');
  await browser.close(); srv.close();
})().catch(async e => { console.error('e2e135 FALLITA:', e && e.stack || e); process.exit(1); });
