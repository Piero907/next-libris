const CFG = require("./_config");
// Modulo «Il tuo trimestre in libri» (wrap.js + wrap.css): invito in cima all'elenco nel primo mese del trimestre nuovo,
// schermate a storie (avanti/indietro, barre), numeri del trimestre, trimestre prima, immagine, menu, opzione in Aspetto (predefinito sì),
// Esc e Indietro chiudono; e l'app senza il modulo (file assenti) funziona uguale
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
let noMod = false;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; if (noMod && /^\/wrap\./.test(p)) { res.writeHead(404); return res.end(); } const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8184));
const T = s => Date.parse(s + 'T10:00:00');
const books = [
  { id: 'a', t: 'La forma dell\'acqua', a: 'Andrea Camilleri', rs: 'ok', rd: '2026-07-10', pg: '300', gen: 'Gialli', rt: 4, ts: T('2025-01-01') },
  { id: 'b', t: 'Il nome della rosa', a: 'Umberto Eco', rs: 'ok', rd: '2026-08-03', pg: '650', gen: 'Storia', rt: 5, ts: T('2025-01-01'), qs: [{ x: 'Stat rosa pristina nomine, nomina nuda tenemus.', pg: '503', d: T('2026-08-04'), phs: [] }] },
  { id: 'c', t: 'Il cane di terracotta', a: 'Andrea Camilleri', rs: 'ok', rd: '2026-08-20', pg: '200', gen: 'Gialli', rt: 3, ts: T('2025-01-01') },
  { id: 'd', t: 'Letto in primavera', a: 'X Y', rs: 'ok', rd: '2026-05-01', pg: '100', ts: T('2025-01-01') },
  ...[1, 2, 3, 4].map(i => ({ id: 'n' + i, t: 'Nuovo ' + i, a: 'Autore ' + i, c: 10 + i, ts: T('2026-08-1' + i), rs: 'da' })),
  { id: 'p', t: 'Prestato', a: 'Z', p: 'Anna', pd: '2026-09-01', ts: T('2024-01-01'), rs: 'da' },
  { id: 'w', t: 'Desiderio', a: 'W', w: true, ts: T('2026-09-02') },
];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  // orologio finto: 5 ottobre 2026, nel primo mese del trimestre nuovo
  await page.evaluateOnNewDocument(() => {
    const off = Date.parse('2026-10-05T10:00:00') - Date.now(), RD = Date;
    class FD extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }
    window.Date = FD;
  });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await page.goto('http://localhost:' + CFG.port(8184) + '/?vista=elenco', { waitUntil: 'load' });
  await page.evaluate(b => { const o = Storage.prototype.setItem; localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: Date.now() })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'Piero', selTip: 1, lastBackup: Date.now(), donUntil: Date.now() + 9e9, goal: 20, nxSeen: 'c' })); Storage.prototype.setItem = function (k, v) { if (/^catalogo-libri-v2$/.test(k)) return; return o.call(this, k, v); }; }, books);
  await page.reload({ waitUntil: 'load' }); await wait(800);
  const txt = s => page.$eval(s, e => e.innerText.replace(/\s+/g, ' ').trim()), hid = s => page.$eval(s, e => e.hidden);
  // 1) invito in cima
  assert(!(await hid('#wrapAsk')), 'invito visibile');
  const ask = await txt('#wrapAsk'); console.log('[1 invito]', ask);
  assert(/La tua estate in libri: è pronto/.test(ask) && /luglio – settembre 2026 · 3 libri letti/.test(ask));
  await page.screenshot({ path: CFG.OUT + '/wrap_invito.png' });
  // 2) storie
  await page.click('#wrapAskGo'); await wait(500);
  assert(!(await hid('#wrap')) && await page.evaluate(() => document.body.classList.contains('wrap-open')));
  const nBars = await page.$$eval('#wProg span', e => e.length); console.log('[2 schermate]', nBars);
  assert.strictEqual(nBars, 6);
  assert(/La tua estate in libri/.test(await txt('#wStage')) && /di Piero/.test(await txt('#wStage')));
  await page.screenshot({ path: CFG.OUT + '/wrap_1.png' });
  const next = async () => { await page.mouse.click(330, 500); await wait(250); };
  const slideTxt = [];
  for (let i = 2; i <= 6; i++) { await next(); slideTxt.push(await txt('#wStage')); await page.screenshot({ path: CFG.OUT + '/wrap_' + i + '.png' }); }
  slideTxt.forEach((t, i) => console.log('  ' + (i + 2) + ':', t.slice(0, 170)));
  assert(/hai letto 3 libri/.test(slideTxt[0]) && /1\.?150 pagine, circa 13 al giorno/.test(slideTxt[0]) && /agosto, con 2 libri/.test(slideTxt[0]) && /2 in più/.test(slideTxt[0]) && /4 su 20/.test(slideTxt[0]));
  assert(/Gialli 67%/.test(slideTxt[1]) && /Storia 33%/.test(slideTxt[1]) && /Andrea Camilleri 2 libri letti/.test(slideTxt[1]));
  assert(/Il più lungo «Il nome della rosa».*650 pagine/.test(slideTxt[2]) && /piaciuto di più «Il nome della rosa»/.test(slideTxt[2]));
  assert(/^In libreria 4 libri nuovi, 50,00 €/.test(slideTxt[3]) && /1 nei Desideri/.test(slideTxt[3]) && /1 libro prestato/.test(slideTxt[3]) && /Stat rosa pristina/.test(slideTxt[3]));
  assert(/letti 3 pagine 1\.?150 nuovi 4 citazioni 1/.test(slideTxt[4]));
  assert.strictEqual(await page.$$eval('#wProg span.done', e => e.length), 5);
  // indietro col tocco a sinistra; ultima: niente oltre
  await page.mouse.click(40, 500); await wait(200); assert(/In libreria/.test(await txt('#wStage')));
  await next(); await next(); assert(/Condividi/.test(await txt('#wStage')));
  // immagine
  const img = await page.evaluate(() => { const d = window.NLWrap.quarters()[0]; const c = window.NLWrap.image(d); return { w: c.width, h: c.height, u: c.toDataURL().length }; });
  assert(img.w === 1080 && img.h === 1350 && img.u > 20000);
  await page.click('[data-w="share"]'); await wait(800);
  console.log('  condividi:', await txt('#toast'));
  // rivedi -> prima schermata; trimestre prima
  await page.click('[data-w="again"]'); await wait(200);
  assert(/La tua estate/.test(await txt('#wStage')));
  await page.click('[data-w="older"]'); await wait(250);
  const sp = await txt('#wStage'); console.log('[3 prima]', sp.slice(0, 90));
  assert(/aprile – giugno 2026/.test(sp) && /La tua primavera/.test(sp));
  await page.click('[data-w="newer"]'); await wait(200); assert(/luglio – settembre/.test(await txt('#wStage')));
  // 4) Esc chiude, l'invito non torna
  await page.keyboard.press('Escape'); await wait(300);
  assert(await hid('#wrap')); assert(await hid('#wrapAsk'), 'già visto');
  assert.strictEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('catalogo-libri-wrap'))).seen, '2026-T3');
  // 5) dal menu; Indietro chiude
  await page.evaluate(() => window.__app.openDrawer('opt')); await wait(350);
  assert(!(await hid('#goWrap'))); const gw = await txt('#goWrap'); console.log('[5 menu]', gw);
  assert(/Il tuo trimestre in libri/.test(gw) && /luglio – settembre 2026/.test(gw));
  await page.screenshot({ path: CFG.OUT + '/wrap_menu.png' });
  await page.click('#goWrap'); await wait(600);
  assert(!(await hid('#wrap')) && !(await page.evaluate(() => document.body.classList.contains('drawer-open'))));
  await page.evaluate(() => history.back()); await wait(400);
  assert(await hid('#wrap'), 'Indietro chiude');
  // tema scuro: il fondo resta scuro anche se il colore della palette e' chiaro
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); window.NLWrap.open('2026-T3'); }); await wait(300);
  const base = await page.$eval('#wrap', e => e.style.getPropertyValue('--w-base')); console.log('  fondo scuro:', base);
  const lum = parseInt(base.slice(1, 3), 16) * .2126 + parseInt(base.slice(3, 5), 16) * .7152 + parseInt(base.slice(5, 7), 16) * .0722;
  assert(lum < 110, 'testo bianco leggibile');
  await page.screenshot({ path: CFG.OUT + '/wrap_scuro.png' });
  await page.evaluate(() => { window.NLWrap.close(); document.documentElement.setAttribute('data-theme', 'light'); }); await wait(300);
  // 6) opzione in Aspetto (predefinito sì); spenta: niente menu
  await page.evaluate(() => window.__app.openOptions('look')); await wait(300);
  assert(await page.$eval('#optWrap', e => e.checked)); assert(/Riepilogo ogni tre mesi/.test(await page.$eval('#optWrap', e => e.closest('label').innerText)));
  await page.click('#optWrap'); await wait(200);
  assert.strictEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('catalogo-libri-wrap'))).on, false);
  await page.evaluate(() => window.__app.closeOptions()); await wait(300);
  await page.evaluate(() => window.__app.openDrawer('opt')); await wait(350);
  assert(await hid('#goWrap'), 'spento: niente voce');
  await page.evaluate(() => window.__app.closeDrawer()); await wait(300);
  // invito: rimesso «non visto» ma spento -> non compare
  await page.evaluate(() => { localStorage.setItem('catalogo-libri-wrap', JSON.stringify({ on: false, seen: '' })); }); await page.reload({ waitUntil: 'load' }); await wait(700);
  assert(await hid('#wrapAsk'));
  await page.evaluate(() => { localStorage.setItem('catalogo-libri-wrap', JSON.stringify({ on: true, seen: '' })); }); await page.reload({ waitUntil: 'load' }); await wait(700);
  assert(!(await hid('#wrapAsk')), 'acceso: torna');
  await page.click('#wrapAsk .ico'); await wait(200); assert(await hid('#wrapAsk'), '× lo nasconde');
  assert.deepStrictEqual(errors, []);
  // 7) senza il modulo (file assenti): l'app funziona uguale
  noMod = true;
  const ctx2 = await browser.createBrowserContext(); const p2 = await ctx2.newPage(); const err2 = []; p2.on('pageerror', e => err2.push(e.message));
  await p2.setViewport({ width: 412, height: 915 });
  await p2.goto('http://localhost:' + CFG.port(8184) + '/?vista=elenco', { waitUntil: 'load' }); await wait(800);
  const st2 = await p2.evaluate(() => ({ nl: !!window.NL, wrap: !!window.NLWrap, ask: !!document.getElementById('wrapAsk'), books: document.querySelector('#list').innerHTML.length }));
  await p2.evaluate(() => window.__app.openDrawer('opt')); await wait(350);
  st2.menu = await p2.evaluate(() => !!document.getElementById('goWrap'));
  await p2.evaluate(() => window.__app.openOptions('look')); await wait(300);
  st2.opt = await p2.evaluate(() => !!document.getElementById('optWrap'));
  console.log('[7 senza modulo]', JSON.stringify(st2), err2);
  assert(st2.nl && !st2.wrap && !st2.ask && !st2.menu && !st2.opt && st2.books > 0);
  assert.deepStrictEqual(err2, []);
  console.log('e2e64 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
