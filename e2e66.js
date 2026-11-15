const CFG = require("./_config");
// copertine -> scheda: si apre solo quella scheda (anche se ci sono libri senza titolo, «Non trovato»); chiudendola (freccetta o Indietro,
// anche dopo «Cerca sul web») si torna alle copertine, allo stesso punto dello scorrimento
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8186));
const books = Array.from({ length: 40 }, (_, i) => i % 5 === 1 ? { id: 'g' + i, i: '97988574' + String(10000 + i), nf: true, ts: 1000 - i } : { id: 'g' + i, t: 'Copertina ' + i, a: 'Autore ' + i, ts: 1000 - i, rs: 'da' });
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await page.goto('http://localhost:' + CFG.port(8186) + '/', { waitUntil: 'load' });
  await page.evaluate(b => { const o = Storage.prototype.setItem; localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: Date.now() })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'P', selTip: 1, lastBackup: Date.now(), donUntil: Date.now() + 9e9, instSnooze: Date.now() + 9e9 })); Storage.prototype.setItem = function (k, v) { if (/^catalogo-libri-v2$/.test(k)) return; return o.call(this, k, v); }; }, books);
  await page.reload({ waitUntil: 'load' }); await wait(800);
  const st = () => page.evaluate(() => ({ grid: document.body.classList.contains('gridview'), y: Math.round(scrollY), open: [...document.querySelectorAll('#list .row.open')].map(e => e.dataset.id) }));
  assert((await st()).grid, 'si parte dalle copertine');
  // scorro giù e tocco una copertina
  await page.evaluate(() => window.scrollTo(0, 1500)); await wait(300);
  const y0 = (await st()).y;
  await page.evaluate(() => document.querySelector('#list .cover[data-id="g20"]').click()); await wait(500);
  let s = await st(); console.log('[1 aperta]', JSON.stringify(s)); assert(!s.grid && s.open.includes('g20'));
  // chiudo con la freccetta: di nuovo copertine, stesso punto
  await page.evaluate(() => document.querySelector('#list .row.open .chev-btn').click()); await wait(500);
  s = await st(); console.log('[2 freccetta]', JSON.stringify(s), 'prima:', y0);
  assert(s.grid && Math.abs(s.y - y0) <= 4, 'copertine allo stesso punto');
  assert.strictEqual(await page.evaluate(() => window.__app.settings.view), 'grid');
  // di nuovo, chiudo con Indietro
  await page.evaluate(() => document.querySelector('#list .cover[data-id="g26"]').click()); await wait(500);
  assert(!(await st()).grid);
  await page.evaluate(() => history.back()); await wait(600);
  s = await st(); console.log('[3 Indietro]', JSON.stringify(s)); assert(s.grid && Math.abs(s.y - y0) <= 4);
  // Indietro un'altra volta: nessuna scheda aperta, chiede conferma per uscire (non riapre nulla)
  // se nell'elenco cambio vista col pulsante, resta l'elenco
  await page.evaluate(() => document.querySelector('#list .cover[data-id="g22"]').click()); await wait(500);
  await page.evaluate(() => document.querySelector('#btnView').click()); await wait(300);     // copertine
  await page.evaluate(() => document.querySelector('#btnView').click()); await wait(300);     // elenco
  const any = await page.evaluate(() => document.querySelector('#list .row.open .chev-btn')); 
  if (any) { await page.evaluate(() => document.querySelector('#list .row.open .chev-btn').click()); await wait(400); }
  s = await st(); console.log('[4 vista scelta a mano]', JSON.stringify(s)); assert(!s.grid, 'scelta a mano: resta l\'elenco');
  // dall'elenco normale (non dalle copertine) chiudere una scheda resta nell'elenco
  await page.evaluate(() => document.querySelector('#list .row[data-id="g3"] .sum').click()); await wait(400);
  await page.evaluate(() => document.querySelector('#list .row.open .chev-btn').click()); await wait(400);
  assert(!(await st()).grid);
  // libro senza titolo («Non trovato») dalle copertine: si apre solo lui; «Cerca sul web», poi Indietro: copertine
  await page.evaluate(() => { document.querySelector('#btnView').click(); }); await wait(300);
  assert((await st()).grid);
  await page.evaluate(() => { window.open = () => null; window.scrollTo(0, 600); }); await wait(200);
  const y1 = (await st()).y;
  await page.evaluate(() => document.querySelector('#list .cover[data-id="g11"]').click()); await wait(500);
  s = await st(); console.log('[5 senza titolo]', JSON.stringify(s)); assert.deepStrictEqual(s.open, ['g11'], 'solo la sua scheda, non tutte le «Non trovato»');
  await page.evaluate(() => document.querySelector('#list .row[data-id="g11"] [data-act="websearch"]').click()); await wait(300);
  await page.evaluate(() => history.back()); await wait(600);
  s = await st(); console.log('[6 dopo Cerca sul web e Indietro]', JSON.stringify(s)); assert(s.grid && Math.abs(s.y - y1) <= 4 && !s.open.length);
  // appena aperta l'app, dalle copertine all'elenco col pulsante: le «Non trovato» restano chiuse (Piero, 16/11/2026)
  await page.reload({ waitUntil: 'load' }); await wait(800);
  assert((await st()).grid);
  await page.evaluate(() => document.querySelector('#btnView').click()); await wait(400);
  s = await st(); console.log('[7 copertine → elenco]', JSON.stringify(s)); assert(!s.grid && !s.open.length, 'nessuna scheda «Non trovato» aperta');
  assert.deepStrictEqual(errors, []);
  console.log('e2e66 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
