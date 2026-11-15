const CFG = require("./_config");
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP, IMG = CFG.IMG;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8136));
const A = '9788806219352', B = '9788804668015', C = '9788807881213', D = '9788845292613', E = '9788817050562';
const TITLES = { [A]: ['Libro A', 'Autore Uno'], [B]: ['Il deserto dei Tartari', 'Dino Buzzati'], [C]: ['Libro C', 'Autore Tre'], [D]: ['Libro D', 'Autore Quattro'], [E]: ['Libro E', 'Autore Cinque'] };
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!localStorage.getItem('catalogo-libri-set')) localStorage.setItem('catalogo-libri-set', JSON.stringify({ installed: true, instScope: '/', swiped: true, lastBackup: Date.now(), price: false, openAll: true })); });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  let olOn = false, delay = 0; const hits = [];
  const png = n => fs.readFileSync(path.join(IMG, n + '.png'));
  await page.setRequestInterception(true);
  page.on('request', async req => {
    const u = req.url();
    if (u.startsWith('http://localhost:' + CFG.port(8136) + '')) return req.continue();
    hits.push(u);
    if (delay) await new Promise(r => setTimeout(r, delay));
    const j = o => req.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    const img = n => req.respond({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: png(n) });
    const nf = () => req.respond({ status: 404, body: '' });
    if (u.includes('googleapis.com/books/v1/volumes?')) {
      const q = decodeURIComponent(u.match(/q=([^&]*)/)[1]);
      if (q.startsWith('isbn:')) { const i = q.slice(5), t = TITLES[i] || ['?', '?']; return j({ items: [{ id: 'g' + i, volumeInfo: { title: t[0], authors: [t[1]], language: 'it', industryIdentifiers: [{ type: 'ISBN_13', identifier: i }] } }] }); }
      if (q.startsWith('intitle:"Il deserto dei Tartari"')) return j({ items: [
        { volumeInfo: { title: 'The Tartar Steppe', authors: ['Dino Buzzati'], language: 'en', imageLinks: { thumbnail: 'http://books.google.com/books/content?id=EN&img=1&zoom=1&edge=curl' } } },
        { volumeInfo: { title: 'Il deserto dei Tartari', authors: ['Dino Buzzati'], language: 'en', publisher: 'Penguin', imageLinks: { thumbnail: 'http://books.google.com/books/content?id=XX&img=1&zoom=1' } } },
        { volumeInfo: { title: 'Il deserto dei tartari. Romanzo', authors: ['Dino Buzzati'], language: 'it', publisher: 'Mondadori', imageLinks: { thumbnail: 'http://books.google.com/books/content?id=IT&img=1&zoom=1&edge=curl' } } }] });
      return j({});
    }
    if (u.startsWith('https://books.google.com/books/content')) return img('cov_thumb');
    if (u.includes('covers.openlibrary.org/b/isbn/' + A) && olOn) return img('cov_big');
    if (u.includes('covers.openlibrary.org/b/id/')) return img('cov_work');
    if (u.includes('covers.openlibrary.org')) return nf();
    if (u.includes('openlibrary.org/search.json')) return j({ docs: [] });
    if (/openlibrary|crossref/.test(u)) return j({});
    return nf();
  });
  await page.goto('http://localhost:' + CFG.port(8136) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const book = i => page.evaluate(i => JSON.parse(JSON.stringify(window.__app.state.books.find(b => b.i === i))), i);
  const sel = id => '#list .row[data-id="' + id + '"] [data-act="coverphoto"]';
  const toastTxt = () => page.$eval('#toast', e => e.hidden ? '' : document.querySelector('#toastTxt').textContent);
  async function add(i) {
    await page.evaluate(i => window.__app.addIsbn(i), i);
    await page.waitForFunction(i => { const b = window.__app.state.books.find(x => x.i === i); const s = b && window.__app.S[b.id]; return b && b.t && !(s && s.st); }, { timeout: 15000 }, i);
    await wait(600);
    const b = await book(i); assert(!b.img && !b.imgL, 'aggiunto senza copertina'); return b.id;
  }
  async function tap(id) { const el = await page.$(sel(id)); assert(el, 'c\'è la fotocamera'); await el.evaluate(e => e.scrollIntoView({ block: 'center' })); await el.tap(); }
  const ids = {};
  for (const i of [A, B, C, D, E]) ids[i] = await add(i);
  console.log('[0 aggiunti]', Object.keys(ids).length, '| errori', errors);

  // 1) stessa edizione (Open Library per ISBN, ora risponde): copertina messa, fotocamera NON aperta
  olOn = true; let chooser = false; const onCh = () => { chooser = true; };
  page.waitForFileChooser({ timeout: 3500 }).then(onCh, () => {});
  await tap(ids[A]); await wait(1500);
  let b = await book(A); console.log('[1 stessa edizione]', b.img, b.imgL, '|', await toastTxt(), '| fotocamera:', chooser);
  assert(b.img.includes('covers.openlibrary.org/b/isbn/' + A)); assert.strictEqual(b.imgL, b.img); assert.strictEqual(await toastTxt(), 'Copertina trovata.');
  assert(!(await page.$(sel(ids[A]))), 'la fotocamera sparisce: c\'è la copertina');
  await wait(2200); assert(!chooser, 'fotocamera non aperta');
  olOn = false;

  // 2) altra edizione: Google per titolo e autore, preferisce l'italiana; «Non è questa» la toglie e apre la fotocamera
  await tap(ids[B]); await wait(1500);
  b = await book(B); console.log('[2 altra edizione]', b.img, '|', await toastTxt());
  assert.strictEqual(b.img, 'https://books.google.com/books/content?id=IT&img=1&zoom=1'); assert(!b.imgL);
  assert((await toastTxt()).includes('un\'altra edizione'));
  const [ch2] = await Promise.all([page.waitForFileChooser({ timeout: 3000 }), page.click('#toastBtn')]);
  await ch2.cancel(); await wait(200);
  b = await book(B); assert(!b.img, 'tolta'); console.log('[2 non è questa] fotocamera aperta, copertina tolta');
  // ritoccando cerca di nuovo (ogni volta)
  let n0 = hits.length;
  await tap(ids[B]); await wait(1500);
  assert(hits.length > n0, 'nuova ricerca a ogni tocco'); b = await book(B); assert(b.img.includes('id=IT'));
  await page.evaluate(i => { const x = window.__app.state.books.find(b => b.i === i); x.img = ''; x.imgL = ''; }, B);

  // 3) nessuna copertina: la pagina propone di scattare una foto (non apre la fotocamera da sola)
  n0 = hits.length; let opened = false; page.waitForFileChooser({ timeout: 2500 }).then(() => { opened = true; }, () => {});
  await tap(ids[C]);
  await page.waitForFunction(() => !document.querySelector('#covSheet').hidden, { timeout: 8000 });
  const searched = hits.slice(n0);
  console.log('[3 nessuna]', await page.$eval('#covSheet', e => e.innerText.replace(/\s+/g, ' ')), '| richieste:', searched.length);
  assert(searched.some(u => u.includes('covers.openlibrary.org/b/isbn/' + C))); assert(searched.some(u => u.includes('intitle')));
  assert((await page.$eval('#covMsg', e => e.textContent)).includes('«Libro C»'));
  await wait(2600); assert(!opened, 'la fotocamera non si apre da sola');
  const [ch3] = await Promise.all([page.waitForFileChooser({ timeout: 3000 }), page.$eval('#covShot', e => e.click())]); await ch3.cancel();
  assert(await page.$eval('#covSheet', e => e.hidden));
  // secondo tocco: cerca ancora, poi ripropone; «Non ora» chiude
  n0 = hits.length; await tap(ids[C]);
  await page.waitForFunction(() => !document.querySelector('#covSheet').hidden, { timeout: 8000 });
  assert(hits.length > n0, 'cerca di nuovo'); await page.$eval('#covLater', e => e.click()); assert(await page.$eval('#covSheet', e => e.hidden));

  // 4) ricerca lenta: rotellina mentre cerca, poi la proposta
  delay = 1200;
  await tap(ids[D]); await wait(400);
  const busy = await page.$('#list .row[data-id="' + ids[D] + '"] .thumb.add.busy .spin');
  console.log('[4 rotellina]', !!busy); assert(busy);
  await page.waitForFunction(() => !document.querySelector('#covSheet').hidden, { timeout: 9000 });
  await page.$eval('#covLater', e => e.click()); delay = 0;

  // 5) senza rete: nessuna richiesta, propone subito la foto
  await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }));
  n0 = hits.length; await tap(ids[E]); await wait(200);
  assert.strictEqual(hits.length, n0); console.log('[5 offline]', await page.$eval('#covMsg', e => e.textContent));
  assert((await page.$eval('#covMsg', e => e.textContent)).includes('senza rete'));
  const [ch5] = await Promise.all([page.waitForFileChooser({ timeout: 2000 }), page.$eval('#covShot', e => e.click())]); await ch5.cancel();
  await page.evaluate(() => delete navigator.onLine);

  // 6) la copertina trovata resta dopo il riavvio
  await page.reload({ waitUntil: 'load' }); await wait(400);
  b = await book(A); assert(b.img.includes('/b/isbn/' + A));
  const shot = await page.$('#list .row[data-id="' + ids[A] + '"]'); await shot.screenshot({ path: CFG.OUT + '/cv_found.png' });
  assert.deepStrictEqual(errors, []);
  console.log('e2e25 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
