const CFG = require("./_config");
// moduli: social, notifiche, ricerche   (senza questi file nell'app la prova si salta: vedi esegui.js)
// modulo «Ricerche condivise» (ricerche.js) con un Supabase finto, 16/11/2026:
// archivio comune (libro già cercato: niente Google; libro nuovo: una sola ricerca Google, poi nell'archivio solo i dati pubblici);
// copertina grande dallo stesso indirizzo di Google (zoom=0), senza la richiesta /volumes/; descrizione assente = «non disponibile», nessuna altra richiesta;
// contatore condiviso della chiave prestata da Bruno (sha256, mai la chiave) e del worker; a 950 notifica «limite» nella campanella,
// Google si ferma (dati da Open Library); la notifica apre la guida «Crea la tua chiave Google Libri: è gratis» (360, 412 scuro, 1280).
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const KEY = 'AIzaChiaveDiBrunoPerLaProva', SBN = 'https://sbn-finto.esempio.workers.dev';
const H = (v) => crypto.createHash('sha256').update(v).digest('hex');
const DB = {
  archive: { '9788806219352': { t: 'La storia', a: 'Elsa Morante', e: 'Einaudi', y: '2014', pg: '720', img: 'https://covers.openlibrary.org/b/id/1-M.jpg', ds: 'Roma, durante la guerra.' } },
  puts: [], counts: {}, calls: [], notif: [], read: {}
};
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
  if (p === '/rest/v1/rpc/miei_amici') return send(200, [{ id: 'uB', utente: 'Bruno', nome: 'Bruno', stato: 'amici', verso: 'inviata', creato: new Date().toISOString() }]);
  if (p === '/rest/v1/rpc/chiavi_mie') return send(200, [{ da: 'uB', a: 'uA', nome: 'Bruno', gb_key: KEY, sbn: '', creato: new Date().toISOString() }]);
  if (p === '/rest/v1/rpc/da_archivio') return send(200, DB.archive[body.isbn] || null);
  if (p === '/rest/v1/rpc/archivia') { DB.puts.push(body); DB.archive[body.isbn] = Object.assign({}, body.dati, DB.archive[body.isbn] || {}); return send(204); }
  if (p === '/rest/v1/rpc/conta_ricerche') {
    DB.calls.push(body); const k = body.chiave; DB.counts[k] = (DB.counts[k] || 0) + body.n;
    if (k[0] === 'g' && DB.counts[k] >= 950 && !DB.notif.length) DB.notif.push({ id: 'nl1', da: null, nome: null, tipo: 'limite', rif: k, titolo: body.di || '', creata: new Date().toISOString(), letta: false });
    return send(200, DB.counts[k]);
  }
  if (p === '/rest/v1/rpc/mie_notifiche') return send(200, DB.notif.map(x => Object.assign({}, x, { letta: !!DB.read[x.id] })));
  if (p === '/rest/v1/rpc/notifiche_lette') { DB.notif.forEach(x => { DB.read[x.id] = 1; }); return send(204); }
  if (p.startsWith('/rest/v1/rpc/')) return send(200, []);
  send(404, { message: 'finto: ' + p });
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/finto/')) { let b = ''; req.on('data', c => b += c); req.on('end', () => { let j = {}; try { j = b ? JSON.parse(b) : {}; } catch (e) {} fake(req, res, j, url); }); return; }
  const p = decodeURIComponent(url.pathname), m = p.match(/^\/next-libris-prova(\/.*)?$/);
  if (!m) { res.writeHead(404); return res.end(); }
  if (!m[1]) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
  const f = path.join(ROOT, m[1] === '/' ? '/index.html' : m[1]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
}).listen(CFG.port(8306));
const base = 'http://localhost:' + CFG.port(8306);
const G = { '9788845292613': ['Il nome della rosa', 'Umberto Eco', 'Bompiani', '2012'], '9788804668015': ['Le città invisibili', 'Italo Calvino', 'Mondadori', '2016'] };
const OL = { '9788807900891': { title: 'La coscienza di Zeno', authors: [{ name: 'Italo Svevo' }], publishers: [{ name: 'Feltrinelli' }], publish_date: '2015' } };
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="300" height="450" fill="#2a6"/></svg>';
let gHits = [], sbnHits = 0, coverHits = [];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const json = o => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
  async function phone(w, h, dark) {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: w < 900, hasTouch: w < 900 });
    page.on('pageerror', e => errors.push(w + ': ' + e.message));
    await page.evaluateOnNewDocument((u, key) => {
      window.NL_SOCIAL = { url: u, key: 'chiave-finta', gClient: 'client-finto' };
      if (!localStorage.getItem('prova:catalogo-libri-social-auth')) {
        localStorage.setItem('prova:catalogo-libri-social-auth', JSON.stringify({ at: 'AT-uA', rt: 'RT-uA', exp: Date.now() + 3e6, uid: 'uA', email: 'anna@esempio.it' }));
        localStorage.setItem('prova:catalogo-libri-amici-chiave-in-uso', JSON.stringify({ da: 'uB', nome: 'Bruno', gb: key, sbn: '' }));
      }
    }, base + '/finto', KEY);
    await page.setRequestInterception(true);
    page.on('request', r => {
      const u = decodeURIComponent(r.url());
      if (u.startsWith(base)) return r.continue();
      const isbn = (u.match(/97[89]\d{10}/) || [])[0];
      if (u.includes('googleapis.com/books/')) {
        gHits.push(u.replace(/^https:\/\/[^/]+/, '').slice(0, 60));
        const g = G[isbn]; if (!g || !u.includes('volumes?')) return r.respond(json({ totalItems: 0 }));
        return r.respond(json({ items: [{ id: 'vol' + isbn.slice(-4), volumeInfo: { title: g[0], authors: [g[1]], publisher: g[2], publishedDate: g[3], language: 'it',
          industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn }], imageLinks: { thumbnail: 'http://books.google.com/books/content?id=vol' + isbn.slice(-4) + '&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api' } } }] }));
      }
      if (u.includes('books.google.com/books/content')) { coverHits.push(u); return r.respond({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: /zoom=0/.test(u) ? SVG : SVG.replace('300', '128').replace('300', '128') }); }
      if (u.startsWith(SBN)) { sbnHits++; return r.respond({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '' }); }
      if (u.includes('openlibrary.org/api/books') && isbn && OL[isbn]) return r.respond(json({ ['ISBN:' + isbn]: OL[isbn] }));
      if (/openlibrary|crossref|covers/.test(u)) return r.respond({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '' });
      r.respond(json({}));
    });
    await page.goto(base + '/next-libris-prova/?vista=elenco', { waitUntil: 'load' }); await wait(2600);
    await page.evaluate((d, key, sbn) => { window.NLLayout && window.NLLayout.set('A'); if (d) document.documentElement.setAttribute('data-theme', 'dark');
      window.NL.settings.gbKey = key; window.NL.settings.sbnUrl = sbn; window.NL.saveSettings(); }, !!dark, KEY, SBN);
    page.byIsbn = i => page.evaluate(i => JSON.parse(JSON.stringify(window.NL.books().find(b => b.i === i) || null)), i);
    page.addWait = async (i, extra) => { await page.evaluate(i => window.__app.addIsbn(i), i);
      await page.waitForFunction(i => { const b = window.NL.books().find(x => x.i === i); return b && b.t; }, { timeout: 15000 }, i); await wait(extra || 2500); };
    return page;
  }
  const A = await phone(360, 780);
  // 1) libro già nell'archivio comune: nessuna richiesta a Google né al worker
  gHits = []; sbnHits = 0;
  await A.addWait('9788806219352');
  let b = await A.byIsbn('9788806219352'); console.log('[1 archivio]', b.t, b.a, b.e, b.y, b.pg, '| Google', gHits.length, '| SBN', sbnHits);
  assert(b.t === 'La storia' && b.a === 'Elsa Morante' && b.e === 'Einaudi' && b.pg === '720' && b.ds.startsWith('Roma') && gHits.length === 0 && sbnHits === 0, 'dall\'archivio, senza Google');
  // 2) libro nuovo: una sola ricerca Google, copertina grande dallo stesso indirizzo, niente descrizione = non disponibile; poi nell'archivio
  gHits = []; coverHits = [];
  await A.addWait('9788845292613', 4000);
  b = await A.byIsbn('9788845292613'); console.log('[2 nuovo]', b.t, '| Google', gHits, '| imgL', b.imgL, '| dsn', b.dsn);
  assert.strictEqual(gHits.length, 1, 'una sola ricerca Google');
  assert(!gHits.some(x => x.includes('/volumes/')), 'nessuna richiesta /volumes/');
  assert(/zoom=0/.test(b.imgL) && !/edge=curl/.test(b.imgL), 'copertina grande dallo stesso indirizzo');
  assert(!b.ds && b.dsn > 0, 'descrizione non disponibile');
  const put = DB.puts.find(x => x.isbn === '9788845292613'); console.log('[2 archiviato]', JSON.stringify(put && put.dati));
  assert(put && put.dati.t === 'Il nome della rosa' && put.dati.e === 'Bompiani' && !('c' in put.dati) && !('n' in put.dati) && !('id' in put.dati), 'nell\'archivio solo i dati pubblici');
  // 3) contatore condiviso: per sha256 della chiave e del worker, con il nome di chi la presta; mai la chiave
  await A.evaluate(() => window.NLRicerche.flush(false)); await wait(800);
  const gk = 'g:' + H(KEY), sk = 's:' + H(SBN);
  console.log('[3 contatore]', JSON.stringify(DB.counts));
  assert(DB.counts[gk] >= 1 && DB.calls.some(c => c.chiave === gk && c.di === 'Bruno') && DB.counts[sk] >= 1, 'contato per hash');
  assert(!JSON.stringify(DB.calls).includes(KEY), 'la chiave non esce dal telefono');
  // 4) gli altri che usano la chiave arrivano a 949: un'altra ricerca supera 950 → notifica, e Google si ferma
  DB.counts[gk] = 949; gHits = [];
  await A.addWait('9788804668015', 1500);
  await A.evaluate(() => window.NLRicerche.flush(false)); await wait(1500);
  console.log('[4 limite]', DB.counts[gk], '| notifiche', DB.notif.length);
  assert(DB.counts[gk] >= 950 && DB.notif.length === 1 && DB.notif[0].titolo === 'Bruno');
  assert.strictEqual(await A.$eval('#btnBellN', x => x.hidden ? '' : x.textContent), '1', 'numero sulla campanella');
  gHits = [];
  await A.addWait('9788807900891', 2000);
  b = await A.byIsbn('9788807900891'); console.log('[4 dopo il limite]', b.t, '| Google', gHits.length);
  assert(b.t === 'La coscienza di Zeno' && gHits.length === 0, 'Google fermo, dati da Open Library');
  // 5) la notifica apre la guida «è gratis»
  await A.click('#btnBell'); await wait(500);
  const nt = await A.$eval('#ntBody', x => x.innerText.replace(/\s+/g, ' ')); console.log('[5 campanella]', nt);
  assert(/La chiave Google di Bruno ha finito le ricerche di oggi: creane una tua, è gratis/.test(nt));
  await A.screenshot({ path: CFG.OUT + '/ricerche-notifica-360.png' });
  await A.click('#ntBody [data-n="nl1"]'); await wait(500);
  assert(await A.$eval('#kgSheet', x => !x.hidden), 'guida aperta');
  const g = await A.$eval('#kgSheet', x => x.innerText.replace(/\s+/g, ' ')); console.log('[5 guida]', g.slice(0, 220));
  assert(/È gratis/.test(g) && /1\.000 ricerche al giorno, solo per te/.test(g) && /La chiave di Bruno ha finito/.test(g) && /Abilita/.test(g) && /Crea credenziali/.test(g));
  const links = await A.$$eval('#kgSheet a', a => a.map(x => x.href)); assert(links.some(h => h.includes('books.googleapis.com')) && links.some(h => h.includes('apis/credentials')));
  const side = await A.evaluate(() => { const si = document.querySelector('#kgSheet .sheet-in'); return Math.max(si.scrollWidth - si.clientWidth, document.documentElement.scrollWidth - document.documentElement.clientWidth); });
  assert(side <= 0, 'niente scorrimento di lato a 360');
  await A.screenshot({ path: CFG.OUT + '/ricerche-guida-360.png' });
  // 6) «Ho già la chiave»: Impostazioni › Ricerca dei libri, con il totale condiviso
  await A.click('#kgPaste'); await wait(700);
  const cnt = await A.$eval('#gbCount', x => x.textContent); console.log('[6 impostazioni]', cnt);
  assert(/con chi usa la stessa chiave/.test(cnt) && /Limite quasi raggiunto/.test(cnt));
  // schermate: 412 scuro e 1280
  for (const [w, h, dark] of [[412, 900, true], [1280, 860, false]]) {
    const P = await phone(w, h, dark);
    await P.evaluate(() => window.NLRicerche.guide('Bruno')); await wait(400);
    await P.screenshot({ path: CFG.OUT + '/ricerche-guida-' + w + (dark ? '-scuro' : '') + '.png' });
  }
  assert.deepStrictEqual(errors, []);
  console.log('e2e106 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
