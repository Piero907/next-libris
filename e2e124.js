const CFG = require("./_config");
const H = require('./_harness');
// moduli: amici, guida
// Giro 5 (18/11/2026), interfaccia, scelte di Piero:
// 1) X nella casella di ricerca: cancella solo il testo, i filtri restano;
// 2) bandiere come piccole immagini dell'app (vendor/flags), non emoji: si scaricano solo quelle che servono;
// 3) film nella scheda del libro, sezione «Dal libro» (🎬/📺, anno, regia, › verso Wikipedia);
// 4) Ricerca dei libri: Google Libri sopra il worker, sezioni richiudibili (stato, due righe, «Come si crea…»), «Prestata da …»;
//    «Presta a un amico» con il contatore degli amici; 5) testo della finestra «Chiave Google e worker»;
// 8) chiave Google coperta nel campo («AIza…7Gt») con «Mostra».
// (6 e 7, guida di 8 schermate e mostrata una volta a chi usa già l'app: e2e123.)
// Con SCHERMATE=cartella: ricerca con la X, Ricerca dei libri chiusa e aperta, scheda con i film, gruppi per paese.
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path');
const assert = require('assert');
const server = H.serve(CFG.port(8324));
const base = 'http://localhost:' + CFG.port(8324);
const SHOTS = process.env.SCHERMATE ? path.resolve(process.env.SCHERMATE) : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const V = JSON.parse(fs.readFileSync(path.join(CFG.APP, 'version.json'), 'utf8')).v;
const B = o => Object.assign({ id: 'x', t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 1, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: 'da', rt: 0, rd: '' }, o);
const books = [
  B({ id: 'g1', t: 'Il Gattopardo', a: 'Giuseppe Tomasi di Lampedusa', ts: 9, rs: 'letto' }),
  B({ id: 'e1', t: 'Il nome della rosa', a: 'Umberto Eco', ts: 8 }),
  B({ id: 'n1', t: 'Lolita', a: 'Vladimir Nabokov', ts: 7 }),
  B({ id: 'c1', t: 'Palomar', a: 'Italo Calvino', ts: 6 }),
];
const KEY = 'AIzaSyA1b2C3d4E5f6G7h8I9j0KlMnOpQr7Gt';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const wait = H.wait;
  const p = await (await browser.createBrowserContext()).newPage();
  await p.setViewport({ width: 360, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  p.on('pageerror', e => errors.push(e.message));
  await p.evaluateOnNewDocument((b, V, KEY) => {
    window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (localStorage.getItem('e2e124')) return; localStorage.setItem('e2e124', '1');
    localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 }));
    localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), price: false, name: 'Piero R.', welcomed: 1, donSeen: 1, viewDef: 'list', seenV: V, wn2: 1, gbKey: KEY }));
    localStorage.setItem('catalogo-libri-layout', JSON.stringify({ v: 'a' })); localStorage.setItem('catalogo-libri-card', JSON.stringify({ v: 'd' }));
  }, books, V, KEY);
  const outside = [];
  await p.setRequestInterception(true);
  p.on('request', r => { const u = r.url(); if (u.startsWith(base)) return r.continue(); outside.push(u); r.respond({ status: 404, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' }); });
  const hideAll = () => p.evaluate(() => { document.querySelectorAll('.sheet:not([hidden])').forEach(x => { x.hidden = true; }); ['#instCard', '#notice'].forEach(s => { const x = document.querySelector(s); if (x) x.hidden = true; }); });
  const side = () => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await p.goto(base + '/', { waitUntil: 'load' }); await wait(1500); await hideAll();
  // dati di Wikidata già salvati (niente rete): paesi e film
  await p.evaluate(() => {
    const m = wdMap();
    m[wdKey('Giuseppe Tomasi di Lampedusa')] = { q: 'Q1', c: 'IT', t: Date.now(), f: [
      { q: 'F1', t: 'Il Gattopardo', y: 1963, d: 'Luchino Visconti', u: 'https://it.wikipedia.org/wiki/Il_Gattopardo_(film)', k: [L.titleKey('Il Gattopardo')] },
      { q: 'F2', t: 'Il Gattopardo', y: 2025, s: 1, k: [L.titleKey('Il Gattopardo')] }] };
    m[wdKey('Umberto Eco')] = { q: 'Q2', c: 'IT', t: Date.now(), f: [] };
    m[wdKey('Vladimir Nabokov')] = { q: 'Q3', c: 'US', b: 'RU', t: Date.now(), f: [] };
    m[wdKey('Italo Calvino')] = { q: 'Q4', c: 'IT', b: 'CU', t: Date.now(), f: [] };
    renderList();
  }); await wait(300);

  // 1) X nella ricerca: compare con il testo, cancella solo il testo, i filtri restano
  assert.strictEqual(await p.$eval('#qX', e => e.hidden), true, 'senza testo niente X');
  await p.evaluate(() => { flt = 'unread'; }); // un filtro acceso
  await p.type('#q', 'rosa'); await wait(300);
  assert.strictEqual(await p.$eval('#qX', e => e.hidden), false, 'con il testo c\'è la X');
  const box = await p.evaluate(() => { const i = document.getElementById('q').getBoundingClientRect(), x = document.getElementById('qX').getBoundingClientRect(); return { inside: x.left >= i.left && x.right <= i.right + 0.5 && x.top >= i.top - 1 && x.bottom <= i.bottom + 1, w: x.width }; });
  assert(box.inside && box.w >= 40, 'X dentro la casella, a destra: ' + JSON.stringify(box));
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'ricerca-x-360.png') });
  await p.click('#qX'); await wait(300);
  const after = await p.evaluate(() => ({ q: q, val: document.getElementById('q').value, flt: flt, x: document.getElementById('qX').hidden }));
  assert.deepStrictEqual(after, { q: '', val: '', flt: 'unread', x: true }, 'la X toglie solo il testo');
  await p.evaluate(() => { flt = ''; renderList(); updateSummary(); }); await wait(200);
  // la X segue anche il testo messo dall'app (es. «Libri di …»)
  await p.evaluate(() => { q = 'Eco'; document.getElementById('q').value = 'Eco'; renderList(); }); await wait(200);
  assert.strictEqual(await p.$eval('#qX', e => e.hidden), false, 'X anche con il testo messo dall\'app');
  await p.click('#qX'); await wait(200);

  // 2) bandiere: immagini dell'app, solo quelle dei paesi presenti
  await p.evaluate(() => { const s = document.querySelector('#grp'); s.value = 'pae'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(600);
  const fl = await p.evaluate(() => [...document.querySelectorAll('#list .gc-flag img.flag')].map(i => i.getAttribute('src') + ':' + (i.complete && i.naturalWidth > 0)));
  console.log('[bandiere]', fl.join(' '));
  assert.deepStrictEqual(fl.sort(), ['vendor/flags/it.webp:true', 'vendor/flags/us.webp:true']);
  const loaded = await p.evaluate(() => performance.getEntriesByType('resource').map(r => r.name).filter(n => /\/vendor\/flags\//.test(n)).map(n => n.split('/').pop()).sort());
  assert(loaded.every(n => n === 'it.webp' || n === 'us.webp'), 'scaricate solo le bandiere che servono: ' + loaded.join(','));
  assert.strictEqual(await p.evaluate(() => /[\u{1F1E6}-\u{1F1FF}]/u.test(document.getElementById('list').textContent)), false, 'niente emoji delle bandiere');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'gruppi-paese-360.png') });
  await p.evaluate(() => { openAuthor('n1', 'Vladimir Nabokov'); }); await wait(600);
  const au = await p.$eval('#auPa', e => ({ t: e.textContent.replace(/\s+/g, ' ').trim(), img: [...e.querySelectorAll('img.flag')].map(i => i.getAttribute('src')) }));
  assert.strictEqual(au.t, 'Paese: Stati Uniti (nascita: Russia) Correggi');
  assert.deepStrictEqual(au.img, ['vendor/flags/us.webp', 'vendor/flags/ru.webp'], 'bandiere in Info Autore');
  await hideAll();
  await p.evaluate(() => { const s = document.querySelector('#grp'); s.value = ''; s.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(400);

  // 3) film nella scheda: «Dal libro», un tocco apre Wikipedia
  await p.evaluate(() => { showBook('g1'); }); await wait(700);
  const fb = await p.$eval('#list .filmbox[data-film="g1"]', e => ({ txt: e.textContent.replace(/\s+/g, ' ').trim(), rows: [...e.querySelectorAll('.fl-row')].map(r => r.tagName + ':' + (r.getAttribute('href') || '') + ':' + Math.round(r.getBoundingClientRect().height)) }));
  console.log('[film]', fb.txt, JSON.stringify(fb.rows));
  assert.strictEqual(fb.txt, 'Dal libro🎬Il Gattopardo — film, 1963 · regia di L. Visconti›📺Il Gattopardo — serie TV, 2025');
  assert(/^A:https:\/\/it\.wikipedia\.org\/wiki\/Il_Gattopardo_\(film\):(\d+)$/.test(fb.rows[0]) && +fb.rows[0].split(':').pop() >= 44, 'riga del film: link a Wikipedia, alta almeno 44 px');
  assert(/^DIV::/.test(fb.rows[1]), 'serie senza voce italiana: niente link');
  assert(await side() <= 0, 'scheda con i film senza scorrimento di lato');
  if (SHOTS) { await p.$eval('#list .filmbox[data-film="g1"]', e => e.scrollIntoView({ block: 'center' })); await wait(200); await p.screenshot({ path: path.join(SHOTS, 'film-dal-libro-360.png') }); }
  await p.evaluate(() => { Object.keys(openState).forEach(k => { openState[k] = false; }); renderList(); }); await wait(300);

  // 4) Ricerca dei libri: Google sopra il worker, sezioni chiuse, stato e guida
  await p.evaluate(() => window.NL.openOptions('search')); await wait(500);
  const rs = await p.evaluate(() => {
    const sec = document.querySelector('[data-sec="search"]'), k = document.getElementById('svcKey'), s = document.getElementById('svcSbn');
    return { order: !!(k.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING), kOpen: !document.getElementById('svcKeyB').hidden, sOpen: !document.getElementById('svcSbnB').hidden,
      kSt: document.getElementById('gbSt').textContent, sSt: document.getElementById('sbnSt').textContent, kGuide: !document.getElementById('gbGuide').hidden, sGuide: !document.getElementById('sbnGuide').hidden,
      kDesc: k.querySelector('.svc-desc').textContent, exp: k.querySelector('.svc-tog').getAttribute('aria-expanded'), txt: sec.innerText };
  });
  console.log('[ricerca]', JSON.stringify({ kSt: rs.kSt, sSt: rs.sSt, kGuide: rs.kGuide, sGuide: rs.sGuide }));
  assert(rs.order, 'Google Libri sopra il worker');
  assert(!rs.kOpen && !rs.sOpen && rs.exp === 'false', 'sezioni chiuse');
  assert.strictEqual(rs.kSt, 'In uso'); assert.strictEqual(rs.sSt, 'Non impostato');
  assert(!rs.kGuide && rs.sGuide, 'la guida solo dove manca (qui il worker)');
  assert.strictEqual(rs.kDesc, 'Trova titoli, copertine e descrizioni nell\'archivio di Google. Senza chiave l\'app usa solo Open Library e trova meno libri.');
  assert(!rs.txt.includes(KEY), 'la chiave non si vede');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'ricerca-chiusa-360.png') });
  // aperta: chiave coperta, «Mostra», tocco sul campo
  await p.click('#svcKey .svc-tog'); await wait(200);
  let f = await p.evaluate(() => ({ open: !document.getElementById('svcKeyB').hidden, exp: document.querySelector('#svcKey .svc-tog').getAttribute('aria-expanded'), v: document.getElementById('gbKey').value, ro: document.getElementById('gbKey').readOnly, show: document.getElementById('gbShow').textContent }));
  assert.deepStrictEqual(f, { open: true, exp: 'true', v: 'AIza…7Gt', ro: true, show: 'Mostra' }, 'chiave coperta');
  assert(await side() <= 0, 'ricerca aperta senza scorrimento di lato');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'ricerca-aperta-360.png') });
  await p.click('#gbShow'); await wait(150);
  f = await p.evaluate(() => ({ v: document.getElementById('gbKey').value, ro: document.getElementById('gbKey').readOnly, show: document.getElementById('gbShow').textContent }));
  assert.deepStrictEqual(f, { v: KEY, ro: false, show: 'Nascondi' }, '«Mostra» scopre la chiave');
  await p.click('#gbShow'); await wait(150);
  assert.strictEqual(await p.$eval('#gbKey', e => e.value), 'AIza…7Gt', '«Nascondi» la copre');
  // una change sul campo coperto non tocca la chiave
  await p.evaluate(() => document.getElementById('gbKey').dispatchEvent(new Event('change')));
  assert.strictEqual(await p.evaluate(() => window.NL.settings.gbKey), KEY, 'chiave intatta');
  await p.click('#svcKey .svc-tog'); await wait(150);
  assert.strictEqual(await p.$eval('#svcKeyB', e => e.hidden), true, 'si richiude');
  // «Come si crea il worker»: apre la sezione e i passi
  await p.click('#sbnGuide'); await wait(300);
  assert(await p.evaluate(() => !document.getElementById('svcSbnB').hidden && document.getElementById('sbnHow').open), 'la guida del worker apre la sezione e i passi');
  // prestata da un amico
  await p.evaluate(() => {
    localStorage.setItem('catalogo-libri-amici-chiavi-mie', JSON.stringify({ gb: '', sbn: '' }));
    localStorage.setItem('catalogo-libri-amici-chiave-in-uso', JSON.stringify({ da: 'uS', nome: 'Serena B.', gb: 'AIzaDiSerena00000000', sbn: '' }));
    window.NL.settings.gbKey = 'AIzaDiSerena00000000'; window.NL.saveSettings(); renderSvc();
  }); await wait(100);
  const lent = await p.evaluate(() => ({ st: document.getElementById('gbSt').textContent, on: document.getElementById('gbSt').classList.contains('on'), show: document.getElementById('gbShow').hidden, guide: !document.getElementById('gbGuide').hidden }));
  assert.deepStrictEqual(lent, { st: 'Prestata da Serena B.', on: true, show: true, guide: true }, 'chiave prestata');
  await hideAll();

  // 5) finestra «Chiave Google e worker»: testo approvato e contatore
  await p.evaluate(() => window.NLAmici.keys()); await wait(400);
  const kw = await p.$eval('#kwBody', e => e.innerText.replace(/\s+/g, ' '));
  assert(kw.startsWith('Una chiave Google Libri fa 1.000 ricerche al giorno. Con un uso normale bastano per te e per decine di amici. Il primo giorno, quando un amico carica la sua libreria, ne consuma di più: puoi aiutare fino a 6 amici nuovi al giorno (50 libri ciascuno). Il worker ne regge migliaia.'), 'testo della finestra: ' + kw);
  assert.deepStrictEqual(await p.evaluate(() => [0, 1, 2].map(n => window.NLAmici.lentText(n))), ['Non la usa ancora nessun amico', 'La usa 1 amico', 'La usano 2 amici']);
  assert.strictEqual(await p.evaluate(() => window.NLAmici.lentCount()), -1, 'senza account il contatore non si mostra');
  await hideAll();

  assert.deepStrictEqual(errors, []);
  console.log('e2e124 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
