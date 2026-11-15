const CFG = require("./_config");
// fotocamera del telefono: pulsante nella fotocamera dell'app e nella scansione, opzione «Per le foto usa la fotocamera del telefono»
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.gz': 'application/gzip', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8180));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + CFG.IMG + '/blank.mjpeg'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await page.setRequestInterception(true);
  page.on('request', r => r.url().startsWith('http://localhost:' + CFG.port(8180) + '') ? r.continue() : r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"totalItems":0}' }));
  await page.evaluateOnNewDocument(() => { if (!localStorage.getItem('catalogo-libri-set')) localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'P', selTip: 1, lastBackup: Date.now(), price: false })); });
  await page.goto('http://localhost:' + CFG.port(8180) + '/?vista=elenco', { waitUntil: 'load' }); await wait(600);
  const n = () => page.evaluate(() => window.__app.state.books.length);
  const vis = sel => page.$eval(sel, e => !e.hidden);
  // 1) Foto › Scatta: fotocamera dell'app, poi «Usa la fotocamera del telefono» -> la stessa foto arriva dal telefono
  await page.evaluate(() => document.querySelector('#btnPhoto').click()); await wait(200);
  await page.evaluate(() => document.querySelector('#photoCam').click());
  await page.waitForFunction(() => !document.querySelector('#snap').hidden && document.querySelector('#snapVideo').videoWidth > 0, { timeout: 10000 });
  assert(await vis('#snapNative'));
  await page.screenshot({ path: CFG.OUT + '/snap_native.png' });
  let [ch] = await Promise.all([page.waitForFileChooser({ timeout: 5000 }), page.click('#snapNative')]);
  console.log('[1 input]', await page.evaluate(() => document.activeElement && document.activeElement.id), ch.isMultiple());
  assert(!(await vis('#snap')), 'la fotocamera dell\'app si chiude');
  await ch.accept([CFG.IMG + '/cover.jpg']); await wait(1500);
  assert.strictEqual(await n(), 1, 'foto del telefono arrivata nell\'app');
  await page.evaluate(() => { document.querySelectorAll('.sheet').forEach(s => { s.hidden = true; }); }); await wait(200);
  // 2) opzione: sempre la fotocamera del telefono (la fotocamera dell'app non si apre)
  await page.evaluate(() => window.__app.openOptions('cards')); await wait(300);
  await page.click('#optCamNative'); await wait(200);
  assert.strictEqual(await page.evaluate(() => window.__app.settings.camNative), true);
  await page.evaluate(() => window.__app.closeOptions()); await wait(300);
  await page.evaluate(() => document.querySelector('#btnPhoto').click()); await wait(200);
  [ch] = await Promise.all([page.waitForFileChooser({ timeout: 5000 }), page.evaluate(() => document.querySelector('#photoCam').click())]);
  assert(!(await vis('#snap')), 'nessuna fotocamera dell\'app');
  await ch.accept([CFG.IMG + '/author_only.jpg']); await wait(800);
  assert.strictEqual(await n(), 2);
  await page.evaluate(() => { document.querySelectorAll('.sheet').forEach(s => { s.hidden = true; }); window.__app.settings.camNative = false; }); await wait(200);
  // 3) scansione: «Usa la fotocamera del telefono» chiude la scansione e la foto passa all'app (qui il codice a barre del retro)
  await page.evaluate(() => window.__app.startScan()); await page.waitForFunction(() => !document.querySelector('#scan').hidden, { timeout: 8000 }); await wait(600);
  assert(await vis('#scanNative'));
  await page.screenshot({ path: CFG.OUT + '/scan_native.png' });
  [ch] = await Promise.all([page.waitForFileChooser({ timeout: 5000 }), page.click('#scanNative')]);
  assert(await page.$eval('#scan', e => e.hidden), 'scansione chiusa');
  await ch.accept([CFG.IMG + '/back.jpg']); await wait(2500);
  const last = await page.evaluate(() => window.__app.state.books.map(b => b.i).filter(Boolean)); console.log('[3 ISBN letti]', JSON.stringify(last));
  assert.strictEqual(await n(), 3);
  // 4) «Ce l'ho già?»: niente pulsante (non deve aggiungere libri)
  await page.evaluate(() => { document.querySelectorAll('.sheet').forEach(s => { s.hidden = true; }); window.__app.startScan('check'); });
  await page.waitForFunction(() => !document.querySelector('#scan').hidden, { timeout: 8000 }); await wait(300);
  assert.strictEqual(await page.$eval('#scanNative', e => getComputedStyle(e).display), 'none');
  await page.evaluate(() => document.querySelector('#scanClose').click()); await wait(300);
  assert.deepStrictEqual(errors, []);
  console.log('e2e60 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
