const CFG = require("./_config");
const H = require('./_harness');
// moduli: layout
// 17/11/2026. Piero: «molte anteprime degli autori rimangono vuote anche se la foto è presente» (esempio Antonio Tabucchi).
// La voce di it.wikipedia di Tabucchi non ha foto; la foto sta su Wikidata (P18) e la miniatura su Commons.
// Si prova: 1) foto presa da Wikidata/Commons quando it.wikipedia non ce l'ha; 2) i vecchi «senza foto» salvati si cancellano
// e si ricerca subito; 3) un errore di rete salta solo quell'autore, la coda va avanti; 4) «Chi è» usa la stessa foto.
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
}).listen(CFG.port(8318));
const base = 'http://localhost:' + CFG.port(8318);
const V = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).v;
const PNG = fs.readFileSync(path.join(CFG.IMG, 'cov_thumb.png'));
const B = o => Object.assign({ id: 'x', t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 1, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: 'da', rt: 0, rd: '' }, o);
const books = [
  B({ id: 'b1', t: 'Sostiene Pereira', a: 'Antonio Tabucchi', gen: 'Romanzo', ts: 10 }),
  B({ id: 'b2', t: 'Il nome della rosa', a: 'Umberto Eco', gen: 'Giallo', ts: 9 }),
  B({ id: 'b3', t: 'Palomar', a: 'Italo Calvino', gen: 'Libri della nonna', ts: 8 }),
  B({ id: 'b4', t: 'Il deserto dei Tartari', a: 'Dino Buzzati', gen: 'Romanzo', ts: 7 }),
];
const J = (r, o, st) => r.respond({ status: st || 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) });
const hits = { wd: 0, cm: 0 };
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const wait = H.wait;
  const p = await (await browser.createBrowserContext()).newPage();
  await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  p.on('pageerror', e => errors.push(e.message));
  await p.evaluateOnNewDocument((b, V) => {
    window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (localStorage.getItem('prova:e2e118')) return; localStorage.setItem('prova:e2e118', '1');
    localStorage.setItem('prova:catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 }));
    localStorage.setItem('prova:catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), price: false, name: 'Piero R.', welcomed: 1, donSeen: 1, viewDef: 'grid', look: 'nuovo', seenV: V, wn2: 1, grp: 'aut' }));
    localStorage.setItem('prova:catalogo-libri-layout', JSON.stringify({ v: 'a' })); localStorage.setItem('prova:catalogo-libri-card', JSON.stringify({ v: 'd' }));
    // come sul telefono di Piero: Tabucchi già cercato prima della correzione e salvato «senza foto»
    localStorage.setItem('prova:catalogo-libri-aufoto', JSON.stringify({ 'antonio tabucchi': ['', Date.now()], 'umberto eco': ['https://upload.wikimedia.org/eco.png', Date.now()] }));
  }, books, V);
  await p.setRequestInterception(true);
  p.on('request', r => {
    const u = decodeURIComponent(r.url());
    if (u.startsWith(base)) return r.continue();
    if (/summary\/Antonio_Tabucchi/.test(u)) return J(r, { type: 'standard', title: 'Antonio Tabucchi', description: 'scrittore italiano', extract: 'Antonio Tabucchi è stato uno scrittore.', wikibase_item: 'Q231781' });
    if (/summary\/Italo_Calvino/.test(u)) return J(r, { type: 'standard', title: 'Italo Calvino', description: 'scrittore italiano', extract: 'Italo Calvino è stato uno scrittore.', wikibase_item: 'Q47672' });
    if (/summary\/Dino_Buzzati/.test(u)) return r.abort('timedout');   // errore di rete per un solo autore
    if (/wikidata\.org.*entity=Q231781/.test(u)) { hits.wd++; return J(r, { claims: { P18: [{ rank: 'normal', mainsnak: { datavalue: { value: 'Antonio Tabucchi.jpg' } } }] } }); }
    if (/wikidata\.org/.test(u)) { hits.wd++; return J(r, { claims: {} }); }   // Calvino: nemmeno Wikidata ha la foto
    if (/commons\.wikimedia\.org.*File:Antonio Tabucchi\.jpg/.test(u)) { hits.cm++; return J(r, { query: { pages: { '1': { imageinfo: [{ thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/x/xy/Antonio_Tabucchi.jpg/330px-Antonio_Tabucchi.jpg' }] } } } }); }
    if (/wikipedia\.org/.test(u)) return J(r, {}, 404);
    if (/upload\.wikimedia\.org/.test(u)) return r.respond({ status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: PNG });
    r.respond({ status: 200, contentType: 'application/json', body: '{"totalItems":0}' });
  });
  await p.goto(base + '/next-libris-prova/', { waitUntil: 'load' }); await wait(1500);
  await p.evaluate(() => { document.querySelectorAll('.sheet:not([hidden])').forEach(x => { x.hidden = true; }); ['#instCard', '#notice'].forEach(s => { const x = document.querySelector(s); if (x) x.hidden = true; }); });

  // 1-3) Tabucchi da Wikidata (il vecchio «senza foto» è stato cancellato), Calvino senza foto, Buzzati (errore) non blocca gli altri
  await p.waitForFunction(() => [...document.querySelectorAll('.gcard')].filter(c => c.querySelector('.gc-img')).length >= 2 && !document.querySelector('.gcard [data-auf]:not([data-aun="Dino Buzzati"])'), { polling: 100, timeout: 10000 });
  const ph = await p.evaluate(() => [...document.querySelectorAll('.gcard')].map(c => c.querySelector('.cap').textContent + ':' + (c.querySelector('.gc-img') ? 'foto' : 'no')));
  console.log('[foto]', ph.join(' | '), '· Wikidata', hits.wd, '· Commons', hits.cm);
  assert.deepStrictEqual(ph, ['Buzzati, Dino:no', 'Calvino, Italo:no', 'Eco, Umberto:foto', 'Tabucchi, Antonio:foto']);
  assert.strictEqual(hits.cm, 1, 'Commons solo per chi ha la foto su Wikidata');
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('prova:catalogo-libri-aufoto')));
  console.log('[salvate]', JSON.stringify(saved));
  assert(/330px-Antonio_Tabucchi/.test(saved['antonio tabucchi'][0]), 'foto di Tabucchi salvata');
  assert(saved['italo calvino'][0] === '' && !saved['dino buzzati'] && saved['~v'] === 2, 'Calvino senza foto, Buzzati non salvato (errore), segno della pulizia');

  // 4) «Chi è» mostra la stessa foto
  await p.evaluate(() => document.querySelector('.gcard[aria-label^="Tabucchi"]').click()); await wait(300);
  await p.evaluate(() => document.querySelector('.gpanel:not([hidden]) .gp-who').click());
  await p.waitForFunction(() => !document.getElementById('auPic').hidden, { polling: 100, timeout: 6000 });
  assert(/330px-Antonio_Tabucchi/.test(await p.evaluate(() => document.querySelector('#auPic img').src)), 'foto in «Chi è»');

  // riaprendo: niente richieste nuove per chi è già salvato
  const w0 = hits.wd; await p.reload({ waitUntil: 'load' }); await wait(1500);
  assert(await p.evaluate(() => !!document.querySelector('.gcard[aria-label^="Tabucchi"] .gc-img')), 'foto di Tabucchi alla riapertura');
  assert.strictEqual(hits.wd, w0, 'alla riapertura Wikidata non si richiama');

  // 5) senza foto: nome piccolo e COGNOME grande al centro; generi con l'icona (libro chiuso se il genere non si riconosce)
  const nm = await p.evaluate(() => { const c = document.querySelector('.gcard[aria-label^="Calvino"] .gc-ph'); const s = getComputedStyle(c.querySelector('.gc-sur'));
    return [c.querySelector('.gc-nm').textContent, c.querySelector('.gc-sur').textContent, s.textTransform, getComputedStyle(c).justifyContent]; });
  assert.deepStrictEqual(nm, ['Italo', 'Calvino', 'uppercase', 'center']);
  await p.evaluate(() => { const g = document.getElementById('grp'); g.value = 'gen'; g.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(500);
  const gi = await p.evaluate(() => [...document.querySelectorAll('.gcard')].map(c => c.querySelector('.gc-gn').textContent + ':' + c.querySelector('.gc-ico').innerHTML.slice(0, 20)));
  console.log('[generi]', gi.join(' | '));
  assert.strictEqual(gi.length, 3); assert(/Giallo:<circle cx="10.5"/.test(gi.join('|')) && /Libri della nonna:<path d="M5 19.5/.test(gi.join('|')), 'icone: lente per il giallo, libro chiuso per un genere non riconosciuto');
  const ov = await p.evaluate(() => [...document.querySelectorAll('.gc-face')].some(f => f.scrollWidth > f.clientWidth + 1));
  assert(!ov, 'niente testo che esce dalle copertine');

  assert.deepStrictEqual(errors, [], 'errori JavaScript: ' + errors.join(' | '));
  console.log('e2e118 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FALLITA', e); process.exit(1); });
