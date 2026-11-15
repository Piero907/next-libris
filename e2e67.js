const CFG = require("./_config");
// suoni della scansione: bip quando legge il codice; se poi titolo e autore non si trovano, suono «non trovato» (due note basse che scendono);
// trovato: nessun suono in più; libri aggiunti senza scansione (in sottofondo) non suonano; con i suoni spenti, niente
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.gz': 'application/gzip' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8187));
const FOUND = '9788806219352';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + CFG.IMG + '/blank.mjpeg', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await page.setRequestInterception(true);
  page.on('request', r => {
    const u = decodeURIComponent(r.url());
    if (u.startsWith('http://localhost:' + CFG.port(8187))) return r.continue();
    const hit = /googleapis/.test(u) && u.includes(FOUND);
    r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: hit ? JSON.stringify({ totalItems: 1, items: [{ id: 'x', volumeInfo: { title: 'Il libro trovato', authors: ['Mario Rossi'], publisher: 'Einaudi', publishedDate: '2010', industryIdentifiers: [{ type: 'ISBN_13', identifier: FOUND }] } }] }) : '{"totalItems":0}' });
  });
  await page.evaluateOnNewDocument(() => { if (!localStorage.getItem('catalogo-libri-set')) localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'P', selTip: 1, lastBackup: Date.now(), price: false })); });
  await page.goto('http://localhost:' + CFG.port(8187) + '/?vista=elenco', { waitUntil: 'load' }); await wait(600);
  const snd = () => page.evaluate(() => window.__app.sounds());
  const done = isbn => page.waitForFunction(i => { const b = window.__app.state.books.find(x => x.i === i); return b && (b.t || b.nf); }, { timeout: 15000 }, isbn);
  await page.evaluate(() => window.__app.startScan()); await page.waitForFunction(() => !document.querySelector('#scan').hidden, { timeout: 8000 }); await wait(800);
  // 1) trovato: un bip, nessun «non trovato»
  let s0 = await snd();
  await page.evaluate(i => window.__app.onScanned(i), FOUND); await done(FOUND); await wait(300);
  let s1 = await snd(); console.log('[trovato]', JSON.stringify(s0), '->', JSON.stringify(s1));
  assert.strictEqual(s1.beep, s0.beep + 1); assert.strictEqual(s1.fail, s0.fail);
  // 2) solo il codice: bip e poi «non trovato»
  await page.evaluate(() => window.__app.onScanned('9798864592106')); await done('9798864592106'); await wait(300);
  let s2 = await snd(); console.log('[non trovato]', JSON.stringify(s2));
  assert.strictEqual(s2.beep, s1.beep + 1); assert.strictEqual(s2.fail, s1.fail + 1, 'suono di errore');
  // 3) libro aggiunto senza scansione (per esempio un elenco di ISBN cercato in sottofondo): niente suono
  await page.evaluate(() => window.__app.addIsbn('9798867261412')); await done('9798867261412'); await wait(300);
  let s3 = await snd(); assert.strictEqual(s3.fail, s2.fail, 'in sottofondo non suona');
  // 4) suoni spenti: niente
  await page.click('#scanSound'); await wait(200);
  await page.evaluate(() => window.__app.onScanned('9798861010702')); await done('9798861010702'); await wait(300);
  let s4 = await snd(); assert.strictEqual(s4.fail, s3.fail, 'spenti: niente');
  assert.deepStrictEqual(errors, []);
  console.log('e2e67 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
