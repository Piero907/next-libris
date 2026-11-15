const CFG = require("./_config");
// citazioni con foto; Indietro chiude la scheda aperta; due volte Indietro per uscire
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.gz': 'application/gzip', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': (p.endsWith('.wasm.js') ? 'text/javascript' : MIME[path.extname(f)]) || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8154));
const B = (o) => Object.assign({ t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: Date.now(), sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: 'da', rt: 0, rd: '' }, o);
const books = [B({ id: 'rosa', t: 'Il nome della rosa', a: 'Umberto Eco' }), B({ id: 'calv', t: 'Le città invisibili', a: 'Italo Calvino' }), B({ id: 'ging', t: 'Lessico famigliare', a: 'Natalia Ginzburg' })];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const pg = await browser.newPage(); await pg.setViewport({ width: 1100, height: 520 });
  await pg.setContent('<body style="margin:0;background:#fff"><div style="font:34px/1.6 Georgia,serif;padding:50px;width:1000px;color:#111">Era una bella mattina di fine novembre. Nella notte aveva nevicato un poco.</div></body>');
  await pg.screenshot({ path: CFG.OUT + '/pagina2.png' });
  await pg.setContent('<body style="margin:0;background:linear-gradient(45deg,#c96,#69c)"><div style="width:900px;height:600px"></div></body>');
  await pg.screenshot({ path: CFG.OUT + '/foto_vuota.png' }); await pg.close();
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => { if (!/sessionStorage/.test(e.message)) errors.push(e.message); });
  await page.evaluateOnNewDocument((b) => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ extra: true, lastBackup: Date.now(), price: false, installed: true, instScope: '/', swiped: true, name: 'Piero' })); sessionStorage.seeded = 1; } }, books);
  await page.goto('http://localhost:' + CFG.port(8154) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(1200);
  const click = sel => page.evaluate(s => document.querySelector(s).click(), sel);
  const book = id => page.evaluate(i => JSON.parse(JSON.stringify(window.__app.state.books.find(x => x.id === i))), id);
  const openIds = () => page.$$eval('#list .row.open', e => e.map(r => r.dataset.id));
  const back = async () => { await page.evaluate(() => history.back()); await wait(350); };
  const toastTxt = () => page.$eval('#toast', e => e.hidden ? '' : document.querySelector('#toastTxt').textContent);
  const pick = async file => { const inp = await page.$('#fileQuote'); await inp.uploadFile(file); await page.evaluate(() => document.querySelector('#fileQuote').dispatchEvent(new Event('change', { bubbles: true }))); };

  // 1) scheda come pagina: una alla volta, Indietro la chiude
  await click('.row[data-id="rosa"] [data-act="toggle"]'); await wait(250);
  await click('.row[data-id="calv"] [data-act="toggle"]'); await wait(250);
  assert.deepStrictEqual(await openIds(), ['calv'], 'una scheda alla volta');
  await back(); assert.deepStrictEqual(await openIds(), [], 'Indietro chiude la scheda'); assert.strictEqual(await toastTxt(), '');
  // freccetta: chiude e non lascia passi di Indietro a vuoto
  await click('.row[data-id="rosa"] [data-act="toggle"]'); await wait(250);
  await click('.row[data-id="rosa"] .chev-btn'); await wait(350);
  assert.deepStrictEqual(await openIds(), []);
  console.log('[1 schede] ok');
  // 2) Indietro con un foglio aperto (Statistiche) lo chiude
  await click('#btnStats'); await wait(200); await back();
  assert(await page.$eval('#statsSheet', e => e.hidden), 'Indietro chiude le Statistiche'); assert.strictEqual(await toastTxt(), '');
  // il menu laterale come prima
  await click('#btnFilters'); await wait(300); await back(); assert(await page.$eval('#drawer', e => e.hidden));
  // 3) uscita: primo Indietro avvisa, la pagina resta
  await back();
  const t = await toastTxt(); console.log('[3 uscita]', t); assert.strictEqual(t, 'Premi di nuovo Indietro per uscire');
  assert(await page.evaluate(() => history.state && history.state.root));
  await wait(2700);
  assert(await page.$eval('#toast', e => e.hidden), 'il messaggio sparisce');
  assert(await page.evaluate(() => history.state && history.state.guard), 'dopo l\'attesa torna la protezione');
  await back(); assert.strictEqual(await toastTxt(), 'Premi di nuovo Indietro per uscire');
  // secondo Indietro entro poco: si esce davvero (qui: la pagina precedente, about:blank)
  await page.evaluate(() => history.back()).catch(() => {}); await wait(800);
  console.log('[3 seconda volta]', page.url()); assert(!page.url().startsWith('http://localhost:' + CFG.port(8154) + ''));
  await page.goForward({ waitUntil: 'load' }).catch(() => {}); if (!page.url().startsWith('http://localhost')) await page.goto('http://localhost:' + CFG.port(8154) + '/?vista=elenco', { waitUntil: 'load' });
  await wait(1200);
  // 4) citazione con foto e testo letto
  await click('.row[data-id="rosa"] [data-act="toggle"]'); await wait(250);
  await page.evaluate(() => document.querySelector('details.quotes[data-id="rosa"] > summary').click()); await wait(150);
  await click('details.quotes[data-id="rosa"] [data-act="quoteadd"]'); await wait(150);
  await pick(CFG.OUT + '/pagina2.png');
  await page.waitForFunction(() => !document.querySelector('#quotePh').hidden, { timeout: 10000 }); await wait(1500);
  assert.strictEqual(await page.$eval('#quoteText', e => e.value), '', 'v64: niente lettura automatica');
  console.log('[4 dopo la foto]', await page.$eval('#quoteMsg', e => e.textContent));
  // seconda foto nella stessa citazione
  await pick(CFG.OUT + '/pagina2.png');
  await page.waitForFunction(() => document.querySelectorAll('#quoteThumbs li').length === 2, { timeout: 10000 });
  assert.strictEqual(await page.$eval('#quotePhoto', e => e.textContent), "Aggiungi un'altra foto");
  await page.screenshot({ path: CFG.OUT + '/q2_sheet.png' });
  await click('#quoteOcr');
  await page.waitForFunction(() => /Leggo la foto 1 di 2/.test(document.querySelector('#quoteOcr').textContent), { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('#quoteOcr').classList.contains('busy'), { timeout: 120000 });
  console.log('[4 testo]', JSON.stringify(await page.$eval('#quoteText', e => e.value)));
  assert(/bella mattina[\s\S]*bella mattina/.test(await page.$eval('#quoteText', e => e.value)), 'letto da tutte e due');
  // tolgo la seconda foto con la X
  await click('#quoteThumbs [data-del="1"]'); await wait(100); assert.strictEqual(await page.$$eval('#quoteThumbs li', e => e.length), 1);
  await page.evaluate(() => { document.querySelector('#quoteText').value = 'Era una bella mattina di fine novembre.'; });
  await pick(CFG.OUT + '/foto_vuota.png'); await page.waitForFunction(() => document.querySelectorAll('#quoteThumbs li').length === 2, { timeout: 10000 });
  assert(!(await page.$eval('#quotePh', e => e.hidden)), 'anteprima della foto'); console.log('[4]', await page.$eval('#quoteMsg', e => e.textContent));
  await page.screenshot({ path: CFG.OUT + '/qp_sheet.png' });
  await click('#quoteSave'); await wait(400);
  let b = await book('rosa'); assert.strictEqual(b.qs.length, 1); assert(b.qs[0].phs.length === 2 && /^q:/.test(b.qs[0].phs[0]) && /bella mattina/.test(b.qs[0].x));
  assert(await page.$('details.quotes[data-id="rosa"] .qitem.has-ph img.qimg'));
  assert.strictEqual(await page.$eval('details.quotes[data-id="rosa"] .qimg-n', e => e.textContent), '2');
  await page.evaluate(() => document.querySelector('details.quotes[data-id="rosa"]').scrollIntoView({ block: 'center' })); await wait(150); await page.screenshot({ path: CFG.OUT + '/q2_card.png' });
  // 5) solo foto, senza testo leggibile
  await click('details.quotes[data-id="rosa"] [data-act="quoteadd"]'); await wait(150);
  await pick(CFG.OUT + '/foto_vuota.png');
  await page.waitForFunction(() => !document.querySelector('#quotePh').hidden, { timeout: 10000 });
  await click('#quoteOcr');
  await page.waitForFunction(() => /Non ho trovato|non riuscita|Ho letto/.test(document.querySelector('#quoteMsg').textContent), { timeout: 60000 });
  console.log('[5]', await page.$eval('#quoteMsg', e => e.textContent), '|', JSON.stringify(await page.$eval('#quoteText', e => e.value)));
  await page.evaluate(() => { document.querySelector('#quoteText').value = ''; document.querySelector('#quotePage').value = '12'; });
  await click('#quoteSave'); await wait(400);
  b = await book('rosa'); assert.strictEqual(b.qs.length, 2); assert(b.qs[1].phs.length === 1 && b.qs[1].x === '' && b.qs[1].pg === '12');
  assert((await page.$eval('details.quotes[data-id="rosa"]', e => e.textContent)).includes('Foto della pagina'));
  await page.evaluate(() => document.querySelector('details.quotes[data-id="rosa"]').scrollIntoView({ block: 'center' })); await wait(200);
  await page.screenshot({ path: CFG.OUT + '/qp_card.png' });
  // 6) senza testo né foto non salva
  await click('details.quotes[data-id="rosa"] [data-act="quoteadd"]'); await wait(150); await click('#quoteSave'); await wait(150);
  assert((await page.$eval('#quoteMsg', e => e.textContent)).includes('aggiungi una foto')); await click('#quoteCancel');
  // 7) togli la foto da una citazione esistente
  await click('details.quotes[data-id="rosa"] [data-act="quoteedit"][data-i="0"]'); await wait(200);
  assert.strictEqual(await page.$$eval('#quoteThumbs li', e => e.length), 2);
  await click('#quoteThumbs [data-del="1"]'); await click('#quoteThumbs [data-del="0"]'); await click('#quoteSave'); await wait(300);
  b = await book('rosa'); assert.deepStrictEqual(b.qs[0].phs, []); assert(b.qs[0].x);
  // 8) dopo il riavvio la foto c'è ancora; tutte le citazioni: miniatura e ingrandimento; Indietro chiude l'ingrandimento
  await wait(600); await page.reload({ waitUntil: 'load' }); await wait(1500);
  await page.evaluate(() => window.__app.openDrawer('opt')); await wait(300); await click('#goQuotes'); await wait(400);
  assert(await page.$('#allqList .qimg-btn img.qimg'), 'miniatura nell\'elenco');
  await page.screenshot({ path: CFG.OUT + '/qp_all.png' });
  await click('#allqList .qimg-btn'); await wait(300); assert(!(await page.$eval('#phView', e => e.hidden)));
  await page.screenshot({ path: CFG.OUT + '/qp_view.png' });
  await back(); assert(await page.$eval('#phView', e => e.hidden), 'Indietro chiude la foto'); assert(!(await page.$eval('#allqSheet', e => e.hidden)), 'l\'elenco resta');
  await back(); assert(await page.$eval('#allqSheet', e => e.hidden), 'poi chiude l\'elenco');
  // 9) backup con la foto, ripristino su telefono vuoto
  const data = await page.evaluate(() => window.__app && window.__app.buildBackup ? window.__app.buildBackup() : null);
  assert(data); const d = JSON.parse(data); const k = Object.keys(d.covers || {}); console.log('[9 backup] foto:', k); assert(k.some(x => /^q:/.test(x)));
  // ripristino su un telefono vuoto: la foto della citazione torna
  await page.evaluate(() => new Promise(r => { const q = indexedDB.deleteDatabase('catalogo-libri'); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
  await page.evaluate(() => { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: [], updated: 1 })); });
  await page.reload({ waitUntil: 'load' }); await wait(1200);
  fs.writeFileSync(CFG.OUT + '/bk37.json', data);
  const fi = await page.$('#fileBackup'); await fi.uploadFile(CFG.OUT + '/bk37.json'); await page.evaluate(() => document.querySelector('#fileBackup').dispatchEvent(new Event('change', { bubbles: true })));
  await wait(1500); console.log('[9 ripristino]', await page.$eval('#toastTxt', e => e.textContent));
  await page.reload({ waitUntil: 'load' }); await wait(1500);
  const qb = await book('rosa'); assert.strictEqual(qb.qs.length, 2);
  assert(await page.evaluate(k => new Promise(r => { const o = indexedDB.open('catalogo-libri', 1); o.onsuccess = () => { const g = o.result.transaction('covers').objectStore('covers').get(k); g.onsuccess = () => r(!!g.result); g.onerror = () => r(false); }; }), qb.qs[1].phs[0]), 'foto ripristinata');
  assert.deepStrictEqual(errors, []);
  console.log('e2e37 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
