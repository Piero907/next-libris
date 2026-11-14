const CFG = require("./_config");
// donazioni: riga in fondo (X = 10 giorni), promemoria ogni 50 libri, finestra «Sostieni» con PayPal, ritorno con soglia di 20 secondi
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; if (p === '/vuota') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<!doctype html><title>vuota</title>'); } const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res); }).listen(8171);
const books = n => Array.from({ length: n }, (_, i) => ({ id: 'b' + i, t: 'Libro ' + i, a: 'Autore', ts: 1000 + i }));
const DAY = 864e5;
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const base = { lastBackup: Date.now(), installed: true, instScope: '/', swiped: true, name: 'Piero', selTip: 1, donOpens: 10 };
  async function load(nBooks, set) {
    await page.goto('http://localhost:8171/?vista=elenco', { waitUntil: 'load' });
    await page.evaluate((b, s) => { localStorage.clear(); localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: Date.now() })); localStorage.setItem('catalogo-libri-set', JSON.stringify(s)); const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/^catalogo-libri-(v2|set)$/.test(k)) return; return o.call(this, k, v); }; }, books(nBooks), Object.assign({}, base, set || {}));
    await page.reload({ waitUntil: 'load' }); await wait(900);   // all'uscita la pagina vecchia non puo' piu' salvare sopra i dati preparati
  }
  const vis = () => page.evaluate(() => ({ row: !document.querySelector('#donRow').hidden, ask: !document.querySelector('#donAsk').hidden, askT: document.querySelector('#donAskT').textContent, sheet: !document.querySelector('#donSheet').hidden, set: (({ donUntil, donNever, donMs, donGo }) => ({ donUntil, donNever, donMs, donGo }))(JSON.parse(localStorage.getItem('catalogo-libri-set'))) }));
  const click = sel => page.evaluate(s => document.querySelector(s).click(), sel);
  const toastTxt = () => page.evaluate(() => { const t = document.querySelector('.toast'); return t && !t.hidden ? t.textContent : ''; });

  // 0 libri: niente
  await load(0); let v = await vis(); console.log('[0 libri]', JSON.stringify(v)); assert(!v.row && !v.ask);
  // 3 libri: la riga in fondo, nessun promemoria
  await load(3); console.log(await page.evaluate(() => ({ n: window.__app.state.books.length, h: document.querySelector('#donRow').hidden, u: window.__app.settings.donUntil }))); v = await vis(); console.log('[3 libri]', JSON.stringify(v)); assert(v.row && !v.ask && v.set.donMs === 0);
  const above = await page.evaluate(() => document.querySelector('#donRow').getBoundingClientRect().bottom <= document.querySelector('#list').getBoundingClientRect().top + 1);
  assert(above, 'la riga sta in cima all\'elenco');
  await page.evaluate(() => document.querySelector('#donRow').scrollIntoView({ block: 'center' })); await wait(200);
  await page.screenshot({ path: CFG.OUT + '/don_row.png' });
  // primo avvio e primi 5 accessi: niente riga; dal sesto si'
  await load(3, { donOpens: 0 }); v = await vis(); let op = await page.evaluate(() => window.__app.settings.donOpens); console.log('[accesso 1]', op, v.row); assert(op === 1 && !v.row);
  await load(3, { donOpens: 4 }); v = await vis(); assert(!v.row);
  await load(3, { donOpens: 5 }); v = await vis(); op = await page.evaluate(() => window.__app.settings.donOpens); console.log('[accesso 6]', op, v.row); assert(op === 6 && v.row);
  // l'app rimasta in memoria: tornarci dopo 30 minuti conta come accesso
  await load(3, { donOpens: 4 }); v = await vis(); assert(!v.row);
  const vis2 = async (st) => page.evaluate((st) => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => st }); document.dispatchEvent(new Event('visibilitychange')); }, st);
  await vis2('hidden'); await page.evaluate(() => window.__app.donAway(5 * 60000)); await vis2('visible'); await wait(100);
  op = await page.evaluate(() => window.__app.settings.donOpens); assert.strictEqual(op, 5, 'una pausa breve non conta');
  await vis2('hidden'); await page.evaluate(() => window.__app.donAway(31 * 60000)); await vis2('visible'); await wait(100);
  op = await page.evaluate(() => window.__app.settings.donOpens); v = await vis(); console.log('[ritorno dopo 31 min]', op, v.row); assert(op === 6 && v.row);
  await load(3);
  // la X: 10 giorni
  await click('#donRowX'); await wait(200); v = await vis(); console.log('[X]', JSON.stringify(v));
  assert(!v.row && Math.abs(v.set.donUntil - Date.now() - 10 * DAY) < 60000);
  // 50 libri: promemoria in cima, riga nascosta
  await load(50, { donMs: 0 }); v = await vis(); console.log('[50 libri]', JSON.stringify(v)); assert(v.ask && !v.row && v.askT === '50 libri catalogati');
  await page.screenshot({ path: CFG.OUT + '/don_ask.png' });
  await click('#donAskLater'); await wait(200); v = await vis(); assert(!v.ask && !v.row && v.set.donUntil > Date.now() + 9 * DAY);
  // 99 libri dopo il promemoria dei 50 non piu' visto (pausa finita): ancora quello dei 50; a 100 «100 libri»
  await load(100, { donMs: 50 }); v = await vis(); assert(v.ask && v.askT === '100 libri catalogati');
  // utente che aveva gia' 230 libri: niente subito, traguardo memorizzato a 200
  await load(230); v = await vis(); console.log('[230 libri, aggiornamento]', JSON.stringify(v)); assert(!v.ask && v.row && v.set.donMs === 200);
  await load(250, { donMs: 200 }); v = await vis(); assert(v.ask && v.askT === '250 libri catalogati');
  // «Non chiedere più»
  await click('#donAskNever'); await wait(200); v = await vis(); console.log('[non chiedere]', JSON.stringify(v)); assert(!v.ask && v.row && v.set.donNever === true);
  await load(300, { donMs: 250, donNever: true }); v = await vis(); assert(!v.ask && v.row);
  // Desideri: niente richieste
  await page.evaluate(() => window.__app.setTab('wish')); await wait(200); v = await vis(); assert(!v.row && !v.ask);
  await page.evaluate(() => window.__app.setTab('lib')); await wait(200);

  // finestra «Sostieni»: importi e link PayPal
  await load(3);
  await click('#donRowOpen'); await wait(300); v = await vis(); assert(v.sheet);
  let info = await page.evaluate(() => ({ go: document.querySelector('#donGo').textContent, sel: document.querySelector('.don-amt[aria-checked="true"]').textContent, top: (() => { const r = document.querySelector('#donSheet .sheet-in').getBoundingClientRect(); return !!document.elementFromPoint(r.left + r.width / 2, r.top + 20).closest('#donSheet'); })() }));
  console.log('[finestra]', JSON.stringify(info)); assert(info.go === 'Dona 3 € con PayPal' && info.sel === '3 €' && info.top);
  await page.screenshot({ path: CFG.OUT + '/don_sheet.png' });
  await page.evaluate(() => document.querySelector('.don-amt[data-amt="5"]').click()); assert.strictEqual(await page.$eval('#donGo', e => e.textContent), 'Dona 5 € con PayPal');
  await page.evaluate(() => document.querySelector('.don-amt[data-amt=""]').click()); assert.strictEqual(await page.$eval('#donGo', e => e.textContent), 'Dona con PayPal');
  // Indietro chiude la finestra
  await page.evaluate(() => history.back()); await wait(300); v = await vis(); assert(!v.sheet);
  // apre PayPal con l'importo scelto
  await click('#donRowOpen'); await wait(200); await page.evaluate(() => document.querySelector('.don-amt[data-amt="2"]').click());
  const tgt = new Promise(r => browser.once('targetcreated', t => r(t)));
  await click('#donGo'); const t = await tgt; await wait(300);
  const url = t.url(); console.log('[paypal]', url); assert.strictEqual(url, 'https://www.paypal.me/PieroRagusa907/2EUR');
  try { const pp = await t.page(); if (pp) await pp.close(); } catch (e) {}
  v = await vis(); console.log('[dopo PayPal]', JSON.stringify(v.set), await toastTxt());
  assert(!v.sheet && (v.set.donGo > 0 || v.set.donUntil > Date.now() + 9 * DAY));   // se il browser ha gia' segnalato il ritorno, vale come ritorno veloce
  // ritorno dopo poco: 10 giorni
  const back = (ago) => page.evaluate((ago) => {
    const s = window.__app.settings; s.donGo = Date.now() - ago;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange'));
  }, ago);
  await page.evaluate(() => { window.__app.settings.donUntil = 0; });
  await back(5000); await wait(300); v = await vis(); const tt = await toastTxt(); console.log('[ritorno 5 s]', JSON.stringify(v.set), tt);
  assert(/Grazie se hai donato/.test(tt) && v.set.donGo === 0 && Math.abs(v.set.donUntil - Date.now() - 10 * DAY) < 60000 && !v.row);
  // ritorno dopo 25 s: 3 mesi
  await page.evaluate(() => { window.__app.settings.donUntil = 0; });
  await back(25000); await wait(300); v = await vis(); console.log('[ritorno 25 s]', JSON.stringify(v.set));
  assert(Math.abs(v.set.donUntil - Date.now() - 90 * DAY) < 60000 && !v.row);
  // il telefono aveva chiuso l'app mentre si era su PayPal: alla riapertura vale come ritorno
  await load(60, { donMs: 0, donGo: Date.now() - 40000 }); await wait(1000); v = await vis(); console.log('[riaperta]', JSON.stringify(v));
  assert(!v.ask && !v.row && v.set.donGo === 0 && v.set.donUntil > Date.now() + 80 * DAY && v.set.donMs === 50);

  // dal menu: voce «Sostieni Next Libris»; Indietro chiude solo la finestra
  await load(3);
  await page.evaluate(() => window.__app.openDrawer('opt')); await wait(400);
  await click('#donMenu'); await wait(400);
  let st = await page.evaluate(() => ({ sheet: !document.querySelector('#donSheet').hidden, drawer: !document.querySelector('#drawer').hidden && document.body.classList.contains('drawer-open') }));
  console.log('[dal menu]', JSON.stringify(st)); assert(st.sheet);
  await page.evaluate(() => history.back()); await wait(400);
  assert(await page.evaluate(() => document.querySelector('#donSheet').hidden));
  // da Opzioni › App
  await page.evaluate(() => window.__app.openOptions('app')); await wait(300);
  await click('#donOpt'); await wait(300);
  await page.evaluate(() => history.back()); await wait(400);
  st = await page.evaluate(() => ({ sheet: !document.querySelector('#donSheet').hidden, opt: !document.querySelector('#optSheet').hidden }));
  console.log('[da Opzioni]', JSON.stringify(st)); assert(!st.sheet && st.opt);
  // registro aperto dal menu: Indietro lascia il menu aperto
  await page.evaluate(() => window.__app.closeOptions()); await wait(300);
  await page.evaluate(() => window.__app.openDrawer('opt')); await wait(400);
  await click('#verLog'); await page.waitForFunction(() => document.querySelectorAll('#logBody .log-v').length > 5);
  await page.evaluate(() => history.back()); await wait(400);
  st = await page.evaluate(() => ({ log: !document.querySelector('#logSheet').hidden, drawer: !document.querySelector('#drawer').hidden }));
  console.log('[registro dal menu]', JSON.stringify(st)); assert(!st.log && st.drawer);
  assert.deepStrictEqual(errors, []);
  console.log('e2e52 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
