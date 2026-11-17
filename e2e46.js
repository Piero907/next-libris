const CFG = require("./_config");
const H = require('./_harness');
// numerazione personalizzata: frecce, trascinamento, numeri scritti a mano, controllo dei doppioni
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8165), ROOT);
const B = (o) => Object.assign({ t: '', a: 'Álvaro Mutis', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 0, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: 'da', rt: 0, rd: '' }, o);
const books = [B({ id: 'a', t: 'Abdul Bashur', y: '2014', ts: 4 }), B({ id: 'b', t: "L'ultimo scalo del Tramp Steamer", y: '2006', ts: 3 }), B({ id: 'c', t: 'La casa di Araucaíma', y: '2014', ts: 2 }), B({ id: 'd', t: 'Ilona arriva con la pioggia', y: '2016', ts: 1 })];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.evaluateOnNewDocument((b) => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), installed: true, instScope: '/', swiped: true, name: 'Piero', selTip: 1 })); sessionStorage.seeded = 1; } }, books);
  await page.goto('http://localhost:' + CFG.port(8165) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = H.wait;   // attesa «finché» (_harness.js)
  await wait(1200);
  const click = sel => page.evaluate(s => document.querySelector(s).click(), sel);
  const all = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__app.state.books)));
  const order = () => page.$$eval('#bkPrev li', e => e.map(li => li.dataset.id + '=' + li.querySelector('.bk-n').value));
  // seleziono a, b, c, d (in quest'ordine) e apro Modifica
  const c0 = await page.$eval('.row[data-id="a"] .sum', e => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + 20 }; });
  await page.mouse.move(c0.x, c0.y); await page.mouse.down(); await wait(650); await page.mouse.up(); await wait(500);
  for (const id of ['b', 'c', 'd']) await page.evaluate(i => document.querySelector('.row[data-id="' + i + '"] .sum').click(), id);
  await click('#selEdit'); await wait(200);
  await page.evaluate(() => { const i = document.querySelector('#bkSe'); i.value = 'Mutis'; i.dispatchEvent(new Event('input')); const c = document.querySelector('#bkSeNum'); c.checked = true; c.dispatchEvent(new Event('change')); });
  // per anno, poi personalizzato: si parte dall'ordine per anno
  await page.evaluate(() => { const r = document.querySelector('input[name="bkOrd"][value="year"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.evaluate(() => { const r = document.querySelector('input[name="bkOrd"][value="custom"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(100);
  let o = await order(); console.log('[inizio]', o.join(' ')); assert.deepStrictEqual(o, ['b=1', 'a=2', 'c=3', 'd=4']);
  assert(!(await page.$eval('#bkCustHint', e => e.hidden)));
  // freccia giu' sul primo
  await click('#bkPrev li[data-id="b"] [data-mv="1"]'); await wait(50);
  o = await order(); console.log('[freccia]', o.join(' ')); assert.deepStrictEqual(o, ['a=1', 'b=2', 'c=3', 'd=4']);
  // trascino d in cima con la maniglia
  await page.evaluate(() => document.querySelector('#bkPrev li[data-id="d"]').scrollIntoView({ block: 'center' })); await wait(100);
  const h = await page.$eval('#bkPrev li[data-id="d"] .bk-drag', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const top = await page.$eval('#bkPrev li[data-id="a"]', e => { const r = e.getBoundingClientRect(); return r.top + 5; });
  await page.mouse.move(h.x, h.y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(h.x, h.y + (top - h.y) * i / 8);
  await page.mouse.up(); await wait(100);
  o = await order(); console.log('[trascinato]', o.join(' ')); assert.deepStrictEqual(o, ['d=1', 'a=2', 'b=3', 'c=4']);
  await page.screenshot({ path: CFG.OUT + '/cust.png' });
  // numero a mano: c diventa 9; doppione -> avviso e niente modifica
  await page.evaluate(() => { const i = document.querySelector('#bkPrev li[data-id="c"] .bk-n'); i.value = '2'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await click('#bulkSheet [data-bk="se"]'); await wait(150);
  const t1 = await page.$eval('#toastTxt', e => e.textContent); console.log('[doppione]', t1); assert(t1.includes('usato due volte'));
  assert(!(await all()).some(b => b.se), 'non applicato');
  await page.evaluate(() => { const i = document.querySelector('#bkPrev li[data-id="c"] .bk-n'); i.value = '9'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await click('#bulkSheet [data-bk="se"]'); await wait(150);
  const t2 = await page.$eval('#toastTxt', e => e.textContent); console.log('[applicato]', t2);
  const res = (await all()).map(b => b.id + ':' + b.sn).sort(); assert.deepStrictEqual(res, ['a:2', 'b:3', 'c:9', 'd:1']);
  assert(t2.includes('con i numeri 1, 2, 3, 9'));
  assert.deepStrictEqual(errors, []);
  console.log('e2e46 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
