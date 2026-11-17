const CFG = require("./_config");
const H = require('./_harness');
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8133), ROOT);
const W1 = 'https://sbn-libri.piero.workers.dev', K1 = 'AIzaSyA1b2C3d4E5f6G7h8I9j0KlMnOpQrStUvW', K2 = 'AIzaSyZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument((W1, K1) => {
    window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!localStorage.getItem('catalogo-libri-set')) localStorage.setItem('catalogo-libri-set', JSON.stringify({ installed: true, instScope: '/', swiped: true, lastBackup: Date.now(), price: false, sbnUrl: W1, gbKey: K1 }));
  }, W1, K1);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  let gHits = 0, sHits = 0;
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith('http://localhost:' + CFG.port(8133) + '')) return req.continue();
    const j = o => req.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (u.includes('googleapis.com/books/v1/volumes')) { gHits++; return j({ items: [{ id: 'x', volumeInfo: { title: 'Libro di prova', authors: ['A. Autore'], industryIdentifiers: [{ type: 'ISBN_13', identifier: '9788806219352' }] } }] }); }
    if (u.startsWith('https://sbn-libri.') || u.startsWith('https://nuovo.')) { sHits++; return j({}); }
    if (/openlibrary|crossref/.test(u)) return j({});
    req.abort();
  });
  await page.goto('http://localhost:' + CFG.port(8133) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = H.wait;   // attesa «finché» (_harness.js)
  const txt = sel => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
  const hidden = sel => page.$eval(sel, e => e.hidden);
  const val = sel => page.$eval(sel, e => e.value);
  const tap = sel => page.$eval(sel, e => e.click());
  const set = () => page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')));
  const savedLs = () => page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-saved') || '{}'));
  await wait(400);

  // 1) worker e chiave già impostati: visibili nei campi, «In uso», contatori a zero, già tra i salvati
  await page.evaluate(() => window.__app.openOptions('search')); await wait(200);
  assert.strictEqual(await val('#sbnUrl'), W1); assert.strictEqual(await val('#gbKey'), K1);
  console.log('[1 SBN]', await txt('#svcSbn .svc-h'), '|', await txt('#sbnCount'));
  console.log('[1 Google]', await txt('#svcKey .svc-h'), '|', await txt('#gbCount'));
  assert.strictEqual(await txt('#sbnSt'), 'In uso'); assert.strictEqual(await txt('#gbSt'), 'In uso');
  assert(/Richieste oggi: 0 su 100\.000/.test(await txt('#sbnCount'))); assert(/Richieste oggi: 0 su 1\.000/.test(await txt('#gbCount')));
  assert(!(await hidden('#sbnClear'))); assert(!(await hidden('#gbClear'))); assert(await hidden('#svcRestore'));
  assert(await hidden('#sbnSaved')); assert(await hidden('#gbSaved'));
  assert.deepStrictEqual(await savedLs(), { sbn: [W1], key: [K1] });
  await page.screenshot({ path: CFG.OUT + '/k_on.png' });

  // 2) una ricerca: i due contatori salgono e si aggiornano a schermo
  await page.evaluate(() => window.__app.addIsbn('9788806219352'));
  await page.waitForFunction(() => { const b = window.__app.state.books.find(x => x.i === '9788806219352'); return b && b.t; }, { timeout: 10000 });
  await wait(3500);
  const q = await page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-quota')));
  console.log('[2 contatori]', q, '| richieste viste: Google', gHits, 'SBN', sHits, '|', await txt('#gbCount'), '|', await txt('#sbnCount'));
  assert(q.g >= 1 && q.s >= 1); assert.strictEqual(q.g, gHits); assert.strictEqual(q.s, sHits);
  assert((await txt('#gbCount')).includes('Richieste oggi: ' + q.g + ' su 1.000'));
  assert((await txt('#sbnCount')).includes('Richieste oggi: ' + q.s + ' su 100.000'));
  assert.strictEqual(q.ds, new Date().toISOString().slice(0, 10), 'il giorno di SBN è quello UTC');

  // 3) Cancella: campi vuoti, l'app cerca senza; restano tra i salvati; il pulsante unico li rimette
  await tap('#sbnClear'); await wait(100);
  console.log('[3 toast]', await txt('#toastTxt'));
  await tap('#gbClear'); await wait(100);
  let st = await set(); assert.strictEqual(st.sbnUrl, ''); assert.strictEqual(st.gbKey, '');
  assert.strictEqual(await val('#sbnUrl'), ''); assert.strictEqual(await val('#gbKey'), '');
  assert.strictEqual(await txt('#sbnSt'), 'Non impostato'); assert.strictEqual(await txt('#gbSt'), 'Nessuna chiave');
  assert(await hidden('#sbnClear'));
  console.log('[3 salvati]', await txt('#sbnSaved'), '|', await txt('#gbSaved'), '| pulsante:', await txt('#svcRestore'));
  assert.strictEqual(await txt('#svcRestore'), 'Rimetti chiave e worker salvati');
  assert((await txt('#gbCount')).includes('senza chiave'));
  await page.screenshot({ path: CFG.OUT + '/k_off.png' });
  const s0 = sHits;
  await page.evaluate(() => window.__app.addIsbn('9788806219000'));
  await page.waitForFunction(() => { const b = window.__app.state.books.find(x => x.i === '9788806219000'); return b && b.t; }, { timeout: 10000 });
  await wait(500);
  assert.strictEqual(sHits, s0, 'senza worker nessuna richiesta a SBN');
  const lastG = await page.evaluate(() => performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('googleapis')).pop() || '');
  await tap('#svcRestore'); await wait(100);
  console.log('[3 rimessi]', await txt('#toastTxt'));
  st = await set(); assert.strictEqual(st.sbnUrl, W1); assert.strictEqual(st.gbKey, K1);
  assert.strictEqual(await val('#sbnUrl'), W1); assert.strictEqual(await val('#gbKey'), K1);
  assert(await hidden('#svcRestore'));
  // Annulla del ripristino
  await page.click('.toast button'); await wait(100);
  st = await set(); assert.strictEqual(st.sbnUrl, ''); assert.strictEqual(st.gbKey, '');
  // un tasto salvato alla volta
  await tap('#sbnSaved .schip-use'); await wait(100);
  st = await set(); assert.strictEqual(st.sbnUrl, W1); assert.strictEqual(st.gbKey, '');
  assert.strictEqual(await txt('#svcRestore'), 'Rimetti la chiave salvata');

  // 4) sostituire la chiave: la vecchia resta tra le salvate e si può rimettere
  await page.evaluate(K2 => { const i = document.querySelector('#gbKey'); i.value = '  ' + K2 + ' '; i.dispatchEvent(new Event('change')); }, K2); await wait(100);
  st = await set(); assert.strictEqual(st.gbKey, K2);
  console.log('[4 nuova chiave]', await txt('#toastTxt'), '| salvate:', await txt('#gbSaved'));
  assert.deepStrictEqual((await savedLs()).key, [K2, K1]);
  assert((await txt('#gbSaved')).includes('AIzaSy…tUvW'));
  await tap('#gbSaved .schip-use'); await wait(100);
  st = await set(); assert.strictEqual(st.gbKey, K1);
  // togliere una voce dai salvati (con Annulla)
  await tap('#gbSaved .schip-x'); await wait(100);
  assert.deepStrictEqual((await savedLs()).key, [K1]); assert(await hidden('#gbSaved'));
  await page.click('.toast button'); await wait(100);
  assert.deepStrictEqual((await savedLs()).key, [K1, K2]);

  // 5) worker incollato senza https:// o con ?isbn= della prova a mano
  await page.evaluate(() => { const i = document.querySelector('#sbnUrl'); i.value = 'nuovo.piero.workers.dev/?isbn=9788806219352'; i.dispatchEvent(new Event('change')); }); await wait(100);
  st = await set(); assert.strictEqual(st.sbnUrl, 'https://nuovo.piero.workers.dev');
  assert.strictEqual(await val('#sbnUrl'), 'https://nuovo.piero.workers.dev');
  console.log('[5 worker]', await txt('#sbnSaved'));
  await page.evaluate(() => { const i = document.querySelector('#sbnUrl'); i.value = 'http://sbagliato'; i.dispatchEvent(new Event('change')); }); await wait(100);
  assert((await txt('#toastTxt')).includes('https://')); assert.strictEqual((await set()).sbnUrl, 'https://nuovo.piero.workers.dev');
  // svuotare il campo a mano = cancellare
  await page.evaluate(() => { const i = document.querySelector('#sbnUrl'); i.value = ''; i.dispatchEvent(new Event('change')); }); await wait(100);
  assert.strictEqual((await set()).sbnUrl, ''); assert(!(await hidden('#svcRestore')));
  assert.strictEqual(await txt('#svcRestore'), 'Rimetti il worker salvato');

  // 6) dopo un riavvio i salvati restano; contatore di Google: il giorno nuovo azzera solo Google
  await page.reload({ waitUntil: 'load' }); await wait(300);
  await page.evaluate(() => { const q = JSON.parse(localStorage.getItem('catalogo-libri-quota')); q.d = '2000-01-01'; q.g = 500; q.s = 7; localStorage.setItem('catalogo-libri-quota', JSON.stringify(q)); });
  await page.reload({ waitUntil: 'load' }); await wait(300);
  await page.evaluate(() => window.__app.openOptions('search')); await wait(200);
  console.log('[6 dopo riavvio]', await txt('#gbCount'), '|', await txt('#sbnCount'), '|', await txt('#sbnSaved'));
  assert((await txt('#gbCount')).includes('Richieste oggi: 0')); assert((await txt('#sbnCount')).includes('Richieste oggi: 7'));
  assert(!(await hidden('#sbnSaved')));
  await tap('#svcRestore'); await wait(100);
  assert.strictEqual((await set()).sbnUrl, 'https://nuovo.piero.workers.dev');
  await page.screenshot({ path: CFG.OUT + '/k_saved.png' });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await wait(100);
  await page.screenshot({ path: CFG.OUT + '/k_dark.png' });

  assert.deepStrictEqual(errors, []);
  console.log('e2e23 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
