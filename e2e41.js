const CFG = require("./_config");
// v62: dopo ogni libro un riquadro con titolo e autore e il prezzo facoltativo; niente lettura del prezzo
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP, IMG = CFG.IMG;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.gz': 'application/gzip' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': (p.endsWith('.wasm.js') ? 'text/javascript' : MIME[path.extname(f)]) || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8159));
const json = o => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
const G = { '9788845292613': ['Il nome della rosa', 'Umberto Eco'], '9788806219352': ['La storia', 'Elsa Morante'], '9788804668015': ['Le città invisibili', 'Italo Calvino'] };
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + IMG + '/blank.mjpeg'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => { const u = decodeURIComponent(r.url());
    if (u.startsWith('http://localhost')) return r.continue();
    if (u.includes('googleapis.com/books/v1/volumes?')) { const isbn = (u.match(/97[89]\d{10}/) || [])[0];
      if (!G[isbn]) return r.respond(json({ totalItems: 0 }));
      return setTimeout(() => r.respond(json({ items: [{ id: 'x' + isbn, volumeInfo: { title: G[isbn][0], authors: [G[isbn][1]], publishedDate: '2020', industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn }] } }] })), 700); }
    if (/googleapis|openlibrary|crossref/.test(u)) return r.respond(json({}));
    r.abort(); });
  await page.evaluateOnNewDocument(() => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: [], updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), installed: true, instScope: '/', swiped: true, name: 'Piero', selTip: 1 })); sessionStorage.seeded = 1; } });
  await page.goto('http://localhost:' + CFG.port(8159) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(1200);
  const click = sel => page.evaluate(s => document.querySelector(s).click(), sel);
  const byIsbn = i => page.evaluate(i => JSON.parse(JSON.stringify(window.__app.state.books.find(b => b.i === i) || null)), i);
  // 1) ISBN scritto a mano: il riquadro con «Cerco…», poi titolo e autore; prezzo facoltativo con la tastiera pronta
  await click('#btnType'); await wait(200);
  await page.evaluate(() => { document.querySelector('#isbnText').value = '9788845292613'; }); await click('#isbnGo'); await wait(150);
  assert(!(await page.$eval('#priceAsk', e => e.hidden)));
  console.log('[1 subito]', await page.$eval('#priceAskT', e => e.textContent));
  assert.strictEqual(await page.evaluate(() => document.activeElement.id), 'priceAskIn', 'tastiera pronta');
  const lbl = await page.$eval('#priceAsk label', e => e.textContent); assert(lbl.includes('(facoltativo)'));
  await page.waitForFunction(() => document.querySelector('#priceAskT').textContent === 'Il nome della rosa', { timeout: 8000 });
  assert.strictEqual(await page.$eval('#priceAskA', e => e.textContent), 'Umberto Eco');
  await page.screenshot({ path: CFG.OUT + '/pa_sheet.png' });
  await page.keyboard.type('14,50'); await page.keyboard.press('Enter'); await wait(200);
  assert(await page.$eval('#priceAsk', e => e.hidden)); assert.strictEqual((await byIsbn('9788845292613')).c, 14.5);
  // 2) Salta (e Salva a campo vuoto) non mette niente
  await click('#btnType'); await wait(200);
  await page.evaluate(() => { document.querySelector('#isbnText').value = '9788806219352'; }); await click('#isbnGo'); await wait(150);
  await click('#priceSave'); await wait(150); assert(await page.$eval('#priceAsk', e => e.hidden)); assert.strictEqual((await byIsbn('9788806219352')).c, null);
  // prezzo sbagliato: avviso
  await click('#btnType'); await wait(200);
  await page.evaluate(() => { document.querySelector('#isbnText').value = '9788804668015'; }); await click('#isbnGo'); await wait(150);
  await page.keyboard.type('abc'); await click('#priceSave'); await wait(100);
  assert(!(await page.$eval('#priceAskErr', e => e.hidden))); await click('#priceSkip'); await wait(100); assert(await page.$eval('#priceAsk', e => e.hidden));
  // «togli il libro» dal riquadro
  await click('#btnType'); await wait(200);
  await page.evaluate(() => { document.querySelector('#isbnText').value = '9788804668022'; }); await click('#isbnGo'); await wait(150);
  assert(await byIsbn('9788804668022')); await click('#priceUndo'); await wait(150); assert(!(await byIsbn('9788804668022'))); assert(await page.$eval('#priceAsk', e => e.hidden));
  // nessun tasto per leggere il prezzo da foto
  assert(!(await page.$('#priceShot')) && !(await page.$('#scanPriceBtn')) && !(await page.$('[data-act="pricephoto"]')));
  // 3) nella fotocamera: riquadro con titolo e autore, campo «Prezzo (facoltativo)»
  await page.evaluate(() => { window.__app.state.books.length = 0; window.__app.state.books.push.apply(window.__app.state.books, []); });
  await click('#btnScan'); await page.waitForFunction(() => !document.querySelector('#scan').hidden, { timeout: 8000 }); await wait(300);
  await page.evaluate(() => window.__app.onScanned('9788804668015')); await wait(150);
  console.log('[3 stato]', JSON.stringify(await page.evaluate(() => ({ hidden: document.querySelector('#scanPrice').hidden, msg: document.querySelector('#scanMsg') && document.querySelector('#scanMsg').textContent, n: window.__app.state.books.length, price: window.__app.settings.price, scanning: !document.querySelector('#scan').hidden }))));
  assert(!(await page.$eval('#scanPrice', e => e.hidden)));
  console.log('[3 subito]', await page.$eval('#scanPrice', e => e.innerText.replace(/\s+/g, ' ')));
  await page.waitForFunction(() => document.querySelector('#scanPriceT').textContent === 'Le città invisibili', { timeout: 8000 });
  assert.strictEqual(await page.$eval('#scanPriceA', e => e.textContent), 'Italo Calvino');
  assert.strictEqual(await page.$eval('#scanPriceIn', e => e.placeholder), 'Prezzo (facoltativo)');
  await page.screenshot({ path: CFG.OUT + '/sp_scan.png' });
  await page.focus('#scanPriceIn'); await wait(100); await page.keyboard.type('11'); await page.keyboard.press('Enter'); await wait(200);
  assert.strictEqual((await byIsbn('9788804668015')).c, 11);
  console.log('[3 salvato]', await page.$eval('#scanPriceTxt', e => e.textContent));
  // il riquadro fuori dalla fotocamera non compare durante la scansione
  assert(await page.$eval('#priceAsk', e => e.hidden));
  assert.deepStrictEqual(errors, []);
  console.log('e2e41 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
