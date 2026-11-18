const CFG = require("./_config");
const H = require('./_harness');
// backup: nome «Libreria di Piero - Next Libris - data ora» (2026-11-15 22.58); se l'invio non parte compare «Il backup non è partito» con Riprova e Download.
// fotocamera della scansione: torcia (resta accesa) e flash (solo per la foto della copertina, un attimo allo scatto)
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8179), ROOT);
const books = Array.from({ length: 3 }, (_, i) => ({ id: 'k' + i, t: 'Libro ' + i, a: 'Autore', ts: 10 + i }));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + CFG.IMG + '/blank.mjpeg'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const wait = H.wait;   // attesa «finché» (_harness.js)
  await page.setRequestInterception(true);
  page.on('request', r => r.url().startsWith('http://localhost:' + CFG.port(8179) + '') ? r.continue() : r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"totalItems":0}' }));
  await page.evaluateOnNewDocument(() => {
    // condivisione finta: canShare accetta solo .txt (come Chrome su Android); share segue window.__shareMode
    window.__shared = []; window.__shareMode = 'fail'; window.__dl = [];
    navigator.canShare = d => !!(d && d.files && d.files.every(f => /\.txt$/.test(f.name)));
    navigator.share = d => { window.__shared.push(d.files.map(f => f.name)); const m = window.__shareMode; return m === 'ok' ? Promise.resolve() : Promise.reject(new DOMException('x', m === 'abort' ? 'AbortError' : 'NotAllowedError')); };
    const ck = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__dl.push(this.download); return; } return ck.call(this); };
    // luce finta: la fotocamera finta non ha la torcia
    const gc = MediaStreamTrack.prototype.getCapabilities; window.__torch = [];
    MediaStreamTrack.prototype.getCapabilities = function () { return Object.assign({}, gc ? gc.call(this) : {}, { torch: true }); };
    const ac = MediaStreamTrack.prototype.applyConstraints;
    MediaStreamTrack.prototype.applyConstraints = function (c) { const a = c && c.advanced && c.advanced[0]; if (a && 'torch' in a) { window.__torch.push(a.torch); return Promise.resolve(); } return ac.call(this, c); };
  });
  await page.goto('http://localhost:' + CFG.port(8179) + '/?vista=elenco', { waitUntil: 'load' });
  await page.evaluate(b => { const o = Storage.prototype.setItem; localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: Date.now() })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'Piero', selTip: 1, lastBackup: 1, price: false })); Storage.prototype.setItem = function (k, v) { if (/^catalogo-libri-(v2|set)$/.test(k)) return; return o.call(this, k, v); }; }, books);
  await page.reload({ waitUntil: 'load' }); await wait(600);
  const today = await page.evaluate(() => { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); });
  const vis = sel => page.$eval(sel, e => !e.hidden);
  await page.evaluate(() => document.querySelector('#btnExport').click()); await wait(300);
  // 1) l'invio non parte: finestra con Riprova
  await page.click('#btnShareBackup'); await wait(300);
  let sh = await page.evaluate(() => window.__shared); console.log('[1 nome]', JSON.stringify(sh));
  assert.strictEqual(sh[0].length, 1); assert(new RegExp('^Libreria di Piero - Next Libris - ' + today + ' \\d\\d\\.\\d\\d\\.txt$').test(sh[0][0]), 'nome con data e ora: ' + sh[0][0]);
  assert(await vis('#bkFailSheet') && await vis('#bkFailRetry'), 'finestra con Riprova');
  assert(await page.evaluate(() => { const r = document.querySelector('#bkFailSheet .sheet-in').getBoundingClientRect(); return !!document.elementFromPoint(r.left + r.width / 2, r.top + 30).closest('#bkFailSheet'); }), 'in primo piano, sopra Esporta');
  assert(/NotAllowedError/.test(await page.$eval('#bkFailMsg', e => e.textContent)));
  assert.deepStrictEqual(await page.evaluate(() => window.__dl), [], 'niente download in silenzio');
  await page.screenshot({ path: CFG.OUT + '/bk_fail.png' });
  // 2) Riprova: parte
  await page.evaluate(() => { window.__shareMode = 'ok'; }); await page.click('#bkFailRetry'); await wait(300);
  assert(!(await vis('#bkFailSheet')));
  assert(await page.evaluate(() => window.__app.settings.lastBackup > 1000), 'backup segnato come fatto');
  // 3) annullato: solo un messaggio
  await page.evaluate(() => { window.__shareMode = 'abort'; }); await page.click('#btnShareBackup'); await wait(300);
  assert(!(await vis('#bkFailSheet')));
  // 4) telefono senza condivisione: la finestra propone i Download, con il nome giusto
  await page.evaluate(() => { navigator.canShare = () => false; }); await page.click('#btnShareBackup'); await wait(300);
  assert(await vis('#bkFailSheet') && !(await vis('#bkFailRetry')));
  await page.click('#bkFailDl'); await wait(300);
  const dl = await page.evaluate(() => window.__dl); console.log('[4 download]', JSON.stringify(dl));
  assert.strictEqual(dl.length, 1); assert(new RegExp('^Libreria di Piero - Next Libris - ' + today + ' \\d\\d\\.\\d\\d\\.json$').test(dl[0]), 'nome con data e ora: ' + dl[0]);
  // 4b) con le foto (18/11/2026): oltre ~45 MB niente condivisione, «Invia senza le foto»; un NotAllowedError con le foto propone lo stesso
  await page.evaluate(() => { navigator.canShare = f => /\.txt$/.test(f.files[0].name); window.__shareMode = 'ok'; window.__shared = []; window.coverIds = () => ['k1']; backupReady = '{"app":"catalogo-libri"' + ' '.repeat(46 * 1048576) + '}'; bkWarm = window.__app.state.updated; });
  await page.evaluate(() => { document.getElementById('bkFailSheet').hidden = true; }); await page.click('#btnShareBackup'); await wait(300);
  let big = await page.evaluate(() => ({ sh: window.__shared.length, msg: document.getElementById('bkFailMsg').textContent, lite: !document.getElementById('bkFailLite').hidden, retry: !document.getElementById('bkFailRetry').hidden }));
  console.log('[4b grande]', JSON.stringify(big).slice(0, 220));
  assert(big.sh === 0 && /troppo grande/.test(big.msg) && big.lite && !big.retry, 'troppo grande: niente condivisione, Invia senza le foto');
  await page.click('#bkFailLite'); await wait(300);
  sh = await page.evaluate(() => window.__shared); console.log('[4b senza foto]', JSON.stringify(sh));
  assert(sh.length === 1 && / \(senza foto\)\.txt$/.test(sh[0][0]) && !(await vis('#bkFailSheet')), 'mandato senza le foto');
  await page.evaluate(() => { backupReady = '{"app":"catalogo-libri"' + ' '.repeat(9 * 1048576) + '}'; window.__shareMode = 'no'; });
  await page.click('#btnShareBackup'); await wait(300);
  big = await page.evaluate(() => ({ msg: document.getElementById('bkFailMsg').textContent, lite: !document.getElementById('bkFailLite').hidden }));
  assert(/prova senza le foto/.test(big.msg) && big.lite, 'NotAllowedError con un backup grande: proposta senza foto');
  await page.evaluate(() => { document.getElementById('bkFailSheet').hidden = true; });
  await page.click('#exportClose'); await wait(300);
  // 5) fotocamera: torcia e flash
  await page.evaluate(() => window.__app.startScan()); await page.waitForFunction(() => !document.querySelector('#scan').hidden, { timeout: 8000 }); await wait(900);
  let st = await page.evaluate(() => ({ torch: !document.querySelector('#scanTorch').hidden, flash: !document.querySelector('#scanFlash').hidden }));
  console.log('[5 codice a barre]', JSON.stringify(st)); assert(st.torch && !st.flash, 'col codice a barre solo la torcia');
  await page.click('#scanTorch'); await wait(200);
  assert.strictEqual(await page.$eval('#scanTorch', e => e.getAttribute('aria-pressed')), 'true');
  await page.click('#scanTorch'); await wait(200);
  assert.deepStrictEqual(await page.evaluate(() => window.__torch), [true, false]);
  await page.evaluate(() => document.querySelector('#scanKinds [data-k="cover"]').click()); await wait(300);
  assert(await vis('#scanFlash'), 'con la copertina compare il flash');
  await page.click('#scanFlash'); await wait(200);
  assert.strictEqual(await page.$eval('#scanFlash', e => e.getAttribute('aria-pressed')), 'true');
  await page.screenshot({ path: CFG.OUT + '/scan_flash.png' });
  const n0 = await page.evaluate(() => window.__app.state.books.length);
  await page.evaluate(() => document.querySelector('#scanShoot').click()); await wait(1500);
  const tc = await page.evaluate(() => window.__torch); console.log('[5 scatto con flash]', JSON.stringify(tc));
  assert.deepStrictEqual(tc.slice(2), [true, false], 'luce accesa per lo scatto e poi spenta');
  assert.strictEqual(await page.evaluate(() => window.__app.state.books.length), n0 + 1, 'copertina scattata');
  await page.evaluate(() => document.querySelector('#scanClose').click()); await wait(300);
  assert.deepStrictEqual(errors, []);
  console.log('e2e59 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
