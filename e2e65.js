const CFG = require("./_config");
// Modulo «Disposizione dello schermo» (layout.js + layout.css): Classico e A (barra in basso; B, C, D tolte il 15/11/2026);
// nella A avvisi sopra la ricerca, uno alla volta (opzione), riga «Prestati» solo se serve; finestre «Aggiungi» e «Per te»;
// riepilogo in alto con le opzioni (euro e «non più in libreria» spenti, «in prestito» si tocca), «Salvato su questo telefono» opzionale;
// scelta salvata (una vecchia B/C/D diventa A); senza modulo resta la classica
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
let noMod = false;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; if (noMod && /^\/layout\./.test(p)) { res.writeHead(404); return res.end(); } const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8185));
const today = new Date().toISOString().slice(0, 10);
const books = Array.from({ length: 14 }, (_, i) => ({ id: 'k' + i, t: 'Libro numero ' + i, a: 'Autore ' + (i % 4), c: 10, ts: Date.now() - i * 864e5, rs: i === 0 ? 'ok' : 'da', rd: i === 0 ? today : '', gen: 'Romanzo', pg: String(200 + i * 10), p: i === 3 ? 'Anna' : '', pd: i === 3 ? today : '', xs: i === 13 ? 'v' : '', qs: i === 1 ? [{ x: 'Una citazione', pg: '', d: Date.now(), phs: [] }] : [] }));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await page.goto('http://localhost:' + CFG.port(8185) + '/?vista=elenco', { waitUntil: 'load' });
  await page.evaluate(b => { const o = Storage.prototype.setItem; localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: Date.now() })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'Piero', selTip: 1, lastBackup: Date.now(), donOpens: 9, donUntil: 0 })); localStorage.setItem('catalogo-libri-layout', JSON.stringify({ v: 'a' })); Storage.prototype.setItem = function (k, v) { if (/^catalogo-libri-v2$/.test(k)) return; return o.call(this, k, v); }; }, books);
  await page.reload({ waitUntil: 'load' }); await wait(900);
  // i tasti veri vengono intercettati: basta sapere che il modulo li ha premuti
  await page.evaluate(() => { window.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#btnScan,#btnPhoto,#btnType,#btnCheck'); if (b) { window.__hit = b.id; e.stopImmediatePropagation(); } }, true); });
  const vis = s => page.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return !e.closest('[hidden]') && getComputedStyle(e).display !== 'none' && r.width > 0 && r.height > 0; }, s);
  const txt = s => page.$eval(s, e => e.innerText.replace(/\s+/g, ' ').trim());
  // A
  assert.strictEqual(await page.evaluate(() => document.documentElement.dataset.layout), 'a');
  assert(await vis('#layNav') && !(await vis('.dock')) && !(await vis('#tabLib')) && !(await vis('#btnStats')), 'A: barra in basso');
  // riepilogo: niente euro né «non più in libreria»; «1 in prestito» si tocca; la riga Prestati non serve
  let sum = await txt('#summary'); console.log('[A riepilogo]', sum);
  assert(/^13 libri · 1 in prestito$/.test(sum), 'riepilogo essenziale');
  assert(!(await vis('#fltLoan')), 'riga Prestati nascosta');
  assert(!(await vis('#sync')), '«Salvato su questo telefono» spento di predefinito (16/11/2026)');
  await page.click('#summary [data-sum="loan"]'); await wait(250);
  assert.deepStrictEqual(await page.$$eval('#list [data-id]', e => e.map(x => x.dataset.id)), ['k3']);
  // il filtro usato si vede: «In prestito ×» sotto la ricerca (16/11/2026)
  const lchip = await page.evaluate(() => { const c = document.querySelector('[data-clear="flt"]'); return c && c.getClientRects().length ? c.textContent : ''; }); console.log('[filtro prestiti]', lchip);
  assert(/In prestito/.test(lchip), 'filtro «In prestito» visibile');
  await page.screenshot({ path: CFG.OUT + '/layout_a_prestiti.png' });
  await page.click('#summary [data-sum="loan"]'); await wait(250);
  // avvisi sopra la ricerca, uno alla volta
  const pos = await page.evaluate(() => { const s = document.querySelector('#stick').getBoundingClientRect().top; return ['#nxBox', '#donRow', '#instCard'].map(k => { const e = document.querySelector(k); return e && !e.hidden ? Math.round(e.getBoundingClientRect().top - s) : null; }); });
  console.log('[A avvisi rispetto alla ricerca]', pos.join(' '));
  const notes = await page.evaluate(() => ['#notice', '#nxBox', '#wrapAsk', '#donAsk', '#instCard', '#donRow'].map(k => document.querySelector(k)).filter(e => e && !e.hidden).map(e => e.id + (e.classList.contains('lay-later') ? ':dopo' : ':ora')));
  console.log('[A avvisi]', notes.join(' '), '|', await page.$eval('#layMore', e => e.getAttribute('aria-label')));
  assert(notes.filter(x => /:ora/.test(x)).length === 1 && notes.length >= 2 && /Avviso 1 di/.test(await page.$eval('#layMore', e => e.getAttribute('aria-label'))));
  assert(await page.evaluate(() => { const e = [...document.querySelectorAll('#nxBox,#donRow,#instCard,#wrapAsk')].find(e => !e.hidden && !e.classList.contains('lay-later')); return e.getBoundingClientRect().bottom <= document.querySelector('#stick').getBoundingClientRect().top + 1; }), 'avviso sopra la ricerca');
  await page.screenshot({ path: CFG.OUT + '/layout_a.png' });
  // scorrere col dito: verso sinistra il prossimo, verso destra quello prima; il menu non si apre
  const swipe = async (dx, dy = 0) => {
    const r = await page.evaluate(() => { const e = document.querySelector('[data-lay-swipe]').getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + 30 }; });
    await page.touchscreen.touchStart(r.x, r.y);
    for (let i = 1; i <= 6; i++) { await page.touchscreen.touchMove(r.x + dx * i / 6, r.y + dy * i / 6); await wait(16); }
    await page.touchscreen.touchEnd(); await wait(500);
  };
  const idx = async () => (await page.$eval('#layMore', e => e.getAttribute('aria-label'))).match(/Avviso (\d+) di/)[1];
  assert.strictEqual(await page.$$eval('#layMore i', e => e.length), 3);
  const dots = await page.evaluate(() => { const m = document.querySelector('#layMore'), box = document.querySelector('[data-lay-swipe]'), r = m.getBoundingClientRect(), b = box.getBoundingClientRect(); return { inside: box.contains(m), cx: Math.round(r.left + r.width / 2 - (b.left + b.width / 2)), bottom: Math.round(b.bottom - r.bottom), text: m.innerText.trim() }; });
  console.log('[pallini]', JSON.stringify(dots)); assert(dots.inside && Math.abs(dots.cx) <= 2 && dots.bottom >= 0 && dots.bottom <= 10 && dots.text === '', 'pallini dentro l\'avviso, in basso al centro, senza scritte');
  await swipe(-160); assert.strictEqual(await idx(), '2', 'verso sinistra: il prossimo');
  await swipe(150); assert.strictEqual(await idx(), '1', 'verso destra: quello prima');
  await swipe(150); assert.strictEqual(await idx(), '3', 'in giro');
  await swipe(-30, 160); assert.strictEqual(await idx(), '3', 'in verticale non cambia');
  await swipe(-40); assert.strictEqual(await idx(), '3', 'poco: torna al suo posto');
  assert(!(await page.evaluate(() => document.body.classList.contains('drawer-open'))), 'il menu non si apre');
  assert.strictEqual(await page.evaluate(() => document.querySelector('[data-lay-swipe]').style.transform), '');
  await swipe(-160); assert.strictEqual(await idx(), '1');
  // scorrendo la pagina la barra resta in alto: il pulsante della vista mostra sempre la sua icona
  await page.evaluate(() => window.scrollTo(0, 2000)); await wait(400);
  const ico = await page.evaluate(() => ({ stuck: document.querySelector('#stick').classList.contains('stuck'), svg: getComputedStyle(document.querySelector('#btnView svg')).display }));
  console.log('[barra in alto]', JSON.stringify(ico)); assert(ico.stuck && ico.svg !== 'none', 'icona della vista visibile');
  await page.evaluate(() => window.scrollTo(0, 0)); await wait(300);
  await page.$eval('#layMore', e => e.click()); await wait(500); assert(/Avviso 2 di/.test(await page.$eval('#layMore', e => e.getAttribute('aria-label'))));
  await page.click('#layNav [data-l="wish"]'); await wait(250);
  assert.strictEqual(await page.evaluate(() => window.NL.tab()), 'wish'); assert(await page.$eval('#layNav [data-l="wish"]', e => e.classList.contains('on')));
  assert(/da comprare/.test(await txt('#summary')));
  await page.click('#layNav [data-l="lib"]'); await wait(250);
  await page.click('#layNav [data-l="add"]'); await wait(250);
  assert(await vis('#layAdd')); await page.screenshot({ path: CFG.OUT + '/layout_a_add.png' });
  await page.click('#layAdd [data-l="scan"]'); await wait(150);
  assert.strictEqual(await page.evaluate(() => window.__hit), 'btnScan'); assert(!(await vis('#layAdd')));
  await page.click('#layNav [data-l="add"]'); await wait(250); await page.click('#layAdd [data-l="check"]'); await wait(150);
  assert.strictEqual(await page.evaluate(() => window.__hit), 'btnCheck');
  await page.click('#layNav [data-l="you"]'); await wait(250);
  const you = await txt('#layYouList'); console.log('[A per te]', you);
  assert(/Suggerimenti/.test(you) && /Tutte le citazioni/.test(you) && /Statistiche/.test(you) && /Backup/.test(you));
  await page.screenshot({ path: CFG.OUT + '/layout_a_perte.png' });
  await page.click('#layYou [data-l="stats"]'); await wait(300);
  assert(await vis('#statsSheet')); await page.keyboard.press('Escape'); await wait(250);
  await page.click('#layNav [data-l="menu"]'); await wait(400);
  assert(await page.evaluate(() => document.body.classList.contains('drawer-open'))); await page.evaluate(() => window.__app.closeDrawer()); await wait(350);
  // Opzioni › Aspetto: niente scelta della disposizione (la A e' quella dell'app) ne' degli avvisi uno alla volta, riepilogo
  await page.evaluate(() => window.__app.openOptions('look')); await wait(300);
  assert(await page.evaluate(() => !document.querySelector('#optLayout') && !/Disposizione dello schermo/.test(document.querySelector('#optSheet').innerText)), 'la scelta della disposizione non c\'e\' piu\'');
  assert(await page.evaluate(() => !document.querySelector('#layOne')), 'niente opzione «Avvisi in cima uno alla volta»: e\' sempre cosi\' (16/11/2026)');
  const sumOpts = await page.$$eval('.sum-opts input', e => e.map(x => x.id + (x.checked ? '*' : ''))); console.log('[riepilogo opzioni]', sumOpts.join(' '));
  assert.deepStrictEqual(sumOpts, ['optSumEur', 'optSumLoan*', 'optSumGone', 'optShowSync']);
  await page.screenshot({ path: CFG.OUT + '/layout_opzione.png' });
  await page.click('#optSumEur'); await page.click('#optSumGone'); await page.click('#optSumLoan'); await page.click('#optShowSync'); await wait(250);
  await page.evaluate(() => window.__app.closeOptions()); await wait(350); await page.evaluate(() => window.scrollTo(0, 0));
  sum = await txt('#summary'); console.log('[riepilogo cambiato]', sum);
  assert(/^13 libri · 130,00 € · 1 non più in libreria$/.test(sum));
  assert(await vis('#fltLoan'), 'senza «in prestito» nel riepilogo torna la riga Prestati');
  assert(await vis('#sync'), 'Salvato acceso a mano');
  assert(await page.evaluate(() => !!document.querySelector('.lay-later')), 'avvisi sempre uno alla volta');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')));
  assert(st.sumEur === true && st.sumGone === true && st.sumLoan === false && st.showSync === true);
  // classico: come prima, avvisi al loro posto (sotto la ricerca)
  const pick = async v => { await page.evaluate(v => window.NLLayout.set(v), v); await wait(350); await page.evaluate(() => window.scrollTo(0, 0)); };   // la classica resta solo per le prove
  await pick('classico');
  assert(await vis('#btnStats') && await vis('#tabLib') && await vis('.dock') && !(await vis('#layNav')));
  assert(await page.evaluate(() => document.querySelector('#nxBox').compareDocumentPosition(document.querySelector('#stick')) & Node.DOCUMENT_POSITION_PRECEDING), 'nxBox di nuovo sotto la ricerca');
  await page.screenshot({ path: CFG.OUT + '/layout_classico.png' });
  await pick('a');
  // la scelta resta dopo la riapertura
  await page.reload({ waitUntil: 'load' }); await wait(700);
  assert.strictEqual(await page.evaluate(() => document.documentElement.dataset.layout), 'a');
  assert.deepStrictEqual(errors, []);
  // senza modulo: classica
  noMod = true;
  const ctx2 = await browser.createBrowserContext(); const p2 = await ctx2.newPage(); const err2 = []; p2.on('pageerror', e => err2.push(e.message));
  await p2.goto('http://localhost:' + CFG.port(8185) + '/', { waitUntil: 'load' }); await wait(700);
  const st2 = await p2.evaluate(() => ({ lay: document.documentElement.dataset.layout || '', nav: !!document.getElementById('layNav'), stats: getComputedStyle(document.querySelector('#btnStats')).display }));
  console.log('[senza modulo]', JSON.stringify(st2)); assert(!st2.lay && !st2.nav && st2.stats !== 'none'); assert.deepStrictEqual(err2, []);
  console.log('e2e65 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
