const CFG = require("./_config");
const H = require('./_harness');
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8133), ROOT);
// Ricerca dei libri SENZA account (031, 20/11/2026: worker SBN della casa). Il catalogo SBN è incluso: niente campo del worker;
// il worker salvato prima sparisce dal telefono senza avvisi; le ricerche SBN passano dalla funzione «libri» del server (senza
// accesso: solo la chiave pubblica), 50 al giorno per telefono, poi il testo approvato; «tetto» di tutti (x-nl-stop) con il suo testo.
// Per l'API Google: contatore, Cancella, salvate, «Rimetti» come prima.
const W1 = 'https://sbn-libri.piero.workers.dev', K1 = 'AIzaSyA1b2C3d4E5f6G7h8I9j0KlMnOpQrStUvW', K2 = 'AIzaSyZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument((W1, K1) => {
    window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!localStorage.getItem('catalogo-libri-set')) {      // un telefono con la versione 111: worker suo in uso e tra i salvati
      localStorage.setItem('catalogo-libri-set', JSON.stringify({ installed: true, instScope: '/', swiped: true, lastBackup: Date.now(), price: false, sbnUrl: W1, gbKey: K1 }));
      localStorage.setItem('catalogo-libri-saved', JSON.stringify({ sbn: [W1], key: [K1] }));
    }
  }, W1, K1);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  let gHits = 0, sHits = 0, wHits = 0, sAuth = [], stop = '';
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith('http://localhost:' + CFG.port(8133) + '')) return req.continue();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'x-nl-tot, x-nl-mio, x-nl-stop' };
    const j = (o, st, h) => req.respond({ status: st || 200, contentType: 'application/json', headers: Object.assign({}, cors, h || {}), body: JSON.stringify(o) });
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: cors });
    if (u.includes('googleapis.com/books/v1/volumes')) { gHits++; return j({ items: [{ id: 'x', volumeInfo: { title: 'Libro di prova', authors: ['A. Autore'], industryIdentifiers: [{ type: 'ISBN_13', identifier: '9788806219352' }] } }] }); }
    if (u.includes('/functions/v1/libri?isbn=')) { sHits++; sAuth.push(req.headers().authorization || '');
      return stop ? j({ error: 'limite' }, 429, { 'x-nl-stop': stop }) : j({ briefRecords: [] }); }
    if (u.includes('workers.dev')) { wHits++; return j({}); }
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
  const toasts = () => page.evaluate(() => Array.from(document.querySelectorAll('.toast')).map(t => t.innerText.replace(/\s+/g, ' ').trim()).join(' | '));
  const add = async (isbn) => { await page.evaluate(i => window.__app.addIsbn(i), isbn);
    await page.waitForFunction(i => { const b = window.__app.state.books.find(x => x.i === i); return b && b.t; }, { timeout: 10000 }, isbn); };
  await wait(400);

  // 1) il worker di prima non c'è più (senza avvisi); il catalogo SBN è una riga «Incluso»; l'API resta com'era
  assert(!/worker/i.test(await toasts()), 'nessun avviso sul worker: ' + await toasts());
  assert.strictEqual(await page.evaluate(() => window.NL.settings.sbnUrl), '', 'worker tolto dalle impostazioni');
  assert.deepStrictEqual(await savedLs(), { sbn: [], key: [K1] }, 'worker tolto dai salvati');
  await page.evaluate(() => window.__app.openOptions('search')); await wait(200);
  await page.evaluate(() => { window.NL.svcFold('key', true); }); await wait(100);
  const KM = K1.slice(0, 4) + '…' + K1.slice(-3);   // chiave coperta nel campo (giro 5)
  assert.strictEqual(await val('#gbKey'), KM);
  assert(await page.evaluate(() => !document.getElementById('sbnUrl') && !document.getElementById('sbnCopy') && !document.getElementById('sbnGuide')), 'niente campo né guida del worker');
  const sec = await txt('.opt-sec[data-sec="search"]');
  assert(!/worker/i.test(sec), 'la parola worker non compare più: ' + sec);
  assert(sec.startsWith('L’API Google Libri è facoltativa: serve a trovare più libri e ad avere dati più precisi.'), sec.slice(0, 120));
  console.log('[1 SBN]', await txt('#svcSbn .svc-h'), '|', await txt('#sbnCount'));
  console.log('[1 Google]', await txt('#svcKey .svc-h'), '|', await txt('#gbCount'));
  assert.strictEqual(await txt('#svcSbn .svc-t'), 'Catalogo delle biblioteche italiane (SBN)');
  assert.strictEqual(await txt('#sbnSt'), 'Incluso'); assert.strictEqual(await txt('#gbSt'), 'In uso');
  assert.strictEqual(await txt('#sbnCount'), 'Non devi fare niente. Ricerche di oggi: 0 su 50.');
  assert(/Richieste oggi: 0 su 1\.000/.test(await txt('#gbCount')));
  assert(!(await hidden('#gbClear'))); assert(await hidden('#svcRestore')); assert(await hidden('#gbSaved'));
  const box = await page.evaluate(() => { const r = document.getElementById('svcSbn').getBoundingClientRect(), t = document.querySelector('#svcSbn .svc-t').getBoundingClientRect(), s = document.getElementById('sbnSt').getBoundingClientRect();
    return { in: t.left >= r.left && s.right <= r.right + 0.5, over: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
  assert(box.in && box.over <= 0, 'riga SBN dentro il riquadro: ' + JSON.stringify(box));
  await page.screenshot({ path: CFG.OUT + '/k_on.png' });

  // 2) una ricerca: SBN passa dal server (senza accesso), mai dal vecchio worker; i due contatori salgono
  await add('9788806219352');
  await wait(3500);
  const q = await page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-quota')));
  console.log('[2 contatori]', q, '| richieste viste: Google', gHits, 'SBN', sHits, 'worker', wHits, '|', await txt('#gbCount'), '|', await txt('#sbnCount'));
  assert(q.g >= 1 && q.s >= 1); assert.strictEqual(q.g, gHits); assert.strictEqual(q.s, sHits);
  assert.strictEqual(wHits, 0, 'nessuna richiesta al worker di prima');
  assert(sAuth.every(a => a === ''), 'senza account nessun accesso mandato');
  assert((await txt('#gbCount')).includes('Richieste oggi: ' + q.g + ' su 1.000'));
  assert.strictEqual(await txt('#sbnCount'), 'Non devi fare niente. Ricerche di oggi: ' + q.s + ' su 50.');
  assert.strictEqual(q.ds, new Date().toISOString().slice(0, 10), 'il giorno di SBN è quello UTC');

  // 3) Cancella l'API: campo vuoto, l'app cerca senza; resta tra le salvate; il pulsante la rimette
  await tap('#gbClear'); await wait(100);
  console.log('[3 toast]', await txt('#toastTxt'));
  let st = await set(); assert.strictEqual(st.gbKey, '');
  assert.strictEqual(await val('#gbKey'), ''); assert.strictEqual(await txt('#gbSt'), 'Nessuna API');
  console.log('[3 salvate]', await txt('#gbSaved'), '| pulsante:', await txt('#svcRestore'));
  assert.strictEqual(await txt('#svcRestore'), 'Rimetti l’API salvata');
  assert((await txt('#gbCount')).includes('senza API'));
  await page.screenshot({ path: CFG.OUT + '/k_off.png' });
  await tap('#svcRestore'); await wait(100);
  console.log('[3 rimessa]', await txt('#toastTxt'));
  st = await set(); assert.strictEqual(st.gbKey, K1); assert.strictEqual(await val('#gbKey'), KM);
  assert(await hidden('#svcRestore'));
  await page.click('.toast button'); await wait(100);   // Annulla del ripristino
  st = await set(); assert.strictEqual(st.gbKey, '');

  // 4) sostituire l’API: la vecchia resta tra le salvate e si può rimettere
  await page.evaluate(K2 => { const i = document.querySelector('#gbKey'); i.value = '  ' + K2 + ' '; i.dispatchEvent(new Event('change')); }, K2); await wait(100);
  st = await set(); assert.strictEqual(st.gbKey, K2);
  console.log('[4 nuova chiave]', await txt('#toastTxt'), '| salvate:', await txt('#gbSaved'));
  assert.deepStrictEqual((await savedLs()).key, [K2, K1]);
  assert((await txt('#gbSaved')).includes('AIzaSy…tUvW'));
  await tap('#gbSaved .schip-use'); await wait(100);
  st = await set(); assert.strictEqual(st.gbKey, K1);
  await tap('#gbSaved .schip-x'); await wait(100);      // togliere una voce dalle salvate (con Annulla)
  assert.deepStrictEqual((await savedLs()).key, [K1]); assert(await hidden('#gbSaved'));
  await page.click('.toast button'); await wait(100);
  assert.deepStrictEqual((await savedLs()).key, [K1, K2]);

  // 5) senza account: 50 ricerche al giorno per telefono; alla 51ª niente richiesta e il testo approvato, una volta sola
  await page.evaluate(() => { const q = JSON.parse(localStorage.getItem('catalogo-libri-quota')); q.s = 50; localStorage.setItem('catalogo-libri-quota', JSON.stringify(q)); });
  await page.reload({ waitUntil: 'load' }); await wait(300);
  let s0 = sHits;
  await add('9788806219000'); await wait(300);
  console.log('[5 limite 50]', await toasts(), '| SBN', sHits - s0);
  assert.strictEqual(sHits, s0, 'oltre le 50 nessuna richiesta a SBN');
  assert((await toasts()).includes('Senza account il catalogo delle biblioteche (SBN) fa 50 ricerche al giorno. Entra con Google per averne 500.'), await toasts());
  assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-sbn-casa')).said), 'qui');
  await page.evaluate(() => window.__app.openOptions('search')); await wait(200);
  assert.strictEqual(await txt('#sbnCount'), 'Non devi fare niente. Ricerche di oggi: 50 su 50.');
  if (process.env.SCHERMATE) await page.screenshot({ path: path.join(process.env.SCHERMATE, 'ricerca-sbn-incluso-390.png') });
  await page.evaluate(() => { document.querySelectorAll('.toast').forEach(t => t.remove()); });
  await add('9788806219017'); await wait(300);
  assert(!(await toasts()).includes('Senza account'), 'il limite si dice una volta al giorno');

  // 5b) il tetto di tutti quelli senza account (lo dice il server): testo approvato, poi niente richieste fino a domani
  await page.evaluate(() => { const q = JSON.parse(localStorage.getItem('catalogo-libri-quota')); q.s = 3; localStorage.setItem('catalogo-libri-quota', JSON.stringify(q)); localStorage.removeItem('catalogo-libri-sbn-casa'); });
  await page.reload({ waitUntil: 'load' }); await wait(300);
  stop = 'tetto'; s0 = sHits;
  await add('9788806219024'); await wait(300);
  console.log('[5b tetto]', await toasts(), '| SBN', sHits - s0);
  assert.strictEqual(sHits, s0 + 1);
  assert((await toasts()).includes('Oggi il catalogo delle biblioteche (SBN) è al completo per chi non ha l\'account. Entra con Google per usarlo subito.'), await toasts());
  stop = ''; s0 = sHits;
  await add('9788806219031'); await wait(300);
  assert.strictEqual(sHits, s0, 'dopo il tetto niente SBN fino a domani');

  // 6) il giorno nuovo azzera i contatori; le API salvate restano
  await page.evaluate(() => { const q = JSON.parse(localStorage.getItem('catalogo-libri-quota')); q.d = '2000-01-01'; q.g = 500; q.ds = '2000-01-01'; q.s = 50; localStorage.setItem('catalogo-libri-quota', JSON.stringify(q));
    const c = JSON.parse(localStorage.getItem('catalogo-libri-sbn-casa')); c.d = '2000-01-01'; localStorage.setItem('catalogo-libri-sbn-casa', JSON.stringify(c)); });   // anche il «tetto» era di ieri
  await page.reload({ waitUntil: 'load' }); await wait(300);
  await page.evaluate(() => window.__app.openOptions('search')); await wait(200);
  console.log('[6 giorno nuovo]', await txt('#gbCount'), '|', await txt('#sbnCount'));
  assert((await txt('#gbCount')).includes('Richieste oggi: 0')); assert.strictEqual(await txt('#sbnCount'), 'Non devi fare niente. Ricerche di oggi: 0 su 50.');
  s0 = sHits; await add('9788806219048'); await wait(300);
  assert.strictEqual(sHits, s0 + 1, 'il giorno dopo SBN riparte');
  assert.deepStrictEqual((await savedLs()).key, [K1, K2]);
  await page.screenshot({ path: CFG.OUT + '/k_saved.png' });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await wait(100);
  await page.screenshot({ path: CFG.OUT + '/k_dark.png' });

  assert.deepStrictEqual(errors, []);
  console.log('e2e23 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
