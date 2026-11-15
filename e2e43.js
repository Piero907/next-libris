const CFG = require("./_config");
// editor della foto per le citazioni: evidenziatore, penna, annulla, fatto / senza segni, matita sulle foto salvate
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP, IMG = CFG.IMG;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.gz': 'application/gzip' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': (p.endsWith('.wasm.js') ? 'text/javascript' : MIME[path.extname(f)]) || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8161));
const B = (o) => Object.assign({ t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 1, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: 'da', rt: 0, rd: '' }, o);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + IMG + '/pagina.mjpeg'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => { const u = r.url(); if (u.startsWith('http://localhost') || u.startsWith('blob:') || u.startsWith('data:')) return r.continue(); r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }); });
  await page.evaluateOnNewDocument((b) => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ extra: true, lastBackup: Date.now(), installed: true, instScope: '/', swiped: true, name: 'Piero', selTip: 1 })); sessionStorage.seeded = 1; } }, [B({ id: 'rosa', t: 'Il nome della rosa', a: 'Umberto Eco' })]);
  await page.goto('http://localhost:' + CFG.port(8161) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(1200);
  const click = sel => page.evaluate(s => document.querySelector(s).click(), sel);
  const book = id => page.evaluate(i => JSON.parse(JSON.stringify(window.__app.state.books.find(x => x.id === i))), id);
  const live = () => page.waitForFunction(() => { const v = document.querySelector('#snapVideo'); return !document.querySelector('#snap').hidden && v.videoWidth > 0; }, { timeout: 10000 });
  const pedOpen = () => page.waitForFunction(() => !document.querySelector('#ped').hidden && document.querySelector('#pedCanvas').width > 50, { timeout: 10000 });
  const drag = async (fx, fy, tx, ty) => { const r = await page.$eval('#pedCanvas', e => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
    await page.mouse.move(r.x + r.w * fx, r.y + r.h * fy); await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(r.x + r.w * (fx + (tx - fx) * i / 10), r.y + r.h * (fy + (ty - fy) * i / 10));
    await page.mouse.up(); await wait(80); };
  // colore medio di una zona della miniatura (per vedere i segni)
  const thumbColor = (k, fx, fy) => page.evaluate((k, fx, fy) => new Promise(res => { const im = document.querySelectorAll('#quoteThumbs img')[k]; const i2 = new Image(); i2.onload = () => { const c = document.createElement('canvas'); c.width = i2.width; c.height = i2.height; const x = c.getContext('2d'); x.drawImage(i2, 0, 0); const d = x.getImageData(Math.round(i2.width * fx), Math.round(i2.height * fy), 1, 1).data; res([d[0], d[1], d[2]]); }; i2.src = im.src; }), k, fx, fy);
  await click('.row[data-id="rosa"] [data-act="toggle"]'); await wait(250);
  await page.evaluate(() => document.querySelector('details.quotes[data-id="rosa"] > summary').click()); await wait(100);
  await click('details.quotes[data-id="rosa"] [data-act="quoteadd"]'); await wait(150);
  // 1) scatto -> editor; evidenziatore giallo su una zona bianca, penna rossa sotto
  await click('#quotePhoto'); await live(); await click('#snapShoot'); await pedOpen();
  assert.strictEqual(await page.$eval('#pedH', e => e.textContent), 'Evidenzia o scrivi');
  await drag(0.1, 0.75, 0.9, 0.75);
  await click('.ped-t[data-tool="pen"][data-color="#E5322D"]'); await drag(0.1, 0.9, 0.9, 0.9);
  assert(!(await page.$eval('#pedUndo', e => e.disabled)));
  await page.screenshot({ path: CFG.OUT + '/ped.png' });
  // un segno in piu' e poi ↶
  await drag(0.5, 0.2, 0.6, 0.3); await click('#pedUndo'); await wait(50);
  await click('#pedDone');
  await page.waitForFunction(() => document.querySelector('#ped').hidden && document.querySelectorAll('#quoteThumbs li').length === 1, { timeout: 10000 });
  const yel = await thumbColor(0, 0.5, 0.75), red = await thumbColor(0, 0.5, 0.9), top = await thumbColor(0, 0.55, 0.25);
  console.log('[1 colori] giallo', yel, 'rosso', red, 'annullato', top);
  assert(yel[0] > 200 && yel[1] > 180 && yel[2] < 170, 'evidenziato in giallo'); assert(red[0] > 180 && red[1] < 120 && red[2] < 120, 'penna rossa'); assert(top[0] > 230 && top[1] > 230 && top[2] > 230, 'segno annullato');
  // la lettura del testo usa la foto senza segni
  await click('#quoteOcr');
  await page.waitForFunction(() => !document.querySelector('#quoteOcr').classList.contains('busy') && document.querySelector('#quoteText').value.length > 5, { timeout: 90000 });
  console.log('[1 testo]', JSON.stringify(await page.$eval('#quoteText', e => e.value)));
  assert(/bella mattina/.test(await page.$eval('#quoteText', e => e.value)));
  // 2) seconda foto: «Senza segni» la tiene com'e'
  await click('#quotePhoto'); await live(); await click('#snapShoot'); await pedOpen();
  await click('#pedSkip'); await page.waitForFunction(() => document.querySelector('#ped').hidden && document.querySelectorAll('#quoteThumbs li').length === 2, { timeout: 10000 });
  const clean = await thumbColor(1, 0.5, 0.75); assert(clean[0] > 230 && clean[2] > 230, 'senza segni');
  await click('#quoteSave'); await wait(400);
  let b = await book('rosa'); assert.strictEqual(b.qs[0].phs.length, 2); const k0 = b.qs[0].phs[1];
  // 3) matita sulla foto salvata: segni nuovi, nuova chiave dopo il salvataggio
  await click('details.quotes[data-id="rosa"] [data-act="quoteedit"][data-i="0"]'); await wait(200);
  assert.strictEqual(await page.$$eval('#quoteThumbs .q-th-ed', e => e.length), 2);
  await click('#quoteThumbs [data-ed="1"]'); await pedOpen();
  await drag(0.1, 0.75, 0.9, 0.75); await click('#pedDone');
  await page.waitForFunction(() => document.querySelector('#ped').hidden, { timeout: 10000 }); await wait(200);
  const yel2 = await thumbColor(1, 0.5, 0.75); assert(yel2[2] < 170, 'segni sulla foto salvata');
  await click('#quoteSave'); await wait(400);
  b = await book('rosa'); assert.strictEqual(b.qs[0].phs.length, 2); assert.notStrictEqual(b.qs[0].phs[1], k0, 'nuova foto salvata');
  // 4) Indietro chiude l'editor senza cambiare
  await click('details.quotes[data-id="rosa"] [data-act="quoteedit"][data-i="0"]'); await wait(200);
  await click('#quoteThumbs [data-ed="0"]'); await pedOpen(); await drag(0.2, 0.3, 0.8, 0.3);
  await page.evaluate(() => history.back()); await wait(300);
  assert(await page.$eval('#ped', e => e.hidden)); assert(!(await page.$eval('#quoteSheet', e => e.hidden)), 'la citazione resta aperta');
  await click('#quoteCancel');
  assert.deepStrictEqual(errors, []);
  console.log('e2e43 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
