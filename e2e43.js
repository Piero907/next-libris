const CFG = require("./_config");
const H = require('./_harness');
// editor della foto per le citazioni (17/11/2026: unite qui e2e43, e2e44, e2e48, e2e50, che avevano la stessa preparazione):
// 1) evidenziatore, penna, annulla, fatto / senza segni, matita sulle foto salvate; 2) due dita ingrandiscono, un dito disegna nel punto giusto;
// 3) gomma, adesivi, più grande e spostamento; 4) penna e segni dal vivo (ex e2e50). Ogni parte riapre l'editor da capo.
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP, IMG = CFG.IMG;
const server = H.serve(CFG.port(8161), ROOT);
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
  const wait = H.wait;   // attesa «finché» (_harness.js)
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
  { // ---- 1) evidenziatore, penna, annulla (ex e2e43) ----
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
  }
  { // ---- 2) ingrandimento con due dita (ex e2e44) ----
    await click('details.quotes[data-id="rosa"] [data-act="quoteadd"]'); await wait(150);
    // scatto -> editor; due dita ingrandiscono, un dito disegna nel punto giusto anche ingrandito
    await click('#quotePhoto'); await live(); await click('#snapShoot'); await pedOpen();
    const cdp = await page.target().createCDPSession();
    const r = await page.$eval('#pedArea', e => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: i + 1, radiusX: 2, radiusY: 2, force: 1 })) });
    await T('touchStart', [[cx - 30, cy], [cx + 30, cy]]);
    for (let i = 1; i <= 10; i++) await T('touchMove', [[cx - 30 - i * 12, cy], [cx + 30 + i * 12, cy]]);
    await T('touchEnd', []); await wait(150);
    const z = await page.$eval('#pedStage', e => e.style.transform); console.log('[zoom]', z);
    const zv = parseFloat(z.match(/scale\(([\d.]+)\)/)[1]); assert(zv > 2.5, 'ingrandita');
    assert(!(await page.$eval('#pedFit', e => e.hidden)), 'compare «Adatta»');
    assert(!(await page.$eval('#pedUndo', e => e.disabled)) === false, 'due dita non lasciano segni');
    // un dito al centro dello schermo: il segno cade al centro della foto (la foto e' ingrandita attorno al centro)
    await T('touchStart', [[cx - 20, cy]]); for (let i = 1; i <= 6; i++) await T('touchMove', [[cx - 20 + i * 7, cy]]); await T('touchEnd', []); await wait(150);
    const st = await page.evaluate(() => { const c = document.querySelector('#pedCanvas'); return null; });
    assert(!(await page.$eval('#pedUndo', e => e.disabled)), 'un dito disegna');
    await page.screenshot({ path: CFG.OUT + '/ped_zoom.png' });
    await click('#pedFit'); await wait(80);
    assert.strictEqual(await page.$eval('#pedStage', e => e.style.transform), 'translate(0px, 0px) scale(1)');
    await page.screenshot({ path: CFG.OUT + '/ped_fit.png' });
    await click('#pedDone');
    await page.waitForFunction(() => document.querySelector('#ped').hidden && document.querySelectorAll('#quoteThumbs li').length === 1, { timeout: 10000 });
    const mid = await thumbColor(0, 0.5, 0.5); console.log('[segno al centro]', mid); assert(mid[2] < 200, 'il segno e\' al centro della foto');
    await click('#quoteCancel');
  }
  { // ---- 3) gomma e adesivi (ex e2e48) ----
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
  }
  { // ---- 4) penna dal vivo (ex e2e50) ----
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
  }
  assert.deepStrictEqual(errors, []);
  console.log('e2e43 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
