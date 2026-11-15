const CFG = require("./_config");
// backup: pulsanti chiari; finestre dal basso: si chiudono trascinandole verso il basso (non se il contenuto e' scorso, non partendo da un campo; un trascinamento corto le lascia aperte)
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8177));
const books = Array.from({ length: 6 }, (_, i) => ({ id: 'd' + i, t: 'Libro ' + i, a: 'Autore', ts: 10 + i, pg: '200', c: 10, rs: i < 2 ? 'ok' : 'da' }));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await page.goto('http://localhost:' + CFG.port(8177) + '/?vista=elenco', { waitUntil: 'load' });
  await page.evaluate(b => { const o = Storage.prototype.setItem; localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: Date.now() })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'P', selTip: 1, lastBackup: Date.now() })); Storage.prototype.setItem = function (k, v) { if (/^catalogo-libri-(v2|set)$/.test(k)) return; return o.call(this, k, v); }; }, books);
  await page.reload({ waitUntil: 'load' }); await wait(700);
  const vis = sel => page.$eval(sel, e => !e.hidden);
  async function drag(sel, dy, steps = 8, stepMs = 16) {
    const r = await page.$eval(sel, e => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + Math.min(20, b.height / 2) }; });
    await page.touchscreen.touchStart(r.x, r.y);
    for (let i = 1; i <= steps; i++) { await page.touchscreen.touchMove(r.x, r.y + dy * i / steps); await wait(stepMs); }
    await page.touchscreen.touchEnd(); await wait(400);
  }
  // 1) Statistiche: trascinata giu' dal titolo -> si chiude
  await page.evaluate(() => document.querySelector('#btnStats').click()); await wait(400);
  assert(await vis('#statsSheet'));
  await page.screenshot({ path: CFG.OUT + '/sheet_handle.png' });
  await drag('#statsSheet .sheet-in h2', 260); assert(!(await vis('#statsSheet')), 'chiusa trascinando');
  // 2) trascinamento corto e lento: resta aperta e torna al suo posto
  await page.evaluate(() => document.querySelector('#btnStats').click()); await wait(400);
  await drag('#statsSheet .sheet-in h2', 50, 10, 60);
  assert(await vis('#statsSheet'), 'corto: resta aperta');
  assert.strictEqual(await page.$eval('#statsSheet .sheet-in', e => e.style.transform), '', 'torna al suo posto');
  // 3) partendo da un campo non si chiude
  if (await page.$('#goalIn')) { await drag('#goalIn', 260); assert(await vis('#statsSheet'), 'dal campo: resta aperta'); }
  // 4) contenuto scorso: il gesto scorre, non chiude
  await page.$eval('#statsSheet .sheet-in', e => { e.scrollTop = 150; });
  const scrolled = await page.$eval('#statsSheet .sheet-in', e => e.scrollTop);
  if (scrolled > 0) { await drag('#statsSheet .sheet-in h2', 260); assert(await vis('#statsSheet'), 'contenuto scorso: resta aperta'); }
  await page.keyboard.press('Escape'); await wait(200);
  // 5) finestra con la sua cronologia (Novita' delle versioni): chiusa trascinando, Indietro non la riapre e il menu resta coerente
  await page.evaluate(() => window.__app.openDrawer('opt')); await wait(350);
  await page.evaluate(() => document.querySelector('#verLog').click());
  await page.waitForFunction(() => document.querySelectorAll('#logBody .log-v').length > 5, { timeout: 8000 });
  await drag('#logSheet .sheet-in h2', 300); assert(!(await vis('#logSheet')), 'registro chiuso trascinando');
  assert(await page.evaluate(() => document.body.classList.contains('drawer-open')), 'il menu sotto resta aperto');
  // 6) Esporta: i pulsanti del backup dicono cosa fanno
  await page.evaluate(() => window.__app.closeDrawer()); await wait(350);
  await page.evaluate(() => document.querySelector('#btnExport').click()); await wait(300);
  assert.strictEqual(await page.$eval('#btnShareBackup', e => e.textContent), 'Fai il backup e mandalo su Drive, email…');
  assert.strictEqual(await page.$eval('#btnBackup', e => e.textContent), 'Fai il backup sul telefono (Download)');
  assert(/più sicuro/.test(await page.$eval('#exportSheet', e => e.textContent)));
  assert.deepStrictEqual(errors, []);
  console.log('e2e57 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
