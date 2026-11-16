const CFG = require("./_config");
// descrizione (scelta di Piero, 16/11/2026): solo dalla prima ricerca per ISBN; se manca «Descrizione non disponibile» e nessun'altra richiesta;
// le descrizioni rimaste «in sospeso» dalle versioni vecchie diventano «non disponibile» senza cercarle
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8163));
const json = o => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
const GD = { '9788804668015': ['Le città invisibili', 'Italo Calvino', '<p>Marco Polo racconta al Gran Kan le città che ha visitato: un libro che è anche una riflessione sulla città.</p>'] };
const G = { '9788845292613': ['Il nome della rosa', 'Umberto Eco', 'Un novizio e il suo maestro indagano su una serie di delitti in una abbazia del nord Italia.'], '9788806219352': ['La storia', 'Elsa Morante', 'Roma, durante la guerra: la vita di Ida e del piccolo Useppe raccontata con una forza che non si dimentica.'] };
let descNet = 'ok', descHits = 0, lookHits = 0;
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => { const u = decodeURIComponent(r.url());
    if (u.startsWith('http://localhost')) return r.continue();
    const isbn = (u.match(/97[89]\d{10}/) || [])[0];
    if (u.includes('googleapis.com/books/v1/volumes?') && u.includes('description')) {      // ricerca della descrizione
      descHits++;
      if (descNet === 'down') return r.abort('failed');
      const g = isbn && G[isbn]; return r.respond(json(g ? { items: [{ volumeInfo: { title: g[0], authors: [g[1]], language: 'it', description: g[2] } }] } : { totalItems: 0 }));
    }
    if (u.includes('googleapis.com/books/v1/volumes?') && GD[isbn]) { lookHits++; const g = GD[isbn];                  // ricerca per ISBN che porta gia' la descrizione
      return r.respond(json({ items: [{ id: 'x' + isbn, volumeInfo: { title: g[0], authors: [g[1]], language: 'it', publishedDate: '2016', description: g[2], industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn }] } }] })); }
    if (u.includes('googleapis.com/books/v1/volumes?')) { const g = G[isbn]; if (!g) return r.respond(json({ totalItems: 0 }));
      return r.respond(json({ items: [{ id: 'x' + isbn, volumeInfo: { title: g[0], authors: [g[1]], publishedDate: '2020', industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn }] } }] })); }
    if (u.includes('openlibrary.org/isbn/') && descNet === 'down') return r.abort('failed');
    if (/googleapis|openlibrary|crossref/.test(u)) return r.respond({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '' });
    r.abort(); });
  await page.evaluateOnNewDocument(() => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: [], updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), installed: true, instScope: '/', swiped: true, name: 'Piero', selTip: 1, price: false })); sessionStorage.seeded = 1; } });
  await page.goto('http://localhost:' + CFG.port(8163) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(1200);
  const byIsbn = i => page.evaluate(i => JSON.parse(JSON.stringify(window.__app.state.books.find(b => b.i === i) || null)), i);
  // 0) la ricerca per ISBN porta gia' la descrizione: nessuna richiesta in piu'
  descHits = 0;
  await page.evaluate(() => window.__app.addIsbn('9788804668015'));
  await page.waitForFunction(() => { const b = window.__app.state.books.find(x => x.i === '9788804668015'); return b && b.t; }, { timeout: 15000 }); await wait(2500);
  let b0 = await byIsbn('9788804668015'); console.log('[0 stessa richiesta]', b0.ds, '| richieste descrizione:', descHits, '| dsq', b0.dsq);
  assert(b0.ds.startsWith('Marco Polo racconta') && !b0.ds.includes('<p>') && b0.dsf === 'g' && b0.dsl === 'it' && !b0.dsq); assert.strictEqual(descHits, 0, 'nessuna richiesta in piu\'');
  // 1) la prima ricerca non porta la descrizione: «non disponibile», nessuna altra richiesta
  descHits = 0;
  await page.evaluate(() => window.__app.addIsbn('9788845292613'));
  await page.waitForFunction(() => { const b = window.__app.state.books.find(x => x.i === '9788845292613'); return b && b.t; }, { timeout: 15000 }); await wait(3000);
  let b = await byIsbn('9788845292613'); console.log('[1 senza descrizione]', b.t, '| ds', JSON.stringify(b.ds), '| dsn', b.dsn, '| richieste', descHits);
  assert(!b.ds && b.dsn > 0 && !b.dsq && descHits === 0, 'non disponibile, nessuna richiesta');
  // 2) libro «in sospeso» da una versione vecchia: dopo il riavvio diventa «non disponibile», senza cercarla
  await page.evaluate(() => { const b = window.__app.state.books.find(x => x.i === '9788845292613'); b.dsn = 0; b.dsq = 1; window.NL.save(); });
  await wait(800); await page.reload({ waitUntil: 'load' }); await wait(7000);
  b = await byIsbn('9788845292613'); console.log('[2 riavvio]', '| dsq', b.dsq, '| dsn', b.dsn, '| richieste', descHits);
  assert(!b.ds && !b.dsq && b.dsn > 0 && descHits === 0);
  // 3) aprendo il riquadro: «Descrizione non disponibile», nessuna richiesta; quella arrivata con la prima ricerca c'è
  const id = b.id;
  await page.evaluate(i => document.querySelector('.row[data-id="' + i + '"] [data-act="toggle"]').click(), id); await wait(250);
  await page.evaluate(i => document.querySelector('details.desc:not(.quotes)[data-id="' + i + '"] > summary').click(), id); await wait(600);
  assert.strictEqual(await page.$eval('details.desc:not(.quotes)[data-id="' + id + '"] .desc-b', e => e.textContent.trim()), 'Descrizione non disponibile.'); assert.strictEqual(descHits, 0);
  assert.deepStrictEqual(errors, []);
  console.log('e2e45 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
