const CFG = require("./_config");
const assert = require('assert');
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = CFG.APP, IMG = CFG.IMG;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': (p.endsWith('.wasm.js') ? 'text/javascript' : MIME[path.extname(f)]) || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(8173);
const ISBN = fs.readFileSync(IMG + '/isbn.txt', 'utf8').trim();
const gItem = (id, t, a, e, y, lang, isbn) => ({ id, volumeInfo: { title: t, authors: [a], publisher: e, publishedDate: y, language: lang, industryIdentifiers: isbn ? [{ type: 'ISBN_13', identifier: isbn }] : [], imageLinks: { thumbnail: 'http://books.google.com/t/' + id + '.png' } } });
const png1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAf9JkWQAAAABJRU5ErkJggg==', 'base64');
let mode = 'ok';   // ok | empty | fail
const FERRANTE = [
  gItem('A1', "L'amica geniale", 'Elena Ferrante', 'E/O', '2011', 'it', '9788866321378'),
  gItem('A3', 'Storia del nuovo cognome', 'Elena Ferrante', 'E/O', '2012', 'it', '9788866322214'),
  gItem('A5', 'Storia di chi fugge e di chi resta', 'Elena Ferrante', 'E/O', '2013', 'it', '9788866323211'),
  gItem('A6', "La figlia oscura", 'Elena Ferrante', 'E/O', '2006', 'it', '9788876417252')];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => { if (!localStorage.getItem('catalogo-libri-set')) localStorage.setItem('catalogo-libri-set', JSON.stringify({ openAll: true })); });   // questi test controllano i campi delle schede aperte
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith('http://localhost:8173')) return req.continue();
    const json = (o, status = 200) => req.respond({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (u.includes('googleapis.com/books/v1/volumes')) {
      if (mode === 'fail') return json({ error: 'x' }, 500);
      const q = new URL(u).searchParams.get('q');
      if (q.startsWith('isbn:')) return q.slice(5) === ISBN ? json({ items: [gItem('IT1', 'Il nome della rosa', 'Umberto Eco', 'Bompiani', '2012', 'it', ISBN)] }) : json({ totalItems: 0 });
      return mode === 'empty' ? json({ totalItems: 0 }) : json({ items: FERRANTE });
    }
    if (u.includes('openlibrary.org')) return mode === 'fail' ? json({}, 500) : json({});
    if (u.includes('books.google.com')) return req.respond({ status: 200, contentType: 'image/png', body: png1 });
    if (u.includes('fonts.')) return req.respond({ status: 200, contentType: 'text/css', body: '' });
    req.abort();
  });

  await page.goto('http://localhost:8173/?vista=elenco', { waitUntil: 'load' }); await sleep(400);
  await page.evaluate(() => { window.__app.settings.price = false; });
  const first = () => page.evaluate(() => { const b = window.__app.state.books[0]; if (!b) return null; const s = window.__app.S[b.id] || {}; return { id: b.id, t: b.t, a: b.a, i: b.i, g: b.g, st: s.st, man: !!s.manual }; });
  const reset = () => page.evaluate(() => { window.__app.state.books.length = 0; for (const k in window.__app.S) delete window.__app.S[k]; });
  const manOpen = () => page.$eval('#manSheet', e => !e.hidden);
  const settle = (ms = 150000) => page.waitForFunction(() => { const b = window.__app.state.books[0]; const s = b && window.__app.S[b.id]; return b && (!s || !s.st || s.st === 'choose' || s.st === 'error' || s.st === 'nf'); }, { timeout: ms, polling: 300 });

  // 1) nessun libro trovato online: la finestra per scrivere titolo e autore si apre da sola, con il testo letto come base
  mode = 'empty'; await reset(); await (await page.$('#fileCam')).uploadFile(IMG + '/cover.jpg');
  await settle(); let r = await first(); console.log('[1 non trovato]', JSON.stringify(r));
  assert.strictEqual(r.st, 'nf');
  await page.waitForFunction(() => !document.querySelector('#manSheet').hidden, { timeout: 3000 });
  const pre = await page.evaluate(() => ({ t: document.querySelector('#manT').value, a: document.querySelector('#manA').value, img: !document.querySelector('#manImg').hidden, msg: document.querySelector('#manMsg').textContent }));
  console.log('  precompilato:', JSON.stringify(pre)); assert(pre.img && /Non ho trovato/.test(pre.msg));
  await page.screenshot({ path: CFG.OUT + '/man_sheet.png' });
  // riga: pulsanti «Scrivi titolo e autore» e «Usa il testo letto»
  const btns = await page.$$eval('#list .row [data-act]', els => els.map(e => e.dataset.act)); console.log('  pulsanti riga:', btns); assert(btns.includes('manual') && btns.includes('ocrtext'));
  // titolo vuoto: avviso
  await page.evaluate(() => { document.querySelector('#manT').value = ''; document.querySelector('#manA').value = ''; }); await page.click('#manSave'); await sleep(150);
  assert(!(await page.$eval('#manErr', e => e.hidden)) && await manOpen());
  const ch0 = await page.evaluate(() => window.__app.chimes());
  await page.type('#manT', 'Il pendolo di Foucault'); await page.keyboard.press('Enter'); await page.type('#manA', 'Umberto Eco'); await page.keyboard.press('Enter'); await sleep(300);
  r = await first(); console.log('  salvato:', JSON.stringify(r));
  assert(!(await manOpen()) && r.t === 'Il pendolo di Foucault' && r.a === 'Umberto Eco' && !r.st && !r.g.includes('t'));
  assert.strictEqual(await page.evaluate(() => window.__app.chimes()), ch0 + 1, 'suono di completato');
  const cov = await page.evaluate(id => !!document.querySelector('#list .row[data-id="' + id + '"] img'), r.id); assert(cov, 'la foto e\' la copertina');

  // 2) piu' edizioni possibili: «Nessuno: scrivo io titolo e autore»
  mode = 'ok'; await reset(); await (await page.$('#fileCam')).uploadFile(IMG + '/author_only.jpg');
  await settle(); r = await first(); console.log('[2 scelta]', r.st);
  if (r.st === 'choose') {
    assert(await page.$('#list .row [data-act="manual"]'), 'anche qui «Scrivi a mano»');
    if (await page.$eval('#pickSheet', e => e.hidden)) await page.click('#list [data-act="choose"]'); await sleep(300);   // v83: la scelta si apre da sola
    await page.click('#pickMan'); await sleep(300); assert(await manOpen());
    await page.evaluate(() => { document.querySelector('#manT').value = ''; document.querySelector('#manA').value = ''; });
    await page.type('#manT', 'Titolo mio'); await page.click('#manSave'); await sleep(300);
    r = await first(); assert(r.t === 'Titolo mio' && !r.st);
  }

  // 3) copertina illeggibile: errore con «Scrivi a mano» in evidenza, la finestra si apre da sola
  await reset(); await (await page.$('#fileCam')).uploadFile(IMG + '/cover_blank.jpg');
  await settle(); r = await first(); console.log('[3 illeggibile]', JSON.stringify(r));
  assert(r.st === 'error' && await page.$('#list .row .btn.primary[data-act="manual"]'));
  await page.waitForFunction(() => !document.querySelector('#manSheet').hidden, { timeout: 3000 });
  await page.click('#manCancel'); await sleep(200); assert(!(await manOpen()));
  await page.screenshot({ path: CFG.OUT + '/man_row.png' });

  // 4) mentre legge ancora la foto: «Scrivi a mano» subito, e la ricerca si ferma
  mode = 'ok'; await reset(); await (await page.$('#fileCam')).uploadFile(IMG + '/cover.jpg');
  await page.waitForSelector('#list .row [data-act="manual"]', { timeout: 10000 });
  r = await first(); console.log('[4 durante la lettura]', r.st);
  await page.evaluate(() => document.querySelector('#list .row [data-act="manual"]').click()); await sleep(200); assert(await manOpen());
  assert(/smetto di cercarlo/.test(await page.$eval('#manMsg', e => e.textContent)));
  await page.evaluate(() => { document.querySelector('#manT').value = ''; }); await page.type('#manT', 'Scritto da me'); await page.click('#manSave'); await sleep(200);
  await page.waitForFunction(() => window.__app.state.books[0] && window.__app.S[window.__app.state.books[0].id] && !window.__app.S[window.__app.state.books[0].id].st, { timeout: 5000 });
  await sleep(25000);   // la lettura della foto finisce senza toccare il libro
  r = await first(); console.log('  dopo la lettura:', JSON.stringify(r)); assert(r.t === 'Scritto da me' && !r.st);

  // 5) con il prezzo attivo (v83): niente domanda del prezzo a parte, titolo, autore e prezzo nella stessa finestra
  await page.evaluate(() => { window.__app.settings.price = true; });
  mode = 'empty'; await reset(); await (await page.$('#fileCam')).uploadFile(IMG + '/cover.jpg');
  await page.waitForFunction(() => !document.querySelector('#manSheet').hidden, { timeout: 150000 });
  assert(await page.$eval('#priceAsk', e => e.hidden) && await page.$eval('#manP', e => !e.closest('.man-p').hidden), 'prezzo nella finestra a mano');
  const ch1 = await page.evaluate(() => window.__app.chimes());
  await page.evaluate(() => { document.querySelector('#manT').value = 'Con prezzo'; });
  await page.type('#manP', '12'); await page.click('#manSave'); await sleep(300);
  assert.strictEqual(await page.evaluate(() => window.__app.chimes()), ch1 + 1, 'suono di completato');
  r = await first(); assert(r.t === 'Con prezzo');
  assert.strictEqual(await page.evaluate(() => window.__app.state.books[0].c), 12);
  await page.evaluate(() => { window.__app.settings.price = false; });

  // 6) volume accanto al titolo nella vista compatta
  await reset();
  await page.evaluate(() => { window.__app.settings.openAll = false; window.__app.state.books.push({ id: 'v1', t: 'Il trono di spade', a: 'George R. R. Martin', e: '', y: '', c: null, i: '', g: [], img: '', imgL: '', nf: false, ts: 5, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: '', rt: 0, rd: '', se: 'Le cronache del ghiaccio e del fuoco', sn: '3', sq: '' }, { id: 'v2', t: 'Senza serie', a: 'X', e: '', y: '', c: null, i: '', g: [], img: '', imgL: '', nf: false, ts: 4, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: '', rt: 0, rd: '' }); window.__app.setTab('lib'); });
  await sleep(300);
  const titles = await page.$$eval('#list .row.closed .sum-t', els => els.map(e => e.textContent)); console.log('[6 volume]', titles);
  assert(titles.includes('Il trono di spade, 3') && titles.includes('Senza serie'));
  await page.screenshot({ path: CFG.OUT + '/vol.png' });
  assert.deepStrictEqual(errors, []);
  console.log('e2e53 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
