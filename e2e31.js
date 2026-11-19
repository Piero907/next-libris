const CFG = require("./_config");
const H = require('./_harness');
// API Google e worker: «Manda con un link» tolto (giro 8, 18/11/2026); un vecchio link «#k=» dà solo un avviso
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP, BASE = 'http://localhost:' + CFG.port(8148) + '/?vista=elenco';
const server = H.serve(CFG.port(8148), ROOT);
const W = 'https://sbn-libri.piero.workers.dev', K = 'AIzaSyA1b2C3d4E5f6G7h8I9j0KlMnOpQrStUvW';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const wait = H.wait;   // attesa «finché» (_harness.js)
  async function open(url, set) {
    const ctx = await browser.createBrowserContext(); const p = await ctx.newPage();
    await p.evaluateOnNewDocument(s => {
      if (!localStorage.getItem('catalogo-libri-set')) localStorage.setItem('catalogo-libri-set', JSON.stringify(s));
      window.__shared = []; window.__copied = [];
      Object.defineProperty(navigator, 'share', { configurable: true, value: d => { window.__shared.push(d); return Promise.resolve(); } });
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__copied.push(t); return Promise.resolve(); } } });
    }, Object.assign({ installed: true, instScope: '/', swiped: true, lastBackup: Date.now() }, set));
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
    await p.setRequestInterception(true); p.on('request', r => r.url().startsWith(BASE.split('?')[0]) ? r.continue() : r.respond({ status: 404, body: '' }));
    await p.goto(url, { waitUntil: 'load' }); await wait(400); return p;
  }
  const tap = (p, s) => p.$eval(s, e => e.click()), hid = (p, s) => p.$eval(s, e => e.hidden), txt = (p, s) => p.$eval(s, e => e.innerText.replace(/\s+/g, ' ').trim());
  const set = p => p.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')));
  // 1) senza API né worker: solo la guida
  let p = await open(BASE, {});
  await p.evaluate(() => window.__app.openOptions('search')); await wait(150);
  assert.deepStrictEqual(await p.$$eval('#svcBox [data-svc]', e => e.map(x => x.dataset.svc)), ['guide'], 'niente da prestare: solo la guida (16/11/2026)');
  await p.browserContext().close();
  // 2) con API e worker: «Presta a un amico» c'è, ma «Manda con un link» non c'è più (giro 8, Piero 18/11/2026: si presta solo dentro l'app)
  p = await open(BASE, { name: 'Piero', sbnUrl: W, gbKey: K });
  await p.evaluate(() => window.__app.openOptions('search')); await wait(150);
  await tap(p, '#svcBox [data-svc="lend"]'); await wait(300);
  assert(!(await hid(p, '#kwSheet')), 'finestra dell’API aperta');
  assert.strictEqual(await p.$$eval('#kwBody [data-kw="link"]', a => a.length), 0, 'niente «Manda con un link»');
  assert(!/link/i.test(await txt(p, '#kwBody')), 'nessun testo sul link: ' + await txt(p, '#kwBody'));
  assert.strictEqual(await p.$$eval('#svcSheet, #svcInSheet', a => a.length), 0, 'finestre del link tolte dalla pagina');
  assert.strictEqual(await p.evaluate(() => typeof window.NL.svcShare), 'undefined');
  assert.deepStrictEqual(p.errors, []); await p.browserContext().close();
  // 3) un vecchio link «#k=» aperto oggi: avviso, niente finestra, impostazioni intatte, indirizzo ripulito
  const old = 'j' + Buffer.from(JSON.stringify({ v: 1, t: 'svc', n: 'Piero', sb: W, gk: K })).toString('base64url');
  p = await open(BASE + '#k=' + old, { name: 'Anna', gbKey: 'AIzaSyANNAANNAANNAANNAANNAANNAANNAANNAAN' });
  const t3 = await p.$eval('#toastTxt', e => e.textContent); console.log('[3 vecchio link]', t3);
  assert(/non si usano più/.test(t3) && !t3.includes(K));
  let st = await set(p); assert.deepStrictEqual([st.sbnUrl || '', st.gbKey], ['', 'AIzaSyANNAANNAANNAANNAANNAANNAANNAANNAAN'], 'niente cambiato');
  assert.strictEqual(p.url(), BASE, 'il codice non resta nell\'indirizzo');
  const sv = await p.evaluate(() => localStorage.getItem('catalogo-libri-saved') || ''); assert(!sv.includes(K) && !sv.includes(W), 'niente tra i salvati');
  // ostile: non viene nemmeno letto
  const evil = 'j' + Buffer.from(JSON.stringify({ v: 1, t: 'svc', n: '<img src=x onerror=window.__pwn=1>', sb: 'javascript:alert(1)', gk: '<script>' })).toString('base64url');
  await p.evaluate(h => { location.hash = 'k=' + h; }, evil); await wait(400);
  assert.strictEqual(await p.evaluate(() => window.__pwn), undefined);
  // un link di una lista («#l=») funziona ancora dopo
  assert.strictEqual(await p.evaluate(() => typeof window.NL), 'object');
  assert.deepStrictEqual(p.errors, []); await p.browserContext().close();
  console.log('e2e31 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
