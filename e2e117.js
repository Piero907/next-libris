const CFG = require("./_config");
const H = require('./_harness');
// moduli: amici, layout
// 17/11/2026 notte. Richieste di Piero:
// 1) «Ordina» e «Raggruppa» in una riga sotto la ricerca, sempre in vista (non più nella barra dei filtri);
// 2) Espandi tutto / Comprimi tutto anche con filtri o ricerca;
// 3) autori per cognome anche nei gruppi; «Neruda, Pablo» di predefinito (preferenza in Aspetto); cognome corretto a mano in «Chi è»;
// 4) libreria di un amico: solo «Libreria di Anna» in testata, amici in comune, Sta leggendo, Letti, «Prestiti, regali e altro»,
//    poi i tasti; via «‹ La tua libreria»; chiave solo se prestata; niente «Novità dei tuoi autori».
// Con SCHERMATE=cartella: schermata principale e libreria dell'amico.
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
}).listen(CFG.port(8317));
const base = 'http://localhost:' + CFG.port(8317);
const SHOTS = process.env.SCHERMATE ? path.resolve(process.env.SCHERMATE) : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const V = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).v;
const B = o => Object.assign({ id: 'x', t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 1, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: 'da', rt: 0, rd: '' }, o);
const books = [
  B({ id: 'n1', t: 'Cento sonetti d\'amore', a: 'Pablo Neruda', gen: 'Poesia', ts: 10 }),
  B({ id: 'n2', t: 'Il barone rampante', a: 'Italo Calvino', gen: 'Romanzo', ts: 9 }),
  B({ id: 'n3', t: 'Cuore', a: 'Edmondo De Amicis', gen: 'Romanzo', ts: 8 }),
  B({ id: 'n4', t: 'Cent\'anni di solitudine', a: 'Gabriel García Márquez', gen: 'Romanzo', ts: 7 }),
  B({ id: 'n5', t: 'Il nome della rosa', a: 'Umberto Eco', gen: 'Romanzo', ts: 6 }),
  B({ id: 'n6', t: 'Desiderio', a: 'Elsa Morante', gen: 'Romanzo', w: true, ts: 5 }),
];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [], wait = H.wait;
  const p = await (await browser.createBrowserContext()).newPage();
  await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  p.on('pageerror', e => errors.push(e.message));
  await p.evaluateOnNewDocument((b, V) => {
    window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (localStorage.getItem('prova:e2e117')) return; localStorage.setItem('prova:e2e117', '1');
    localStorage.setItem('prova:catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 }));
    localStorage.setItem('prova:catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), price: false, name: 'Piero R.', welcomed: 1, donSeen: 1, viewDef: 'grid', look: 'nuovo', seenV: V, wn2: 1, grp: 'aut' }));
    localStorage.setItem('prova:catalogo-libri-layout', JSON.stringify({ v: 'a' })); localStorage.setItem('prova:catalogo-libri-card', JSON.stringify({ v: 'd' }));
  }, books, V);
  await p.setRequestInterception(true);
  p.on('request', r => { const u = r.url(); if (u.startsWith(base)) return r.continue();
    r.respond({ status: 404, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' }); });
  await p.goto(base + '/next-libris-prova/', { waitUntil: 'load' }); await wait(1500);
  await p.evaluate(() => { document.querySelectorAll('.sheet:not([hidden])').forEach(x => { x.hidden = true; }); ['#instCard', '#notice'].forEach(s => { const x = document.querySelector(s); if (x) x.hidden = true; }); });
  const caps = () => p.evaluate(() => [...document.querySelectorAll('#list .gcard .cap')].map(c => c.textContent));

  // 1) riga Ordina · Raggruppa
  const sb = await p.evaluate(() => ({ t: [...document.querySelectorAll('#sortBar .dpick .dp-t')].map(b => b.textContent), vis: !!document.getElementById('sortBar').offsetParent,
    drawer: !!document.querySelector('#drawer #sort, #drawer #grp'), menu: document.querySelector('#goFilters b').textContent }));
  console.log('[1 riga]', JSON.stringify(sb));
  assert(sb.vis && !sb.drawer && sb.t[0] === 'Più recenti' && sb.t[1] === 'Raggruppa: Autore' && sb.menu === 'Filtri', 'riga sotto la ricerca, niente nei filtri');
  await p.click('#grpPick'); await wait(200);
  assert(await p.evaluate(() => document.getElementById('pickPop').parentNode.id === 'sortBar' && !document.getElementById('pickPop').hidden), 'finestrella sotto la riga');
  await p.keyboard.press('Escape'); await wait(200);

  // 3) autori per cognome, «Cognome, Nome»
  let c = await caps(); console.log('[3 gruppi]', c.join(' | '));
  assert.deepStrictEqual(c, ['Calvino, Italo', 'De Amicis, Edmondo', 'Eco, Umberto', 'Márquez, Gabriel García', 'Neruda, Pablo']);
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'principale-412.png') });
  await p.evaluate(() => [...document.querySelectorAll('#list .gcard')][3].click()); await wait(300);
  await p.evaluate(() => document.querySelector('#list .gpanel:not([hidden]) .gp-who').click()); await wait(400);
  assert.match(await p.$eval('#auCut', x => x.textContent), /In ordine come Márquez, Gabriel García/);
  await p.click('#auCut [data-auc="open"]'); await wait(200);
  const opts = await p.evaluate(() => [...document.querySelectorAll('#auCut .pk-o')].map(x => x.textContent + (x.getAttribute('aria-checked') === 'true' ? '*' : '')));
  console.log('[3 tagli]', opts.join(' | '));
  assert.deepStrictEqual(opts, ['Márquez, Gabriel García*', 'García Márquez, Gabriel', 'Gabriel García Márquez (com\'è scritto)']);
  await p.click('#auCut [data-auc="2"]'); await wait(300);
  await p.evaluate(() => document.getElementById('auClose').click()); await wait(300);
  c = await caps(); assert(c[3] === 'García Márquez, Gabriel', 'corretto: ' + c[3]);
  assert.strictEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('prova:catalogo-libri-set')).auCut['gabriel garcia marquez']), 2, 'correzione ricordata');
  await p.evaluate(() => window.__app.openOptions('look')); await wait(400);
  await p.evaluate(() => document.querySelector('input[name="auInv"][value="0"]').click()); await wait(300);
  await p.evaluate(() => window.__app.closeOptions()); await wait(300);
  c = await caps(); console.log('[3 come scritti]', c.join(' | '));
  assert.deepStrictEqual(c, ['Italo Calvino', 'Edmondo De Amicis', 'Umberto Eco', 'Gabriel García Márquez', 'Pablo Neruda'], 'stesso ordine, nomi come sono scritti');

  // 2) Espandi / Comprimi anche con la ricerca
  await p.type('#q', 'ro'); await wait(600);
  let ex = await p.evaluate(() => ({ tools: !!document.querySelector('#list .grp-tools'), exp: document.getElementById('list').classList.contains('grp-exp') }));
  assert(ex.tools && ex.exp, 'con la ricerca: tutto aperto e i tasti ci sono ' + JSON.stringify(ex));
  await p.click('#list [data-gx="0"]'); await wait(300);
  ex = await p.evaluate(() => ({ exp: document.getElementById('list').classList.contains('grp-exp'), set: window.__app.settings.grpExp }));
  assert(!ex.exp && !ex.set, 'compresso, senza cambiare la scelta di sempre ' + JSON.stringify(ex));
  await p.click('#list [data-gx="1"]'); await wait(300);
  assert(await p.evaluate(() => document.getElementById('list').classList.contains('grp-exp')), 'riaperto');
  await p.evaluate(() => { const q = document.getElementById('q'); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(500);

  // 4) libreria di un amico
  await p.evaluate(() => NL.guestEnter('Anna', [
    { id: 'g1', t: 'Il deserto dei Tartari', a: 'Dino Buzzati', gen: 'Romanzo', rs: 'in', pg: 250, pp: 80, ts: 5 },
    { id: 'g2', t: 'Il Gattopardo', a: 'Giuseppe Tomasi di Lampedusa', gen: 'Romanzo', rs: 'ok', rt: 5, rd: '2025-03-02', ts: 4 },
    { id: 'g4', t: 'Desiderio di Anna', a: 'Elsa Morante', gen: 'Romanzo', w: true, ts: 2 }], { id: 'x', comuni: 1, libVis: true, wishVis: true })); await wait(600);
  const gb = await p.evaluate(() => ({ meta: document.querySelector('header.top .top-meta').innerText.trim(), order: [...document.getElementById('guestBar').children].map(x => x.className.replace(/^(tabs |link )/, '').split(' ')[0]),
    back: !!document.querySelector('#guestBar .gb-back'), key: !!(document.getElementById('guestKey') && !document.getElementById('guestKey').hidden), sort: !!document.getElementById('sortBar').offsetParent }));
  console.log('[4 amico]', JSON.stringify(gb));
  assert.strictEqual(gb.meta, 'Libreria di Anna');
  assert.deepStrictEqual(gb.order.slice(0, 5), ['gb-num', 'gb-line', 'gb-line', 'gb-top', 'gb-tabs']);
  assert(!gb.back && !gb.key && gb.sort, 'via «La tua libreria», niente chiave, riga Ordina · Raggruppa');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'amico-412.png') });
  await p.click('#guestBar [data-t="wish"]'); await wait(400);
  assert(await p.evaluate(() => !document.getElementById('btnNews').offsetParent && /Libreria di Anna$/.test(document.querySelector('header.top .top-meta').innerText.trim())), 'Desideri dell\'amico: niente Novità né «da comprare»');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'amico-desideri-412.png') });
  await p.evaluate(() => NL.guestExit()); await wait(400);
  assert.match(await p.$eval('header.top .top-meta', x => x.innerText), /Piero R\.[^]*5 libri/);

  assert.deepStrictEqual(errors, [], 'errori di pagina: ' + errors.join(' | '));
  console.log('E2E117 OK');
  await browser.close(); server.close(); process.exit(0);
})().catch(e => { console.error('E2E117 FALLITA', e); process.exit(1); });
