const CFG = require("./_config");
const H = require('./_harness');
// moduli: social, amici, notifiche, ricerche   (senza questi file nell'app la prova si salta: vedi esegui.js)
// 026 (Piero, 18/11/2026 sera): Bruno ha sul telefono l’API e il worker di Anna come se fossero suoi (copiati prima del giro 8,
// anche tra i «salvati»). All'apertura il server (chiavi_controlla) dice che l'API è di Anna: sparisce dal telefono, Bruno la usa dal
// server («prestata:…»), non può prestarla (niente elenco «Presta a un amico»; presta_chiavi = «non tua»).
// 031 (20/11/2026): il worker non si presta più. Quello di Anna sparisce dal telefono senza avvisi (anche se un server non ancora
// aggiornato manda ancora «worker-prestato.invalid»); il catalogo SBN è quello della casa: con l'account passa dalla funzione «libri»
// con l'accesso (?isbn=, senza «da»), 500 ricerche al giorno, poi il testo approvato e niente più richieste fino al giorno dopo.
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm', '.webp': 'image/webp' };
const UA = '00000000-0000-0000-0000-0000000000a1', UB = '00000000-0000-0000-0000-0000000000b2';
const KEY = 'AIzaANNA0123456789abcdefghijklmnopq', KEY2 = 'AIzaNUOVA9876543210zyxwvutsrqponmlk', W = 'https://sbn-anna.esempio.workers.dev';
const DB = { prof: { [UA]: { utente: 'Anna', nome: 'Anna' }, [UB]: { utente: 'Bruno', nome: 'Bruno' } },
  keys: [{ da: UA, a: UB, gb_key: KEY, sbn: W }], presta: [], libri: [], mode: '', tot: 40, mio: 0, aggiorna: [], avvisi: [], conta: [] };
const uidOf = (req) => { const m = /Bearer AT-([\w-]+)/.exec(req.headers.authorization || ''); return m ? m[1] : null; };
function fake(req, res, body, url) {
  const send = (st, j, h) => { res.writeHead(st, Object.assign({ 'Content-Type': 'application/json' }, h || {})); res.end(j === undefined ? '' : JSON.stringify(j)); };
  const p = url.pathname.replace(/^\/finto/, ''), q = url.searchParams;
  if (req.headers.apikey !== 'chiave-finta') return send(401, { message: 'no api key' });
  if (p === '/auth/v1/settings') return send(200, { external: { google: true } });
  if (p === '/auth/v1/token') { const id = String(body.refresh_token || '').slice(3); return send(200, { access_token: 'AT-' + id, refresh_token: 'RT-' + id, expires_in: 3600, user: { id } }); }
  const me = uidOf(req); if (!me) return send(401, { message: 'JWT' });
  // la funzione «libri»: come supabase/funzioni/libri/index.ts
  if (p === '/functions/v1/libri') {
    const da = q.get('da'), u = q.get('u') || '';
    DB.libri.push({ me, da, u, isbn: q.get('isbn') });
    if (q.has('isbn')) {                                   // worker della casa (031): per chiunque abbia l'accesso, senza «da»
      if (DB.wmode === 'mio') return send(429, { error: 'limite del giorno' }, { 'x-nl-stop': 'mio', 'x-nl-mio': '500' });
      DB.sbnN = (DB.sbnN || 0) + 1;
      return send(200, { numFound: 0 }, { 'x-nl-mio': String(DB.sbnN) }); }
    if (!/^\/books\/v1\/volumes\?/.test(u)) return send(400, { error: { code: 400 } });
    const k = DB.keys.find(x => x.da === da && x.a === me && x.gb_key);
    if (!k) return send(403, { error: { code: 403, message: 'chiave non prestata' } }, { 'x-nl-stop': 'no' });
    if (DB.mode === 'mio') return send(429, { error: { code: 429 } }, { 'x-nl-stop': 'mio', 'x-nl-tot': String(DB.tot), 'x-nl-mio': '300' });
    DB.tot++; DB.mio++;
    return send(200, { totalItems: 1, items: [{ id: 'g1', volumeInfo: { title: 'Il nome della rosa', authors: ['Umberto Eco'], publisher: 'Bompiani', publishedDate: '1980', language: 'it', pageCount: 503,
      industryIdentifiers: [{ type: 'ISBN_13', identifier: '9788845278655' }] } }] }, { 'x-nl-tot': String(DB.tot), 'x-nl-mio': String(DB.mio) });
  }
  if (p === '/rest/v1/libri' && req.method === 'GET') return send(200, []);
  if (p === '/rest/v1/libri') return send(201);
  if (p === '/rest/v1/profili' && req.method === 'GET') { const pr = DB.prof[me]; return send(200, [{ utente: pr.utente, nome: pr.nome, desideri: false, libreria: true }]); }
  if (p === '/rest/v1/profili') return send(201);
  if (p === '/rest/v1/rpc/miei_amici') { const o = me === UA ? UB : UA; return send(200, [{ id: o, utente: DB.prof[o].utente, nome: DB.prof[o].nome, stato: 'amici', verso: 'inviata', creato: '2026-11-16T10:00:00Z' }]); }
  if (p === '/rest/v1/rpc/chiavi_mie') return send(200, DB.keys.filter(k => k.da === me).map(k => ({ da: k.da, a: k.a, nome: DB.prof[k.a].utente, gb_key: k.gb_key ? 'si' : '', sbn: k.sbn ? 'si' : '' }))
    .concat(DB.keys.filter(k => k.a === me).map(k => ({ da: k.da, a: k.a, nome: DB.prof[k.da].utente, gb_key: k.gb_key ? 'prestata:' + k.da : '', sbn: k.sbn ? 'https://worker-prestato.invalid/' + k.da : '' }))));
  if (p === '/rest/v1/rpc/chiavi_controlla') return send(200, (body.valori || []).filter(v => DB.keys.some(k => k.da !== me && (k.gb_key === v || k.sbn === v))).map(v => ({ v, da: (DB.keys.find(k => k.a === me && k.da !== me && (k.gb_key === v || k.sbn === v)) || {}).da || null })));
  if (p === '/rest/v1/rpc/presta_chiavi') { DB.presta.push(body); if (DB.keys.some(k => k.da !== me && ((body.gb_key && k.gb_key === body.gb_key) || (body.sbn && k.sbn === body.sbn)))) return send(400, { message: 'non tua' }); return send(204); }
  if (p === '/rest/v1/rpc/chiavi_aggiorna') { DB.aggiorna.push({ me, k: body.gb_key }); let n = 0; DB.keys.forEach(k => { if (k.da === me && k.gb_key && k.gb_key !== body.gb_key) { k.gb_key = body.gb_key; n++; } }); return send(200, n); }
  if (p === '/rest/v1/rpc/conta_ricerche') { DB.conta.push({ me, chiave: body.chiave, n: body.n }); return send(200, 0); }
  if (p === '/rest/v1/rpc/mie_notifiche') return send(200, me === UB ? DB.avvisi : []);
  if (p === '/rest/v1/rpc/notifiche_lette') return send(204);
  if (p === '/rest/v1/rpc/da_archivio') return send(200, null);
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
}).listen(CFG.port(8333));
const base = 'http://localhost:' + CFG.port(8333);

(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [], fuori = [];
  const wait = H.wait;
  const SHOTS = process.env.SCHERMATE;
  async function phone(name, uid) {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: 360, height: 800, deviceScaleFactor: SHOTS ? 1 : 2, isMobile: true, hasTouch: true });
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    await page.evaluateOnNewDocument((u, id) => {
      window.NL_SOCIAL = { url: u, key: 'chiave-finta', gClient: 'client-finto' };
      if (!localStorage.getItem('prova:catalogo-libri-social-auth')) localStorage.setItem('prova:catalogo-libri-social-auth', JSON.stringify({ at: 'AT-' + id, rt: 'RT-' + id, exp: Date.now() + 3e6, uid: id, email: 'x@esempio.it' }));
      if (id.endsWith('b2') && !localStorage.getItem('prova:e2e133')) { localStorage.setItem('prova:e2e133', '1');   // Bruno: l’API e il worker di Anna salvati come suoi
        localStorage.setItem('prova:catalogo-libri-set', JSON.stringify({ gbKey: 'AIzaANNA0123456789abcdefghijklmnopq', sbnUrl: 'https://sbn-anna.esempio.workers.dev', name: 'Bruno', welcomed: 1, donSeen: 1 }));
        localStorage.setItem('prova:catalogo-libri-saved', JSON.stringify({ key: ['AIzaANNA0123456789abcdefghijklmnopq', 'AIzaBRUNOsua000000000000000000000001'], sbn: ['https://sbn-anna.esempio.workers.dev'] })); }
      if (!localStorage.getItem('prova:catalogo-libri-layout')) { localStorage.setItem('prova:catalogo-libri-layout', JSON.stringify({ v: 'a' })); localStorage.setItem('prova:catalogo-libri-card', JSON.stringify({ v: 'd' })); }
    }, base + '/finto', uid);
    await page.setRequestInterception(true);
    page.on('request', r => { if (r.url().startsWith(base)) return r.continue(); fuori.push(name + ' ' + r.url()); r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"totalItems":0}' }); });
    await page.goto(base + '/next-libris-prova/?vista=elenco', { waitUntil: 'load' }); await wait(2000);
    page.click$ = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error('manca ' + s); e.click(); }, sel);
    page.vis = sel => page.evaluate(s => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, sel);
    page.txt = sel => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
    page.shot = async (n) => { if (SHOTS) { await wait(250); await page.screenshot({ path: path.join(SHOTS, n + '.png') }); } };
    page.wide = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    return page;
  }

  const B = await phone('B', UB);
  await B.evaluate(() => window.NLAmici.load(true)); await wait(900);
  const st = await B.evaluate(() => ({ gb: window.NL.settings.gbKey, sbn: window.NL.settings.sbnUrl, saved: localStorage.getItem('prova:catalogo-libri-saved'), all: JSON.stringify(localStorage) }));
  console.log('[bruno]', st.gb, st.sbn, st.saved);
  assert.strictEqual(st.gb, 'prestata:' + UA, 'chiave dal server'); assert.strictEqual(st.sbn, '', 'nessun worker: né suo né prestato (031)');
  assert(!st.all.includes(KEY) && !st.all.includes(W) && !st.all.includes('worker-prestato'), 'sul telefono di Bruno non restano né l’API né il worker di Anna');
  const tw = await B.evaluate(() => Array.from(document.querySelectorAll('.toast')).map(t => t.innerText).join(' | '));
  assert(!/worker/i.test(tw), 'nessun avviso sul worker: ' + tw);
  assert(st.saved.includes('AIzaBRUNOsua'), 'la sua API salvata resta');
  // non può prestarli: niente «Presta a un amico» nella finestra dell’API
  await B.evaluate(() => window.NLAmici.keys()); await wait(300);
  const kw = await B.txt('#kwBody'); console.log('[finestra]', kw.slice(0, 200));
  assert(!/Tocca un amico per/.test(kw) && /Anna condivide con te la sua API Google/.test(kw) && /La stai usando/.test(kw) && !/worker/i.test(kw), 'niente prestito di quelle degli altri');
  // il server rifiuta comunque
  const r = await B.evaluate(async (k, a) => { try { await window.NLAmici.rpc('presta_chiavi', { a, gb_key: k, sbn: '' }); return 'ok'; } catch (e) { return String(e.message || e); } }, KEY, UA);
  assert(/non tua/.test(r), 'presta_chiavi: ' + r);
  // catalogo SBN della casa: dal server, con l'accesso di Bruno, senza indirizzi di worker sul telefono
  await B.evaluate(() => { const k = document.getElementById('kwClose'); if (k) k.click(); }); await wait(200);
  const n0 = DB.libri.length;
  await B.evaluate(async (u) => { await apiFetch(lookupOpts(true).sbnUrl + '?isbn=9788845278655'); }, 0);
  const last = DB.libri[n0]; console.log('[sbn]', JSON.stringify(last));
  assert(last && last.isbn === '9788845278655' && last.me === UB && !last.da, 'SBN passa dalla funzione, con l\'accesso e senza «da»');
  assert(!fuori.some(u => /sbn-anna|worker-prestato|sbn-casa|workers\.dev/.test(u)), 'nessuna richiesta a un worker dal telefono: ' + fuori.join(' '));
  await B.evaluate(() => window.NL.openOptions('search')); await wait(500);
  assert.strictEqual(await B.txt('#sbnSt'), 'Incluso');
  assert.strictEqual(await B.txt('#sbnCount'), 'Non devi fare niente. Ricerche di oggi: 1 su 500.');   // testo approvato (20/11/2026)
  assert.strictEqual(await B.wide(), 0, 'niente scorrimento di lato');
  await B.shot('133-ricerca-sbn-incluso-360');
  // 500 ricerche al giorno con l'account: poi il testo approvato, una volta, e niente più richieste al server fino al giorno dopo
  DB.wmode = 'mio';
  await B.evaluate(async () => { await apiFetch(lookupOpts(true).sbnUrl + '?isbn=9788845278655'); });
  await B.waitForFunction(() => /finito le ricerche nel catalogo/.test(document.body.innerText), { polling: 100, timeout: 4000 });
  const toastW = await B.evaluate(() => (document.body.innerText.match(/Per oggi hai finito[^\n]*/) || [''])[0]);
  assert.strictEqual(toastW, 'Per oggi hai finito le ricerche nel catalogo delle biblioteche (SBN). Fino a domattina l\'app cerca in Open Library e con Google.', toastW);
  assert.strictEqual(await B.txt('#sbnCount'), 'Non devi fare niente. Ricerche di oggi: 500 su 500.');
  const n1 = DB.libri.length;
  const st2 = await B.evaluate(async () => { const r = await apiFetch('https://sbn-casa.invalid/?isbn=9788845278655'); return { out: sbnOut(), sbn: lookupOpts(true).sbnUrl, local: !!r.local }; });
  assert(st2.out && st2.sbn === '' && st2.local && DB.libri.length === n1, 'dopo il limite niente SBN: ' + JSON.stringify(st2));
  assert.deepStrictEqual(errors, []);
  console.log('OK e2e133');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
