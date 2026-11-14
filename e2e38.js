const CFG = require("./_config");
// condividere le citazioni: dalla finestra della citazione e «Condividi tutte»
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(8155);
const B = (o) => Object.assign({ t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: Date.now(), sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: 'da', rt: 0, rd: '' }, o);
const books = [
  B({ id: 'rosa', t: 'Il nome della rosa', a: 'Umberto Eco', qs: [{ x: 'Stat rosa pristina nomine, nomina nuda tenemus.', pg: '503', d: 1 }, { x: 'I libri non sono fatti per crederci, ma per essere sottoposti a indagine.', pg: '', d: 2 }] }),
  B({ id: 'calv', t: 'Le città invisibili', a: 'Italo Calvino', qs: [{ x: "L'inferno dei viventi non è qualcosa che sarà.", pg: '164', d: 3 }] }),
];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.evaluateOnNewDocument((b) => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    window.__shared = []; navigator.share = d => { window.__shared.push({ text: d.text, files: (d.files || []).length }); return Promise.resolve(); }; navigator.canShare = () => true;
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ extra: true, lastBackup: Date.now(), price: false, installed: true, instScope: '/', swiped: true, name: 'Piero' })); sessionStorage.seeded = 1; } }, books);
  await page.goto('http://localhost:8155/', { waitUntil: 'load' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(1200);
  const click = sel => page.evaluate(s => document.querySelector(s).click(), sel);
  const last = () => page.evaluate(() => window.__shared[window.__shared.length - 1]);
  await click('.row[data-id="rosa"] [data-act="toggle"]'); await wait(250);
  await page.evaluate(() => document.querySelector('details.quotes[data-id="rosa"] > summary').click()); await wait(150);
  // Condividi tutte dalla scheda
  assert((await page.$eval('details.quotes[data-id="rosa"]', e => e.textContent)).includes('Condividi tutte (2)'));
  await click('details.quotes[data-id="rosa"] [data-act="quoteshareall"]'); await wait(200);
  let s = await last(); console.log('[tutte]\n' + s.text);
  assert(s.text.startsWith('Citazioni da «Il nome della rosa» di Umberto Eco') && s.text.includes('«Stat rosa pristina nomine, nomina nuda tenemus.» (p. 503)') && s.text.includes('indagine.»') && s.text.includes('— scelte da Piero\n\nInviato con Next Libris') && s.text.endsWith('/next-libris/'));
  // dalla finestra della citazione (anche modificata e non salvata)
  await click('details.quotes[data-id="rosa"] [data-act="quoteedit"][data-i="0"]'); await wait(150);
  await page.evaluate(() => { document.querySelector('#quoteText').value = 'Stat rosa pristina nomine.'; });
  await click('#quoteShare'); await wait(200);
  s = await last(); console.log('[una]', JSON.stringify(s.text)); assert(s.text.startsWith('«Stat rosa pristina nomine.»\n— Il nome della rosa, Umberto Eco, p. 503\n\nInviato con Next Libris'));
  await click('#quoteCancel');
  // Condividi su ogni citazione, senza aprirla
  assert.strictEqual(await page.$$eval('details.quotes[data-id="rosa"] .qshare', e => e.length), 2);
  await click('details.quotes[data-id="rosa"] .qshare[data-i="1"]'); await wait(200);
  s = await last(); assert(s.text.startsWith('«I libri non sono fatti per crederci, ma per essere sottoposti a indagine.»\n— Il nome della rosa, Umberto Eco'));
  assert(await page.$eval('#quoteSheet', e => e.hidden), 'non apre la modifica');
  await page.evaluate(() => document.querySelector('details.quotes[data-id="rosa"]').scrollIntoView({ block: 'center' })); await wait(150);
  await page.screenshot({ path: CFG.OUT + '/qshare.png' });
  // X rossa: elimina con Annulla
  assert.strictEqual(await page.$$eval('details.quotes[data-id="rosa"] .qdel', e => e.length), 2);
  await click('details.quotes[data-id="rosa"] .qdel[data-i="0"]'); await wait(200);
  assert.strictEqual(await page.evaluate(() => window.__app.state.books.find(b => b.id === 'rosa').qs.length), 1);
  await page.evaluate(() => document.querySelector('#toastBtn').click()); await wait(200);
  assert.strictEqual(await page.evaluate(() => window.__app.state.books.find(b => b.id === 'rosa').qs[0].pg), '503');
  // libro con una sola citazione: «Condividi»
  await click('.row[data-id="calv"] [data-act="toggle"]'); await wait(250);
  await page.evaluate(() => document.querySelector('details.quotes[data-id="calv"] > summary').click()); await wait(150);
  assert.strictEqual(await page.$eval('details.quotes[data-id="calv"] [data-act="quoteshareall"]', e => e.textContent), 'Condividi');
  await click('details.quotes[data-id="calv"] [data-act="quoteshareall"]'); await wait(200);
  s = await last(); assert(s.text.startsWith("«L'inferno dei viventi non è qualcosa che sarà.»\n— Le città invisibili, Italo Calvino, p. 164\n\nInviato con Next Libris"));
  // elenco di tutte: Condividi tutte per libro
  await page.evaluate(() => history.back()); await wait(300);
  await click('#btnFilters'); await wait(300); await click('#drawerFlt [data-g="quotes"]'); await wait(300);
  const alls = await page.$$eval('#allqList [data-all]', e => e.map(x => x.dataset.all)); assert.deepStrictEqual(alls, ['rosa']);
  await click('#allqList [data-all="rosa"]'); await wait(200); s = await last(); assert(s.text.startsWith('Citazioni da «Il nome della rosa»'));
  await page.screenshot({ path: CFG.OUT + '/share_all.png' });
  assert.deepStrictEqual(errors, []);
  console.log('e2e38 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
