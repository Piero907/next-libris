const CFG = require('./_config');
const H = require('./_harness');
// Pezzo 3 (20/11/2026): dall'app sono usciti i pezzi delle vecchie disposizioni. Resta lo stile G.
// - nella pagina non ci sono più: vecchia testata (nome, riepilogo, «Salvato su questo telefono», boccale, ingranaggio), schede
//   Libreria/Desideri e «Prestati», barra Scansiona/Foto/Digita, barra in basso, linguetta del menu, triangolino degli avvisi;
// - testatina, titolo, nastro e frase stanno già in index.html; Filtri e copertine/elenco nella riga dell'ordine;
// - ≡ Indice apre l'Indice con le Impostazioni aperte; la frase dei prestiti filtra i libri in prestito;
// - Aspetto: via «Riepilogo in alto»; resta «Riepilogo di ogni stagione», in fondo;
// - salvataggio non riuscito: avviso in cima con «Fai il backup», solo quando serve; sparisce quando il salvataggio torna a riuscire;
// - un avviso chiuso con la × non lascia nessun triangolino.
const puppeteer = require('puppeteer-core');
const assert = require('assert');
const server = H.serve(CFG.port(8338), CFG.APP);
const APP = 'http://localhost:' + CFG.port(8338);
const wait = H.wait;
const today = new Date().toISOString().slice(0, 10);
const books = Array.from({ length: 6 }, (_, i) => ({ id: 'k' + i, t: 'Libro numero ' + i, a: 'Autore ' + i, ts: Date.now() - i * 864e5, rs: i === 0 ? 'in' : 'da', p: i === 2 ? 'Anna' : '', pd: i === 2 ? today : '' }));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await browser.newPage();
  await p.setViewport({ width: 360, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(APP + '/', { waitUntil: 'load' });
  await p.evaluate((b) => { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: Date.now() })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'Piero', lastBackup: Date.now(), sumGone: true, showSync: true, syncOff: 1 })); localStorage.setItem('catalogo-libri-guida', JSON.stringify({ v: 99, path: 0 })); const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/^catalogo-libri-(v2|set|guida)$/.test(k)) return; return o.call(this, k, v); }; }, books);   // fino al ricaricamento l'app non riscrive i dati di prova
  await p.reload({ waitUntil: 'load' }); await wait(900);
  await p.evaluate(() => { if (window.NLGuida && window.NLGuida.close) window.NLGuida.close(); document.querySelectorAll('.sheet:not([hidden])').forEach(x => { x.hidden = true; }); }); await wait(200);

  // 1) i pezzi vecchi non esistono; quelli dello stile G sono nella pagina
  const dom = await p.evaluate(() => ({
    old: ['#owner', '#summary', '.top-meta', '#sync', '#btnBeer', '#btnOpts', '#btnFri', '.tabbar', '#tabLib', '#tabWish', '#fltLoan', '.dock', '#btnScan', '#btnPhoto', '#btnType', '#btnCheck', '#btnStats', '#btnExport', '#layNav', '#edgeTab', '.sum-alert', '#guestIcos'].filter(s => document.querySelector(s)),
    cls: document.documentElement.className, lay: document.documentElement.dataset.layout,
    head: ['#gHead', '#gRun', '#gIcs', '#gMenu', '#gRib', '#gProse', '#gTabs', '#gAdd'].filter(s => !document.querySelector(s)),
    bar: [...document.getElementById('sortBar').children].filter(e => e.id === 'btnFilters' || e.id === 'btnView').map(e => e.id),
    title: document.querySelector('header.top h1 .g-t').textContent, h1: document.querySelector('header.top h1').innerText.trim(),
    rib: document.querySelector('#gRib b').textContent, prose: document.getElementById('gProse').textContent,
    api: ['get', 'set', 'list'].filter(k => window.NLLayout[k]), side: document.scrollingElement.scrollWidth - innerWidth }));
  console.log('[1 pagina]', JSON.stringify(dom));
  assert.deepStrictEqual(dom.old, [], 'pezzi delle vecchie disposizioni ancora nella pagina');
  assert.deepStrictEqual(dom.head, [], 'pezzi dello stile G');
  assert(/\bg-look\b/.test(dom.cls) && dom.lay === 'a');
  assert.deepStrictEqual(dom.bar, ['btnFilters', 'btnView'], 'Filtri e copertine/elenco nella riga dell\'ordine');
  assert.strictEqual(dom.title, 'Libreria'); assert(/^Libreria/.test(dom.h1), 'il titolo si legge una volta sola: ' + dom.h1);
  assert.strictEqual(dom.rib, '6'); assert(/Stai leggendo Libro numero 0; 1 è in prestito\./.test(dom.prose), dom.prose);
  assert.deepStrictEqual(dom.api, [], 'niente più scelta della disposizione'); assert(dom.side <= 0, 'niente scorrimento di lato');

  // 2) ≡ Indice: si apre con le Impostazioni aperte (come faceva l'ingranaggio)
  await p.click('#gMenu'); await wait(500);
  const idx = await p.evaluate(() => ({ open: document.body.classList.contains('drawer-open') || document.documentElement.classList.contains('drawer-open'), h: document.getElementById('drawerH').textContent,
    look: (() => { const b = document.querySelector('#drawerOpts [data-sec="look"]'); return !!(b && b.getClientRects().length); })() }));
  console.log('[2 indice]', JSON.stringify(idx)); assert(idx.open && idx.h === 'Indice' && idx.look, 'Indice con «Aspetto» in vista');
  await p.evaluate(() => window.NL.closeDrawer()); await wait(400);

  // 3) la frase dei prestiti filtra; un altro tocco li rimette tutti
  await p.click('#gProse [data-gl="loan"]'); await wait(300);
  assert.strictEqual(await p.evaluate(() => window.NL.flt()), 'loan'); assert.deepStrictEqual(await p.$$eval('#list [data-id]', e => e.map(x => x.dataset.id)), ['k2']);
  await p.click('#gProse [data-gl="loan"]'); await wait(300);
  assert.strictEqual(await p.evaluate(() => window.NL.flt()), ''); assert.strictEqual(await H.prestiti(p), '1');

  // 4) Aspetto: via «Riepilogo in alto»; resta la stagione in libri, in fondo
  await p.evaluate(() => window.__app.openOptions('look')); await wait(400);
  const look = await p.evaluate(() => { const sec = document.querySelector('#optSheet .opt-sec[data-sec="look"]'), w = document.getElementById('optWrap');
    return { old: ['#optSumLoan', '#optSumGone', '#optSumEur', '#optShowSync', '.sum-opts'].filter(s => document.querySelector(s)), txt: /Riepilogo in alto|Conferma del salvataggio/.test(sec.innerText),
      wrap: !!(w && w.closest('label') === sec.lastElementChild && w.getClientRects().length), left: !!document.getElementById('optGLeft'), side: sec.scrollWidth - sec.clientWidth }; });
  console.log('[4 aspetto]', JSON.stringify(look));
  assert(!look.old.length && !look.txt && look.wrap && look.left && look.side <= 0, 'Aspetto senza le opzioni del vecchio riepilogo');
  await p.evaluate(() => window.__app.closeOptions()); await wait(300);

  // 5) salvataggio non riuscito: avviso in cima, solo quando serve
  assert(await p.$eval('#notice', e => e.hidden), 'di partenza nessun avviso');
  await p.evaluate(() => { const o = Storage.prototype.setItem; window.__pieno = true; Storage.prototype.setItem = function (k, v) { if (window.__pieno && /catalogo-libri-v2$/.test(k)) throw new DOMException('pieno', 'QuotaExceededError'); return o.call(this, k, v); }; });
  await p.evaluate(() => { const b = window.NL.books()[1]; b.n = 'una nota'; window.NL.save(); }); await wait(800);
  const ko = await p.evaluate(() => { const n = document.getElementById('notice'), b = document.getElementById('noticeBtn'), r = n.getBoundingClientRect(), tb = document.getElementById('gTabs').getBoundingClientRect();
    return { vis: !n.hidden && r.height > 0, txt: document.getElementById('noticeTxt').textContent, btn: b.hidden ? '' : b.textContent, fuori: r.right <= tb.left + 1 || innerWidth >= 700, later: n.classList.contains('lay-later') }; });
  console.log('[5 non salva]', JSON.stringify(ko));
  assert(ko.vis && !ko.later && /Non riesco a salvare/.test(ko.txt) && /backup/.test(ko.txt) && ko.btn === 'Fai il backup' && ko.fuori, 'avviso del salvataggio non riuscito');
  if (process.env.SCHERMATE) await p.screenshot({ path: require('path').join(process.env.SCHERMATE, 'salvataggio-360.png') });
  await p.click('#noticeX'); await wait(200); assert(await p.$eval('#notice', e => e.hidden), 'la × lo chiude');
  assert(!(await p.$('.sum-alert, [data-sum="alert"]')), 'nessun triangolino per riaprirlo');
  await p.evaluate(() => { window.NL.books()[1].n = 'un\'altra nota'; window.NL.save(); }); await wait(800);
  assert(!(await p.$eval('#notice', e => e.hidden)), 'al salvataggio successivo, se ancora non riesce, torna');
  await p.evaluate(() => { window.__pieno = false; window.NL.books()[1].n = 'ora si salva'; window.NL.save(); }); await wait(800);
  assert(await p.$eval('#notice', e => e.hidden), 'quando il salvataggio riesce l\'avviso sparisce da solo');
  assert(/ora si salva/.test(await p.evaluate(() => localStorage.getItem('catalogo-libri-v2'))));

  // 6) «+ Aggiungi» › Digita e Fotografa partono davvero (senza i tasti di prima)
  await H.aggiungi(p, 'type'); await wait(300); assert(await p.evaluate(() => { const s = document.getElementById('isbnSheet'); return !!s && !s.hidden; }), '«Titolo o ISBN» aperta');
  await p.evaluate(() => { document.querySelectorAll('.sheet:not([hidden])').forEach(x => { x.hidden = true; }); }); await wait(200);
  await H.aggiungi(p, 'photo'); await wait(300); assert(!(await p.$eval('#photoSheet', e => e.hidden)), 'finestra della foto aperta');

  assert.deepStrictEqual(errors, []);
  console.log('e2e138 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
