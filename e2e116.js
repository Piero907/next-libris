const CFG = require("./_config");
const H = require('./_harness');
// moduli: amici, layout
// 17/11/2026 sera. Richieste di Piero:
// 1) testi della birra (Piccola/Media/Grande, niente «i libri restano sul telefono»);
// 2) «Ordina per» e «Raggruppa per» con la finestrella dell'app al posto della tendina del telefono;
// 3) × in alto a destra nelle finestre con «Chiudi» (che resta), non nelle richieste con «Annulla»;
// 4) libreria di un amico: Libreria/Desideri dell'amico con due tasti in cima, quelli in basso e «Per te» tornano ai tuoi;
//    «Anna l'ha letto» al posto dei tre tasti; chiave e worker con un'icona sulla riga del nome;
// 5) foto degli autori da Wikipedia nelle copertine dei gruppi, salvate sul telefono.
// Con SCHERMATE=cartella: foto dei gruppi con le foto, della finestrella e della libreria dell'amico.
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const http = require('http');
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname), m = p.match(/^\/next-libris-prova(\/.*)?$/);
  if (!m) { res.writeHead(404); return res.end(); }
  if (!m[1]) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
  const f = path.join(ROOT, m[1] === '/' ? '/index.html' : m[1]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': H.MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
}).listen(CFG.port(8316));
const base = 'http://localhost:' + CFG.port(8316);
const SHOTS = process.env.SCHERMATE ? path.resolve(process.env.SCHERMATE) : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const V = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).v;
const PNG = fs.readFileSync(path.join(CFG.IMG, 'cov_thumb.png'));
const B = o => Object.assign({ id: 'x', t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 1, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: 'da', rt: 0, rd: '' }, o);
const books = [
  B({ id: 'b1', t: 'Il nome della rosa', a: 'Umberto Eco', gen: 'Romanzo', ts: 10 }),
  B({ id: 'b2', t: 'Baudolino', a: 'Umberto Eco', gen: 'Romanzo', ts: 9 }),
  B({ id: 'b3', t: 'Palomar', a: 'Italo Calvino', gen: 'Romanzo', ts: 8 }),
];
let wiki = 0;
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const wait = H.wait;
  const page = await (await browser.createBrowserContext()).newPage();
  const p = page;
  await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  p.on('pageerror', e => errors.push(e.message));
  await p.evaluateOnNewDocument((b, V) => {
    window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (localStorage.getItem('prova:e2e116')) return; localStorage.setItem('prova:e2e116', '1');
    localStorage.setItem('prova:catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 }));
    localStorage.setItem('prova:catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), price: false, name: 'Piero R.', welcomed: 1, donSeen: 1, viewDef: 'grid', look: 'nuovo', seenV: V, wn2: 1, grp: 'aut', gbKey: 'AIzaSyA' + 'x'.repeat(32) }));
    localStorage.setItem('prova:catalogo-libri-layout', JSON.stringify({ v: 'a' })); localStorage.setItem('prova:catalogo-libri-card', JSON.stringify({ v: 'd' }));
  }, books, V);
  await p.setRequestInterception(true);
  p.on('request', r => {
    const u = r.url();
    if (u.startsWith(base)) return r.continue();
    if (/it\.wikipedia\.org\/api\/rest_v1\/page\/summary\/Umberto_Eco/.test(u)) { wiki++; return r.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ type: 'standard', title: 'Umberto Eco', description: 'scrittore italiano', extract: 'Umberto Eco è stato uno scrittore.', thumbnail: { source: 'https://upload.wikimedia.org/eco.png' } }) }); }
    if (/wikipedia\.org/.test(u)) { wiki++; return r.respond({ status: 404, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' }); }
    if (/upload\.wikimedia\.org/.test(u)) return r.respond({ status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: PNG });
    r.respond({ status: 200, contentType: 'application/json', body: '{"totalItems":0}' });
  });
  await p.goto(base + '/next-libris-prova/', { waitUntil: 'load' }); await wait(1500);
  await p.evaluate(() => { document.querySelectorAll('.sheet:not([hidden])').forEach(x => { x.hidden = true; }); ['#instCard', '#notice'].forEach(s => { const x = document.querySelector(s); if (x) x.hidden = true; }); });

  // 5) foto degli autori: Eco da Wikipedia, Calvino con le iniziali; salvate
  await p.waitForFunction(() => document.querySelector('.gcard .gc-img'), { polling: 100, timeout: 8000 });
  const ph = await p.evaluate(() => [...document.querySelectorAll('.gcard')].map(c => c.querySelector('.cap').textContent + ':' + (c.querySelector('.gc-img') ? 'foto' : c.querySelector('.gc-ph b').textContent)));
  console.log('[5 foto]', ph.join(' | '), '· richieste', wiki); assert.deepStrictEqual(ph, ['Italo Calvino:IC', 'Umberto Eco:foto']);
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('prova:catalogo-libri-aufoto')));
  assert(saved['umberto eco'][0] === 'https://upload.wikimedia.org/eco.png' && saved['italo calvino'][0] === '', 'foto salvate: ' + JSON.stringify(saved));
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'gruppi-foto-412.png') });
  const w0 = wiki; await p.reload({ waitUntil: 'load' }); await wait(1200);
  assert(await p.evaluate(() => !!document.querySelector('.gcard .gc-img')) && wiki === w0, 'alla riapertura la foto c\'è già, senza cercarla');
  await p.evaluate(() => { document.querySelectorAll('.sheet:not([hidden])').forEach(x => { x.hidden = true; }); });

  // 1) birra
  await p.click('#btnBeer'); await wait(300);
  const don = await p.evaluate(() => ({ msg: document.querySelector('#donSheet .msg').textContent, amt: [...document.querySelectorAll('.don-amt')].map(x => x.textContent), go: document.getElementById('donGo').textContent, x: !!document.querySelector('#donSheet .sh-x') }));
  console.log('[1 birra]', JSON.stringify(don));
  assert(/offrimi una birra/.test(don.msg) && !/telefono/.test(don.msg) && don.go === 'Offri una media con PayPal' && don.x, 'testi della birra');
  assert.deepStrictEqual(don.amt, ['Piccola2 €', 'Media3 €', 'Grande5 €', 'Altroa scelta']);
  await p.click('.don-amt[data-amt="5"]'); assert.strictEqual(await p.evaluate(() => document.getElementById('donGo').textContent), 'Offri una grande con PayPal');
  await p.click('.don-amt[data-amt=""]'); assert.strictEqual(await p.evaluate(() => document.getElementById('donGo').textContent), 'Offri una birra con PayPal');
  // 3) × in alto a destra: chiude come «Chiudi»
  await p.click('#donSheet .sh-x'); await wait(300);
  assert(await p.evaluate(() => document.getElementById('donSheet').hidden), '× chiude la birra');
  const xs = await p.evaluate(() => Object.fromEntries(['statsSheet', 'logSheet', 'allqSheet', 'exportSheet', 'suggSheet', 'layYou', 'instSheet', 'confirmSheet', 'loanSheet', 'optSheet'].map(id => { const s = document.getElementById(id); return [id, s ? s.querySelectorAll('.sheet-in > .sh-x').length + '/' + [...s.querySelectorAll('button')].filter(b => b.textContent.trim() === '×').length : '-']; })));
  console.log('[3 ×]', JSON.stringify(xs));
  ['statsSheet', 'logSheet', 'allqSheet', 'exportSheet', 'suggSheet', 'layYou', 'instSheet'].forEach(k => assert.strictEqual(xs[k], '1/1', k));
  assert.strictEqual(xs.confirmSheet, '0/0', 'le richieste con Annulla restano senza ×'); assert.strictEqual(xs.optSheet, '0/1', 'Opzioni aveva già la sua ×');
  await p.click('#edgeTab'); await wait(450); await p.click('#goStats'); await wait(500);
  const sx = await p.evaluate(() => { const x = document.querySelector('#statsSheet .sh-x').getBoundingClientRect(), s = document.querySelector('#statsSheet .sheet-in').getBoundingClientRect(); return { right: Math.round(s.right - x.right), top: Math.round(x.top - s.top) }; });
  console.log('[3 × statistiche]', JSON.stringify(sx)); assert(sx.right < 30 && sx.top < 30, '× in alto a destra');
  await p.click('#statsSheet .sh-x'); await wait(600);
  assert(await p.evaluate(() => document.getElementById('statsSheet').hidden && document.getElementById('drawer').classList.contains('open')), '× delle statistiche torna al Menu');

  // 2) finestrella al posto della tendina
  await p.evaluate(() => window.__app.openDrawer('flt')); await wait(500);
  const pk = await p.evaluate(() => ({ sel: [...document.querySelectorAll('select.dsel')].map(s => s.offsetParent === null), btn: [...document.querySelectorAll('.dpick .dp-t')].map(b => b.textContent) }));
  console.log('[2 tasti]', JSON.stringify(pk)); assert(pk.sel.every(Boolean) && pk.btn[0] === 'Più recenti' && pk.btn[1] === 'Autore', 'tendine nascoste, tasti con la scelta');
  await p.evaluate(() => document.querySelectorAll('.dpick')[1].click()); await wait(200);
  const pop = await p.evaluate(() => ({ o: [...document.querySelectorAll('#pickPop .pk-o')].map(x => x.textContent + (x.getAttribute('aria-selected') === 'true' ? '*' : '')), focus: document.activeElement.textContent }));
  console.log('[2 finestrella]', JSON.stringify(pop)); assert.deepStrictEqual(pop.o, ['Nessun gruppo', 'Autore*', 'Genere', 'Genere, poi autore', 'Lettura']);
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'finestrella-412.png') });
  await p.evaluate(() => [...document.querySelectorAll('#pickPop .pk-o')][2].click()); await wait(300);
  const af = await p.evaluate(() => ({ v: document.getElementById('grp').value, g: JSON.parse(localStorage.getItem('prova:catalogo-libri-set')).grp, t: document.querySelectorAll('.dpick .dp-t')[1].textContent, hid: document.getElementById('pickPop').hidden }));
  assert(af.v === 'gen' && af.g === 'gen' && af.t === 'Genere' && af.hid, 'scelta fatta: ' + JSON.stringify(af));
  await p.evaluate(() => document.querySelectorAll('.dpick')[0].click()); await wait(200);
  await p.keyboard.press('Escape'); await wait(200);
  assert(await p.evaluate(() => document.getElementById('pickPop').hidden && document.getElementById('drawer').classList.contains('open')), 'Esc chiude solo la finestrella');
  await p.evaluate(() => window.__app.closeDrawer()); await wait(400);

  // 4) libreria di un amico
  await p.evaluate(() => NL.guestEnter('Anna', [
    { id: 'g1', t: 'Il deserto dei Tartari', a: 'Dino Buzzati', gen: 'Romanzo', rs: 'in', pg: 250, pp: 80, ts: 5 },
    { id: 'g2', t: 'Il Gattopardo', a: 'Giuseppe Tomasi di Lampedusa', gen: 'Romanzo', rs: 'ok', rt: 5, rd: '2025-03-02', ts: 4 },
    { id: 'g3', t: 'La coscienza di Zeno', a: 'Italo Svevo', gen: 'Romanzo', rs: 'da', ts: 3 },
    { id: 'g4', t: 'Desiderio di Anna', a: 'Elsa Morante', gen: 'Romanzo', w: true, ts: 2 }], { id: 'x', comuni: 2, libVis: true, wishVis: true })); await wait(600);
  const gb = await p.evaluate(() => ({ tabs: [...document.querySelectorAll('#guestBar .gb-tabs [role="tab"]')].map(b => b.textContent + (b.getAttribute('aria-selected') === 'true' ? '*' : '')),
    pill: [...document.querySelectorAll('#guestBar .chip')].map(b => b.textContent), key: (() => { const k = document.getElementById('guestKey'), m = document.querySelector('header.top .top-meta'); return k && !k.hidden && k.parentNode === m ? k.getAttribute('aria-label') : ''; })(),
    nav: [...document.querySelectorAll('#layNav .on')].length }));
  console.log('[4 striscia]', JSON.stringify(gb));
  assert.deepStrictEqual(gb.tabs, ['Libreria 3*', 'Desideri 1']);
  assert(!gb.pill.some(t => /Prest/.test(t)) && /Presta/.test(gb.key) && gb.nav === 0, 'icona della chiave al posto della pillola, nessun tasto in basso acceso');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'amico-412.png') });
  await p.evaluate(() => { const s = document.getElementById('grp'); s.value = ''; s.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(300);
  await p.click('#btnView'); await wait(400);
  const rd = await p.evaluate(async () => {
    const out = {};
    for (const id of ['g1', 'g2', 'g3']) { const r = document.querySelector('#list .row[data-id="' + id + '"] .sum'); r.click(); await new Promise(x => setTimeout(x, 350));
      const c = document.querySelector('#list .row[data-id="' + id + '"]'); out[id] = { t: (c.querySelector('.g-rs') || {}).textContent || '', btn: c.querySelectorAll('[data-act="rs"]').length }; }
    return out; });
  console.log('[4 lettura]', JSON.stringify(rd));
  assert(rd.g1.t.startsWith('Anna lo sta leggendo') && rd.g2.t === 'Anna l\'ha letto · il 2 marzo 2025 · «Capolavoro»' && rd.g3.t === '', 'frasi della lettura');
  assert(rd.g1.btn + rd.g2.btn + rd.g3.btn === 0, 'niente tasti di lettura');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'amico-letto-412.png') });
  await p.click('#guestBar [data-t="wish"]'); await wait(400);
  let st = await p.evaluate(() => [NL.guest(), NL.tab(), document.querySelectorAll('#list .row').length]);
  assert.deepStrictEqual(st, ['Anna', 'wish', 1], 'Desideri dell\'amico dal tasto in cima');
  await p.click('#layNav [data-l="lib"]'); await wait(400);
  st = await p.evaluate(() => [NL.guest(), NL.tab(), document.querySelectorAll('#list .row, #list .cover').length]);
  assert.deepStrictEqual(st, [null, 'lib', 3], 'Libreria in basso: la tua');
  assert(await p.evaluate(() => document.getElementById('guestKey').hidden), 'icona della chiave via fuori dalla libreria dell\'amico');
  // «Per te» dalla libreria di un amico: le tue statistiche
  await p.evaluate(() => NL.guestEnter('Anna', [{ id: 'g1', t: 'Uno', a: 'X', ts: 1 }], { id: 'x' })); await wait(400);
  await p.click('#layNav [data-l="you"]'); await wait(300); await p.click('#layYou [data-l="stats"]'); await wait(500);
  st = await p.evaluate(() => [NL.guest(), document.querySelector('#statsSheet .stat b, #statsSheet b').textContent]);
  console.log('[4 per te]', JSON.stringify(st)); assert(st[0] === null && st[1] === '3', 'Per te parla della tua libreria');

  assert.deepStrictEqual(errors, [], 'errori di pagina: ' + errors.join(' | '));
  console.log('nessun errore di pagina');
  console.log('E2E116 OK');
  await browser.close(); server.close(); process.exit(0);
})().catch(e => { console.error('E2E116 FALLITA', e); process.exit(1); });
