const CFG = require("./_config");
const H = require('./_harness');
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = CFG.APP, IMG = CFG.IMG;
const server = H.serve(CFG.port(8124), ROOT);
const ISBN = fs.readFileSync(IMG + '/isbn.txt', 'utf8').trim();
const gItem = (id, t, a, e, y, lang, isbn) => ({ id, volumeInfo: { title: t, authors: [a], publisher: e, publishedDate: y, language: lang, industryIdentifiers: isbn ? [{ type: 'ISBN_13', identifier: isbn }] : [], imageLinks: { thumbnail: 'http://books.google.com/t/' + id + '.png' } } });
const png1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAf9JkWQAAAABJRU5ErkJggg==', 'base64');
let mode = 'ok';   // ok | empty | fail
const FERRANTE = [
  gItem('A1', "L'amica geniale", 'Elena Ferrante', 'E/O', '2011', 'it', '9788866321378'),
  gItem('A3', 'Storia del nuovo cognome', 'Elena Ferrante', 'E/O', '2012', 'it', '9788866322214'),
  gItem('A5', 'Storia di chi fugge e di chi resta', 'Elena Ferrante', 'E/O', '2013', 'it', '9788866323211'),
  gItem('A6', "La figlia oscura", 'Elena Ferrante', 'E/O', '2006', 'it', '9788876417252')];
const sleep = H.wait;   // attesa «finché» (_harness.js)
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
    if (u.startsWith('http://localhost:' + CFG.port(8124) + '')) return req.continue();
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
  await page.goto('http://localhost:' + CFG.port(8124) + '/?vista=elenco', { waitUntil: 'load' }); await sleep(400);
  await page.evaluate(() => { window.__app.settings.price = false; });   // la domanda sul prezzo ha il suo test (e2e5)
  const first = () => page.evaluate(() => { const b = window.__app.state.books[0]; if (!b) return null; const s = window.__app.S[b.id] || {}; return { t: b.t, a: b.a, e: b.e, y: b.y, i: b.i, g: b.g, st: s.st, err: s.err, retry: s.retry, nc: (s.cands || []).length, lines: (s.lines || []).map(l => l.text) }; });
  const reset = () => page.evaluate(() => { window.__app.state.books.length = 0; for (const k in window.__app.S) delete window.__app.S[k]; });
  const settle = async (ms = 120000) => { const t0 = Date.now(); await page.waitForFunction(() => { const b = window.__app.state.books[0]; const s = b && window.__app.S[b.id]; return b && (!s || !s.st || s.st === 'choose' || s.st === 'error' || s.st === 'nf'); }, { timeout: ms, polling: 400 }); return ((Date.now() - t0) / 1000).toFixed(1) + 's'; };

  // 1) copertina sporca e storta
  await reset(); await (await page.$('#fileCam')).uploadFile(IMG + '/cover_noisy.jpg');
  let dt = await settle(); console.log('[1 sporca]', dt, JSON.stringify(await first()));

  // 2) solo autore -> scelta
  await reset(); await (await page.$('#fileCam')).uploadFile(IMG + '/author_only.jpg');
  dt = await settle(); const r2 = await first(); console.log('[2 ambigua]', dt, JSON.stringify(r2));
  if (r2 && r2.st === 'choose') {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: CFG.OUT + '/s_choose.png' });
    if (await page.$eval('#pickSheet', e => e.hidden)) { await page.click('#list [data-act="choose"]'); } await sleep(300);   // v83: con una foto sola la scelta si apre da sola
    await page.screenshot({ path: CFG.OUT + '/s_pick.png' });
    console.log('  candidati:', await page.$$eval('#pickList .cand b', els => els.map(e => e.textContent)));
    await page.click('#pickList li:nth-child(2) .cand'); await sleep(300);
    console.log('  dopo scelta:', JSON.stringify(await first()));
  }

  // 3) nessun risultato online -> testo letto
  mode = 'empty'; await reset(); await (await page.$('#fileCam')).uploadFile(IMG + '/cover.jpg');
  dt = await settle(); console.log('[3 nessun risultato]', dt, JSON.stringify(await first()));
  await page.waitForFunction(() => !document.querySelector('#manSheet').hidden, { timeout: 3000 });   // v81: si apre «Scrivi titolo e autore»
  console.log('  finestra titolo e autore:', await page.$eval('#manT', e => e.value)); await page.click('#manCancel'); await sleep(200);

  // 4) banche dati in errore -> riprova
  mode = 'fail'; await reset(); await H.aggiungi(page, 'type'); await page.type('#isbnText', ISBN); await page.click('#isbnGo'); await sleep(800);
  console.log('[4 errore server]', JSON.stringify(await first()));
  mode = 'ok';
  await page.click('#list [data-act="retry"]').catch(() => console.log('  nessun bottone riprova')); await sleep(800);
  console.log('  dopo riprova:', JSON.stringify(await first()));

  // 5) copertina illeggibile
  mode = 'ok'; await reset(); await (await page.$('#fileCam')).uploadFile(IMG + '/cover_blank.jpg');
  dt = await settle(); console.log('[5 illeggibile]', dt, JSON.stringify(await first()));
  await page.waitForFunction(() => !document.querySelector('#manSheet').hidden, { timeout: 3000 }); await page.click('#manCancel'); await sleep(200);
  await page.screenshot({ path: CFG.OUT + '/s_blank.png' });

  // 6) offline: ISBN salvato e completato al ritorno online
  await reset(); await page.setOfflineMode(true); await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { value: false, configurable: true }));
  await H.aggiungi(page, 'type'); await page.type('#isbnText', ISBN); await page.click('#isbnGo'); await sleep(600);
  console.log('[6 offline]', JSON.stringify(await first()), '| chip:', await page.$eval('#btnTodo', e => e.hidden ? '(nascosto)' : e.textContent));
  await page.setOfflineMode(false);
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { value: true, configurable: true }); window.dispatchEvent(new Event('online')); });
  await sleep(1200);
  console.log('  online di nuovo:', JSON.stringify(await first()));

  // 7) doppione da scansione/digitazione
  await H.aggiungi(page, 'type'); await page.type('#isbnText', ISBN); await page.click('#isbnGo'); await sleep(400);
  console.log('[7 doppione] libri:', await page.evaluate(() => window.__app.state.books.length), '| toast:', await page.$eval('#toastTxt', e => e.textContent));

  // 8) lista di più ISBN incollati
  await H.aggiungi(page, 'type'); await page.type('#isbnText', '9780306406157\n0306406152, 9788866321378'); await page.click('#isbnGo'); await sleep(900);
  console.log('[8 elenco]', await page.evaluate(() => window.__app.state.books.map(b => b.i + ':' + (b.t || '-'))), '| toast:', await page.$eval('#toastTxt', e => e.textContent));
  console.log('ERRORI:', errors.length ? errors : 'nessuno');
  await browser.close(); server.close();
})().catch(e => { console.error('E2E2 FAIL', e); process.exit(1); });
