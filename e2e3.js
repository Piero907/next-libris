const CFG = require("./_config");
const H = require('./_harness');
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8124), ROOT);
let rate = true, nfMode = false;
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => { if (!localStorage.getItem('catalogo-libri-set')) localStorage.setItem('catalogo-libri-set', JSON.stringify({ openAll: true })); });   // questi test controllano i campi delle schede aperte
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith('http://localhost:' + CFG.port(8124) + '')) return req.continue();
    const j = (o, s = 200) => req.respond({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (u.includes('googleapis.com')) return rate ? j({ error: 'quota' }, 429) : nfMode ? j({ totalItems: 0 }) : j({ items: [{ id: 'x', volumeInfo: { title: 'Il nome della rosa', authors: ['Umberto Eco'], publisher: 'Bompiani', publishedDate: '2012', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9788806219352' }] } }] });
    if (u.includes('openlibrary.org')) return j({});
    if (u.includes('fonts.')) return req.respond({ status: 200, contentType: 'text/css', body: '' });
    req.abort();
  });
  await page.goto('http://localhost:' + CFG.port(8124) + '/?vista=elenco', { waitUntil: 'load' });
  await page.evaluate(() => window.__app.addIsbn('9788806219352'));
  await new Promise(r => setTimeout(r, 4500));
  let st = await page.evaluate(() => { const id = window.__app.state.books[0].id; return { s: window.__app.S[id], nf: window.__app.state.books[0].nf }; });
  console.log('[429]', JSON.stringify(st));
  await page.screenshot({ path: CFG.OUT + '/s_rate.png' });
  // diagnosi
  await page.evaluate(() => { window.__app.openOptions(); });
  await page.evaluate(() => document.querySelector('#btnDiag').click());
  await new Promise(r => setTimeout(r, 2500));
  console.log('[diag]', await page.$eval('#diagOut', e => e.textContent));
  rate = false;
  await page.evaluate(() => document.querySelector('#btnDiag').click()); await new Promise(r => setTimeout(r, 1500));
  console.log('[diag ok]', await page.$eval('#diagOut', e => e.textContent));
  // Riprova dopo che Google si e' ripreso
  await page.evaluate(() => { window.__app.closeOptions(); });
  const btn = await page.$('[data-act="retry"]');
  if (btn) { await btn.click(); await new Promise(r => setTimeout(r, 1500)); }
  console.log('[retry]', JSON.stringify(await page.evaluate(() => window.__app.state.books.map(b => [b.t, b.a, b.e, b.y, b.nf]))));
  await page.screenshot({ path: CFG.OUT + '/s_diag.png' });
  nfMode = true;
  await page.evaluate(() => window.__app.addIsbn('9780306406157'));
  await new Promise(r => setTimeout(r, 1500));
  console.log('[nf]', JSON.stringify(await page.evaluate(() => window.__app.state.books.map(b => [b.t, b.i, b.nf]))), 'webBtn:', await page.$$eval('[data-act="web"]', e => e.length));
  await page.screenshot({ path: CFG.OUT + '/s_nf.png' });
  await page.evaluate(() => { window.__app.openOptions(); });
  await page.evaluate(() => document.querySelector('#btnInstDiag').click()); await new Promise(r => setTimeout(r, 1500));
  console.log('[inst]', JSON.stringify(await page.$eval('#instOut', e => ({ hidden: e.hidden, text: e.textContent.slice(0, 600), disp: getComputedStyle(e).display }))));
  console.log('[sbn checkbox rimosso]', (await page.$('#sbnProxy')) === null, '| bottone editori:', (await page.$('#btnGuessPub')) !== null);
  await page.screenshot({ path: CFG.OUT + '/s_opts.png', fullPage: true });
  console.log('ERRORI:', errors.length ? errors : 'nessuno');
  await browser.close(); server.close();
})();
