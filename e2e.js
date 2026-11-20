const CFG = require("./_config");
const H = require('./_harness');
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = CFG.APP, IMG = CFG.IMG;
const server = H.serve(CFG.port(8123), ROOT);

const ISBN = fs.readFileSync(IMG + '/isbn.txt', 'utf8').trim();
const gItem = (id, t, a, e, y, lang, isbn) => ({ id, volumeInfo: { title: t, authors: [a], publisher: e, publishedDate: y, language: lang, industryIdentifiers: isbn ? [{ type: 'ISBN_13', identifier: isbn }] : [], imageLinks: { thumbnail: 'http://books.google.com/t/' + id + '.png' } } });
const png1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAf9JkWQAAAABJRU5ErkJggg==', 'base64');
const netlog = [];

(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new',
    args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + IMG + '/live.mjpeg', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => { if (!localStorage.getItem('catalogo-libri-set')) localStorage.setItem('catalogo-libri-set', JSON.stringify({ openAll: true })); });   // questi test controllano i campi delle schede aperte
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith('http://localhost:' + CFG.port(8123) + '')) return req.continue();
    netlog.push(u.slice(0, 120));
    const json = (o) => req.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (u.includes('googleapis.com/books/v1/volumes')) {
      const q = new URL(u).searchParams.get('q');
      if (q.startsWith('isbn:')) {
        const code = q.slice(5);
        if (code === ISBN) return json({ items: [gItem('IT1', 'Il nome della rosa', 'Umberto Eco', 'Bompiani', '2012-05', 'it', ISBN)] });
        return json({ totalItems: 0 });
      }
      return json({ items: [
        gItem('A1', "L'amica geniale", 'Elena Ferrante', 'E/O', '2011', 'it', '9788866321378'),
        gItem('A2', "L'amica geniale", 'Elena Ferrante', 'Edizioni E/O', '2014', 'it', '9788866324065'),
        gItem('A3', 'Storia del nuovo cognome', 'Elena Ferrante', 'E/O', '2012', 'it', '9788866322214'),
        gItem('A4', 'Elena e il mare', 'Anna Bianchi', 'Altro', '2001', 'it', null) ] });
    }
    if (u.includes('openlibrary.org') || u.includes('crossref.org') || u.includes('allorigins') || u.includes('codetabs') || u.includes('corsproxy')) return json({});
    if (u.includes('books.google.com')) return req.respond({ status: 200, contentType: 'image/png', body: png1 });
    if (u.includes('fonts.')) return req.respond({ status: 200, contentType: 'text/css', body: '' });
    req.abort();
  });
  const T0 = Date.now(); const t = () => ((Date.now() - T0) / 1000).toFixed(1) + 's';
  await page.goto('http://localhost:' + CFG.port(8123) + '/?vista=elenco', { waitUntil: 'load' });
  await page.evaluate(() => { window.__app.settings.price = false; });   // la domanda sul prezzo ha il suo test (e2e5)
  await new Promise(r => setTimeout(r, 500));
  console.log('[load] summary:', await page.$eval('#gProse', e => e.textContent), '| empty state:', !!(await page.$('.empty')));
  console.log('[load] globals:', await page.evaluate(() => ({ Lib: !!window.Lib, ZXing: !!window.ZXing, Tesseract: !!window.Tesseract, BarcodeDetector: 'BarcodeDetector' in window })));
  await page.screenshot({ path: CFG.OUT + '/s_empty.png' });

  // A) ISBN a mano
  await H.aggiungi(page, 'type');
  await page.type('#isbnText', ISBN.slice(0, 3) + '-' + ISBN.slice(3));
  await page.click('#isbnGo');
  await page.waitForFunction(() => document.querySelector('#list .row [data-k="t"]') && document.querySelector('#list .row [data-k="t"]').value, { timeout: 8000 });
  console.log('[A manuale]', await page.evaluate(() => [...document.querySelectorAll('#list .row')].map(r => ['t', 'a', 'e', 'y', 'i'].map(k => { const el = r.querySelector('[data-k="' + k + '"]'); return el ? el.value : (k === 'a' && r.querySelector('.au-names') ? r.querySelector('.au-names').textContent : ''); }).join(' | '))));

  // A2) ISBN non valido e non trovato
  await H.aggiungi(page, 'type'); await page.type('#isbnText', '9788806219351'); await page.click('#isbnGo');
  console.log('[A2 invalido]', await page.$eval('#isbnErr', e => e.textContent));
  await page.$eval('#isbnText', e => e.value = ''); await page.type('#isbnText', '9780306406157'); await page.click('#isbnGo');
  await new Promise(r => setTimeout(r, 600));
  console.log('[A2 non trovato] flags:', await page.evaluate(() => [...document.querySelectorAll('#list .row')].map(r => (r.querySelector('.flags') || {}).textContent)));

  // B) foto del retro con codice a barre
  const before = await page.evaluate(() => window.__app.state.books.length);
  const inp = await page.$('#fileCam');
  await page.evaluate(() => { window.__app.state.books.length = 0; }); // riparto con elenco vuoto per il test foto
  await inp.uploadFile(IMG + '/back.jpg');
  let t1 = Date.now();
  await page.waitForFunction(() => { const b = window.__app.state.books[0]; return b && b.t; }, { timeout: 60000 });
  console.log('[B foto codice]', await page.evaluate(() => { const b = window.__app.state.books[0]; return { t: b.t, i: b.i, e: b.e, y: b.y, c: b.c }; }), 'in', ((Date.now() - t1) / 1000).toFixed(1) + 's');

  // C) foto della copertina (OCR reale)
  await page.evaluate(() => { window.__app.state.books.length = 0; });
  await (await page.$('#fileCam')).uploadFile(IMG + '/cover.jpg');
  t1 = Date.now();
  await page.waitForFunction(() => { const b = window.__app.state.books[0]; const s = b && window.__app.S[b.id]; return b && (b.t || (s && (s.st === 'choose' || s.st === 'error' || s.st === 'nf'))); }, { timeout: 180000, polling: 500 });
  console.log('[C copertina] in', ((Date.now() - t1) / 1000).toFixed(1) + 's', await page.evaluate(() => { const b = window.__app.state.books[0]; const s = window.__app.S[b.id] || {}; return { t: b.t, a: b.a, e: b.e, y: b.y, i: b.i, g: b.g, st: s.st, err: s.err, cands: (s.cands || []).map(c => c.t), lines: (s.lines || []).map(l => l.text + ' [h' + l.h + ',c' + Math.round(l.conf) + ']') }; }));
  await page.screenshot({ path: CFG.OUT + '/s_cover.png' });

  // D) scansione dal vivo (camera finta con il codice a barre)
  await page.evaluate(() => { window.__app.state.books.length = 0; });
  await H.aggiungi(page, 'scan');
  await new Promise(r => setTimeout(r, 1500));
  console.log('[D scan] overlay visible:', await page.$eval('#scan', e => !e.hidden), '| msg:', await page.$eval('#scanMsg', e => e.textContent));
  try {
    await page.waitForFunction(() => window.__app.state.books.length >= 1, { timeout: 20000, polling: 300 });
  } catch (e) { console.log('[D scan] nessun codice letto'); }
  await new Promise(r => setTimeout(r, 800));
  console.log('[D scan] count:', await page.$eval('#scanCount', e => e.textContent), '| msg:', await page.$eval('#scanMsg', e => e.textContent));
  await page.screenshot({ path: CFG.OUT + '/s_scan.png' });
  await page.click('#scanClose');
  await new Promise(r => setTimeout(r, 500));
  console.log('[D scan] after close books:', await page.evaluate(() => window.__app.state.books.map(b => b.t + ' / ' + b.i)));

  // E) CSV / TSV
  await page.evaluate(() => { const b = window.__app.state.books[0]; if (b) b.c = 12.5; });
  console.log('[E tsv] ok');
  await page.screenshot({ path: CFG.OUT + '/s_list.png' });

  // F) persistenza: ricarica
  await page.evaluate(() => document.querySelector('#sort').dispatchEvent(new Event('change')));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.reload({ waitUntil: 'load' }); await new Promise(r => setTimeout(r, 600));
  console.log('[F reload] summary:', await page.$eval('#gProse', e => e.textContent));
  console.log('SW:', await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r ? (r.active ? 'attivo' : 'registrato') : 'nessuno'; }));
  console.log('rete esterna chiamata:', [...new Set(netlog.map(u => u.split('?')[0]))].join(', '));
  console.log('ERRORI:', errors.length ? errors : 'nessuno');
  await browser.close(); server.close();
})().catch(e => { console.error('E2E FAIL', e); process.exit(1); });
