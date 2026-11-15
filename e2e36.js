const CFG = require("./_config");
// menu laterale: «Leggi tutte le citazioni» e filtro «Con citazioni»
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8153));
const B = (o) => Object.assign({ t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: Date.now(), sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: 'da', rt: 0, rd: '' }, o);
const books = [
  B({ id: 'rosa', t: 'Il nome della rosa', a: 'Umberto Eco', qs: [{ x: 'Stat rosa pristina nomine, nomina nuda tenemus.', pg: '503', d: 1 }, { x: 'I libri non sono fatti per crederci, ma per essere sottoposti a indagine.', pg: '', d: 2 }] }),
  B({ id: 'calv', t: 'Le città invisibili', a: 'Italo Calvino', qs: [{ x: "L'inferno dei viventi non è qualcosa che sarà; se ce n'è uno, è quello che è già qui.", pg: '164', d: 3 }] }),
  B({ id: 'plain', t: 'Lessico famigliare', a: 'Natalia Ginzburg' }),
  B({ id: 'w1', t: 'Sostiene Pereira', a: 'Antonio Tabucchi', w: true, rs: '', qs: [{ x: 'Sostiene Pereira di averlo conosciuto in un giorno d\'estate.', pg: '7', d: 4 }] }),
];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.evaluateOnNewDocument((b) => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ extra: true, lastBackup: Date.now(), price: false, installed: true, instScope: '/', swiped: true, name: 'Piero' })); sessionStorage.seeded = 1; } }, books);
  await page.goto('http://localhost:' + CFG.port(8153) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(1200);
  const click = sel => page.evaluate(s => document.querySelector(s).click(), sel);
  const rows = () => page.$$eval('#list .row', e => e.map(r => r.dataset.id));
  // menu laterale
  await click('#btnFilters'); await wait(300);
  const dr = await page.$eval('#drawerFlt', e => e.textContent.replace(/\s+/g, ' ')); console.log('[menu]', dr.slice(0, 160));
  assert(dr.includes('Con citazioni2'));
  assert.strictEqual(await page.$eval('#goQTxt', e => e.textContent), '4 citazioni salvate');   // v84: «Tutte le citazioni» sta nel menu
  await page.screenshot({ path: CFG.OUT + '/q_drawer.png' });
  // filtro
  await click('#drawerFlt [data-g="flt"][data-v="qs"]'); await wait(150); await click('#drawerShow'); await wait(300);
  assert.deepStrictEqual((await rows()).sort(), ['calv', 'rosa']);
  assert((await page.$eval('#activeFlt', e => e.textContent)).includes('Con citazioni')); console.log('[filtro] ok');
  // elenco di tutte le citazioni
  await page.evaluate(() => window.__app.openDrawer('opt')); await wait(300); await click('#goQuotes'); await wait(300);
  assert(await page.$eval('#drawer', e => e.hidden), 'il menu si chiude');
  const books1 = await page.$$eval('#allqList .aq-h b', e => e.map(x => x.textContent)); console.log('[elenco]', books1.join(' | '), '|', await page.$eval('#allqMsg', e => e.textContent));
  assert.deepStrictEqual(books1, ['Le città invisibili', 'Il nome della rosa', 'Sostiene Pereira']);
  assert.strictEqual(await page.$$eval('#allqList .aq-q', e => e.length), 4);
  await page.screenshot({ path: CFG.OUT + '/q_all.png' });
  // cerca
  await page.evaluate(() => { const i = document.querySelector('#allqQ'); i.value = 'indagine'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(100);
  assert.strictEqual(await page.$$eval('#allqList .aq-q', e => e.length), 1); assert((await page.$eval('#allqMsg', e => e.textContent)).includes('1 citazione trovata'));
  await page.evaluate(() => { const i = document.querySelector('#allqQ'); i.value = 'calvino'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(100);
  assert.strictEqual(await page.$$eval('#allqList .aq-q', e => e.length), 1);
  // condividi (copia)
  await page.evaluate(() => { delete navigator.share; window.__copied = ''; navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); }; });
  await click('#allqList [data-copy]'); await wait(200);
  const cp = await page.evaluate(() => window.__copied); console.log('[copia]', JSON.stringify(cp)); assert(cp.startsWith('«L\'inferno') && cp.includes('— Le città invisibili, Italo Calvino, p. 164\n\nInviato con Next Libris'));
  // apri il libro dei Desideri dall'elenco: cambia scheda, apre la scheda e il riquadro
  await page.evaluate(() => { const i = document.querySelector('#allqQ'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(100);
  await page.evaluate(() => document.querySelector('#allqList [data-open="w1"]').click()); await wait(400);
  assert(await page.$eval('#allqSheet', e => e.hidden)); assert(await page.evaluate(() => document.body.classList.contains('wishtab')));
  assert(await page.$('.row.open[data-id="w1"] details.quotes[open]'), 'scheda e citazioni aperte'); console.log('[apri libro] ok');
  await page.screenshot({ path: CFG.OUT + '/q_open.png' });
  assert.deepStrictEqual(errors, []);
  console.log('e2e36 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
