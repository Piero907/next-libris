const CFG = require("./_config");
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP, IMG = CFG.IMG;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.gz': 'application/gzip' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': (p.endsWith('.wasm.js') ? 'text/javascript' : MIME[path.extname(f)]) || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(CFG.port(8126));
const ISBN = '9788806219352';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new',
    args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + IMG + '/live_price.mjpeg'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => { if (!localStorage.getItem('catalogo-libri-set')) localStorage.setItem('catalogo-libri-set', JSON.stringify({ openAll: true })); });   // questi test controllano i campi delle schede aperte
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith('http://localhost:' + CFG.port(8126) + '')) return req.continue();
    const j = (o, s = 200) => req.respond({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (u.includes('googleapis.com/books')) return j({ items: [{ id: 'x', volumeInfo: { title: 'Il nome della rosa', authors: ['Umberto Eco'], publisher: 'Bompiani', publishedDate: '2012', industryIdentifiers: [{ type: 'ISBN_13', identifier: ISBN }] } }] });
    if (u.includes('openlibrary.org')) return j({});
    if (u.includes('crossref.org')) return j({ message: { items: [] } });
    if (u.includes('fonts.')) return req.respond({ status: 200, contentType: 'text/css', body: '' });
    req.abort();
  });
  await page.goto('http://localhost:' + CFG.port(8126) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const first = () => page.evaluate(() => { const b = window.__app.state.books[0]; return b && { id: b.id, t: b.t, i: b.i, c: b.c }; });
  const reset = () => page.evaluate(() => { window.__app.state.books.length = 0; });
  const askVisible = () => page.$eval('#priceAsk', e => !e.hidden);

  // v62: dopo la foto di un libro compare «Libro aggiunto» con titolo e autore e il prezzo facoltativo (niente lettura del prezzo)
  let t0 = Date.now();
  await (await page.$('#fileCam')).uploadFile(IMG + '/back_noprice.jpg');
  await page.waitForFunction(() => !document.querySelector('#priceAsk').hidden, { timeout: 5000, polling: 50 });
  console.log('[1 riquadro dopo]', Date.now() - t0, 'ms', '|', await page.$eval('#priceAskT', e => e.textContent));
  assert(!(await page.$('#priceShot')));
  await page.waitForFunction(() => document.querySelector('#priceAskT').textContent === 'Il nome della rosa', { timeout: 60000, polling: 200 });
  assert.strictEqual(await page.$eval('#priceAskA', e => e.textContent), 'Umberto Eco');
  await page.type('#priceAskIn', '11,5'); await page.keyboard.press('Enter'); await wait(200);
  assert(!(await askVisible()));
  let b = await first(); console.log('[1 scritto]', JSON.stringify(b)); assert.strictEqual(b.c, 11.5); assert.strictEqual(b.t, 'Il nome della rosa');
  // 2) prezzo scritto prima che il libro sia riconosciuto: arriva lo stesso al libro
  await reset();
  await (await page.$('#fileCam')).uploadFile(IMG + '/back_noprice.jpg');
  await page.waitForFunction(() => !document.querySelector('#priceAsk').hidden, { timeout: 5000, polling: 50 });
  await page.type('#priceAskIn', '9,90'); await page.keyboard.press('Enter'); await wait(200);
  await page.waitForFunction(() => window.__app.state.books[0] && window.__app.state.books[0].t, { timeout: 60000, polling: 200 });
  b = await first(); console.log('[2 prima del riconoscimento]', JSON.stringify(b)); assert.strictEqual(b.c, 9.9);
  // 3) Salta: nessun prezzo
  await reset();
  await (await page.$('#fileCam')).uploadFile(IMG + '/back_noprice.jpg');
  await page.waitForFunction(() => !document.querySelector('#priceAsk').hidden, { timeout: 5000, polling: 50 });
  await page.evaluate(() => document.querySelector('#priceSkip').click()); await wait(100);
  assert(!(await askVisible()));
  await page.waitForFunction(() => window.__app.state.books[0] && window.__app.state.books[0].t, { timeout: 60000, polling: 200 });
  b = await first(); assert.strictEqual(b.c, null);
  // 4) opzione spenta: nessun riquadro
  await reset();
  await page.evaluate(() => { window.__app.settings.price = false; });
  await (await page.$('#fileCam')).uploadFile(IMG + '/back_noprice.jpg'); await wait(800);
  assert(!(await askVisible()));
  assert.deepStrictEqual(errors, []);
  console.log('e2e5 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
