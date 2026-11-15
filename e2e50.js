const CFG = require("./_config");
// editor della foto per le citazioni: evidenziatore, penna, annulla, fatto / senza segni, matita sulle foto salvate
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP, IMG = CFG.IMG;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.gz': 'application/gzip' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': (p.endsWith('.wasm.js') ? 'text/javascript' : MIME[path.extname(f)]) || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8169));
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
  await page.goto('http://localhost:' + CFG.port(8169) + '/?vista=elenco', { waitUntil: 'load' });
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
  const toClient = async p => page.evaluate(p => { const c = document.querySelector('#pedCanvas'), r = c.getBoundingClientRect(), img = window.__ped.st().img; return { x: r.left + p[0] / img.width * r.width, y: r.top + p[1] / img.height * r.height }; }, p);
  const sel = () => page.evaluate(() => { const o = window.__ped.stickers().find(x => x.it === window.__ped.st().sel); return o ? { x: o.x, y: o.y, size: o.size, r: o.r, h: window.__ped.handles(o) } : null; });
  const dragFrom = async (a, b) => { await page.mouse.move(a.x, a.y); await page.mouse.down(); for (let i = 1; i <= 10; i++) await page.mouse.move(a.x + (b.x - a.x) * i / 10, a.y + (b.y - a.y) * i / 10); await page.mouse.up(); await wait(120); };
  const liveInk = () => page.evaluate(() => { const c = document.querySelector('#pedLive'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
  await click('.ped-t[data-tool="stk"]'); await click('#pedStk [data-l="Importante"]');
  const r0 = await page.$eval('#pedCanvas', e => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  await page.mouse.click(r0.x + r0.w * 0.5, r0.y + r0.h * 0.45); await wait(120);
  let s0 = await sel(); assert(s0, 'appena messo e selezionato'); assert((await liveInk()) > 50, 'maniglie disegnate');
  await page.screenshot({ path: CFG.OUT + '/handles.png' });
  console.log('[messo]', JSON.stringify({ size: Math.round(s0.size), r: s0.r.toFixed(2) }));
  // maniglia verde: piu' grande
  const sz = await toClient(s0.h.size), c0 = await toClient([s0.x, s0.y]);
  await dragFrom(sz, { x: c0.x + (sz.x - c0.x) * 1.6, y: c0.y + (sz.y - c0.y) * 1.6 });
  let s1 = await sel(); console.log('[grandezza]', Math.round(s0.size), '->', Math.round(s1.size)); assert(s1.size > s0.size * 1.4 && s1.size < s0.size * 1.8);
  // maniglia blu: ruoto di un quarto di giro (in senso orario) -> si aggancia a 90 gradi
  const rt = await toClient(s1.h.rot), c1 = await toClient([s1.x, s1.y]), dist = Math.hypot(rt.x - c1.x, rt.y - c1.y);
  await page.mouse.move(rt.x, rt.y); await page.mouse.down();
  for (let i = 1; i <= 12; i++) { const a = -Math.PI / 2 - 0.05 + (Math.PI / 2 + 0.05) * i / 12; await page.mouse.move(c1.x + dist * Math.cos(a), c1.y + dist * Math.sin(a)); }
  await page.mouse.up(); await wait(120);
  let s2 = await sel(); console.log('[rotazione]', s1.r.toFixed(2), '->', s2.r.toFixed(3)); assert(Math.abs(s2.r - Math.PI / 2) < 0.001, 'agganciata a 90 gradi');
  await page.screenshot({ path: CFG.OUT + '/handles_rot.png' });
  // trascino da dentro: si sposta
  const in0 = await toClient([s2.x, s2.y]); await dragFrom(in0, { x: in0.x - 60, y: in0.y + 40 });
  let s3 = await sel(); assert(s3.x < s2.x && s3.y > s2.y, 'spostato');
  // ↶ annulla un gesto alla volta: lo spostamento, poi la rotazione
  await click('#pedUndo'); let u1 = await sel(); assert(Math.abs(u1.x - s2.x) < 0.5 && Math.abs(u1.r - Math.PI / 2) < 0.001);
  await click('#pedUndo'); let u2 = await sel(); assert(Math.abs(u2.r - s1.r) < 0.001, 'tolta la rotazione');
  // maniglia rossa: toglie
  const dl = await toClient((await sel()).h.del); await page.mouse.click(dl.x, dl.y); await wait(100);
  assert.strictEqual(await page.evaluate(() => window.__ped.stickers().length), 0); assert.strictEqual(await liveInk(), 0, 'niente maniglie');
  await click('#pedUndo'); assert.strictEqual(await page.evaluate(() => window.__ped.stickers().length), 1, '↶ lo rimette');
  // tocco su un punto vuoto: deseleziona e non mette un altro adesivo
  await page.mouse.click(r0.x + r0.w * 0.1, r0.y + r0.h * 0.1); await wait(80);
  await page.mouse.click(r0.x + r0.w * 0.1, r0.y + r0.h * 0.1); await wait(80);
  assert.strictEqual(await page.evaluate(() => window.__ped.stickers().length), 2, 'secondo tocco: nuovo adesivo');
  // con un altro strumento le maniglie non si vedono e la foto salvata non le contiene
  await click('.ped-t[data-tool="pen"][data-color="#2457D6"]'); assert.strictEqual(await liveInk(), 0);
  await click('#pedDone'); await page.waitForFunction(() => document.querySelector('#ped').hidden, { timeout: 10000 });
  await click('#quoteCancel');
  assert.deepStrictEqual(errors, []);
  console.log('e2e50 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
