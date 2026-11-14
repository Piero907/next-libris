const CFG = require("./_config");
// fotocamera dentro l'app per foto di citazioni, copertine e libri
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP, IMG = CFG.IMG;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.gz': 'application/gzip' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': (p.endsWith('.wasm.js') ? 'text/javascript' : MIME[path.extname(f)]) || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(8160);
const B = (o) => Object.assign({ t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 1, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: 'da', rt: 0, rd: '' }, o);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + IMG + '/pagina.mjpeg'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => { const u = r.url(); if (u.startsWith('http://localhost')) return r.continue(); r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }); });
  await page.evaluateOnNewDocument((b) => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true); window.__clicked = []; const oc = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function () { window.__clicked.push(this.id); if (this.id !== 'fileSnapGal' && this.id !== 'fileQuote' && this.id !== 'fileCover' && this.id !== 'fileCam') return oc.call(this); };
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ extra: true, lastBackup: Date.now(), installed: true, instScope: '/', swiped: true, name: 'Piero', selTip: 1 })); sessionStorage.seeded = 1; } }, [B({ id: 'rosa', t: 'Il nome della rosa', a: 'Umberto Eco' })]);
  await page.goto('http://localhost:8160/?vista=elenco', { waitUntil: 'load' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(1200);
  const click = sel => page.evaluate(s => document.querySelector(s).click(), sel);
  const book = id => page.evaluate(i => JSON.parse(JSON.stringify(window.__app.state.books.find(x => x.id === i))), id);
  const live = () => page.waitForFunction(() => { const v = document.querySelector('#snapVideo'); return !document.querySelector('#snap').hidden && v.videoWidth > 0; }, { timeout: 10000 });
  // 1) citazione: «Aggiungi una foto» apre la fotocamera dell'app, non il selettore del telefono
  await click('.row[data-id="rosa"] [data-act="toggle"]'); await wait(250);
  await page.evaluate(() => document.querySelector('details.quotes[data-id="rosa"] > summary').click()); await wait(100);
  await click('details.quotes[data-id="rosa"] [data-act="quoteadd"]'); await wait(150);
  await click('#quotePhoto'); await live();
  assert(!(await page.evaluate(() => window.__clicked.includes('fileQuote'))), 'niente selettore del telefono');
  assert.strictEqual(await page.$eval('#snapH', e => e.textContent), 'Foto della pagina');
  await page.screenshot({ path: CFG.OUT + '/snap.png' });
  await click('#snapShoot');
  await page.waitForFunction(() => !document.querySelector('#ped').hidden, { timeout: 10000 }); await click('#pedSkip');   // v65: editor dopo lo scatto
  await page.waitForFunction(() => document.querySelector('#snap').hidden && !document.querySelector('#quotePh').hidden, { timeout: 10000 });
  await wait(800); assert.strictEqual(await page.$eval('#quoteText', e => e.value), '', 'non legge da solo');
  await click('#quoteOcr'); await wait(50);
  const busy = await page.$eval('#quoteOcr', e => ({ cls: e.classList.contains('busy'), t: e.textContent, spin: !!e.querySelector('.spin') })); console.log('[1 durante]', JSON.stringify(busy));
  assert(busy.cls && busy.spin && busy.t === 'Leggo il testo…');
  await page.screenshot({ path: CFG.OUT + '/ocr_busy.png' });
  await page.waitForFunction(() => document.querySelector('#quoteText').value.length > 10 || /Non ho trovato|non riuscita/.test(document.querySelector('#quoteMsg').textContent), { timeout: 90000 });
  await page.waitForFunction(() => !document.querySelector('#quoteOcr').classList.contains('busy'), { timeout: 5000 });
  assert.strictEqual(await page.$eval('#quoteOcr', e => e.textContent), 'Leggi il testo dalla foto');
  console.log('[1 testo letto]', JSON.stringify(await page.$eval('#quoteText', e => e.value)));
  await click('#quoteSave'); await wait(300); assert(/^q:/.test((await book('rosa')).qs[0].phs[0]));
  // opzione: lettura automatica
  await page.evaluate(() => { const c = document.querySelector('#optQuoteOcr'); c.checked = true; c.dispatchEvent(new Event('change')); });
  assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')).quoteOcrAuto), true);
  await click('details.quotes[data-id="rosa"] [data-act="quoteadd"]'); await wait(150);
  await click('#quotePhoto'); await live(); await click('#snapShoot');
  await page.waitForFunction(() => !document.querySelector('#ped').hidden, { timeout: 10000 }); await click('#pedSkip');
  await page.waitForFunction(() => document.querySelector('#quoteText').value.length > 10, { timeout: 90000 }); console.log('[1b automatica] ok');
  await page.waitForFunction(() => !document.querySelector('#quoteOcr').classList.contains('busy'), { timeout: 10000 });
  await click('#quoteCancel');
  await page.evaluate(() => { const c = document.querySelector('#optQuoteOcr'); c.checked = false; c.dispatchEvent(new Event('change')); });
  // 2) Indietro chiude la fotocamera senza foto
  await click('details.quotes[data-id="rosa"] [data-act="quoteadd"]'); await wait(150);
  await click('#quotePhoto'); await live();
  await page.evaluate(() => history.back()); await wait(400);
  assert(await page.$eval('#snap', e => e.hidden)); assert(!(await page.$eval('#quoteSheet', e => e.hidden)), 'la finestra della citazione resta');
  assert(await page.$eval('#quotePh', e => e.hidden));
  assert.strictEqual(await page.evaluate(() => { const v = document.querySelector('#snapVideo'); return v.srcObject; }), null, 'fotocamera spenta');
  await click('#quoteCancel');
  // 3) Galleria: sceglie una foto
  await click('details.quotes[data-id="rosa"] [data-act="quoteadd"]'); await wait(150);
  await click('#quotePhoto'); await live();
  await click('#snapGal'); assert(await page.evaluate(() => window.__clicked.includes('fileSnapGal')));
  const g = await page.$('#fileSnapGal'); await g.uploadFile(IMG + '/blank.jpg'); await page.evaluate(() => document.querySelector('#fileSnapGal').dispatchEvent(new Event('change')));
  await page.waitForFunction(() => !document.querySelector('#ped').hidden, { timeout: 10000 }); await click('#pedSkip');
  await page.waitForFunction(() => document.querySelector('#snap').hidden && !document.querySelector('#quotePh').hidden, { timeout: 10000 });
  await click('#quoteCancel');
  // 4) copertina: la foto diventa la copertina
  await page.evaluate(() => { document.querySelector('.row[data-id="rosa"] [data-act="coverphoto"]') ? document.querySelector('.row[data-id="rosa"] [data-act="coverphoto"]').click() : null; });
  await wait(300);
  if (await page.$eval('#snap', e => e.hidden)) { await page.evaluate(() => { if (!document.querySelector('#covSheet').hidden) document.querySelector('#covShot').click(); }); }
  await live(); assert.strictEqual(await page.$eval('#snapH', e => e.textContent), 'Foto della copertina');
  await click('#snapShoot'); await page.waitForFunction(() => document.querySelector('#snap').hidden, { timeout: 10000 }); await wait(600);
  assert(await page.evaluate(() => !!document.querySelector('.row[data-id="rosa"] img')), 'copertina salvata');
  // 5) Foto > Scatta: aggiunge un libro dalla foto
  const n0 = (await page.evaluate(() => window.__app.state.books.length));
  await click('#btnPhoto'); await wait(150); await click('#photoCam'); await live();
  assert.strictEqual(await page.$eval('#snapH', e => e.textContent), 'Foto del libro');
  await click('#snapShoot'); await page.waitForFunction(n => window.__app.state.books.length === n + 1, { timeout: 10000 }, n0);
  console.log('[5] libro dalla foto aggiunto');
  assert.deepStrictEqual(errors, []);
  console.log('e2e42 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
