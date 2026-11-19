const CFG = require("./_config");
const H = require('./_harness');
const puppeteer = require('puppeteer-core'); const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8141), ROOT);
const B = o => Object.assign({ id: 'x', t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 1, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: '', rt: 0, rd: '' }, o);
const books = [];
const T = [['Il nome della rosa','Umberto Eco','Studio','Narrativa','ok'],['Lessico famigliare','Natalia Ginzburg','Studio','Narrativa','da'],['La storia','Elsa Morante','Camera','Narrativa','in'],['Se questo è un uomo','Primo Levi','Soggiorno','Memorie','ok'],['Il Gattopardo','Giuseppe Tomasi di Lampedusa','Soggiorno','Narrativa','da'],['Le città invisibili','Italo Calvino','Camera','Narrativa',''],['Storia d\'Italia','Indro Montanelli','Studio','Storia','da'],['Breve storia del tempo','Stephen Hawking','Studio','Scienza','']];
T.forEach((x, k) => books.push(B({ id: 'b' + k, t: x[0], a: x[1], sh: x[2], gen: x[3], rs: x[4], e: 'Einaudi', y: '2010', c: 12 + k, i: '978880600000' + k, ts: 100 - k, p: k === 2 ? 'Marco' : '', pd: k === 2 ? '2026-10-01' : '', xs: k === 7 ? 'v' : '', xd: k === 7 ? '2026-11-01' : '' })));
(async () => {
  const assert = require('assert');
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => r.url().startsWith('http://localhost') ? r.continue() : r.abort());
  await page.evaluateOnNewDocument((b) => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), price: false })); sessionStorage.seeded = 1; } }, books);
  await page.goto('http://localhost:' + CFG.port(8141) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = H.wait;   // attesa «finché» (_harness.js)
  const click = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error('manca ' + s); e.click(); }, sel);
  const rows = () => page.$$eval('#list .row', e => e.map(r => r.dataset.id));
  const isOpen = () => page.evaluate(() => { const d = document.querySelector('#drawer'); return !d.hidden && d.classList.contains('open') && document.body.classList.contains('drawer-open'); });
  const txt = sel => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
  async function drag(x0, y0, x1, y1, steps = 8, pause = 16) {
    await page.touchscreen.touchStart(x0, y0);
    for (let i = 1; i <= steps; i++) { await page.touchscreen.touchMove(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await wait(pause); }
    await page.touchscreen.touchEnd(); await wait(400);
  }
  await wait(400);
  const all = await rows(); console.log('[0 righe]', all.length);

  // 1) gesti che NON devono aprire: corto, dal lato sinistro, verticale
  await drag(20, 650, 50, 652); assert(!(await isOpen()), 'corto');
  await drag(300, 650, 385, 650); assert(!(await isOpen()), 'dalla meta destra');
  await drag(60, 700, 70, 500); assert(!(await isOpen()), 'verticale');
  await drag(120, 650, 20, 650); assert(!(await isOpen()), 'verso sinistra');
  // 2) a meta' gesto il pannello segue il dito
  await page.touchscreen.touchStart(2, 650);
  for (let i = 1; i <= 4; i++) { await page.touchscreen.touchMove(2 + i * 20, 652); await wait(16); }
  const mid = await page.evaluate(() => ({ hidden: document.querySelector('#drawer').hidden, tr: document.querySelector('#drawer').style.transform }));
  console.log('[2 a metà]', mid); assert(!mid.hidden && /translateX\(-\d/.test(mid.tr));
  for (let i = 5; i <= 10; i++) { await page.touchscreen.touchMove(2 + i * 20, 652); await wait(16); }
  await page.touchscreen.touchEnd(); await wait(400);
  assert(await isOpen(), 'si apre col gesto');
  const box = await page.$eval('#drawer', e => { const r = e.getBoundingClientRect(); return [r.left, r.width]; });
  console.log('[2 posizione]', box); assert(box[0] === 0 && box[1] >= 390 - 1);   // restyle pezzo 3 (Piero, 19/11/2026): il Menu è una pagina intera
  const set = await page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')));
  assert.strictEqual(set.swiped, true); assert(await page.$eval('#drawerHint', e => e.hidden));
  await page.screenshot({ path: CFG.OUT + '/s_drawer.png' });
  assert(await page.$eval('#drawerOpts', e => !e.hidden), 'v84: dal bordo si apre il menu, non i filtri');
  await click('#goFilters'); await wait(200);
  console.log('[2 piede]', await txt('#drawerShow'));

  // 3) filtri: Da leggere + scaffale Studio
  await click('#drawerFlt [data-g="read"][data-v="da"]'); await wait(100);
  let r = await rows(); console.log('[3 da leggere]', r, await txt('#drawerShow'));
  assert.deepStrictEqual(r.sort(), ['b1', 'b4', 'b6']);
  const studio = await page.$eval('#drawerFlt [data-g="sh"]', e => e.dataset.v);
  await page.evaluate(() => { [...document.querySelectorAll('#drawerFlt [data-g="sh"]')].find(x => x.textContent.startsWith('Studio')).click(); }); await wait(100);
  r = await rows(); console.log('[3 + Studio]', r, '|', await txt('#drawerShow'), '| numerino', await txt('#fltBadge'));
  assert.deepStrictEqual(r.sort(), ['b1', 'b6']); assert.strictEqual(await txt('#fltBadge'), '2'); assert.strictEqual(await txt('#drawerShow'), 'Mostra 2 libri');
  // ordine dal pannello
  await page.select('#sort', 'titolo'); await wait(100); assert.deepStrictEqual(await rows(), ['b1', 'b6']);
  await page.select('#sort', 'recent');
  // 4) chiudi trascinando verso destra
  await drag(170, 500, 5, 505); assert(!(await isOpen()), 'chiude col gesto');
  await wait(300); assert(await page.$eval('#drawer', e => e.hidden && e.hasAttribute('inert')));
  console.log('[4 chip]', await txt('#activeFlt'));
  assert((await txt('#activeFlt')).includes('Da leggere') && (await txt('#activeFlt')).includes('Scaffale: Studio'));
  await click('#activeFlt [data-clear="sh"]'); await wait(100);
  assert.deepStrictEqual((await rows()).sort(), ['b1', 'b4', 'b6']); assert.strictEqual(await txt('#fltBadge'), '1');
  // 5) pulsante, tasto Indietro, Esc, tocco fuori
  await click('#btnFilters'); await wait(350); assert(await isOpen());
  await page.goBack(); await wait(400); assert(!(await isOpen()), 'Indietro chiude'); assert.strictEqual(page.url(), 'http://localhost:' + CFG.port(8141) + '/?vista=elenco');
  await click('#btnFilters'); await wait(350); await page.keyboard.press('Escape'); await wait(350); assert(!(await isOpen()), 'Esc');
  await click('#btnFilters'); await wait(350); await click('#drawerX'); await wait(350); assert(!(await isOpen()), '‹ chiude');   // restyle pezzo 3: pagina intera, niente «fuori» da toccare
  // 5b) la linguetta sul bordo sinistro apre il pannello; e' colorata quando ci sono filtri attivi
  assert(await page.$eval('#edgeTab', e => e.classList.contains('on')));
  const tabBox = await page.$eval('#edgeTab', e => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top + r.height / 2)]; });
  console.log('[5b linguetta]', tabBox); assert(tabBox[0] === 0 && Math.abs(tabBox[1] - 422) < 3);
  await page.evaluate(() => window.scrollTo(0, 400)); await wait(100);
  assert.deepStrictEqual(await page.$eval('#edgeTab', e => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top + r.height / 2)]; }), tabBox);
  await page.click('#edgeTab'); await wait(350); assert(await isOpen(), 'linguetta');
  assert(await page.$eval('#edgeTab', e => getComputedStyle(e).visibility === 'hidden'));
  await click('#drawerX'); await wait(350);
  await page.evaluate(() => window.scrollTo(0, 0));
  // 6) Azzera e lista vuota
  await click('#btnFilters'); await wait(300);
  await click('#drawerFlt [data-g="flt"][data-v="loan"]'); await wait(100);
  r = await rows(); console.log('[6 prestito + da leggere]', r); assert.deepStrictEqual(r, []);
  await click('#drawerShow'); await wait(350);
  console.log('[6 vuoto]', await txt('#list')); await click('#list [data-act="clearflt"]'); await wait(100);
  assert.strictEqual((await rows()).length, all.length); assert(await page.$eval('#fltBadge', e => e.hidden));
  // 7) genere; Desideri senza Lettura
  await click('#btnFilters'); await wait(300);
  const gens = await page.$$eval('#drawerFlt [data-g="gen"]', e => e.map(x => x.innerText.replace(/\s+/g, ' ')));
  console.log('[7 generi]', gens.join(' | ')); assert(gens[0].startsWith('Narrativa'));
  await click('#drawerX'); await wait(300);
  await page.evaluate(() => window.__app.setTab('wish')); await click('#btnFilters'); await wait(300);
  const heads = await page.$$eval('#drawerFlt h3', e => e.map(x => x.textContent)); console.log('[7 desideri]', heads); assert(!heads.includes('Lettura'));
  await click('#drawerX'); await wait(300);
  // 9) dal bordo sinistro anche sopra l'intestazione (fuori dall'elenco), senza tornare indietro di pagina
  await page.evaluate(() => window.__app.setTab('lib')); await page.evaluate(() => window.scrollTo(0, 0)); await wait(100);
  await drag(3, 90, 260, 95); assert(await isOpen(), 'dall intestazione'); assert.strictEqual(page.url(), 'http://localhost:' + CFG.port(8141) + '/?vista=elenco');
  await page.screenshot({ path: CFG.OUT + '/s_drawer_left.png' });
  await drag(170, 300, 10, 300);
  assert(!(await isOpen()));
  // 8) col pannello chiuso un gesto sopra una finestra aperta non fa nulla
  await page.evaluate(() => window.__app.setTab('lib'));
  await click('#btnStats'); await wait(200);
  await drag(10, 650, 300, 650); assert(!(await isOpen()), 'non sopra le finestre'); await click('#statsClose'); await wait(100);
  console.log('ERRORI:', errors.length ? errors : 'nessuno'); assert(!errors.length);
  console.log('e2e11 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
