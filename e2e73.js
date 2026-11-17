const CFG = require("./_config");
const H = require('./_harness');
// due copie allo stesso indirizzo di base: vera (…/next-libris/) e prova (…/next-libris-prova/). (Fino al 16/11/2026 c'era anche la social.)
// Ognuna ha libri, impostazioni, database delle copertine e copie offline suoi; nessun service worker cancella le copie offline delle altre;
// l'etichetta dice il nome della copia; il tema all'avvio (prima di app.js) si legge dalle impostazioni della copia giusta
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.gz': 'application/gzip', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const m = p.match(/^\/(next-libris|next-libris-prova)(\/.*)?$/);
  if (!m) { res.writeHead(404); return res.end(); }
  if (!m[2]) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
  const rel = m[2] === '/' ? '/index.html' : m[2];
  const f = path.join(ROOT, rel); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
}).listen(CFG.port(8193));
const base = 'http://localhost:' + CFG.port(8193);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const wait = H.wait;   // attesa «finché» (_harness.js)
  await page.setRequestInterception(true);
  page.on('request', r => r.url().startsWith(base) ? r.continue() : r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"totalItems":0}' }));
  const open = async (copy) => { await page.goto(base + '/' + copy + '/?vista=elenco', { waitUntil: 'load' }); await wait(800); };
  const info = () => page.evaluate(() => ({ cls: [...document.documentElement.classList].filter(c => /prova|copia/.test(c)).sort(), tag: document.querySelector('.prova-tag') ? document.querySelector('.prova-tag').textContent : '', title: document.title, n: window.__app.state.books.length, theme: document.documentElement.getAttribute('data-theme') }));
  const add = async (...isbn) => { await page.evaluate((l) => { window.__app.settings.price = false; l.forEach(i => window.__app.addIsbn(i)); }, isbn); await wait(900); };
  const sw = async () => { await page.waitForFunction(() => navigator.serviceWorker.controller, { timeout: 15000 }).catch(() => {}); await wait(1500); };

  // versione vera: un libro, nessuna etichetta
  await open('next-libris'); let i = await info(); console.log('[vera]', JSON.stringify(i));
  assert(!i.cls.length && !i.tag && i.title === 'Next Libris', 'la vera non ha etichetta');
  await add('9788806219352'); await sw();
  // prova: come prima (chiavi «prova:», database e copie offline «prova-»)
  await open('next-libris-prova'); i = await info(); console.log('[prova]', JSON.stringify(i));
  assert.deepStrictEqual(i.cls, ['copia-prova', 'prova']); assert(i.tag === 'PROVA' && /\(prova\)/.test(i.title) && i.n === 0);
  await add('9788804668015', '9788845292613'); await sw();
  // ognuna vede solo i suoi libri
  await open('next-libris'); assert.strictEqual((await info()).n, 1, 'la vera non vede i libri delle copie');
  await open('next-libris-prova'); assert.strictEqual((await info()).n, 2, 'la prova vede solo i suoi');
  const keys = await page.evaluate(() => Object.keys(localStorage).sort()); console.log('[chiavi]', JSON.stringify(keys));
  assert(keys.includes('catalogo-libri-v2') && keys.includes('prova:catalogo-libri-v2'));
  assert(keys.every(k => /^(prova:)?catalogo-libri/.test(k)), 'nessuna chiave senza il prefisso della sua copia');
  const dbs = await page.evaluate(async () => indexedDB.databases ? (await indexedDB.databases()).map(d => d.name).sort() : []); console.log('[database]', JSON.stringify(dbs));
  assert(!dbs.length || !dbs.some(d => /^(?!prova-)[a-z]+-catalogo-libri$/.test(d)), 'database solo con nomi noti');
  // tema all'avvio: la prova scura, la vera chiara; lo script in testa a index.html legge la copia giusta
  // (anche nelle impostazioni in memoria: la pagina aperta le risalva quando passa in secondo piano)
  await page.evaluate(() => { window.__app.settings.themeV2 = true; window.__app.settings.theme = 'dark'; const k = 'prova:catalogo-libri-set'; const s = JSON.parse(localStorage.getItem(k) || '{}'); s.themeV2 = true; s.theme = 'dark'; localStorage.setItem(k, JSON.stringify(s)); });
  assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')).theme), 'light');
  // il primo valore di data-theme, scritto dallo script in testa a index.html (prima che parta app.js)
  const early = async (copy) => {
    const pg = await browser.newPage();
    await pg.evaluateOnNewDocument(() => { new MutationObserver(() => { if (window.__t0 === undefined && document.documentElement) window.__t0 = document.documentElement.getAttribute('data-theme'); }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-theme'] }); });
    await pg.goto(base + '/' + copy + '/', { waitUntil: 'load' }); const t = await pg.evaluate(() => window.__t0); await pg.close(); return t;
  };
  const tS = await early('next-libris-prova'), tV = await early('next-libris'); console.log('[tema all\'avvio]', 'prova', tS, '| vera', tV);
  assert.strictEqual(tS, 'dark'); assert.strictEqual(tV, 'light');
  // copie offline: tutte e due presenti, anche dopo che il service worker della vera si e' riattivato
  await open('next-libris'); await sw();
  const cs = await page.evaluate(async () => (await caches.keys()).sort()); console.log('[copie offline]', JSON.stringify(cs));
  assert(cs.some(k => /^catalogo-libri-v\d+$/.test(k)) && cs.some(k => /^prova-catalogo-libri-v\d+$/.test(k)), 'copie offline separate e tutte presenti');
  // una copia offline vecchia della prova non la tocca la vera, ma la cancella la prova stessa
  await page.evaluate(async () => { await (await caches.open('prova-catalogo-libri-v1')).put('/x', new Response('x')); await (await caches.open('catalogo-libri-v1')).put('/x', new Response('x')); });
  const reg = async (copy) => page.evaluate(async (c) => { const r = await navigator.serviceWorker.getRegistration('/' + c + '/'); if (r) await r.unregister(); }, copy);
  await reg('next-libris'); await open('next-libris'); await sw();
  let cs2 = await page.evaluate(async () => (await caches.keys()).sort()); console.log('[dopo la vera]', JSON.stringify(cs2));
  assert(!cs2.includes('catalogo-libri-v1') && cs2.includes('prova-catalogo-libri-v1'), 'la vera cancella solo le sue copie vecchie');
  await reg('next-libris-prova'); await open('next-libris-prova'); await sw();
  cs2 = await page.evaluate(async () => (await caches.keys()).sort()); console.log('[dopo la prova]', JSON.stringify(cs2));
  assert(!cs2.includes('prova-catalogo-libri-v1') && cs2.some(k => /^catalogo-libri-v\d+$/.test(k)) && cs2.some(k => /^prova-catalogo-libri-v\d+$/.test(k)), 'la prova cancella solo le sue');
  assert.deepStrictEqual(errors, []);
  console.log('e2e73 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
