const CFG = require("./_config");
const H = require('./_harness');
// filtri -> schede compatte; fotocamera: pulsante di uscita
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP, IMG = CFG.IMG;
const server = H.serve(CFG.port(8145), ROOT);
const B = [{ id: 'b1', t: 'Il nome della rosa', a: 'Umberto Eco', gen: 'Gialli', ts: 3, p: 'Marco' }, { id: 'b2', t: 'Il deserto dei Tartari', a: 'Dino Buzzati', gen: 'Narrativa', ts: 2 }, { id: 'b3', t: 'Il pendolo di Foucault', a: 'Umberto Eco', gen: 'Gialli', ts: 1 }];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + IMG + '/live.mjpeg'] });
  const p = await browser.newPage();
  await p.evaluateOnNewDocument(b => { localStorage.setItem('catalogo-libri-set', JSON.stringify({ installed: true, instScope: '/', swiped: true, lastBackup: Date.now(), price: false })); if (!localStorage.getItem('catalogo-libri-v2')) localStorage.setItem('catalogo-libri-v2', JSON.stringify({ updated: Date.now(), books: b })); }, B);
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.setRequestInterception(true);
  p.on('request', r => { const u = r.url(); if (u.startsWith('http://localhost:' + CFG.port(8145) + '')) return r.continue(); if (u.includes('googleapis.com/books')) return r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ items: [{ id: 'g', volumeInfo: { title: 'Libro scansionato', authors: ['A'] } }] }) }); r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }); });
  await p.goto('http://localhost:' + CFG.port(8145) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = H.wait;   // attesa «finché» (_harness.js)
  const tap = s => p.$eval(s, e => e.click());
  const openN = () => p.$$eval('#list .row.open', a => a.length);
  const openAllCards = async () => { for (const id of await p.$$eval('#list .row.closed', a => a.map(x => x.dataset.id))) { await tap('#list .row[data-id="' + id + '"] .sum'); await wait(60); } };
  await wait(400);
  // 1) etichetta «Vedi tutti i libri di» dalla scheda aperta
  await openAllCards(); assert.strictEqual(await openN(), 1);   // una scheda alla volta (v58)
  if (!await p.$('#list .row.open[data-id="b1"]')) { await tap('#list .row[data-id="b1"] .sum'); await wait(80); }
  await p.$$eval('#list .row[data-id="b1"] [data-act="facet"]', a => a.find(x => x.dataset.f === 'gen').click()); await wait(200);
  console.log('[1 genere] righe', await p.$$eval('#list .row', a => a.length), 'aperte', await openN()); assert.strictEqual(await openN(), 0);
  // 2) menu laterale
  await openAllCards(); assert(await openN() > 0);
  await p.evaluate(() => window.__app.openDrawer('flt')); await wait(350);
  await tap('#drawerFlt [data-g="read"][data-v="da"]'); await wait(150); assert.strictEqual(await openN(), 0);
  await p.evaluate(() => window.__app.closeDrawer()); await wait(350);
  // 3) togliere un filtro, «Prestati», ricerca, Azzera
  await openAllCards(); await tap('#activeFlt [data-clear]'); await wait(150); assert.strictEqual(await openN(), 0);
  await p.evaluate(() => document.querySelector('#drawerReset').click()); await wait(150);
  await openAllCards(); assert.strictEqual(await openN(), 1);   // una scheda alla volta (v58)
  if (!await p.$('#list .row.open[data-id="b1"]')) { await tap('#list .row[data-id="b1"] .sum'); await wait(80); } await H.fai(p, 'loan'); await wait(150); assert.strictEqual(await openN(), 0); await H.fai(p, 'loan'); await wait(150);
  await openAllCards(); await p.type('#q', 'eco'); await wait(200); console.log('[3 ricerca] righe', await p.$$eval('#list .row', a => a.length), 'aperte', await openN()); assert.strictEqual(await openN(), 0);
  // senza filtri, aprire e chiudere funziona come prima
  await p.evaluate(() => document.querySelector('#drawerReset').click()); await wait(150);
  await tap('#list .row[data-id="b2"] .sum'); await wait(100); assert.strictEqual(await openN(), 1);

  // 4) fotocamera: pulsante in basso
  await H.fai(p, 'scan'); await wait(120);
  console.log('[4 inizio]', await p.$eval('#scanClose', e => e.textContent), '|', await p.$eval('#scanDone', e => e.textContent));

  await p.waitForFunction(() => /vedi/.test(document.querySelector('#scanDone').textContent), { timeout: 30000 });
  console.log('[4 dopo la scansione]', await p.$eval('#scanDone', e => e.textContent));
  assert.strictEqual(await p.$eval('#scanDone', e => e.textContent), 'Ho finito · vedi il libro aggiunto'); assert(await p.$eval('#scanDone', e => e.classList.contains('has')));
  const box = await p.$eval('#scanDone', e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), getComputedStyle(e).backgroundColor]; });
  console.log('[4 pulsante]', box); assert(box[0] > 300 && box[1] >= 48 && box[2] === 'rgb(255, 255, 255)');
  await p.screenshot({ path: CFG.OUT + '/sc_done.png' });
  await tap('#scanDone'); await wait(500);
  assert(await p.$eval('#scan', e => e.hidden)); assert.strictEqual(await p.evaluate(() => window.__app.state.books.length), 4);
  // riaprendo riparte da zero; «Ce l'ho già?» dice solo Chiudi
  await H.fai(p, 'scan'); await wait(120); assert.strictEqual(await p.$eval('#scanDone', e => e.textContent), 'Chiudi la fotocamera'); await wait(600); await tap('#scanClose'); await wait(400);
  assert.deepStrictEqual(errors, []);
  console.log('e2e29 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
