const CFG = require("./_config");
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.gz': 'application/gzip' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(8125);
const mk = (body12) => { let sum = 0; for (let i = 0; i < 12; i++) sum += (+body12[i]) * (i % 2 ? 3 : 1); return body12 + ((10 - sum % 10) % 10); };
const A = mk('978885026001'), COOK = '9788850262359', D = mk('978885026004'), Z = mk('978880099991');
const gv = (isbn, o) => ({ items: [{ id: isbn, volumeInfo: Object.assign({ industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn }] }, o) }] });
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => { if (!localStorage.getItem('catalogo-libri-set')) localStorage.setItem('catalogo-libri-set', JSON.stringify({ openAll: true })); });   // questi test controllano i campi delle schede aperte
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = [], hits = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith('http://localhost:8125')) return req.continue();
    const j = (o, s = 200) => req.respond({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    hits.push(u.replace(/\?.*/, '').replace(/^https?:\/\//, ''));
    if (u.includes('googleapis.com')) {
      if (u.includes(A)) return j(gv(A, { title: 'Primo libro', authors: ['Aut A'], publisher: 'Tea Tascabili', publishedDate: '2019' }));
      if (u.includes(COOK)) return j(gv(COOK, { title: 'Giornali di bordo', authors: ['James Cook'], publishedDate: '2021' }));   // Google SENZA editore
      if (u.includes(D)) return j({ totalItems: 0 });
      return j({ totalItems: 0 });
    }
    if (u.includes('openlibrary.org')) return j({});
    if (u.includes('crossref.org')) return j({ message: { items: [] } });
    if (u.includes('fonts.')) return req.respond({ status: 200, contentType: 'text/css', body: '' });
    req.abort();
  });
  await page.goto('http://localhost:8125/?vista=elenco', { waitUntil: 'load' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const books = () => page.evaluate(() => window.__app.state.books.map(b => ({ i: b.i, t: b.t, e: b.e, g: b.g, nf: b.nf })));

  await page.evaluate(c => window.__app.addIsbn(c), A); await wait(1500);
  await page.evaluate(c => window.__app.addIsbn(c), COOK); await wait(1500);
  let bs = await books();
  const a = bs.find(b => b.i === A), c = bs.find(b => b.i === COOK);
  console.log('[A]', JSON.stringify(a)); console.log('[COOK]', JSON.stringify(c));
  assert.strictEqual(a.e, 'Tea Tascabili'); assert(!a.g.includes('e'));               // dato vero da Google: nessuna ipotesi
  assert.strictEqual(c.t, 'Giornali di bordo');
  assert.strictEqual(c.e, 'Tea Tascabili'); assert(!c.g.includes('e'));               // dedotto dal prefisso e confermato dai tuoi libri: niente "da verificare"

  // libro NON trovato ma con prefisso noto: la scheda resta con l'ISBN e l'editore dedotto
  await page.evaluate(c => window.__app.addIsbn(c), D); await wait(1800);
  bs = await books(); const d = bs.find(b => b.i === D);
  console.log('[D nf]', JSON.stringify(d));
  assert.strictEqual(d.nf, true); assert.strictEqual(d.e, 'Tea Tascabili');

  // editore sconosciuto: nessuna deduzione inventata
  await page.evaluate(c => window.__app.addIsbn(c), Z); await wait(1800);
  bs = await books(); const z = bs.find(b => b.i === Z);
  assert.strictEqual(z.e, ''); assert.deepStrictEqual(z.g, []);

  // bottone in Opzioni: svuoto l'editore di COOK e lo rideduco in blocco; poi "Annulla"
  await page.evaluate(c => { window.__app.openOptions(); const b = window.__app.state.books.find(x => x.i === c); b.e = ''; b.g = []; }, COOK);
  await page.evaluate(() => document.querySelector('#btnGuessPub').click()); await wait(600);
  bs = await books();
  const toast = await page.evaluate(() => document.body.innerText.match(/Dedotte[^\n]*/)?.[0] || '');
  console.log('[bottone]', toast);
  assert(toast.includes('Dedotte 1 casa editrice'));
  assert.strictEqual(bs.find(b => b.i === COOK).e, 'Tea Tascabili');
  // premuto di nuovo: niente da fare
  await page.evaluate(() => document.querySelector('#btnGuessPub').click()); await wait(400);

  // tocco sull'etichetta "Da verificare": la toglie (con Annulla)
  await page.evaluate(() => { const b = window.__app.state.books.find(x => x.t && !x.g.length); b.g = ['e']; window.__app.setTab('lib'); }); await wait(200);
  const before = (await books()).filter(b => b.g.length).length;
  await page.evaluate(() => document.querySelector('[data-act="verify"]').click()); await wait(500);
  const after = (await books()).filter(b => b.g.length).length;
  console.log('[verifica]', before, '->', after);
  assert.strictEqual(after, before - 1);
  await page.evaluate(() => { const a = [...document.querySelectorAll('.toast button, #toast button')].find(x => /Annulla/.test(x.textContent)); if (a) a.click(); }); await wait(400);
  assert.strictEqual((await books()).filter(b => b.g.length).length, before);

  // la rete: prima Google, SBN/proxy mai interrogati
  console.log('[reti]', [...new Set(hits)].join(' | '));
  assert(!hits.some(h => /allorigins|codetabs|corsproxy|opac\.sbn/.test(h)));
  const firstExt = hits.find(h => /googleapis|openlibrary|crossref/.test(h));
  assert(/googleapis/.test(firstExt), 'Google è la prima banca dati interrogata');
  await page.screenshot({ path: CFG.OUT + '/s_pub.png', fullPage: true });
  console.log('ERRORI:', errors.length ? errors : 'nessuno');
  assert(!errors.length);
  console.log('e2e4 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
