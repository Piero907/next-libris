const CFG = require("./_config");
// 17/11/2026: trasloco da piero907.github.io a nextlibris.github.io (trasloco.html / trasloco.js).
// Due indirizzi finti: due porte diverse (vecchio e nuovo), la pagina li prende da ?vecchio=&nuovo= solo sul computer.
// 1) Il vecchio apre il nuovo: passano libri, impostazioni, account e foto della copia (solo «prova:»); non passano
//    la versione vera, le notifiche push e il segno del trasloco; il vecchio ricorda che e' fatto; l'app nuova si apre con i libri.
// 2) Il nuovo, gia' con dei libri, chiede «Sostituisci», poi apre lui il vecchio (?invia=1) e riceve i libri aggiornati.
// 3) Un terzo indirizzo che apre la pagina nuova e le manda dati finti: ignorato.
// 4) File del trasloco: scaricato al vecchio, caricato al nuovo (foto comprese).
// 5) Vecchio indirizzo senza dati: va dritto al nuovo, portando ?amico=.
// Con SCHERMATE=cartella fa le foto delle pagine (360, 412 scuro).
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm' };
function serve(p) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const q = decodeURIComponent(url.pathname), m = q.match(/^\/next-libris-prova(\/.*)?$/);
    if (!m) { res.writeHead(404); return res.end(); }
    if (!m[1]) { res.writeHead(301, { Location: q + '/' }); return res.end(); }
    const f = path.join(ROOT, m[1] === '/' ? '/index.html' : m[1]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
  }).listen(p);
}
const PV = CFG.port(8313), PN = CFG.port(8314), PX = CFG.port(8315);
const servers = [serve(PV), serve(PN), serve(PX)];
const V = 'http://127.0.0.1:' + PV, N = 'http://127.0.0.1:' + PN, X = 'http://127.0.0.1:' + PX;
const QS = '?vecchio=' + encodeURIComponent(V) + '&nuovo=' + encodeURIComponent(N);
const OUT = path.join(CFG.OUT, 'e2e113'); fs.mkdirSync(OUT, { recursive: true });
const SHOTS = process.env.SCHERMATE;
const passo = (t) => { if (process.env.PASSI) console.log('passo', t); };
const B = (o) => Object.assign({ t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 1, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: 'da', rt: 0, rd: '' }, o);
const LIBRI = [B({ id: 'rosa', t: 'Il nome della rosa', a: 'Umberto Eco' }), B({ id: 'gatto', t: 'Il gattopardo', a: 'Tomasi di Lampedusa' }), B({ id: 'zeno', t: 'La coscienza di Zeno', a: 'Italo Svevo' })];

(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const ctx = await browser.createBrowserContext();
  function guard(page, nome) {
    page.on('pageerror', e => errors.push(nome + ': ' + e.message));
    page.on('dialog', d => d.accept());
  }
  async function aperta(fn) {   // la scheda che si apre con window.open
    const p = new Promise(r => ctx.once('targetcreated', async t => r(await t.page())));
    await fn(); const pg = await p; guard(pg, 'popup'); return pg;
  }
  async function attendi(page, fn, arg, ms) {
    try { await page.waitForFunction(fn, { timeout: ms || 10000, polling: 150 }, arg); }
    catch (e) { const s = await page.evaluate(() => [location.href, (document.querySelector('#trTit') || {}).textContent, (document.querySelector('#trTxt') || {}).textContent, (document.querySelector('#trStato') || {}).textContent].join(' | ')).catch(() => '?'); throw new Error('attesa scaduta: ' + fn.toString().slice(0, 90) + ' → ' + s + ' ' + errors.join(' ; ')); }
  }
  const tit = (page) => page.$eval('#trTit', e => e.textContent);
  const dati = (page) => page.evaluate(async () => {
    const ls = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); }
    const foto = await new Promise(res => { const r = indexedDB.open('prova-catalogo-libri', 1); r.onupgradeneeded = () => r.result.createObjectStore('covers');
      r.onsuccess = () => { const out = {}; const tx = r.result.transaction('covers'); const q = tx.objectStore('covers').openCursor();
        q.onsuccess = () => { const c = q.result; if (c) { out[c.key] = c.value instanceof Blob ? 'blob:' + c.value.type + ':' + c.value.size : typeof c.value; c.continue(); } };
        tx.oncomplete = () => { r.result.close(); res(out); }; }; });
    return { ls, foto };
  });
  const libri = (d) => JSON.parse(d.ls['prova:catalogo-libri-v2'] || '{"books":[]}').books.map(b => b.id).sort().join(',');

  // --- vecchio indirizzo con i dati della prova (e della versione vera, che non deve passare) ---
  const old = await ctx.newPage(); guard(old, 'vecchio');
  await old.setViewport({ width: 360, height: 760, isMobile: true, hasTouch: true });
  await old.goto(V + '/next-libris-prova/manifest.json');
  await old.evaluate(async (b) => {
    localStorage.setItem('prova:catalogo-libri-v2', JSON.stringify({ books: b, updated: 5 }));
    localStorage.setItem('prova:catalogo-libri-set', JSON.stringify({ name: 'Piero', theme: 'light' }));
    localStorage.setItem('prova:catalogo-libri-social-auth', JSON.stringify({ uid: 'u1', at: 'tok', rt: 'ref' }));
    localStorage.setItem('prova:catalogo-libri-push', JSON.stringify({ on: true }));
    localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: [{ id: 'vera' }] }));
    localStorage.setItem('altro-sito', 'x');
    const cv = document.createElement('canvas'); cv.width = 40; cv.height = 60; const g = cv.getContext('2d'); g.fillStyle = '#a33'; g.fillRect(0, 0, 40, 60);
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', .8));
    await new Promise((res, rej) => { const r = indexedDB.open('prova-catalogo-libri', 1); r.onupgradeneeded = () => r.result.createObjectStore('covers');
      r.onsuccess = () => { const tx = r.result.transaction('covers', 'readwrite'); tx.objectStore('covers').put(blob, 'rosa'); tx.objectStore('covers').put(blob, 'zeno'); tx.oncomplete = () => { r.result.close(); res(); }; tx.onerror = rej; }; });
  }, LIBRI);
  await old.goto(V + '/next-libris-prova/trasloco.html' + QS, { waitUntil: 'load' });
  await attendi(old, () => !document.querySelector('#trGo').hidden);
  assert.match(await old.$eval('#trTxt', e => e.textContent), /3 libri e 2 foto/, 'il vecchio conta libri e foto');
  if (SHOTS) await old.screenshot({ path: path.join(SHOTS, 'e2e113-vecchio-360.png') });

  passo('// 1) il vecchio apre il nuovo');
  // 1) il vecchio apre il nuovo
  const nw = await aperta(() => old.click('#trGo'));
  await attendi(old, () => document.querySelector('#trTit').textContent === 'Trasloco fatto');
  await attendi(nw, () => document.querySelector('#trTit').textContent === 'Trasloco fatto');
  assert.match(await nw.$eval('#trTxt', e => e.textContent), /3 libri e 2 foto/);
  let d = await dati(nw);
  assert.strictEqual(libri(d), 'gatto,rosa,zeno', 'libri arrivati');
  assert.ok(d.ls['prova:catalogo-libri-social-auth'], 'account arrivato');
  assert.ok(d.ls['prova:catalogo-libri-set'], 'impostazioni arrivate');
  assert.ok(!d.ls['prova:catalogo-libri-push'], 'push non passa');
  assert.ok(!d.ls['catalogo-libri-v2'] && !d.ls['altro-sito'], 'solo i dati della prova');
  assert.ok(!d.ls['prova:catalogo-libri-trasloco'], 'il segno del trasloco non passa');
  assert.deepStrictEqual(Object.keys(d.foto).sort(), ['rosa', 'zeno']);
  assert.ok(/^blob:image\/jpeg:\d+$/.test(d.foto.rosa), 'foto come immagini: ' + d.foto.rosa);
  assert.ok(Number(await old.evaluate(() => localStorage.getItem('prova:catalogo-libri-trasloco'))) > 0, 'il vecchio ricorda il trasloco');
  passo('// «Apri Next Libris» porta');
  // «Apri Next Libris» porta all'app nuova (al posto della pagina del trasloco)
 
  const navApp = new Promise(r => nw.on('framenavigated', f => { if (f === nw.mainFrame() && !/trasloco/.test(f.url())) r(f.url()); }));
  await nw.evaluate(() => localStorage.removeItem('prova:catalogo-libri-social-auth'));   // l'account finto non deve cercare Supabase
 
  await nw.setRequestInterception(true);
 
  nw.on('request', r => r.url().startsWith(N) ? r.continue() : r.respond({ status: 200, contentType: 'application/json', body: '{"totalItems":0}' }));
  await nw.click('#trGo');
 
  assert.strictEqual(await navApp, N + '/next-libris-prova/', 'apre l\'app nuova');
 
  await nw.close();
  passo("// l'app nuova si apre con i l");
  // l'app nuova si apre con i libri trasferiti
  const app = await ctx.newPage(); guard(app, 'app');
  await app.setRequestInterception(true);
  app.on('request', r => r.url().startsWith(N) ? r.continue() : r.respond({ status: 200, contentType: 'application/json', body: '{"totalItems":0}' }));
  await app.goto(N + '/next-libris-prova/', { waitUntil: 'load' });
  await app.waitForFunction(() => window.NL && document.body.innerText.includes('Il gattopardo') && document.body.innerText.includes('La coscienza di Zeno'), { timeout: 15000, polling: 200 });
  await app.close();
  passo('// al ritorno, il vecchio dice');
  // al ritorno, il vecchio dice che e' fatto
  await old.reload({ waitUntil: 'load' }); await attendi(old, () => !document.querySelector('#trGo').hidden);
  assert.strictEqual(await old.$eval('#trGo', e => e.textContent), 'Apri Next Libris');
  assert.strictEqual(await old.$eval('#trAlt', e => e.textContent), 'Rifai il trasloco');

  passo("// 2) un libro in piu'");
  // 2) un libro in piu' al vecchio; il nuovo (che ha gia' 3 libri) chiede di sostituire e apre lui il vecchio
  await old.evaluate((b) => localStorage.setItem('prova:catalogo-libri-v2', JSON.stringify({ books: b, updated: 6 })), LIBRI.concat([B({ id: 'calvino', t: 'Il barone rampante', a: 'Italo Calvino' })]));
  const n2 = await ctx.newPage(); guard(n2, 'nuovo2');
  await n2.setViewport({ width: 360, height: 760, isMobile: true, hasTouch: true });
  await n2.goto(N + '/next-libris-prova/trasloco.html' + QS, { waitUntil: 'load' });
  await attendi(n2, () => document.querySelector('#trGo').textContent === 'Sostituisci');
  assert.match(await n2.$eval('#trTxt', e => e.textContent), /già 3 libri/);
  if (SHOTS) await n2.screenshot({ path: path.join(SHOTS, 'e2e113-nuovo-sostituisci-360.png') });
  await n2.click('#trGo');
  await attendi(n2, () => document.querySelector('#trGo').textContent === 'Prendi i miei libri');
  const v2 = await aperta(() => n2.click('#trGo'));
  await attendi(n2, () => document.querySelector('#trTit').textContent === 'Trasloco fatto');
  d = await dati(n2);
  assert.strictEqual(libri(d), 'calvino,gatto,rosa,zeno', 'libri aggiornati');
  if (SHOTS) { await n2.bringToFront(); await n2.setViewport({ width: 412, height: 800, isMobile: true, hasTouch: true }); await n2.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await n2.screenshot({ path: path.join(SHOTS, 'e2e113-nuovo-fatto-412scuro.png') }); await n2.evaluate(() => document.documentElement.removeAttribute('data-theme')); await n2.setViewport({ width: 360, height: 760, isMobile: true, hasTouch: true }); }
  await wait(2000);
  assert.ok(v2.isClosed(), 'la scheda del vecchio si chiude da sola');

  passo('// 3) un altro indirizzo');
  // 3) un altro indirizzo prova a mandare dati finti: ignorati
  const ev = await ctx.newPage(); guard(ev, 'altro');
  await ev.goto(X + '/next-libris-prova/manifest.json');
  await ev.evaluate((u) => { window.w = window.open(u, '_blank'); }, N + '/next-libris-prova/trasloco.html' + QS);
  await wait(1500);
  await ev.evaluate(() => { for (let i = 0; i < 5; i++) window.w.postMessage({ t: 'dati', copia: 'prova', ls: { 'catalogo-libri-v2': JSON.stringify({ books: [{ id: 'finto' }] }) }, db: {}, libri: 1, foto: 0 }, '*'); });
  await wait(1000);
  d = await dati(n2);
  assert.strictEqual(libri(d), 'calvino,gatto,rosa,zeno', 'dati finti ignorati');
  for (const pg of await ctx.pages()) if (pg !== old && pg !== n2 && !pg.isClosed()) await pg.close().catch(() => {});

  passo('// 4) file del trasloco');
  // 4) file del trasloco: scaricato al vecchio (con un libro in meno), caricato al nuovo
  await old.evaluate((b) => localStorage.setItem('prova:catalogo-libri-v2', JSON.stringify({ books: b, updated: 7 })), LIBRI.slice(0, 2));
  await old.reload({ waitUntil: 'load' }); await attendi(old, () => !document.querySelector('#trGo').hidden);
  // lo scaricamento vero chiude la scheda in Chrome senza schermo: il file si prende dalla pagina, al posto del clic sul link
  await old.evaluate(() => { HTMLAnchorElement.prototype.click = function () { const a = this; window.__nome = a.download; fetch(a.href).then(r => r.text()).then(t => { window.__file = t; }); }; });
  passo('await old.bringToFront(); awai');
  await old.bringToFront(); await old.click('#trScarica');
  await attendi(old, () => !!window.__file, null, 20000);
  assert.strictEqual(await old.evaluate(() => window.__nome), 'next-libris-trasloco-prova.json');
  passo('const fileT = path.join(OUT');
  const fileT = path.join(OUT, 'next-libris-trasloco-prova.json');
  fs.writeFileSync(fileT, await old.evaluate(() => window.__file));
  const fj = JSON.parse(fs.readFileSync(fileT, 'utf8'));
  assert.strictEqual(fj.app, 'next-libris-trasloco'); assert.strictEqual(fj.copia, 'prova');
  passo('// le foto restano le stesse');
  // le foto restano le stesse del passo 1: per vedere che arrivano dal file, al nuovo si tolgono prima
  await n2.evaluate(() => new Promise(res => { const r = indexedDB.open('prova-catalogo-libri', 1); r.onsuccess = () => { const tx = r.result.transaction('covers', 'readwrite'); tx.objectStore('covers').clear(); tx.oncomplete = () => { r.result.close(); res(); }; }; }));
  await n2.goto(N + '/next-libris-prova/trasloco.html' + QS, { waitUntil: 'load' });
  passo('await n2.bringToFront();');
  await n2.bringToFront(); const inp = await n2.$('#trFile'); await inp.uploadFile(fileT);
  await attendi(n2, () => document.querySelector('#trTit').textContent === 'Trasloco fatto');
  d = await dati(n2);
  assert.strictEqual(libri(d), 'gatto,rosa', 'libri dal file');
  assert.deepStrictEqual(Object.keys(d.foto).sort(), ['rosa', 'zeno'], 'foto dal file');
  assert.ok(/^blob:image\/jpeg:\d+$/.test(d.foto.zeno));
  passo('// un file della versione vera');
  // un file della versione vera non entra nella prova
  const fv = path.join(OUT, 'vera.json'); fs.writeFileSync(fv, JSON.stringify(Object.assign({}, fj, { copia: '' })));
  await n2.goto(N + '/next-libris-prova/trasloco.html' + QS, { waitUntil: 'load' });
  await (await n2.$('#trFile')).uploadFile(fv);
  await attendi(n2, () => /versione vera/.test(document.querySelector('#trStato').textContent));

  passo('// 5) vecchio indirizzo senza ');
  // 5) vecchio indirizzo senza dati (altro telefono): dritto al nuovo, con l'invito
  const ctx2 = await browser.createBrowserContext();
  const e5 = await ctx2.newPage(); e5.on('pageerror', e => errors.push('vuoto: ' + e.message));
  await e5.setRequestInterception(true);
  e5.on('request', r => r.url().startsWith(V) || r.url().startsWith(N) ? r.continue() : r.respond({ status: 200, contentType: 'application/json', body: '{"totalItems":0}' }));
  const arrivo = new Promise(r => e5.on('framenavigated', f => { if (f === e5.mainFrame() && f.url().startsWith(N)) r(f.url()); }));
  await e5.goto(V + '/next-libris-prova/trasloco.html' + QS + '&amico=anna#x', { waitUntil: 'load' });
  assert.strictEqual(await arrivo, N + '/next-libris-prova/?amico=anna#x', 'l\'invito arriva al nuovo indirizzo');   // poi l'app lo legge e lo toglie
  // e nessun database vuoto creato al vecchio indirizzo
  await e5.goto(V + '/next-libris-prova/manifest.json');
  const dbs = await e5.evaluate(async () => (await indexedDB.databases()).map(x => x.name));
  assert.ok(!dbs.includes('prova-catalogo-libri'), 'nessun database creato per sbaglio: ' + dbs);

  passo('// larghezza e errori');
  // larghezza e errori
  for (const p of [old, n2]) assert.ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 0), 'niente scorrimento di lato');
  const err = errors.filter(e => !/Failed to load resource|net::ERR/.test(e));
  assert.deepStrictEqual(err, [], 'errori JavaScript: ' + err.join(' | '));
  console.log('e2e113 OK: trasloco (vecchio→nuovo, nuovo→vecchio con Sostituisci, altri indirizzi ignorati, file, vecchio vuoto)');
  await browser.close(); servers.forEach(s => s.close());
})().catch(async e => { console.error('e2e113 FALLITA:', e.message); process.exit(1); });
