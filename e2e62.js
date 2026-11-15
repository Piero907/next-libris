const CFG = require("./_config");
// copia di prova allo stesso indirizzo di base (…/next-libris-prova/): dati, copie offline e titolo separati dalla versione vera (…/next-libris/);
// timbro della pubblicazione (BUILD): la prova propone «Aggiorna adesso» anche a parità di versione, la vera no
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.gz': 'application/gzip', '.wasm': 'application/wasm' };
let appBuild = '2026-11-15 20:00', siteBuild = '2026-11-15 20:00';
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  const m = p.match(/^\/(next-libris|next-libris-prova)(\/.*)?$/);
  if (!m) { res.writeHead(404); return res.end(); }
  if (!m[2]) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
  let rel = m[2] === '/' ? '/index.html' : m[2];
  if (m[1] === 'next-libris-prova' && rel === '/REGISTRO_PROVA.md') { res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' }); return res.end('# Registro della copia di prova\n\nIntro.\n\n## Prova 94.8 · 15/11/2026 20:00\n- **4 avvisi di prova**\n\n## Prova 94.7 · 15/11/2026 19:00\n- Copertine ed Elenco\n'); }
  const f = path.join(ROOT, rel); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  // nella prova, come fa pubblica_prova.py: app.js col suo timbro, version.json con quello pubblicato adesso
  if (m[1] === 'next-libris-prova' && rel === '/app.js') { res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-cache' }); return res.end(fs.readFileSync(f, 'utf8').replace("var BUILD = { t: '', n: '', note: '' };", 'var BUILD = ' + JSON.stringify({ t: appBuild, n: '94.8', note: 'avvisi di prova' }) + ';')); }
  if (m[1] === 'next-libris-prova' && rel === '/version.json') { const j = JSON.parse(fs.readFileSync(f, 'utf8')); j.build = siteBuild; j.prova = siteBuild === appBuild ? '94.8' : '94.9'; res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify(j)); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
}).listen(CFG.port(8182));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await page.setRequestInterception(true);
  page.on('request', r => r.url().startsWith('http://localhost:' + CFG.port(8182) + '') ? r.continue() : r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"totalItems":0}' }));
  // versione vera: un libro
  await page.goto('http://localhost:' + CFG.port(8182) + '/next-libris/?vista=elenco', { waitUntil: 'load' }); await wait(800);
  let info = await page.evaluate(() => ({ prova: document.documentElement.classList.contains('prova'), tag: !!document.querySelector('.prova-tag'), title: document.title }));
  console.log('[vera]', JSON.stringify(info)); assert(!info.prova && !info.tag);
  await page.evaluate(() => { window.__app.settings.price = false; window.__app.addIsbn('9788806219352'); }); await wait(800);
  assert.strictEqual(await page.evaluate(() => window.__app.state.books.length), 1);
  await page.waitForFunction(() => navigator.serviceWorker.controller, { timeout: 15000 }).catch(() => {});
  // copia di prova: vuota, con l'etichetta; i suoi libri restano suoi
  await page.goto('http://localhost:' + CFG.port(8182) + '/next-libris-prova/?vista=elenco', { waitUntil: 'load' }); await wait(800);
  info = await page.evaluate(() => ({ prova: document.documentElement.classList.contains('prova'), tag: document.querySelector('.prova-tag') && document.querySelector('.prova-tag').textContent, title: document.title, n: window.__app.state.books.length }));
  console.log('[prova]', JSON.stringify(info)); assert(info.prova && info.tag === 'PROVA' && /prova/.test(info.title) && info.n === 0, 'prova vuota e riconoscibile');
  await page.screenshot({ path: CFG.OUT + '/prova.png' });
  await page.evaluate(() => { window.__app.settings.price = false; window.__app.addIsbn('9788804668015'); window.__app.addIsbn('9788845292613'); }); await wait(900);
  assert.strictEqual(await page.evaluate(() => window.__app.state.books.length), 2);
  const keys = await page.evaluate(() => Object.keys(localStorage).sort()); console.log('[chiavi]', JSON.stringify(keys));
  assert(keys.includes('catalogo-libri-v2') && keys.includes('prova:catalogo-libri-v2'));
  await page.waitForFunction(() => navigator.serviceWorker.controller, { timeout: 15000 }).catch(() => {});
  await wait(1500);
  // di nuovo la vera: sempre e solo il suo libro
  await page.goto('http://localhost:' + CFG.port(8182) + '/next-libris/?vista=elenco', { waitUntil: 'load' }); await wait(800);
  assert.strictEqual(await page.evaluate(() => window.__app.state.books.length), 1, 'la vera non vede i libri della prova');
  await wait(1500);
  const cs = await page.evaluate(async () => (await caches.keys()).sort()); console.log('[copie offline]', JSON.stringify(cs));
  assert(cs.some(k => /^catalogo-libri-v\d+$/.test(k)) && cs.some(k => /^prova-catalogo-libri-v\d+$/.test(k)), 'copie offline separate e tutte e due presenti');
  const dbs = await page.evaluate(async () => indexedDB.databases ? (await indexedDB.databases()).map(d => d.name).sort() : []); console.log('[database]', JSON.stringify(dbs));
  assert(!dbs.length || !dbs.includes('prova-catalogo-libri') || dbs.includes('catalogo-libri'));
  // timbro: stessa pubblicazione -> nessun avviso; pubblicazione piu' nuova -> «Aggiorna adesso» solo nella prova
  const provaUrl = 'http://localhost:' + CFG.port(8182) + '/next-libris-prova/?vista=elenco';
  await page.goto(provaUrl, { waitUntil: 'load' }); await wait(3200);
  let nt = await page.evaluate(() => { const n = document.querySelector('#notice'); return n.hidden ? '' : n.innerText; });
  assert(!/aggiornamento della copia di prova/.test(nt), 'stesso timbro: niente avviso');
  siteBuild = '2026-11-15 22:05';
  await page.goto(provaUrl, { waitUntil: 'load' }); await wait(3200);
  nt = await page.evaluate(() => { const n = document.querySelector('#notice'); return n.hidden ? '' : n.innerText; }); console.log('[timbro nuovo]', nt.replace(/\s+/g, ' '));
  assert(/aggiornamento della copia di prova \(94\.9, del 15\/11 alle 22:05\)/.test(nt) && /Aggiorna adesso/.test(nt));
  await page.evaluate(() => window.__app.openDrawer('opt')); await wait(400);
  const vd = await page.$eval('#verDate', e => e.textContent), vs = await page.$eval('#verState', e => e.textContent); console.log('[menu]', vd, '|', vs);
  assert(/prova 94\.8 del 15\/11 alle 20:00/.test(vd) && /aggiornamento della prova \(94\.9/.test(vs) && await page.$eval('#verUpdate', e => !e.hidden));
  assert(/Ultime novità della prova: avvisi di prova/.test(await page.$eval('#verNote', e => e.textContent)));
  // il registro della prova sopra quello della versione vera, con «questa» sulla prova in uso
  await page.click('#verLog'); await wait(700);
  const lg = await page.evaluate(() => ({ parts: [...document.querySelectorAll('#logBody .log-part')].map(e => e.textContent), cur: document.querySelector('#logBody .log-v.cur h3').textContent, first: document.querySelector('#logBody .log-v h3').textContent }));
  console.log('[registro prova]', JSON.stringify(lg));
  assert.deepStrictEqual(lg.parts, ['Copia di prova', 'Versione vera']); assert(/^Prova 94\.8/.test(lg.cur) && /questa/.test(lg.cur) && /^Prova 94\.8/.test(lg.first));
  await page.click('#logClose'); await wait(300);
  await page.evaluate(() => window.__app.closeDrawer()); await wait(300);
  await page.goto('http://localhost:' + CFG.port(8182) + '/next-libris/?vista=elenco', { waitUntil: 'load' }); await wait(3200);
  nt = await page.evaluate(() => { const n = document.querySelector('#notice'); return n.hidden ? '' : n.innerText; });
  assert(!/copia di prova/.test(nt), 'la vera non guarda il timbro');
  assert.deepStrictEqual(errors, []);
  console.log('e2e62 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
