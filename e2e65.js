const CFG = require("./_config");
const H = require('./_harness');
// Disposizione dell'app con lo stile G (riscritta il 20/11/2026: la barra in basso e la disposizione classica non ci sono più).
// Segnalibri al posto della barra; «+ Aggiungi» apre la finestra Aggiungi (Scansiona, Ce l'ho già?…); Per te con Suggerimenti,
// Citazioni, Statistiche, Backup; Desideri dal segnalibro; avvisi in cima uno alla volta, con i pallini e lo scorrimento col dito.
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
let noMod = false;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; if (noMod && /^\/layout\./.test(p)) { res.writeHead(404); return res.end(); } const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8185));
const today = new Date().toISOString().slice(0, 10);
const books = Array.from({ length: 14 }, (_, i) => ({ id: 'k' + i, t: 'Libro numero ' + i, a: 'Autore ' + (i % 4), c: 10, ts: Date.now() - i * 864e5, rs: i === 0 ? 'ok' : 'da', rd: i === 0 ? today : '', gen: 'Romanzo', pg: String(200 + i * 10), p: i === 3 ? 'Anna' : '', pd: i === 3 ? today : '', xs: i === 13 ? 'v' : '', qs: i === 1 ? [{ x: 'Una citazione', pg: '', d: Date.now(), phs: [] }] : [] }));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const wait = H.wait;   // attesa «finché» (_harness.js)
  await page.goto('http://localhost:' + CFG.port(8185) + '/?vista=elenco', { waitUntil: 'load' });
  await page.evaluate(b => { const o = Storage.prototype.setItem; localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: Date.now() })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'Piero', selTip: 1, lastBackup: Date.now(), donOpens: 9, donUntil: 0 })); localStorage.setItem('catalogo-libri-layout', JSON.stringify({ v: 'classico' })); Storage.prototype.setItem = function (k, v) { if (/^catalogo-libri-v2$/.test(k)) return; return o.call(this, k, v); }; }, books);
  await page.reload({ waitUntil: 'load' }); await wait(900);
    await page.evaluate(() => { window.NL.scan = function (m) { window.__hit = m === 'check' ? 'check' : 'scan'; }; });   // la fotocamera non parte: basta sapere che la finestra del + l'ha chiesta
  const vis = s => page.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return !e.closest('[hidden]') && getComputedStyle(e).display !== 'none' && r.width > 0 && r.height > 0; }, s);
  const txt = s => page.$eval(s, e => e.innerText.replace(/\s+/g, ' ').trim());
  // stile G: segnalibri, niente barra in basso né tasti grandi di prima
  assert.strictEqual(await page.evaluate(() => document.documentElement.dataset.layout), 'a');
  assert(await vis('#gTabs') && await page.evaluate(() => !document.querySelector('#layNav, .dock, #tabLib, #btnStats, #summary, #btnOpts, #fltLoan, #edgeTab')), 'stile G: segnalibri; i pezzi delle vecchie disposizioni non esistono più');
  assert.strictEqual(await page.evaluate(() => localStorage.getItem('catalogo-libri-layout')), null, 'la scelta della vecchia disposizione viene cancellata');
  // la frase in prosa dice i prestiti, e il link apre i libri prestati
  const prose = await txt('#gProse'); console.log('[frase]', prose);
  assert(/in prestito/.test(prose), 'frase con i prestiti');
  await page.click('#gProse [data-gl="loan"]'); await wait(300);
  assert.deepStrictEqual(await page.$$eval('#list [data-id]', e => e.map(x => x.dataset.id)), ['k3']);
  const lchip = await page.evaluate(() => { const c = document.querySelector('[data-clear="flt"]'); return c && c.getClientRects().length ? c.textContent : ''; }); console.log('[filtro prestiti]', lchip);
  assert(/In prestito/.test(lchip), 'filtro «In prestito» visibile');
  await page.click('[data-clear="flt"]'); await wait(250);
  // avvisi in cima, uno alla volta, con i pallini
  const notes = await page.evaluate(() => ['#notice', '#nxBox', '#wrapAsk', '#donAsk', '#instCard', '#donRow'].map(k => document.querySelector(k)).filter(e => e && !e.hidden).map(e => e.id + (e.classList.contains('lay-later') ? '' : ':ora')));
  console.log('[avvisi]', notes.join(' '), '|', await page.$eval('#layMore', e => e.getAttribute('aria-label')));
  assert(notes.filter(x => /:ora/.test(x)).length === 1 && notes.length >= 2 && /Avviso 1 di/.test(await page.$eval('#layMore', e => e.getAttribute('aria-label'))));
  const swipe = async (dx, dy = 0) => {
    const r = await page.evaluate(() => { const e = document.querySelector('[data-lay-swipe]').getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + 30 }; });
    await page.touchscreen.touchStart(r.x, r.y);
    for (let i = 1; i <= 6; i++) { await page.touchscreen.touchMove(r.x + dx * i / 6, r.y + dy * i / 6); await wait(16); }
    await page.touchscreen.touchEnd(); await wait(500);
  };
  const idx = async () => (await page.$eval('#layMore', e => e.getAttribute('aria-label'))).match(/Avviso (\d+) di/)[1];
  await swipe(-160); assert.strictEqual(await idx(), '2', 'verso sinistra: il prossimo');
  await swipe(150); assert.strictEqual(await idx(), '1', 'verso destra: quello prima');
  await swipe(-30, 160); assert.strictEqual(await idx(), '1', 'in verticale non cambia');
  assert(!(await page.evaluate(() => document.body.classList.contains('drawer-open'))), 'l\'Indice non si apre');
  await page.screenshot({ path: CFG.OUT + '/layout_g.png' });
  // Desideri dal segnalibro
  await page.click('#gTabs [data-g="wish"]'); await wait(300);
  assert.strictEqual(await page.evaluate(() => window.NL.tab()), 'wish'); assert(await page.$eval('#gTabs [data-g="wish"]', e => e.classList.contains('on')));
  assert(/Desideri/.test(await txt('header.top h1')));
  await page.click('#gTabs [data-g="lib"]'); await wait(300);
  // «+ Aggiungi»: la finestra, e i suoi tasti fanno partire le azioni vere
  await page.click('#gAdd'); await wait(300);
  assert(await vis('#layAdd')); await page.screenshot({ path: CFG.OUT + '/layout_g_add.png' });
  await page.click('#layAdd [data-l="scan"]'); await wait(150);
  assert.strictEqual(await page.evaluate(() => window.__hit), 'scan'); assert(!(await vis('#layAdd')));
  await page.click('#gAdd'); await wait(300); await page.click('#layAdd [data-l="check"]'); await wait(150);
  assert.strictEqual(await page.evaluate(() => window.__hit), 'check');
  // Per te
  await page.click('#gTabs [data-g="you"]'); await wait(300);
  const you = await txt('#layYouList'); console.log('[per te]', you);
  assert(/Suggerimenti/.test(you) && /Tutte le citazioni/.test(you) && /Statistiche/.test(you) && /Backup/.test(you));
  await page.screenshot({ path: CFG.OUT + '/layout_g_perte.png' });
  await page.click('#layYou [data-l="stats"]'); await wait(300);
  assert(await vis('#statsSheet')); await page.keyboard.press('Escape'); await wait(250);
  // Indice › Aspetto: niente scelta della disposizione
  await page.evaluate(() => window.__app.openOptions('look')); await wait(300);
  assert(await page.evaluate(() => !document.querySelector('#optLayout') && !/Disposizione dello schermo/.test(document.querySelector('#optSheet').innerText)), 'la scelta della disposizione non c\'e\' piu\'');
  await page.evaluate(() => window.__app.closeOptions()); await wait(350);
  // la scelta resta dopo la riapertura
  await page.reload({ waitUntil: 'load' }); await wait(700);
  assert.strictEqual(await page.evaluate(() => document.documentElement.dataset.layout), 'a');
  assert.deepStrictEqual(errors, []);
  console.log('e2e65 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
