const CFG = require("./_config");
// ISBN 979-8 (pubblicazione Amazon in proprio) non trovato: casa editrice «Amazon (pubblicazione in proprio)», riquadro nella scheda con
// «Fotografa la copertina» e «Cerca sul web»; la foto riconosce titolo e autore e il codice resta il suo; i 979-8 già non trovati si sistemano all'avvio
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP, IMG = CFG.IMG;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.gz': 'application/gzip', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8189));
const gItem = (id, t, a, e, y, isbn) => ({ id, volumeInfo: { title: t, authors: [a], publisher: e, publishedDate: y, language: 'it', industryIdentifiers: isbn ? [{ type: 'ISBN_13', identifier: isbn }] : [] } });
const FERRANTE = [gItem('A1', "L'amica geniale", 'Elena Ferrante', '', '2011', '9788866321378'), gItem('A3', 'Storia del nuovo cognome', 'Elena Ferrante', '', '2012', '9788866322214')];
const KDP = '9798864592106', OLD = '9798857067536';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith('http://localhost:' + CFG.port(8189))) return req.continue();
    const json = o => req.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (u.includes('googleapis.com/books/v1/volumes')) { const q = new URL(u).searchParams.get('q'); return q.startsWith('isbn:') ? json({ totalItems: 0 }) : json({ items: FERRANTE }); }
    if (u.includes('openlibrary.org')) return json({});
    if (u.includes('fonts.')) return req.respond({ status: 200, contentType: 'text/css', body: '' });
    req.abort();
  });
  await page.goto('http://localhost:' + CFG.port(8189) + '/?vista=elenco', { waitUntil: 'load' });
  // un 979-8 gia' «non trovato» da prima, senza casa editrice
  await page.evaluate(i => { const o = Storage.prototype.setItem; localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: [{ id: 'old', i, nf: true, ts: 1 }], updated: Date.now() })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'P', selTip: 1, lastBackup: Date.now(), price: false })); Storage.prototype.setItem = function (k, v) { if (/^catalogo-libri-v2$/.test(k)) return; return o.call(this, k, v); }; }, OLD);
  await page.reload({ waitUntil: 'load' }); await wait(800);
  const bk = id => page.evaluate(i => { const b = window.__app.state.books.find(x => x.id === i || x.i === i); return b && { id: b.id, t: b.t, a: b.a, e: b.e, i: b.i, nf: b.nf, g: b.g }; }, id);
  let o = await bk('old'); console.log('[1 gia\' non trovato]', JSON.stringify(o)); assert.strictEqual(o.e, 'Amazon (pubblicazione in proprio)');
  // nuovo 979-8: non trovato -> casa editrice Amazon, nessun «da verificare» sulla casa editrice
  await page.evaluate(i => window.__app.addIsbn(i), KDP);
  await page.waitForFunction(i => { const b = window.__app.state.books.find(x => x.i === i); return b && b.nf; }, { timeout: 15000 }, KDP);
  o = await bk(KDP); console.log('[2 nuovo]', JSON.stringify(o)); assert(o.nf && o.e === 'Amazon (pubblicazione in proprio)' && !o.g.includes('e'));
  // la scheda aperta mostra il riquadro con i due pulsanti
  await page.evaluate(() => window.scrollTo(0, 0)); await wait(300);
  const hint = await page.evaluate(id => { const r = document.querySelector('#list .row[data-id="' + id + '"]'); const h = r && r.querySelector('.kdp-hint'); return h ? { txt: h.innerText.replace(/\s+/g, ' '), btn: [...h.querySelectorAll('button')].map(b => b.dataset.act) } : null; }, o.id);
  console.log('[3 riquadro]', JSON.stringify(hint));
  assert(hint && /Libro pubblicato in proprio tramite Amazon/.test(hint.txt) && hint.btn.join() === 'kdpphoto,websearch');
  assert.strictEqual(await page.evaluate(id => document.querySelectorAll('#list .row[data-id="' + id + '"] [data-act="websearch"]').length, o.id), 1, 'un solo «Cerca sul web»');
  await page.evaluate(id => document.querySelector('#list .row[data-id="' + id + '"]').scrollIntoView({ block: 'start' }), o.id); await wait(200);
  await page.screenshot({ path: CFG.OUT + '/kdp_scheda.png' });
  // Cerca sul web: apre la ricerca con il codice
  const opened = await page.evaluate(id => { let u = ''; window.open = x => { u = x; return null; }; document.querySelector('#list .row[data-id="' + id + '"] .kdp-hint [data-act="websearch"]').click(); return u; }, o.id);
  console.log('  web:', opened); assert(opened.includes('google.com/search') && opened.includes(KDP));
  // la foto della copertina: titolo e autore riconosciuti, l'ISBN resta il suo
  const b64 = fs.readFileSync(IMG + '/cover_noisy.jpg').toString('base64');
  await page.evaluate((id, b64) => { const bin = atob(b64), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); const f = new File([a], 'c.jpg', { type: 'image/jpeg' }); const S = window.__app.S; S[id] = Object.assign(S[id] || {}, { keep: true, st: 'queued' }); window.__app.processPhoto(id, f); }, o.id, b64);
  await page.waitForFunction(id => { const s = window.__app.S[id] || {}; return !s.st || s.st === 'choose' || s.st === 'nf' || s.st === 'error'; }, { timeout: 120000, polling: 500 }, o.id);
  const st = await page.evaluate(id => ({ st: (window.__app.S[id] || {}).st || '', n: ((window.__app.S[id] || {}).cands || []).length }), o.id);
  o = await bk(o.id); console.log('[4 dopo la foto]', JSON.stringify(st), JSON.stringify(o));
  assert(o.i === KDP, 'il codice resta il suo');
  assert(o.t || st.st === 'choose', 'riconosciuto (o da scegliere)');
  if (o.t) assert(o.e === 'Amazon (pubblicazione in proprio)' && !o.nf, 'casa editrice Amazon tenuta (il risultato non ne ha una)');
  assert.deepStrictEqual(errors, []);
  console.log('e2e69 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
