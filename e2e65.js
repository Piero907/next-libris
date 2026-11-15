const CFG = require("./_config");
// Modulo «Disposizione dello schermo» (layout.js + layout.css): Classico, A (barra in basso), B (leggera), C (pulsante tondo), D (tutto in basso);
// scelta in Opzioni › Aspetto, salvata; avvisi in cima uno alla volta; finestre «Aggiungi» e «Per te»; senza modulo resta la classica
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
let noMod = false;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; if (noMod && /^\/layout\./.test(p)) { res.writeHead(404); return res.end(); } const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(8185);
const today = new Date().toISOString().slice(0, 10);
const books = Array.from({ length: 14 }, (_, i) => ({ id: 'k' + i, t: 'Libro numero ' + i, a: 'Autore ' + (i % 4), ts: Date.now() - i * 864e5, rs: i === 0 ? 'ok' : 'da', rd: i === 0 ? today : '', gen: 'Romanzo', pg: String(200 + i * 10), qs: i === 1 ? [{ x: 'Una citazione', pg: '', d: Date.now(), phs: [] }] : [] }));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await page.goto('http://localhost:8185/?vista=elenco', { waitUntil: 'load' });
  await page.evaluate(b => { const o = Storage.prototype.setItem; localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: Date.now() })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'Piero', selTip: 1, lastBackup: Date.now(), donOpens: 9, donUntil: 0 })); localStorage.setItem('catalogo-libri-layout', JSON.stringify({ v: 'a' })); Storage.prototype.setItem = function (k, v) { if (/^catalogo-libri-v2$/.test(k)) return; return o.call(this, k, v); }; }, books);
  await page.reload({ waitUntil: 'load' }); await wait(900);
  // i tasti veri vengono intercettati: basta sapere che il modulo li ha premuti
  await page.evaluate(() => { window.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#btnScan,#btnPhoto,#btnType,#btnCheck'); if (b) { window.__hit = b.id; e.stopImmediatePropagation(); } }, true); });
  const vis = s => page.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return !e.closest('[hidden]') && getComputedStyle(e).display !== 'none' && r.width > 0 && r.height > 0; }, s);
  const txt = s => page.$eval(s, e => e.innerText.replace(/\s+/g, ' ').trim());
  // A
  assert.strictEqual(await page.evaluate(() => document.documentElement.dataset.layout), 'a');
  assert(await vis('#layNav') && !(await vis('.dock')) && !(await vis('#tabLib')) && !(await vis('#btnStats')), 'A: barra in basso');
  // avvisi uno alla volta: installa, «hai finito», sostieni
  const notes = await page.evaluate(() => ['#notice', '#nxBox', '#wrapAsk', '#donAsk', '#instCard', '#donRow'].map(k => document.querySelector(k)).filter(e => e && !e.hidden).map(e => e.id + (e.classList.contains('lay-later') ? ':dopo' : ':ora')));
  console.log('[A avvisi]', notes.join(' '), '|', await txt('#layMore'));
  assert(notes.filter(x => /:ora/.test(x)).length === 1 && notes.length >= 2 && /Avviso 1 di/.test(await txt('#layMore')));
  await page.screenshot({ path: CFG.OUT + '/layout_a.png' });
  await page.click('#layMore'); await wait(150); assert(/Avviso 2 di/.test(await txt('#layMore')));
  await page.click('#layNav [data-l="wish"]'); await wait(250);
  assert.strictEqual(await page.evaluate(() => window.NL.tab()), 'wish'); assert(await page.$eval('#layNav [data-l="wish"]', e => e.classList.contains('on')));
  await page.click('#layNav [data-l="lib"]'); await wait(250);
  await page.click('#layNav [data-l="add"]'); await wait(250);
  assert(await vis('#layAdd')); await page.screenshot({ path: CFG.OUT + '/layout_a_add.png' });
  await page.click('#layAdd [data-l="scan"]'); await wait(150);
  assert.strictEqual(await page.evaluate(() => window.__hit), 'btnScan'); assert(!(await vis('#layAdd')));
  await page.click('#layNav [data-l="you"]'); await wait(250);
  const you = await txt('#layYouList'); console.log('[A per te]', you);
  assert(/Suggerimenti/.test(you) && /Tutte le citazioni/.test(you) && /Statistiche/.test(you) && /Backup/.test(you));
  await page.screenshot({ path: CFG.OUT + '/layout_a_perte.png' });
  await page.click('#layYou [data-l="stats"]'); await wait(300);
  assert(await vis('#statsSheet')); await page.keyboard.press('Escape'); await wait(250);
  await page.click('#layNav [data-l="menu"]'); await wait(400);
  assert(await page.evaluate(() => document.body.classList.contains('drawer-open'))); await page.evaluate(() => window.__app.closeDrawer()); await wait(350);
  // scelta in Opzioni › Aspetto
  await page.evaluate(() => window.__app.openOptions('look')); await wait(300);
  const opts = await page.$$eval('#optLayout input', e => e.map(x => x.value + (x.checked ? '*' : '')));
  console.log('[opzione]', opts.join(' ')); assert.deepStrictEqual(opts, ['classico', 'a*', 'b', 'c', 'd']);
  await page.screenshot({ path: CFG.OUT + '/layout_opzione.png' });
  const pick = async v => { await page.evaluate(() => window.__app.openOptions('look')); await wait(200); await page.click('#optLayout input[value="' + v + '"]'); await wait(250); await page.evaluate(() => window.__app.closeOptions()); await wait(350); await page.evaluate(() => window.scrollTo(0, 0)); };
  // B
  await pick('b');
  assert(await vis('.dock') && await vis('#tabLib') && await vis('#btnCheck') && await vis('#btnView') && !(await vis('#btnStats')) && !(await vis('#btnExport')) && !(await vis('#layNav')));
  assert(!(await vis('.tip')), 'B: niente testo d\'aiuto con più di 10 libri');
  await page.screenshot({ path: CFG.OUT + '/layout_b.png' });
  // C
  await pick('c');
  assert(await vis('#layFabB') && !(await vis('.dock')) && await vis('#layStrip'));
  const strip = await txt('#layStrip'); console.log('[C scorciatoie]', strip); assert(/Suggerimenti/.test(strip) && /Statistiche/.test(strip) && /Ce l'ho già/.test(strip));
  await page.screenshot({ path: CFG.OUT + '/layout_c.png' });
  await page.click('#layFabB'); await wait(250);
  assert(await vis('#layDial')); await page.screenshot({ path: CFG.OUT + '/layout_c_aperto.png' });
  await page.click('#layDial [data-l="type"]'); await wait(150);
  assert.strictEqual(await page.evaluate(() => window.__hit), 'btnType'); assert(!(await vis('#layDial')));
  // D
  await pick('d');
  const d = await page.evaluate(() => { const s = document.querySelector('#stick').getBoundingClientRect(), k = document.querySelector('.dock').getBoundingClientRect(); return { stickBottom: Math.round(s.bottom), dockTop: Math.round(k.top), vh: innerHeight, pos: getComputedStyle(document.querySelector('#stick')).position }; });
  console.log('[D]', JSON.stringify(d)); assert(d.pos === 'fixed' && Math.abs(d.stickBottom - d.dockTop) <= 2 && d.dockTop > d.vh - 120);
  // l'ultimo libro non resta nascosto sotto i comandi
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await wait(200);
  const last = await page.evaluate(() => { const r = [...document.querySelectorAll('#list .row')].pop().getBoundingClientRect(); return { b: Math.round(r.bottom), top: Math.round(document.querySelector('#stick').getBoundingClientRect().top) }; });
  assert(last.b <= last.top + 1, 'ultimo libro visibile');
  await page.evaluate(() => window.scrollTo(0, 0)); await wait(100);
  await page.screenshot({ path: CFG.OUT + '/layout_d.png' });
  // classico: come prima, tutti gli avvisi
  await pick('classico');
  assert(await vis('#btnStats') && await vis('#tabLib') && await vis('.dock') && !(await vis('#layNav')) && !(await vis('#layFabB')));
  assert(await page.evaluate(() => !document.querySelector('.lay-later')), 'classico: avvisi tutti');
  await page.screenshot({ path: CFG.OUT + '/layout_classico.png' });
  // la scelta resta dopo la riapertura
  await pick('c'); await page.reload({ waitUntil: 'load' }); await wait(700);
  assert.strictEqual(await page.evaluate(() => document.documentElement.dataset.layout), 'c');
  assert.deepStrictEqual(errors, []);
  // senza modulo: classica
  noMod = true;
  const ctx2 = await browser.createBrowserContext(); const p2 = await ctx2.newPage(); const err2 = []; p2.on('pageerror', e => err2.push(e.message));
  await p2.goto('http://localhost:8185/', { waitUntil: 'load' }); await wait(700);
  const st2 = await p2.evaluate(() => ({ lay: document.documentElement.dataset.layout || '', nav: !!document.getElementById('layNav'), stats: getComputedStyle(document.querySelector('#btnStats')).display }));
  console.log('[senza modulo]', JSON.stringify(st2)); assert(!st2.lay && !st2.nav && st2.stats !== 'none'); assert.deepStrictEqual(err2, []);
  console.log('e2e65 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
