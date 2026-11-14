const CFG = require("./_config");
// suoni: si spengono e accendono dalle Opzioni (Aspetto) e dalla fotocamera (🔊/🔇); spenti, niente bip né «fatto»; la scelta resta
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.gz': 'application/gzip' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(8178);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + CFG.IMG + '/blank.mjpeg', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await page.setRequestInterception(true);
  page.on('request', r => r.url().startsWith('http://localhost:8178') ? r.continue() : r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"totalItems":0}' }));
  await page.evaluateOnNewDocument(() => { if (!localStorage.getItem('catalogo-libri-set')) localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'P', selTip: 1, lastBackup: Date.now(), price: false })); });
  await page.goto('http://localhost:8178/?vista=elenco', { waitUntil: 'load' }); await wait(600);
  const snd = () => page.evaluate(() => window.__app.sounds());
  // 1) Opzioni › Aspetto: «Suoni» acceso di predefinito; spento -> niente bip
  await page.evaluate(() => window.__app.openOptions('look')); await wait(300);
  assert(await page.$eval('#optSound', e => e.checked), 'acceso di predefinito');
  await page.click('#optSound'); await wait(200);
  assert.strictEqual(await page.evaluate(() => window.__app.settings.sound), false);
  await page.evaluate(() => window.__app.closeOptions()); await wait(300);
  // 2) fotocamera: il pulsante mostra 🔇; un codice letto non suona
  await page.evaluate(() => window.__app.startScan()); await page.waitForFunction(() => !document.querySelector('#scan').hidden, { timeout: 8000 }); await wait(800);
  let b = await page.$eval('#scanSound', e => ({ t: e.textContent, p: e.getAttribute('aria-pressed') })); console.log('[fotocamera]', JSON.stringify(b));
  assert(b.t === '🔇' && b.p === 'false');
  let s0 = await snd(); await page.evaluate(() => window.__app.onScanned('9788806219352')); await wait(300);
  let s1 = await snd(); console.log('[spenti]', JSON.stringify(s0), JSON.stringify(s1)); assert.strictEqual(s1.beep, s0.beep, 'spenti: nessun bip');
  await page.screenshot({ path: CFG.OUT + '/scan_sound.png' });
  // 3) un tocco su 🔇 li riaccende (con un bip di prova); un altro codice suona
  await page.click('#scanSound'); await wait(200);
  b = await page.$eval('#scanSound', e => ({ t: e.textContent, p: e.getAttribute('aria-pressed') })); assert(b.t === '🔊' && b.p === 'true');
  const s2 = await snd(); assert.strictEqual(s2.beep, s1.beep + 1, 'bip di prova');
  await page.evaluate(() => window.__app.onScanned('9788804668015')); await wait(300);
  const s3 = await snd(); assert(s3.beep > s2.beep, 'accesi: bip');
  assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')).sound), true, 'scelta salvata');
  // 4) la scelta resta dopo il riavvio e si vede anche nelle Opzioni
  await page.click('#scanSound'); await wait(200);
  await page.evaluate(() => document.querySelector('#scanClose').click()); await wait(400);
  await page.reload({ waitUntil: 'load' }); await wait(600);
  assert.strictEqual(await page.evaluate(() => window.__app.settings.sound), false);
  assert(!(await page.$eval('#optSound', e => e.checked)));
  assert.deepStrictEqual(errors, []);
  console.log('e2e58 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
