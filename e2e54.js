const CFG = require("./_config");
const H = require('./_harness');
// statistiche: libri senza pagine; tastiera: «Fatto» (enterkeyhint="done") nei campi della scheda aperta, Costo compreso; Invio chiude la tastiera
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8174), ROOT);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const wait = H.wait;   // attesa «finché» (_harness.js)
  await page.goto('http://localhost:' + CFG.port(8174) + '/?vista=elenco', { waitUntil: 'load' });
  await page.evaluate(() => { const o = Storage.prototype.setItem; localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: [{ id: 'k1', t: 'Libro', a: 'Autore', e: 'Editore', y: '2021', c: 24, ts: 1 }, { id: 'k2', t: 'Altro', a: 'B', pg: '300', ts: 2 }, { id: 'k3', t: 'Terzo', a: 'C', pg: '120', ts: 3 }], updated: Date.now() })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'P', selTip: 1, extra: true })); Storage.prototype.setItem = function (k, v) { if (/^catalogo-libri-(v2|set)$/.test(k)) return; return o.call(this, k, v); }; });
  await page.reload({ waitUntil: 'load' }); await wait(800);
  await page.evaluate(() => document.querySelector('#list .row[data-id="k1"] .sum').click()); await wait(400);
  const f = await page.$$eval('#list .row.open input:not([type=date]), #list .row.open textarea', els => els.map(e => e.dataset.k + ':' + e.getAttribute('enterkeyhint')));
  console.log('[campi]', f.join(' '));
  assert(f.length > 6 && f.every(x => x.endsWith(':done')), 'tutti «Fatto»');
  assert(f.includes('c:done'));
  await page.focus('#c-k1'); await page.keyboard.press('Enter'); await wait(150);
  assert.notStrictEqual(await page.evaluate(() => document.activeElement && document.activeElement.id), 'c-k1', 'Invio chiude la tastiera');
  for (const id of ['#bkFrom', '#quotePage', '#loanWho', '#optName']) assert.strictEqual(await page.$eval(id, e => e.getAttribute('enterkeyhint')), 'done', id);
  // statistiche: «su 2 libri · senza pagine: 1»
  await page.evaluate(() => { document.activeElement && document.activeElement.blur(); history.back(); }); await wait(300);
  await H.fai(page, 'stats'); await wait(400);
  const pages = await page.$$eval('#statsBody .tile', els => els.map(e => e.textContent).find(t => /pagine/.test(t) && !/lette/.test(t)));
  console.log('[pagine]', pages); assert(/420/.test(pages) && /su 2 libri · senza pagine: 1/.test(pages));
  assert.deepStrictEqual(errors, []);
  console.log('e2e54 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
