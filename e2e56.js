const CFG = require("./_config");
// menu laterale: pagina principale (non i filtri), largo due terzi, «Filtri e ordine» come pagina a parte con Indietro,
// filtri raggruppati in pillole con «Altri…», «Sostieni» al centro con sfondo suo; «Prestato» centrato sulle copertine; vista all'apertura (Copertine di predefinito)
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8176));
const SH = ['Studio', 'Sala', 'Camera', 'Corridoio', 'Cantina', 'Soffitta', 'Ufficio', 'Cucina', 'Bagno', 'Ingresso', 'Garage', 'Terrazzo'];
const books = Array.from({ length: 14 }, (_, i) => ({ id: 'm' + i, t: 'Libro ' + i, a: 'Autore ' + (i % 3), ts: 100 + i, sh: SH[i % SH.length], gen: i % 2 ? 'Romanzo' : 'Saggio', rs: i < 4 ? 'ok' : 'da', fav: i === 1, p: i < 2 ? 'Anna' : '', pd: i < 2 ? '2026-10-01' : '', img: '' }));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await page.goto('http://localhost:' + CFG.port(8176) + '/', { waitUntil: 'load' });
  await page.evaluate(b => { const o = Storage.prototype.setItem; localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: Date.now() })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'P', selTip: 1, lastBackup: Date.now() })); Storage.prototype.setItem = function (k, v) { if (/^catalogo-libri-(v2|set)$/.test(k)) return; return o.call(this, k, v); }; }, books);
  await page.reload({ waitUntil: 'load' }); await wait(700);
  const st = () => page.evaluate(() => ({ open: document.body.classList.contains('drawer-open'), h: document.querySelector('#drawerH').textContent, home: !document.querySelector('#drawerOpts').hidden, flt: !document.querySelector('#drawerFilters').hidden, back: !document.querySelector('#drawerBack').hidden, w: Math.round(document.querySelector('#drawer').getBoundingClientRect().width) }));
  // 1) dalla linguetta: il menu, non i filtri; largo due terzi
  await page.evaluate(() => document.querySelector('#edgeTab').click()); await wait(400);
  let s = await st(); console.log('[1 linguetta]', JSON.stringify(s));
  assert(s.open && s.home && !s.flt && s.h === 'Menu' && Math.abs(s.w - Math.round(412 * 0.67)) <= 3);
  const items = await page.$$eval('#drawerOpts .dopt b', e => e.map(x => x.textContent)); console.log('  voci:', items.join(' | '));
  const iDon = items.indexOf('Sostieni Next Libris'), set = items.slice(3);
  assert(iDon > 3 && iDon < items.length - 2, 'Sostieni in mezzo alle impostazioni');
  const don = await page.$eval('#donMenu', e => { const c = e.querySelector('.don-cup').getBoundingClientRect(); return { bg: getComputedStyle(e).backgroundColor, sub: e.querySelector('small').textContent, svg: !!e.querySelector('.don-cup svg'), w: Math.round(c.width), h: Math.round(c.height) }; });
  console.log('  sostieni:', JSON.stringify(don)); assert(don.bg !== 'rgba(0, 0, 0, 0)' && /birra/.test(don.sub) && don.svg && don.w === don.h && don.w >= 36, 'boccale nel cerchio');
  await page.screenshot({ path: CFG.OUT + '/menu_home.png' });
  // 2) «Filtri e ordine» -> pagina; Indietro torna al menu; un altro Indietro chiude
  await page.click('#goFilters'); await wait(300);
  s = await st(); assert(s.flt && !s.home && s.back && s.h === 'Filtri e ordine');
  const groups = await page.$$eval('#drawerFlt h3', e => e.map(x => x.textContent)); console.log('[2 gruppi]', groups.join(' | '));
  assert.deepStrictEqual(groups.slice(0, 4), ['Libri', 'Lettura', 'Scaffale', 'Genere']);
  // scaffali: 12 -> 8 + «Altri 4…»
  let shp = await page.$$eval('#drawerFlt [data-g="sh"]', e => e.length); const more = await page.$eval('#drawerFlt [data-g="more"]', e => e.textContent);
  console.log('  scaffali visibili:', shp, more); assert(shp === 8 && /Altri 4/.test(more));
  await page.screenshot({ path: CFG.OUT + '/menu_filtri.png' });
  await page.click('#drawerFlt [data-g="more"]'); await wait(200);
  assert.strictEqual(await page.$$eval('#drawerFlt [data-g="sh"]', e => e.length), 12);
  // filtro: In prestito
  await page.click('#drawerFlt [data-g="flt"][data-v="loan"]'); await wait(200);
  assert.strictEqual(await page.$eval('#drawerShow', e => e.textContent), 'Mostra 2 libri');
  await page.evaluate(() => history.back()); await wait(350);
  s = await st(); console.log('[2 indietro]', JSON.stringify(s)); assert(s.open && s.home && s.h === 'Menu');
  const sum = await page.$eval('#goFltTxt', e => e.textContent); console.log('  riassunto:', sum, await page.$eval('#goFltN', e => e.hidden ? '' : e.textContent));
  assert(/1 filtro attivo/.test(sum));
  await page.evaluate(() => history.back()); await wait(400);
  s = await st(); assert(!s.open, 'secondo Indietro chiude');
  // 3) il pulsante Filtri apre direttamente la pagina dei filtri; ‹ porta al menu; × chiude senza lasciare passi in piu' nella cronologia
  await page.click('#btnFilters'); await wait(400);
  s = await st(); assert(s.open && s.flt && s.back);
  await page.click('#drawerBack'); await wait(250); s = await st(); assert(s.home);
  await page.click('#goFilters'); await wait(250); await page.click('#drawerX'); await wait(400);
  s = await st(); assert(!s.open);
  const hl = await page.evaluate(() => history.length); await page.evaluate(() => history.back()); await wait(300);
  assert(!(await st()).open);
  // 4) «Prestato» centrato nel riquadro celeste (vista Copertine)
  await page.evaluate(() => { document.querySelector('#drawerShow') && 0; });
  // vista all'apertura: Copertine di predefinito (nessuna scelta salvata), scelta nelle Opzioni › Aspetto
  assert(await page.evaluate(() => document.body.classList.contains('gridview') && !!document.querySelector('#list .grid')), 'copertine di predefinito');
  await page.evaluate(() => window.__app.openOptions('look')); await wait(300);
  assert(await page.$eval('input[name="viewDef"][value="grid"]', e => e.checked));
  // la scelta ha l'aspetto di quella del tema: due pulsanti uguali affiancati, il pallino della radio non si vede
  const vseg = await page.evaluate(() => { const sp = [...document.querySelectorAll('.seg-view span')].map(x => x.getBoundingClientRect()), th = document.querySelector('.seg-theme span').getBoundingClientRect(); return { w: sp.map(r => Math.round(r.width)), h: Math.round(sp[0].height), th: Math.round(th.height), op: getComputedStyle(document.querySelector('.seg-view input')).opacity, bg: getComputedStyle(document.querySelector('.seg-view input:checked+span')).backgroundColor }; });
  console.log('[vista: aspetto]', JSON.stringify(vseg)); assert(vseg.op === '0' && Math.abs(vseg.w[0] - vseg.w[1]) <= 2 && vseg.h === vseg.th && vseg.bg !== 'rgba(0, 0, 0, 0)');
  await page.evaluate(() => document.querySelector('.seg-view').scrollIntoView({ block: 'center' })); await page.screenshot({ path: CFG.OUT + '/vista_scelta.png' });
  await page.click('input[name="viewDef"][value="list"]'); await wait(300);
  assert(await page.evaluate(() => !document.body.classList.contains('gridview') && window.__app.settings.viewDef === 'list'));
  await page.click('input[name="viewDef"][value="grid"]'); await wait(300);
  await page.evaluate(() => window.__app.closeOptions()); await wait(300);
  // il pulsante sopra i libri cambia solo fino alla prossima apertura
  await page.evaluate(() => document.querySelector('#btnView').click()); await wait(200);
  assert(await page.evaluate(() => !document.body.classList.contains('gridview') && window.__app.settings.viewDef === 'grid'));
  await page.evaluate(() => document.querySelector('#btnView').click()); await wait(400);
  const bd = await page.evaluate(() => { const b = document.querySelector('.cover .badge.loan'); if (!b) return null; const r = b.getBoundingClientRect(), rg = document.createRange(); rg.selectNodeContents(b); const t = rg.getBoundingClientRect(); return { top: Math.round(t.top - r.top), bottom: Math.round(r.bottom - t.bottom) }; });
  console.log('[4 Prestato]', JSON.stringify(bd));
  assert(bd && Math.abs(bd.top - bd.bottom) <= 2, 'testo centrato');
  await page.screenshot({ path: CFG.OUT + '/badge.png' });
  assert.deepStrictEqual(errors, []);
  console.log('e2e56 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
