const CFG = require("./_config");
const H = require('./_harness');
const puppeteer = require('puppeteer-core'); const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8147), ROOT);
const B = o => Object.assign({ id: 'x', t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 1, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: '', rt: 0, rd: '' }, o);
const books = [];
const T = [['Il nome della rosa','Umberto Eco','Studio','Narrativa','ok'],['Lessico famigliare','Natalia Ginzburg','Studio','Narrativa','da'],['La storia','Elsa Morante','Camera','Narrativa','in'],['Se questo è un uomo','Primo Levi','Soggiorno','Memorie','ok'],['Il Gattopardo','Giuseppe Tomasi di Lampedusa','Soggiorno','Narrativa','da'],['Le città invisibili','Italo Calvino','Camera','Narrativa',''],['Storia d\'Italia','Indro Montanelli','Studio','Storia','da'],['Breve storia del tempo','Stephen Hawking','Studio','Scienza','']];
T.forEach((x, k) => books.push(B({ id: 'b' + k, t: x[0], a: x[1], sh: x[2], gen: x[3], rs: x[4], e: 'Einaudi', y: '2010', c: 12 + k, i: '978880600000' + k, ts: 100 - k, p: k === 2 ? 'Marco' : '', pd: k === 2 ? '2026-10-01' : '', xs: k === 7 ? 'v' : '', xd: k === 7 ? '2026-11-01' : '' })));
const assert = require('assert');
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => r.url().startsWith('http://localhost') ? r.continue() : r.abort());
  await page.evaluateOnNewDocument((b) => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), swiped: true, price: false })); sessionStorage.seeded = 1; } }, books);
  await page.goto('http://localhost:' + CFG.port(8147) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = H.wait;   // attesa «finché» (_harness.js)
  const click = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error('manca ' + s); e.click(); }, sel);
  const rows = () => page.$$eval('#list .row', e => e.map(r => r.dataset.id));
  const book = id => page.evaluate(i => JSON.parse(JSON.stringify(window.__app.state.books.find(b => b.id === i))), id);
  await wait(400);
  // 1) dalla Libreria ai Desideri (libro in prestito e in lettura: stato tolto, Annulla lo rimette)
  await page.evaluate(() => { window.__app.openState()['b2'] = true; window.__app.setTab('lib'); }); await wait(150);
  console.log('[1 link]', await page.$eval('#list .row[data-id="b2"] .top-acts', e => [...e.querySelectorAll('button')].map(x => x.dataset.act).join(',')));
  await click('#list .row[data-id="b2"] [data-act="towish"]'); await wait(200);
  let b = await book('b2'); console.log('[1 spostato]', b.w, b.p, b.rs, '|', await page.$eval('#toastTxt', e => e.textContent));
  assert.deepStrictEqual([b.w, b.p, b.rs], [true, '', '']); assert(!(await rows()).includes('b2'));
  await click('#toastBtn'); await wait(150);
  b = await book('b2'); assert.deepStrictEqual([b.w, b.p, b.rs], [false, 'Marco', 'in']); assert((await rows()).includes('b2'));
  // dopo Annulla la scheda torna aperta com'era
  assert(await page.$eval('#list .row[data-id="b2"]', e => e.classList.contains('open')));
  // 2) e viceversa; nell'altro elenco il libro arriva in vista compatta
  await click('#list .row[data-id="b2"] [data-act="towish"]'); await wait(150);
  await page.evaluate(() => window.__app.setTab('wish')); await wait(150);
  const cls = await page.$eval('#list .row[data-id="b2"]', e => e.className); console.log('[2 nei desideri]', cls);
  assert(cls.includes('closed'));
  await page.evaluate(() => { window.__app.openState()['b2'] = true; window.__app.setTab('wish'); }); await wait(150);
  console.log('[2 desideri]', await rows(), await page.$eval('#list .row[data-id="b2"] .top-acts', e => [...e.querySelectorAll('button')].map(x => x.dataset.act).join(',')));
  await click('#list .row[data-id="b2"] [data-act="tolib"]'); await wait(150);
  b = await book('b2'); console.log('[2 in libreria]', b.w, b.rs); assert.deepStrictEqual([b.w, b.rs], [false, 'da']);
  await page.evaluate(() => window.__app.setTab('lib')); await wait(150);
  assert((await page.$eval('#list .row[data-id="b2"]', e => e.className)).includes('closed'));
  await page.evaluate(() => window.__app.setTab('wish')); await wait(100);
  assert.deepStrictEqual(await rows(), []);
  console.log('ERRORI:', errors.length ? errors : 'nessuno'); assert(!errors.length);
  console.log('e2e18 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
