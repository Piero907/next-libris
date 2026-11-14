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
}).listen(8175);
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
    if (u.startsWith('http://localhost:8175')) return req.continue();
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


  await page.goto('http://localhost:8175/?vista=elenco', { waitUntil: 'load' }); await sleep(400);
  const first = () => page.evaluate(() => { const b = window.__app.state.books[0]; if (!b) return null; const s = window.__app.S[b.id] || {}; return { id: b.id, t: b.t, a: b.a, i: b.i, c: b.c, st: s.st }; });
  const reset = () => page.evaluate(() => { window.__app.state.books.length = 0; for (const k in window.__app.S) delete window.__app.S[k]; window.__app.renderList && 0; });
  const vis = sel => page.$eval(sel, e => !e.hidden);
  const upload = f => page.$('#fileCam').then(h => h.uploadFile(CFG.IMG + '/' + f));
  async function watchPct(until) {            // segue la percentuale finche' la finestra e' aperta
    const seen = []; const t0 = Date.now();
    while (Date.now() - t0 < 150000) {
      const o = await page.evaluate(() => ({ open: !document.querySelector('#recSheet').hidden, pct: document.querySelector('#recPct').textContent, msg: document.querySelector('#recMsg').textContent }));
      if (o.open) { if (!seen.length || seen[seen.length - 1].pct !== o.pct) seen.push(o); } else if (await until()) break;
      await sleep(60);
    }
    return seen;
  }

  // 1) copertina riconosciuta: niente «Libro aggiunto» subito, la finestra con l'avanzamento; poi il prezzo con titolo e autore
  mode = 'ok'; await reset(); await upload('cover_noisy.jpg');
  await sleep(150);
  assert(await vis('#recSheet') && !(await vis('#priceAsk')), 'prima l\'avanzamento, non il prezzo');
  await page.screenshot({ path: CFG.OUT + '/rec_sheet.png' });
  let seen = await watchPct(() => vis('#priceAsk'));
  console.log('[1 avanzamento]', seen.map(x => x.pct).join(' '), '|', [...new Set(seen.map(x => x.msg))].join(' / '));
  const nums = seen.map(x => parseInt(x.pct, 10));
  assert(nums.length >= 3 && nums.every((n, i) => i === 0 || n >= nums[i - 1]) && Math.max(...nums) >= 40, 'percentuale che sale');
  await page.waitForFunction(() => document.querySelector('#priceAskT').textContent === "L'amica geniale", { timeout: 10000 });
  await page.type('#priceAskIn', '18'); await page.keyboard.press('Enter'); await sleep(300);
  let r = await first(); console.log('  libro:', JSON.stringify(r)); assert(r.t === "L'amica geniale" && r.c === 18);

  // 2) piu' edizioni: la scelta si apre da sola, poi il prezzo
  await reset(); await upload('author_only.jpg');
  await watchPct(() => vis('#pickSheet'));
  assert(await vis('#pickSheet'), 'scelta aperta da sola');
  await page.click('#pickList li:nth-child(2) .cand'); await sleep(300);
  assert(await vis('#priceAsk'), 'dopo la scelta il prezzo');
  await page.click('#priceSkip'); await sleep(200);
  r = await first(); console.log('[2 scelta]', JSON.stringify(r)); assert(r.t && !r.st);

  // 3) non trovato: titolo, autore e prezzo nella stessa finestra
  mode = 'empty'; await reset(); await upload('cover.jpg');
  await watchPct(() => vis('#manSheet'));
  assert(await vis('#manSheet') && await page.$eval('#manP', e => !e.closest('.man-p').hidden), 'a mano con il prezzo');
  assert(!(await vis('#priceAsk')));
  await page.screenshot({ path: CFG.OUT + '/man_price.png' });
  await page.evaluate(() => { document.querySelector('#manT').value = 'Mio titolo'; document.querySelector('#manA').value = 'Mio autore'; });
  await page.type('#manP', 'abc'); await page.click('#manSave'); await sleep(150);
  assert(await vis('#manSheet') && /prezzo/.test(await page.$eval('#manErr', e => e.textContent)), 'prezzo sbagliato: avviso');
  await page.evaluate(() => { document.querySelector('#manP').value = ''; }); await page.type('#manP', '12,50'); await page.click('#manSave'); await sleep(300);
  r = await first(); console.log('[3 a mano]', JSON.stringify(r)); assert(r.t === 'Mio titolo' && r.a === 'Mio autore' && r.c === 12.5 && !r.st);

  // 4) foto del retro con il codice a barre: dritto al prezzo
  mode = 'ok'; await reset(); await upload('back.jpg');
  await watchPct(() => vis('#priceAsk'));
  assert(await vis('#priceAsk')); await page.waitForFunction(() => document.querySelector('#priceAskT').textContent === 'Il nome della rosa', { timeout: 10000 });
  await page.click('#priceSkip'); await sleep(200);

  // 5) «Scrivi a mano» mentre legge: subito la finestra, la ricerca si ferma
  mode = 'ok'; await reset(); await upload('cover.jpg'); await sleep(300);
  assert(await vis('#recSheet')); await page.click('#recMan'); await sleep(200);
  assert(await vis('#manSheet') && !(await vis('#recSheet')));
  await page.evaluate(() => { document.querySelector('#manT').value = 'Scritto subito'; }); await page.click('#manSave'); await sleep(200);
  await sleep(6000); r = await first(); assert(r.t === 'Scritto subito' && !r.st && !(await vis('#pickSheet')) && !(await vis('#priceAsk')));

  // 6) «Continua dopo»: la finestra si chiude, il libro resta in lavorazione nell'elenco e non si riapre nulla da solo
  mode = 'empty'; await reset(); await upload('cover.jpg'); await sleep(300);
  await page.click('#recBg'); await sleep(200); assert(!(await vis('#recSheet')));
  await page.waitForFunction(() => { const b = window.__app.state.books[0]; return b && window.__app.S[b.id] && window.__app.S[b.id].st === 'nf'; }, { timeout: 120000 });
  await sleep(500); assert(!(await vis('#manSheet')), 'niente finestra da sola dopo «Continua dopo»');
  assert(await page.$('#list .row [data-act="manual"]'));

  // 7) prezzo spento: riconosciuto -> solo un messaggio
  await page.evaluate(() => { window.__app.settings.price = false; });
  mode = 'ok'; await reset(); await upload('cover_noisy.jpg');
  await watchPct(async () => !(await vis('#recSheet')) && !!(await first()).t);
  assert(!(await vis('#priceAsk'))); console.log('[7 senza prezzo] toast:', await page.$eval('#toastTxt', e => e.textContent));
  await page.evaluate(() => { window.__app.settings.price = true; });
  assert.deepStrictEqual(errors, []);
  await browser.close();

  // 8) fotocamera: poca luce -> avviso; tocco sull'inquadratura -> messa a fuoco (cerchio)
  async function cam(video) {
    const br = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + CFG.IMG + '/' + video] });
    const pg = await br.newPage(); await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('http://localhost:8175/?vista=elenco', { waitUntil: 'load' }); await sleep(400);
    await pg.evaluate(() => document.querySelector('#btnPhoto').click()); await sleep(200);
    await pg.evaluate(() => document.querySelector('#photoCam').click());
    await pg.waitForFunction(() => { const v = document.querySelector('#snapVideo'); return !document.querySelector('#snap').hidden && v.videoWidth > 0; }, { timeout: 10000 });
    await sleep(1800);
    const info = await pg.evaluate(() => window.__app.snapInfo());
    await pg.tap('#snapVideo'); await sleep(150);
    const tap = await pg.evaluate(() => ({ taps: window.__app.snapInfo().taps, ring: !document.querySelector('#snapFocus').hidden }));
    if (video === 'dark.mjpeg') await pg.screenshot({ path: CFG.OUT + '/snap_dark.png' });
    await pg.evaluate(() => document.querySelector('#snapClose').click()); await sleep(200);
    assert.deepStrictEqual(errs, []);
    await br.close(); return Object.assign(info, tap);
  }
  const dark = await cam('dark.mjpeg'); console.log('[8 buio]', JSON.stringify(dark));
  assert(dark.dark && /Poca luce/.test(dark.msg) && dark.taps === 1 && dark.ring);
  const lit = await cam('pagina.mjpeg'); console.log('[8 luce]', JSON.stringify(lit));
  assert(!lit.dark && /mettere a fuoco/.test(lit.msg));
  console.log('e2e55 OK'); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
