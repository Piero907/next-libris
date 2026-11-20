const CFG = require("./_config");
const H = require('./_harness');
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP, IMG = CFG.IMG;
const server = H.serve(CFG.port(8128), ROOT);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!localStorage.getItem('catalogo-libri-set')) localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), swiped: true })); });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith('http://localhost:' + CFG.port(8128) + '')) return req.continue();
    const j = (o, s = 200) => req.respond({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (u.includes('googleapis.com/books/v1/volumes?')) return j({ items: [{ id: 'x', volumeInfo: { title: 'Il nome della rosa', authors: ['Umberto Eco'], publisher: 'Bompiani', publishedDate: '2012', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9788806219352' }] } }] });
    if (/googleapis|openlibrary/.test(u)) return j({});
    if (u.includes('crossref.org')) return j({ message: { items: [] } });
    if (u.includes('fonts.')) return req.respond({ status: 200, contentType: 'text/css', body: '' });
    req.abort();
  });
  await page.goto('http://localhost:' + CFG.port(8128) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = H.wait;   // attesa «finché» (_harness.js)
  const n = () => page.evaluate(() => window.__app.state.books.length);
  // 1) Foto -> scelta tra fotocamera e galleria
  await H.aggiungi(page, 'photo'); await wait(150);
  assert(!(await page.$eval('#photoSheet', e => e.hidden)));
  await page.screenshot({ path: CFG.OUT + '/s_photosheet.png' });
  let [ch] = await Promise.all([page.waitForFileChooser(), page.click('#photoCam')]);
  console.log('[1 fotocamera] multiple:', ch.isMultiple()); assert(!ch.isMultiple()); await ch.cancel();
  assert(await page.$eval('#photoSheet', e => e.hidden));
  // 2) galleria: piu' foto insieme
  await H.aggiungi(page, 'photo'); await wait(150);
  [ch] = await Promise.all([page.waitForFileChooser(), page.click('#photoGal')]);
  console.log('[2 galleria] multiple:', ch.isMultiple()); assert(ch.isMultiple());
  await ch.accept([IMG + '/cover.jpg', IMG + '/back.jpg', IMG + '/cover_noisy.jpg']); await wait(400);
  console.log('[2 libri]', await n(), '|', await page.$eval('#toastTxt', e => e.textContent));
  assert.strictEqual(await n(), 3); assert(await page.$eval('#priceAsk', e => e.hidden));
  // 3) una sola foto dalla galleria: «Riconosco il libro» con l'avanzamento (poi il prezzo)
  await (await page.$('#fileGal')).uploadFile(IMG + '/cover.jpg'); await wait(400);
  assert.strictEqual(await n(), 4); assert(!(await page.$eval('#recSheet', e => e.hidden)));   // v83: prima la finestra con l'avanzamento
  await page.click('#recBg'); await wait(100);
  // 4) Azzera nel pannello svuota anche la ricerca
  await page.type('#q', 'rosa'); await wait(200);
  console.log('[4 prima]', await page.$eval('#q', e => e.value), await page.evaluate(() => [...document.querySelectorAll('.sheet:not([hidden])')].map(x => x.id).join(',')));
  await page.click('#btnFilters'); await wait(350);
  console.log('[4 aperto]', await page.evaluate(() => document.body.classList.contains('drawer-open')));
  console.log('[4 pannello]', await page.$eval('#drawerQ', e => e.hidden ? '(nascosto)' : e.innerText.replace(/\s+/g, ' ')));
  assert(!(await page.$eval('#drawerReset', e => e.disabled)));
  await page.click('#drawerReset'); await wait(150);
  assert.strictEqual(await page.$eval('#q', e => e.value), ''); assert(await page.$eval('#drawerQ', e => e.hidden));
  assert(await page.$eval('#drawerReset', e => e.disabled));
  console.log('ERRORI:', errors.length ? errors : 'nessuno'); assert(!errors.length);
  console.log('e2e14 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
