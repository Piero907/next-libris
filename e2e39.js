const CFG = require("./_config");
const H = require('./_harness');
// tastiera: il campo resta visibile e la barra in basso sparisce; «Cerca sul web» in alto
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8156), ROOT);
const B = (o) => Object.assign({ t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: Date.now(), sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: 'da', rt: 0, rd: '' }, o);
const books = [B({ id: 'arau', t: 'La casa di Araucaíma', a: 'Álvaro Mutis', e: 'Adelphi', y: '2011', i: '9788845925870' }), B({ id: 'x2', t: 'Altro libro', a: 'Qualcuno' }), B({ id: 'x3', t: 'Terzo libro', a: 'Altri' })];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 870, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.evaluateOnNewDocument((b) => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true); window.__opened = []; window.open = u => { window.__opened.push(u); return null; };
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ extra: true, lastBackup: Date.now(), price: false, installed: true, instScope: '/', swiped: true, name: 'Piero' })); sessionStorage.seeded = 1; } }, books);
  await page.goto('http://localhost:' + CFG.port(8156) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = H.wait;   // attesa «finché» (_harness.js)
  await wait(1200);
  await page.evaluate(() => document.querySelector('.row[data-id="arau"] [data-act="toggle"]').click()); await wait(300);
  await page.evaluate(() => window.scrollTo(0, 0)); await wait(200);
  await page.screenshot({ path: CFG.OUT + '/kb_top.png' });
  // Cerca sul web in alto, niente «Prezzo dal web» in basso
  const top = await page.$eval('.row[data-id="arau"] .acts-main', e => e.textContent); console.log('[tasti in alto]', top); assert(top.includes('Cerca sul web'));
  const tail = await page.$eval('.row[data-id="arau"] .tail', e => e.textContent); console.log('[in basso]', tail); assert(!tail.includes('Prezzo dal web') && !tail.includes('Cerca sul web'));
  await page.evaluate(() => document.querySelector('.row[data-id="arau"] [data-act="websearch"]').click());
  const u = decodeURIComponent((await page.evaluate(() => window.__opened[0])).replace(/\+/g, ' ')); console.log('[web]', u); assert(u.includes('La casa di Araucaíma Álvaro Mutis libro'));
  // il costo: tocco il campo, la tastiera rimpicciolisce lo schermo
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.focus('.row[data-id="arau"] [data-k="c"]');
  assert(await page.evaluate(() => document.body.classList.contains('typing'))); assert.strictEqual(await page.$eval('.dock', e => getComputedStyle(e).display), 'none');
  await page.setViewport({ width: 412, height: 430, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await wait(900);
  const r = await page.$eval('.row[data-id="arau"] [data-k="c"]', e => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, vh: innerHeight }; });
  console.log('[campo]', r); assert(r.top >= 0 && r.bottom <= r.vh, 'il campo e\' visibile');
  await page.keyboard.type('12,00');
  await page.screenshot({ path: CFG.OUT + '/kb_field.png' });
  // fuori dal campo la barra torna
  await page.evaluate(() => document.activeElement.blur()); await wait(300);
  assert(!(await page.evaluate(() => document.body.classList.contains('typing')))); assert.notStrictEqual(await page.$eval('.dock', e => getComputedStyle(e).display), 'none');
  // da un campo all'altro non lampeggia
  await page.focus('.row[data-id="arau"] [data-k="y"]'); await page.focus('.row[data-id="arau"] [data-k="c"]'); await wait(200);
  assert(await page.evaluate(() => document.body.classList.contains('typing')));
  assert.deepStrictEqual(errors, []);
  console.log('e2e39 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
