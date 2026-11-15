const CFG = require("./_config");
// editor della foto per le citazioni: evidenziatore, penna, annulla, fatto / senza segni, matita sulle foto salvate
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP, IMG = CFG.IMG;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.gz': 'application/gzip' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': (p.endsWith('.wasm.js') ? 'text/javascript' : MIME[path.extname(f)]) || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8167));
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
  await page.goto('http://localhost:' + CFG.port(8167) + '/?vista=elenco', { waitUntil: 'load' });
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
  await click('#quotePhoto'); await live(); await click('#snapShoot'); await pedOpen();
  const pix = (fx, fy) => page.evaluate((fx, fy) => { const c = document.querySelector('#pedCanvas'); const d = c.getContext('2d').getImageData(Math.round(c.width * fx), Math.round(c.height * fy), 1, 1).data; return [d[0], d[1], d[2]]; }, fx, fy);
  const tap = async (fx, fy) => { const r = await page.$eval('#pedCanvas', e => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }); await page.mouse.click(r.x + r.w * fx, r.y + r.h * fy); await wait(80); };
  const white = p => p[0] > 235 && p[1] > 235 && p[2] > 235;
  // 1) gomma: cancella meta' dell'evidenziatore
  await drag(0.1, 0.75, 0.9, 0.75);
  assert(!white(await pix(0.3, 0.75)) && !white(await pix(0.7, 0.75)));
  await click('.ped-t[data-tool="er"]'); assert(await page.$eval('#pedStk', e => e.hidden));
  await drag(0.55, 0.75, 0.95, 0.75); await wait(100);
  const a1 = await pix(0.3, 0.75), a2 = await pix(0.75, 0.75); console.log('[gomma] resta', a1, 'cancellato', a2);
  assert(!white(a1) && white(a2), 'la gomma cancella solo dove passa');
  // la gomma non tocca la foto: il testo sotto resta
  // 2) adesivi: emoticon e etichetta
  await click('.ped-t[data-tool="stk"]'); assert(!(await page.$eval('#pedStk', e => e.hidden)));
  await page.screenshot({ path: CFG.OUT + '/ped_stk_tray.png' });
  await tap(0.25, 0.35);
  await click('#pedStk [data-l="Importante"]'); await tap(0.7, 0.35);
  const e1 = await pix(0.25, 0.35), l1 = await pix(0.7, 0.35); console.log('[adesivi] emoticon', e1, 'etichetta', l1);
  assert(!white(e1), 'emoticon disegnata'); assert(l1[0] > 170 && l1[1] < 90 && l1[2] < 110, 'etichetta rossa');
  // 3) piu' grande, poi sposto l'etichetta
  const before = await page.evaluate(() => 0);
  await click('#pedBigger'); await wait(60);
  const r = await page.$eval('#pedCanvas', e => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  await page.mouse.move(r.x + r.w * 0.7, r.y + r.h * 0.35); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(r.x + r.w * 0.7, r.y + r.h * (0.35 + 0.25 * i / 8));
  await page.mouse.up(); await wait(100);
  const l2 = await pix(0.7, 0.35), l3 = await pix(0.7, 0.6); console.log('[spostata] prima', l2, 'dopo', l3);
  assert(l3[0] > 170 && l3[1] < 90, 'etichetta nel nuovo posto'); assert(!(l2[0] > 170 && l2[1] < 90 && l2[2] < 110), 'non piu\' nel vecchio');
  await page.screenshot({ path: CFG.OUT + '/ped_stk.png' });
  // 4) la gomma toglie l'adesivo con un tocco; «↶» lo rimette
  await click('.ped-t[data-tool="er"]'); await tap(0.25, 0.35);
  assert(white(await pix(0.25, 0.35)), 'emoticon tolta');
  await click('#pedUndo'); await wait(60); assert(!white(await pix(0.25, 0.35)), '↶ la rimette');
  // 5) Fatto: la foto salvata ha segni e adesivi
  await click('#pedDone');
  await page.waitForFunction(() => document.querySelector('#ped').hidden && document.querySelectorAll('#quoteThumbs li').length === 1, { timeout: 10000 });
  const t1 = await thumbColor(0, 0.3, 0.75), t2 = await thumbColor(0, 0.7, 0.6), t3 = await thumbColor(0, 0.75, 0.75);
  console.log('[salvata] evidenziato', t1, 'etichetta', t2, 'cancellato', t3);
  assert(t1[2] < 200 && t2[0] > 170 && t2[1] < 100 && t3[2] > 225);
  await click('#quoteCancel');
  assert.deepStrictEqual(errors, []);
  console.log('e2e48 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
