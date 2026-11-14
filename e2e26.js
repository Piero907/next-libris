const CFG = require("./_config");
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(8139);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await browser.newPage();
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem('catalogo-libri-set', JSON.stringify({ installed: true, instScope: '/', swiped: true, lastBackup: Date.now(), price: false }));
    localStorage.setItem('catalogo-libri-v2', JSON.stringify({ updated: Date.now(), books: [
      { id: 'b1', t: 'Il deserto dei Tartari', a: 'Dino Buzzati', e: 'Mondadori', y: '2016', i: '9788804668015', ts: 5 },
      { id: 'b2', t: 'Il nome della rosa', a: 'Umberto Eco', c: 14, i: '9788845292613', ts: 4, p: 'Marco', pd: '2026-10-01' },
      { id: 'b5', t: 'Venduto', a: 'X', c: 3, i: '9788817050562', ts: 3, xs: 'v', xd: '2026-09-01' },
      { id: 'b4', t: '', a: '', i: '9788807881213', ts: 2, nf: true },
      { id: 'b3', t: 'Le città invisibili', a: 'Italo Calvino', i: '9788804668022', ts: 1, w: true } ] }));
  });
  await p.setViewport({ width: 360, height: 800, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.setRequestInterception(true); p.on('request', r => r.url().startsWith('http://localhost:8139') ? r.continue() : r.abort());
  await p.goto('http://localhost:8139/?vista=elenco', { waitUntil: 'load' }); await new Promise(r => setTimeout(r, 400));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function card(id) {
    await p.evaluate(id => { const s = document.querySelector('#list .row[data-id="' + id + '"] .sum'); if (s) s.click(); }, id); await wait(200);
    return p.evaluate(id => {
      const r = document.querySelector('#list .row[data-id="' + id + '"]');
      const lab = sel => [...r.querySelectorAll(sel)].map(b => (b.querySelector('.al') ? b.querySelector('.al').textContent : '[' + b.dataset.act + ']') + '|' + b.getAttribute('aria-label'));
      return { main: lab('.acts-main button'), win: [...r.querySelectorAll('.acts-win button')].map(b => b.dataset.act + ':' + (b.querySelector('.al') ? 'testo' : 'icona')),
        tail: lab('.foot .tail button'), thumb: (r.querySelector('.thumb.add') || {}).textContent || '', flags: r.querySelector('.card-top .flags').innerText,
        over: r.scrollWidth - r.clientWidth, topOver: [...r.querySelectorAll('.card-top button')].some(b => b.getBoundingClientRect().right > r.getBoundingClientRect().right + 1) };
    }, id);
  }
  let c = await card('b1'); console.log('[libro]', JSON.stringify(c));
  assert.deepStrictEqual(c.main, ['Presta, vendi o regala|Presta, vendi o regala il libro', 'Desideri|Sposta nei Desideri', 'Preferito|Metti tra i preferiti', 'Cerca sul web|Cerca questo libro su Google: prezzo, recensioni, dove comprarlo', 'Elimina|Elimina il libro']);
  assert.deepStrictEqual(c.win, ['toggle:icona']);
  // «Elimina» lontano dalla freccetta: almeno 60 px tra i due
  const gap = await p.evaluate(() => { const r = document.querySelector('#list .row[data-id="b1"]'), d = r.querySelector('[data-act="del"]').getBoundingClientRect(), t = r.querySelector('[data-act="toggle"]').getBoundingClientRect(); return Math.hypot((t.left + t.right) / 2 - (d.left + d.right) / 2, (t.top + t.bottom) / 2 - (d.top + d.bottom) / 2); });
  console.log('[distanza Elimina-freccetta]', Math.round(gap), 'px'); assert(gap >= 60);
  assert.deepStrictEqual(c.tail, ['Condividi|Manda questo libro a un amico']);
  assert.strictEqual(c.thumb, 'Copertina'); assert(c.over <= 0 && !c.topOver, 'niente esce dalla scheda');
  c = await card('b2'); console.log('[prestato]', JSON.stringify(c));
  assert(c.main[0].startsWith('Prestato|Prestato a Marco')); assert(c.flags.includes('Prestato a Marco')); assert(c.tail.length === 1);
  c = await card('b5'); console.log('[venduto]', JSON.stringify(c.main));
  assert(c.main[0].startsWith('Venduto|'));
  c = await card('b4'); console.log('[non trovato]', JSON.stringify(c.tail));
  assert.deepStrictEqual(c.tail.map(x => x.split('|')[0]), ['Condividi', 'Cerca di nuovo']);
  assert(c.over <= 0);
  await p.evaluate(() => window.__app.setTab('wish')); await wait(200);
  c = await card('b3'); console.log('[desideri]', JSON.stringify(c.main));
  assert.deepStrictEqual(c.main, ['Libreria|Sposta in Libreria (l\'ho comprato)', 'Cerca sul web|Cerca questo libro su Google: prezzo, recensioni, dove comprarlo', 'Elimina|Elimina il libro']);
  // stesso stile per tutte le azioni con scritta
  const st = await p.evaluate(() => [...document.querySelectorAll('#list .ico.act, #list .row .ico.act')].map(b => { const s = getComputedStyle(b); return [s.height, s.borderRadius, s.fontSize, s.fontWeight].join(' '); }));
  console.log('[stile]', [...new Set(st)]); assert.strictEqual(new Set(st).size, 1);
  assert.deepStrictEqual(errors, []);
  console.log('e2e26 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
