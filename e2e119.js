const CFG = require("./_config");
const H = require('./_harness');
// moduli: layout
// 17/11/2026. Richieste di Piero:
// 1) Ennio Flaiano ha la foto su Wikipedia ma non nell'app: la foto sta solo su it.wikipedia (non libera), il riassunto non la dà
//    → si chiede pageimages con pilicense=any; i vecchi «senza foto» si ricercano una volta (segno '~v' 3); Wikidata non serve.
// 2) toccando la miniatura dell'autore in «Chi è» la foto si apre a tutto schermo, più grande (960px), con la piccola se la grande manca.
// 3) il tasto per restituire si chiama «Restituiscilo» ed è un tasto pieno (colore dell'app), come «È tornato: segna restituito».
// 4) «N in prestito» conta anche i libri ricevuti dagli amici; toccandolo: «Prestati a» e «Prestati da», un gruppo per persona.
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
}).listen(CFG.port(8319));
const base = 'http://localhost:' + CFG.port(8319);
const V = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).v;
const PNG = fs.readFileSync(path.join(CFG.IMG, 'cov_thumb.png'));
const B = o => Object.assign({ id: 'x', t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 1, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: 'da', rt: 0, rd: '' }, o);
const books = [
  B({ id: 'b1', t: 'Tempo di uccidere', a: 'Ennio Flaiano', gen: 'Romanzo', ts: 10 }),
  B({ id: 'b2', t: 'Il nome della rosa', a: 'Umberto Eco', ts: 9, p: 'Marco', pd: '2026-10-01' }),
  B({ id: 'b3', t: 'Palomar', a: 'Italo Calvino', ts: 8, p: 'Marco', pd: '2026-09-01' }),
  B({ id: 'b4', t: 'Il deserto dei Tartari', a: 'Dino Buzzati', ts: 7, p: 'Anna', pd: '2026-11-01' }),
  B({ id: 'b5', t: 'Il giardino dei Finzi-Contini', a: 'Giorgio Bassani', ts: 6, sk: 'p', sda: 'Bruno' }),
  B({ id: 'b6', t: 'Lessico famigliare', a: 'Natalia Ginzburg', ts: 5, sk: 'q', sda: 'Anna' }),
  B({ id: 'b7', t: 'Il Gattopardo', a: 'Giuseppe Tomasi di Lampedusa', ts: 4 }),
];
const J = (r, o, st) => r.respond({ status: st || 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) });
const hits = { pi: 0, wd: 0, big: 0 };
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const wait = H.wait;
  const p = await (await browser.createBrowserContext()).newPage();
  await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  p.on('pageerror', e => errors.push(e.message));
  await p.evaluateOnNewDocument((b, V) => {
    window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (localStorage.getItem('prova:e2e119')) return; localStorage.setItem('prova:e2e119', '1');
    localStorage.setItem('prova:catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 }));
    localStorage.setItem('prova:catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), price: false, name: 'Piero R.', welcomed: 1, donSeen: 1, viewDef: 'grid', look: 'nuovo', seenV: V, wn2: 1, grp: 'aut' }));
    localStorage.setItem('prova:catalogo-libri-layout', JSON.stringify({ v: 'a' })); localStorage.setItem('prova:catalogo-libri-card', JSON.stringify({ v: 'd' }));
    // come sul telefono di Piero: Flaiano già cercato con la 102.4 e salvato «senza foto»
    localStorage.setItem('prova:catalogo-libri-aufoto', JSON.stringify({ '~v': 2, 'ennio flaiano': ['', Date.now()] }));
  }, books, V);
  await p.setRequestInterception(true);
  p.on('request', r => {
    const u = decodeURIComponent(r.url());
    if (u.startsWith(base)) return r.continue();
    if (/summary\/Ennio_Flaiano/.test(u)) return J(r, { type: 'standard', title: 'Ennio Flaiano', description: 'scrittore e sceneggiatore italiano', extract: 'Ennio Flaiano è stato uno scrittore.', wikibase_item: 'Q353406' });
    if (/prop=pageimages/.test(u) && /pilicense=any/.test(u) && /titles=Ennio Flaiano/.test(u)) { hits.pi++; return J(r, { query: { pages: { '7': { title: 'Ennio Flaiano', thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/it/thumb/a/ab/Ennio_Flaiano.jpg/330px-Ennio_Flaiano.jpg' } } } } }); }
    if (/wikidata\.org/.test(u)) { hits.wd++; return J(r, { claims: {} }); }
    if (/wikipedia\.org/.test(u)) return J(r, {}, 404);
    if (/960px-Ennio_Flaiano/.test(u)) { hits.big++; return r.respond({ status: 404, body: '' }); }   // la grande non c'e': si torna alla piccola
    if (/upload\.wikimedia\.org/.test(u)) return r.respond({ status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: PNG });
    r.respond({ status: 200, contentType: 'application/json', body: '{"totalItems":0}' });
  });
  await p.goto(base + '/next-libris-prova/', { waitUntil: 'load' }); await wait(1500);
  await p.evaluate(() => { document.querySelectorAll('.sheet:not([hidden])').forEach(x => { x.hidden = true; }); ['#instCard', '#notice'].forEach(s => { const x = document.querySelector(s); if (x) x.hidden = true; }); });

  // 1) Flaiano: la foto non libera di it.wikipedia, senza Wikidata
  await p.waitForFunction(() => { const c = document.querySelector('.gcard[aria-label^="Flaiano"]'); return c && c.querySelector('.gc-img'); }, { polling: 100, timeout: 10000 });
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('prova:catalogo-libri-aufoto')));
  console.log('[Flaiano]', JSON.stringify(saved['ennio flaiano']), '· pageimages', hits.pi, '· Wikidata', hits.wd, '· ~v', saved['~v']);
  assert(/330px-Ennio_Flaiano/.test(saved['ennio flaiano'][0]) && saved['~v'] === 3, 'foto di Flaiano salvata, vecchio «senza foto» ricercato');
  assert.strictEqual(hits.pi >= 1 && hits.wd, 0, 'trovata su it.wikipedia: Wikidata non serve');

  // 2) «Chi è» › tocco sulla miniatura: a tutto schermo
  await p.evaluate(() => document.querySelector('.gcard[aria-label^="Flaiano"]').click()); await wait(300);
  await p.evaluate(() => document.querySelector('.gpanel:not([hidden]) .gp-who').click());
  await p.waitForFunction(() => !document.getElementById('auPic').hidden, { polling: 100, timeout: 6000 });
  await p.click('#auPic');
  await p.waitForFunction(() => !document.getElementById('phView').hidden && /330px-Ennio_Flaiano/.test(document.getElementById('phImg').src), { polling: 100, timeout: 6000 });
  const fs1 = await p.evaluate(() => { const v = document.getElementById('phView').getBoundingClientRect(), i = document.getElementById('phImg').getBoundingClientRect(); return { vw: v.width, vh: v.height, iw: i.width, cap: document.getElementById('phCap').textContent, au: !document.getElementById('auSheet').hidden }; });
  console.log('[tutto schermo]', JSON.stringify(fs1), '· grande chiesta', hits.big);
  assert(fs1.vw === 412 && fs1.vh === 915 && fs1.iw > 200 && fs1.cap === 'Ennio Flaiano' && fs1.au, 'foto a tutto schermo sopra «Chi è»');
  assert.strictEqual(hits.big, 1, 'prima la grande (960px), poi la piccola');
  await p.click('#phClose'); await wait(300);
  assert(await p.evaluate(() => document.getElementById('phView').hidden && !document.getElementById('auSheet').hidden), '× chiude solo la foto');
  await p.click('#auPic'); await wait(300);
  await p.goBack(); await wait(300);
  assert(await p.evaluate(() => document.getElementById('phView').hidden), 'Indietro chiude la foto');
  await p.evaluate(() => document.getElementById('auClose').click()); await wait(200);

  // 3) tasti per restituire: pieni, colore dell'app
  await p.evaluate(() => { NL.settings.grp = ''; NL.settings.view = 'list'; NL.saveSettings(); NL.refresh(); }); await wait(300);
  const ret = async id => { await p.evaluate(id => NL.showBook(id), id); await wait(400);
    return p.$eval('.row.open[data-id="' + id + '"] .ret-btn', b => ({ t: b.textContent, bg: getComputedStyle(b).backgroundColor, h: b.getBoundingClientRect().height })); };
  const st = { recv: await ret('b5'), lent: await ret('b2') };
  const accent = await p.evaluate(() => { const d = document.createElement('i'); d.style.color = 'var(--accent)'; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; });
  console.log('[restituire]', JSON.stringify(st), accent);
  assert.strictEqual(st.recv.t, 'Restituiscilo'); assert.strictEqual(st.lent.t, 'È tornato: segna restituito');
  assert(st.recv.bg === accent && st.lent.bg === accent, 'pieni, colore dell\'app');
  await p.evaluate(() => NL.refresh());

  // 4) «N in prestito»: prestati da te e ricevuti; gruppi per persona
  const sum = await p.$eval('#summary [data-sum="loan"]', x => x.textContent);
  assert.strictEqual(sum, '5 in prestito');
  await p.click('#summary [data-sum="loan"]'); await wait(300);
  const grp = await p.evaluate(() => [...document.querySelectorAll('#list .loan-groups > .shelf')].map(s => s.querySelector('.shelf-h .sh-t').textContent + ' ' + s.querySelector('.shelf-h .sh-n').textContent + ': ' +
    [...s.querySelectorAll('.grp-sub')].map(x => x.querySelector('.sh-t').textContent + ' ' + [...x.querySelectorAll('.row')].map(r => r.dataset.id).join(',')).join(' | ')));
  console.log('[prestiti]', JSON.stringify(grp));
  assert.deepStrictEqual(grp, ['Prestati a 3: Anna b4 | Marco b3,b2', 'Prestati da 2: Anna b6 | Bruno b5']);
  await p.click('#list .shelf-lo-a-marco .shelf-h'); await wait(150);
  assert(await p.evaluate(() => document.getElementById('shelf-lo-a-marco').hidden), 'il gruppo di Marco si chiude');
  await p.click('#summary [data-sum="loan"]'); await wait(300);
  assert(!(await p.$('#list .loan-groups')), 'di nuovo: tutti i libri');
  await p.evaluate(() => { NL.settings.view = 'grid'; NL.saveSettings(); });
  await p.click('#summary [data-sum="loan"]'); await wait(300);
  assert.strictEqual(await p.$$eval('#list .loan-groups .cover', x => x.length), 5, 'anche a copertine');

  assert.deepStrictEqual(errors, [], 'errori JavaScript: ' + errors.join(' | '));
  console.log('OK e2e119');
  await browser.close(); server.close();
})().catch(async e => { console.error('FAIL', e); process.exit(1); });
