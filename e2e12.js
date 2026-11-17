const CFG = require("./_config");
const H = require('./_harness');
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP, IMG = CFG.IMG;
const server = H.serve(CFG.port(8127), ROOT);
const ISBN = '9788804668015';
async function open(video) {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new',
    args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + IMG + '/' + video, '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!localStorage.getItem('catalogo-libri-set')) localStorage.setItem('catalogo-libri-set', JSON.stringify({ price: false, lastBackup: Date.now() })); });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith('http://localhost:' + CFG.port(8127) + '')) return req.continue();
    const j = (o, s = 200) => req.respond({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (u.includes('googleapis.com/books/v1/volumes?')) {
      const isbn = (decodeURIComponent(u).match(/isbn:(\d{13})/) || [])[1];
      if (isbn && isbn !== ISBN) return j({ totalItems: 0 });
      return j({ items: [{ id: 'x', volumeInfo: { title: isbn ? 'Le città invisibili' : 'Il nome della rosa', authors: [isbn ? 'Italo Calvino' : 'Umberto Eco'], publisher: isbn ? 'Mondadori' : 'Bompiani', publishedDate: '2016', industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn || '9788845292613' }] } }] });
    }
    if (u.includes('googleapis.com')) return j({});
    if (u.includes('openlibrary.org')) return j({});
    if (u.includes('crossref.org')) return j({ message: { items: [] } });
    if (u.includes('fonts.')) return req.respond({ status: 200, contentType: 'text/css', body: '' });
    req.abort();
  });
  await page.goto('http://localhost:' + CFG.port(8127) + '/?vista=elenco', { waitUntil: 'load' });
  return { browser, page, errors };
}
const wait = H.wait;   // attesa «finché» (_harness.js)
(async () => {
  // ---- A) ISBN stampato senza codice a barre
  let { browser, page, errors } = await open('isbn_text.mjpeg');
  const txt = sel => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
  await page.click('#btnScan'); await wait(800);
  assert.strictEqual(await page.$eval('#scanKinds [aria-checked="true"]', e => e.dataset.k), 'bar');
  console.log('[A modi]', await txt('#scanKinds'));
  await page.click('#scanKinds [data-k="text"]'); await wait(200);
  assert(await page.$eval('#scan', e => e.classList.contains('k-text')));
  console.log('[A messaggio]', await txt('#scanMsg'));
  let t0 = Date.now();
  await page.waitForFunction(i => window.__app.state.books.some(b => b.i === i), { timeout: 90000, polling: 200 }, ISBN);
  console.log('[A letto in]', Date.now() - t0, 'ms |', await txt('#scanCount'), '|', await txt('#scanMsg'));
  await wait(800);
  await page.screenshot({ path: CFG.OUT + '/s_scan_text.png' });
  assert.strictEqual(await txt('#scanCount'), '1 aggiunto');
  assert.strictEqual((await page.evaluate(() => window.__app.state.books.length)), 1, 'una volta sola');
  await page.click('#scanClose'); await wait(400);
  const b = await page.evaluate(i => window.__app.state.books.find(x => x.i === i), ISBN);
  console.log('[A libro]', b.t, '/', b.a, '/', b.rs);
  // «Ce l'ho già?» con l'ISBN stampato; la Copertina non c'è
  await page.click('#btnCheck'); await wait(500);
  assert(await page.$eval('#scanKinds [data-k="cover"]', e => getComputedStyle(e).display === 'none'));
  assert.strictEqual(await page.evaluate(() => window.__app.scanKind), 'text');
  await page.waitForFunction(() => !document.querySelector('#scanRes').hidden, { timeout: 30000, polling: 200 });
  console.log('[A ce l\'ho già]', await txt('#scanRes')); assert((await txt('#scanRes')).includes('Ce l\'hai già'));
  await page.click('#scanClose'); await wait(300);
  console.log('[A errori]', errors.length ? errors : 'nessuno'); assert(!errors.length);
  await browser.close();

  // ---- B) Copertina: si scatta, il libro si riconosce mentre continui
  ({ browser, page, errors } = await open('cover_live.mjpeg'));
  await page.click('#btnScan'); await wait(800);
  await page.click('#scanKinds [data-k="cover"]'); await wait(300);
  assert(!(await page.$eval('#scanShootBox', e => e.hidden)));
  await page.screenshot({ path: CFG.OUT + '/s_scan_cover.png' });
  console.log('[B messaggio]', await page.$eval('#scanMsg', e => e.textContent));
  await page.click('#scanShoot'); await wait(600);
  const n = await page.evaluate(() => window.__app.state.books.length);
  console.log('[B dopo lo scatto]', n, await page.$eval('#scanCount', e => e.textContent), '|', await page.$eval('#scanMsg', e => e.textContent));
  assert.strictEqual(n, 1);
  t0 = Date.now();
  await page.waitForFunction(() => { const b = window.__app.state.books[0]; const s = b && window.__app.S[b.id]; return b && (b.t || (s && (s.st === 'choose' || s.st === 'error' || s.st === 'nf'))); }, { timeout: 120000, polling: 300 });
  const r = await page.evaluate(() => { const b = window.__app.state.books[0]; const s = window.__app.S[b.id] || {}; return { t: b.t, a: b.a, st: s.st, err: s.err, n: (s.cands || []).length }; });
  console.log('[B riconosciuto in]', Date.now() - t0, 'ms', JSON.stringify(r));
  assert(r.t === 'Il nome della rosa' || r.st === 'choose', 'copertina riconosciuta');
  await page.click('#scanClose'); await wait(400);
  console.log('[B toast]', await page.$eval('#toastTxt', e => e.textContent));
  console.log('[B errori]', errors.length ? errors : 'nessuno'); assert(!errors.length);
  await browser.close(); server.close();
  console.log('e2e12 OK');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
