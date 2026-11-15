const CFG = require("./_config");
// durata dei messaggi: brevi spariscono presto, con Annulla restano 6 secondi
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8166));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: [{ id: 'a', t: 'Uno', a: 'X', g: [], ts: 1, rs: 'da', qs: [{ x: 'Una frase.', pg: '', d: 1, phs: [] }] }], updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), installed: true, instScope: '/', swiped: true, name: 'Piero', selTip: 1 })); });
  await page.goto('http://localhost:' + CFG.port(8166) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(1500);
  const visibleFor = async (fn) => { await page.evaluate(fn); const t0 = Date.now(); await page.waitForFunction(() => document.querySelector('#toast').hidden, { timeout: 10000, polling: 50 }); return Date.now() - t0; };
  // breve, senza tasto: «Salvata.»
  await page.evaluate(() => document.querySelector('.row[data-id="a"] [data-act="toggle"]').click()); await wait(200);
  await page.evaluate(() => document.querySelector('details.quotes[data-id="a"] > summary').click()); await wait(100);
  await page.evaluate(() => document.querySelector('details.quotes[data-id="a"] [data-act="quoteedit"]').click()); await wait(100);
  const d1 = await visibleFor(() => document.querySelector('#quoteSave').click()); console.log('[«Salvata.»]', d1, 'ms'); assert(d1 > 2200 && d1 < 3000);
  // con Annulla: elimina la citazione
  const d2 = await visibleFor(() => document.querySelector('details.quotes[data-id="a"] .qdel').click()); console.log('[con Annulla]', d2, 'ms'); assert(d2 > 3700 && d2 < 4500);
  assert.strictEqual(await page.$eval('#toastTxt', e => e.textContent), 'Citazione eliminata.');
  // Elimina su un libro: prima la conferma
  await page.evaluate(() => document.querySelector('.row[data-id="a"] [data-act="del"]').click()); await wait(150);
  assert(!(await page.$eval('#confirmSheet', e => e.hidden)), 'chiede conferma');
  const cm = await page.$eval('#confirmSheet', e => e.textContent.replace(/\s+/g, ' ')); console.log('[conferma]', cm); assert(cm.includes('Eliminare il libro?') && cm.includes('«Uno» di X'));
  await page.evaluate(() => document.querySelector('#confirmNo').click()); await wait(100);
  assert.strictEqual(await page.evaluate(() => window.__app.state.books.length), 1, 'Annulla non elimina');
  await page.evaluate(() => document.querySelector('.row[data-id="a"] [data-act="del"]').click()); await wait(150);
  await page.evaluate(() => document.querySelector('#confirmOk').click()); await wait(150);
  assert.strictEqual(await page.evaluate(() => window.__app.state.books.length), 0, 'eliminato');
  assert.strictEqual(await page.$eval('#toastTxt', e => e.textContent), 'Libro eliminato');
  await page.evaluate(() => document.querySelector('#toastBtn').click()); await wait(150);
  assert.strictEqual(await page.evaluate(() => window.__app.state.books.length), 1, 'Annulla dopo');
  await page.screenshot({ path: CFG.OUT + '/del_confirm.png' });
  console.log('e2e47 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
