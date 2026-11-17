const CFG = require("./_config");
const H = require('./_harness');
// 17/11/2026 pomeriggio, prova 101.3. Richieste di Piero:
// 1) «In prestito» sulla copertina di un libro ricevuto in prestito da un amico.
// 2) boccale di birra nella testata: apre Sostieni.
// 3) «Raggruppa per» (Autore, Genere, Genere poi autore, Lettura) nelle copertine e nell'elenco; gruppi chiusi di partenza,
//    aperti con un tocco e ricordati; nei Desideri niente gruppi per lettura.
// 4) la vista resta la stessa dopo un'azione sul libro: nei Desideri, libro aperto dalle copertine ed eliminato → di nuovo copertine.
// 5) Privacy in una finestra dentro l'app; la × torna al Menu.
// 6) «Cosa c'è di nuovo»: se il registro non arriva, la versione non si segna come vista e la finestra compare alla volta dopo.
// Con SCHERMATE=cartella: foto dei gruppi (412 e 360 scuro), della testata e della privacy.
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = H.MIME;
let regOk = false;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname), m = p.match(/^\/next-libris-prova(\/.*)?$/);
  if (!m) { res.writeHead(404); return res.end(); }
  if (!m[1]) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
  if (m[1] === '/REGISTRO_MODIFICHE.md' && !regOk) { res.writeHead(503); return res.end('giù'); }
  const f = path.join(ROOT, m[1] === '/' ? '/index.html' : m[1]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
}).listen(CFG.port(8315));
const base = 'http://localhost:' + CFG.port(8315);
const SHOTS = process.env.SCHERMATE ? path.resolve(process.env.SCHERMATE) : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const V = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).v;
const B = o => Object.assign({ id: 'x', t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 1, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: '', rt: 0, rd: '' }, o);
const books = [
  B({ id: 'b1', t: 'Il nome della rosa', a: 'Umberto Eco', gen: 'Romanzo', rs: 'ok', ts: 10 }),
  B({ id: 'b2', t: 'Il pendolo di Foucault', a: 'Umberto Eco', gen: 'Romanzo', rs: 'in', ts: 9 }),
  B({ id: 'b3', t: 'Se una notte d\'inverno un viaggiatore', a: 'Italo Calvino', gen: 'Romanzo', rs: 'da', ts: 8 }),
  B({ id: 'b4', t: 'Lezioni americane', a: 'Italo Calvino', gen: 'Saggio', ts: 7 }),
  B({ id: 'b5', t: 'Sapiens', a: 'Yuval Noah Harari', gen: 'Saggio', rs: 'ok', ts: 6 }),
  B({ id: 'b6', t: 'Libro senza genere né autore', ts: 5 }),
  B({ id: 'b7', t: 'Il barone rampante', a: 'Italo Calvino', gen: 'Romanzo', ts: 4, sk: 'p', sda: 'Anna', sid: 's1' }),
  B({ id: 'w1', t: 'Desiderio uno', a: 'Elsa Morante', gen: 'Romanzo', w: true, ts: 3 }),
  B({ id: 'w2', t: 'Desiderio due', a: 'Primo Levi', gen: 'Memorie', w: true, ts: 2 }),
];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const wait = H.wait;
  async function phone(w, h, dark, extra) {
    const page = await (await browser.createBrowserContext()).newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 700, hasTouch: w < 700 });
    page.on('pageerror', e => errors.push(w + ': ' + e.message));
    await page.evaluateOnNewDocument((b, x) => {
      window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
      if (localStorage.getItem('prova:e2e115')) return; localStorage.setItem('prova:e2e115', '1');
      localStorage.setItem('prova:catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 }));
      localStorage.setItem('prova:catalogo-libri-set', JSON.stringify(Object.assign({ lastBackup: Date.now(), price: false, name: 'Piero R.', welcomed: 1, donSeen: 1, viewDef: 'grid', look: 'nuovo' }, x)));
      localStorage.setItem('prova:catalogo-libri-layout', JSON.stringify({ v: 'a' })); localStorage.setItem('prova:catalogo-libri-card', JSON.stringify({ v: 'd' }));
    }, books, extra || {});
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) ? r.continue() : r.respond({ status: 200, contentType: 'application/json', body: '{"totalItems":0}' }));
    await page.goto(base + '/next-libris-prova/', { waitUntil: 'load' }); await wait(1500);
    await page.evaluate((d) => {
      document.querySelectorAll('.sheet:not([hidden])').forEach(x => { x.hidden = true; });
      ['#instCard', '#notice'].forEach(s => { const x = document.querySelector(s); if (x) x.hidden = true; });
      if (d) document.documentElement.setAttribute('data-theme', 'dark');
    }, dark); await wait(300);
    return page;
  }
  const set = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('prova:catalogo-libri-set')));
  const groups = (p) => p.evaluate(() => [...document.querySelectorAll('#list > .shelf.grp')].map(s => {
    const h = s.querySelector(':scope > .shelf-h');
    return { t: h.querySelector('.sh-t').textContent, n: +h.querySelector('.sh-n').textContent, open: h.getAttribute('aria-expanded') === 'true',
      sub: [...s.querySelectorAll(':scope > .shelf-b > .shelf.grp-sub > .shelf-h .sh-t')].map(x => x.textContent) };
  }));
  const pick = async (p, v) => { await p.evaluate((v) => { const s = document.getElementById('grp'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }, v); await wait(300); };

  // ---------- 412x915 ----------
  let p = await phone(412, 915, false, { seenV: V, wn2: 1 });
  // 1) «In prestito» sulla copertina del libro ricevuto
  const bd = await p.evaluate(() => { const c = document.querySelector('#list .cover[data-id="b7"] .badge'); return c && c.textContent; });
  console.log('[1 copertina ricevuta]', bd); assert.strictEqual(bd, 'In prestito');
  // 2) boccale nella testata → Sostieni
  const beer = await p.evaluate(() => { const b = document.getElementById('btnBeer'), r = b.getBoundingClientRect(), h = document.querySelector('.top h1').getBoundingClientRect();
    return { vis: r.width > 0, y: Math.round(r.top + r.height / 2 - (h.top + h.height / 2)), gap: Math.round(r.left - h.right) }; });
  console.log('[2 boccale]', JSON.stringify(beer)); assert(beer.vis && Math.abs(beer.y) <= 3 && beer.gap >= 0, 'boccale sulla riga del titolo, senza toccarlo');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'testata-412.png'), clip: { x: 0, y: 0, width: 412, height: 140 } });
  await p.click('#btnBeer'); await wait(400);
  assert(await p.evaluate(() => !document.getElementById('donSheet').hidden), 'Sostieni aperto dal boccale');
  await p.click('#donClose'); await wait(400);
  // 3) Raggruppa per autore: gruppi chiusi, in ordine, «Senza autore» in fondo
  await pick(p, 'aut');
  let g = await groups(p); console.log('[3 autore]', JSON.stringify(g));
  assert.deepStrictEqual(g.map(x => x.t), ['Italo Calvino', 'Umberto Eco', 'Yuval Noah Harari', 'Senza autore']);
  assert.deepStrictEqual(g.map(x => x.n), [3, 2, 1, 1]);
  assert(g.every(x => !x.open), 'chiusi di partenza');
  await p.click('#list > .shelf.grp:first-child > .shelf-h'); await wait(300);
  g = await groups(p); assert(g[0].open && !g[1].open, 'aperto con un tocco');
  assert.strictEqual(await p.evaluate(() => document.querySelectorAll('#list > .shelf.grp:first-child .grid .cover').length), 3, 'copertine nel gruppo');
  assert((await set(p)).grp === 'aut' && Object.keys((await set(p)).grpOpen).length === 1, 'scelta e gruppo aperto ricordati');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'gruppi-autore-412.png') });
  // nell'elenco gli stessi gruppi
  await p.click('#btnView'); await wait(400);
  g = await groups(p); assert(g[0].open && g.length === 4, 'elenco con gli stessi gruppi');
  assert.strictEqual(await p.evaluate(() => document.querySelectorAll('#list > .shelf.grp:first-child .row').length), 3, 'righe nel gruppo');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'gruppi-autore-elenco-412.png') });
  await p.click('#btnView'); await wait(400);
  // la ricerca apre tutti i gruppi
  await p.evaluate(() => { const q = document.getElementById('q'); q.value = 'il'; q.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(600);
  g = await groups(p); assert(g.length && g.every(x => x.open), 'con la ricerca tutti aperti: ' + JSON.stringify(g));
  await p.evaluate(() => { const q = document.getElementById('q'); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(600);
  // genere, poi autore
  await pick(p, 'genaut');
  await p.evaluate(() => document.querySelectorAll('#list > .shelf.grp > .shelf-h').forEach(h => { if (h.getAttribute('aria-expanded') !== 'true') h.click(); })); await wait(300);
  g = await groups(p); console.log('[3 genere › autore]', JSON.stringify(g));
  assert.deepStrictEqual(g.map(x => x.t), ['Romanzo', 'Saggio', 'Senza genere']);
  assert.deepStrictEqual(g[0].sub, ['Italo Calvino', 'Umberto Eco']);
  assert.deepStrictEqual(g[1].sub, ['Italo Calvino', 'Yuval Noah Harari']);
  await p.click('#list > .shelf.grp:first-child .shelf.grp-sub:first-child > .shelf-h'); await wait(300);
  assert.strictEqual(await p.evaluate(() => document.querySelectorAll('#list > .shelf.grp:first-child .shelf.grp-sub:first-child .cover').length), 2, 'Calvino nei romanzi');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'gruppi-genere-autore-412.png') });
  // lettura (solo Libreria)
  await pick(p, 'read');
  g = await groups(p); console.log('[3 lettura]', JSON.stringify(g.map(x => x.t + ' ' + x.n)));
  assert.deepStrictEqual(g.map(x => x.t), ['In lettura', 'Da leggere', 'Letti']);
  assert.deepStrictEqual(g.map(x => x.n), [1, 4, 2]);
  await p.click('#edgeTab'); await wait(450);
  const sub = await p.evaluate(() => document.getElementById('goFltTxt').textContent); assert(/per lettura/.test(sub), 'riassunto del Menu: ' + sub);
  await p.evaluate(() => history.back()); await wait(500);
  await p.evaluate(() => document.getElementById('tabWish').click()); await wait(400);
  g = await groups(p); assert.strictEqual(g.length, 0, 'nei Desideri niente gruppi per lettura');
  // 4) Desideri a copertine: libro aperto ed eliminato → di nuovo copertine
  await pick(p, '');
  await p.click('#list .cover[data-id="w1"]'); await wait(500);
  assert(await p.evaluate(() => !document.body.classList.contains('gridview')), 'scheda aperta nell\'elenco');
  await p.evaluate(() => document.querySelector('#list [data-id="w1"] [data-act="del"]').click()); await wait(300);   // come Piero: Elimina nella scheda, poi conferma
  await p.evaluate(() => document.getElementById('confirmOk').click()); await wait(500);
  const v4 = await p.evaluate(() => ({ grid: document.body.classList.contains('gridview'), n: document.querySelectorAll('#list .cover').length, st: JSON.stringify(history.state) }));
  console.log('[4 eliminato dalle copertine]', JSON.stringify(v4)); assert(v4.grid && v4.n === 1, 'si torna alle copertine');
  // spostato in Libreria dalle copertine: si resta in copertine
  await p.click('#list .cover[data-id="w2"]'); await wait(500);
  await p.evaluate(() => document.querySelector('#list [data-id="w2"] [data-act="tolib"]').click()); await wait(500);
  assert(await p.evaluate(() => document.body.classList.contains('gridview')), 'dopo lo spostamento si torna alle copertine');
  await p.evaluate(() => document.getElementById('tabLib').click()); await wait(400);
  // 5) Privacy dentro l'app; × torna al Menu
  await p.click('#edgeTab'); await wait(450);
  await p.click('#goInfo'); await wait(300); await p.click('#goPrivacy'); await wait(700);
  const pv = await p.evaluate(() => ({ open: !document.getElementById('optSheet').hidden, h: document.getElementById('optH').textContent, txt: document.getElementById('pvBody').innerText.slice(0, 400),
    h1: !!document.querySelector('#pvBody h1, #pvBody footer'), over: document.querySelector('#optSheet .sheet-in').scrollWidth - document.querySelector('#optSheet .sheet-in').clientWidth }));
  console.log('[5 privacy]', pv.h, '·', pv.txt.slice(0, 80).replace(/\n/g, ' '));
  assert(pv.open && pv.h === 'Privacy' && /Chi gestisce i dati/.test(pv.txt) && !pv.h1 && pv.over <= 0, 'privacy nella finestra');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'privacy-412.png') });
  await p.click('#optClose'); await wait(700);
  assert(await p.evaluate(() => document.getElementById('drawer').classList.contains('open') && document.getElementById('optSheet').hidden), '× della privacy torna al Menu');
  await p.close();

  // ---------- 360 scuro: testata con il boccale e gruppi ----------
  p = await phone(360, 780, true, { seenV: V, wn2: 1, grp: 'aut', grpOpen: { 'aut:lib:italo calvino': 1 } });
  const t3 = await p.evaluate(() => { const h = document.querySelector('.top h1').getBoundingClientRect(), b = document.getElementById('btnBeer').getBoundingClientRect(), o = document.getElementById('btnOpts').getBoundingClientRect();
    return { gap: Math.round(b.left - h.right), right: Math.round(o.right), over: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
  console.log('[360 testata]', JSON.stringify(t3)); assert(t3.gap >= 0 && t3.over <= 0, 'a 360 il titolo non tocca il boccale');
  g = await groups(p); assert(g.length === 4 && g[0].open, 'gruppo aperto ricordato: ' + JSON.stringify(g));
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'gruppi-autore-360-scuro.png') });
  await p.close();

  // ---------- 6) Cosa c'è di nuovo: registro irraggiungibile → si riprova ----------
  regOk = false;
  p = await phone(412, 915, false, { seenV: V - 1, wn2: 1 });
  await wait(1500);
  let wn = await p.evaluate(() => ({ shown: !document.getElementById('wnSheet').hidden, seen: JSON.parse(localStorage.getItem('prova:catalogo-libri-set')).seenV }));
  console.log('[6 registro giù]', JSON.stringify(wn)); assert(!wn.shown && wn.seen === V - 1, 'senza registro la versione non si segna');
  regOk = true;
  await p.reload({ waitUntil: 'load' }); await wait(2500);
  wn = await p.evaluate(() => ({ shown: !document.getElementById('wnSheet').hidden, seen: JSON.parse(localStorage.getItem('prova:catalogo-libri-set')).seenV }));
  console.log('[6 registro su]', JSON.stringify(wn)); assert(wn.shown && wn.seen === V, 'la volta dopo la finestra compare');
  await p.close();

  assert.deepStrictEqual(errors, [], 'errori di pagina: ' + errors.join(' | '));
  console.log('nessun errore di pagina');
  console.log('E2E115 OK');
  await browser.close(); server.close(); process.exit(0);
})().catch(e => { console.error('E2E115 FALLITA', e); process.exit(1); });
