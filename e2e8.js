const CFG = require("./_config");
const H = require('./_harness');
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP, IMG = CFG.IMG;
const server = H.serve(CFG.port(8134), ROOT);
const B = (o) => Object.assign({ t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: Date.now(), sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false }, o);
const gimg = (id, z) => 'https://books.google.com/books/content?id=' + id + '&printsec=frontcover&img=1&zoom=' + z + '&source=gbs_api';
const books = [
  B({ id: 'g1', t: 'Il nome della rosa', a: 'Umberto Eco', i: '9788806219352', img: gimg('AAA', 1) }),
  B({ id: 'g2', t: 'Le città invisibili', a: 'Italo Calvino', i: '9788804668015', img: gimg('BBB', 1) }),
  B({ id: 'g3', t: 'Lessico famigliare', a: 'Natalia Ginzburg', i: '9788806219000', img: gimg('DDD', 1) }),
  B({ id: 'ph', t: 'Senza copertina', a: 'Anonimo' }),
];
const jpg = n => ({ status: 200, contentType: 'image/jpeg', body: fs.readFileSync(IMG + '/' + n) });
const json = o => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
let apiCalls = [];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => { const u = r.url();
    if (u.startsWith('http://localhost')) return r.continue();
    if (u.includes('/books/v1/volumes/')) { apiCalls.push(u.split('/volumes/')[1].split('?')[0]);
      const id = u.split('/volumes/')[1].split('?')[0];
      if (id === 'AAA' || id === 'CCC') return r.respond(json({ volumeInfo: { imageLinks: { thumbnail: gimg(id, 1), medium: 'http://books.google.com/books/content?id=' + id + '&printsec=frontcover&img=1&zoom=3&edge=curl&source=gbs_api' } } }));
      return r.respond(json({ volumeInfo: { imageLinks: { thumbnail: gimg(id, 1) } } })); }
    if (u.includes('googleapis.com/books/v1/volumes?')) return r.respond(json({ items: [{ id: 'CCC', volumeInfo: { title: 'Sostiene Pereira', authors: ['Antonio Tabucchi'], publishedDate: '1994', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9788807881213' }], imageLinks: { thumbnail: gimg('CCC', 1) } } }] }));
    if (/\/books\/content\?id=(AAA|CCC)&/.test(u) && u.includes('zoom=3')) return r.respond(jpg('g_big.jpg'));   // solo questi hanno la versione grande (16/11/2026: si prova lo stesso indirizzo con zoom=0 e 3, senza /volumes/)
    if (u.includes('/books/content?id=')) return r.respond(jpg('g_small.jpg'));
    if (u.includes('covers.openlibrary.org/b/isbn/9788804668015')) return r.respond(jpg('ol_big.jpg'));
    if (u.includes('covers.openlibrary.org')) return r.respond({ status: 404, body: 'nf' });
    if (u.includes('openlibrary.org') || u.includes('crossref')) return r.respond(json({}));
    r.abort(); });
  await page.evaluateOnNewDocument((b) => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), price: false })); sessionStorage.seeded = 1; } }, books);
  await page.goto('http://localhost:' + CFG.port(8134) + '/?vista=elenco', { waitUntil: 'networkidle0' });
  const wait = H.wait;   // attesa «finché» (_harness.js)
  const lb = () => page.evaluate(() => ({ open: !document.querySelector('#lightbox').hidden, src: (document.querySelector('#lbImg').getAttribute('src') || '').slice(0, 100), w: document.querySelector('#lbImg').naturalWidth, note: document.querySelector('#lbNote').textContent, photo: document.querySelector('#lbPhoto').textContent, reset: document.querySelector('#lbReset').hidden ? '' : document.querySelector('#lbReset').textContent }));
  const click = sel => page.evaluate(s => document.querySelector(s).click(), sel);
  const book = id => page.evaluate(i => { const b = window.__app.state.books.find(x => x.id === i); return b && { img: b.img, imgL: b.imgL }; }, id);

  // 1) copertina grande di Google (stesso indirizzo, zoom più alto, senza chiedere alle API): si vede e viene ricordata
  await click('#list .row[data-id="g1"] .sum-img');
  await page.waitForFunction(() => document.querySelector('#lbImg').naturalWidth === 800, { timeout: 8000 });
  let s = await lb(); console.log('[1]', JSON.stringify(s));
  assert(s.src.includes('zoom=3') && !s.src.includes('edge=curl') && s.note === '' && s.photo === 'Usa una mia foto' && s.reset === '');
  assert((await book('g1')).imgL.includes('zoom=3'));
  assert.strictEqual(apiCalls.length, 0, 'nessuna richiesta /volumes/ alle API di Google');
  await click('#lbClose'); await wait(200);
  // riaperta: niente nuova richiesta a Google
  const n0 = apiCalls.length; await click('#list .row[data-id="g1"] .sum-img'); await wait(400);
  assert.strictEqual(apiCalls.length, n0); assert((await lb()).w === 800); await click('#lbClose'); await wait(200);

  // 2) Google senza versione grande -> Open Library per ISBN
  await click('#list .row[data-id="g2"] .sum-img');
  await page.waitForFunction(() => document.querySelector('#lbImg').naturalWidth === 500, { timeout: 8000 });
  assert((await book('g2')).imgL.includes('openlibrary')); await click('#lbClose'); await wait(200);
  // 3) nessuna versione grande: lo dice e propone la tua foto
  await click('#list .row[data-id="g3"] .sum-img');
  await page.waitForFunction(() => /Non esiste una versione più grande/.test(document.querySelector('#lbNote').textContent), { timeout: 8000 });
  assert.strictEqual((await book('g3')).imgL, ''); console.log('[3]', (await lb()).note);
  // 4) «Usa una mia foto» dal visore: la foto diventa la copertina, salvata sul telefono
  const [ch] = await Promise.all([page.waitForFileChooser(), click('#lbPhoto')]);
  await ch.accept([IMG + '/cover.jpg']);
  await page.waitForFunction(() => /^blob:/.test(document.querySelector('#lbImg').src), { timeout: 8000 });
  s = await lb(); console.log('[4 mia foto]', s.w, s.photo, '|', s.reset);
  assert(s.w >= 500 && s.photo === 'Rifai la foto' && s.reset === 'Torna alla copertina scaricata');
  await page.screenshot({ path: CFG.OUT + '/s_myphoto.png' });
  await click('#lbClose'); await wait(200);
  assert(/^blob:/.test(await page.$eval('#list .row[data-id="g3"] .sum-img img', e => e.src)));

  // 5) libro senza nessuna copertina: nella scheda aperta il riquadro tratteggiato fotografa la copertina
  await click('#list .row[data-id="ph"] .sum'); await wait(150);
  await click('#list .row[data-id="ph"] .thumb.add');
  await page.waitForFunction(() => !document.querySelector('#covSheet').hidden, { timeout: 9000 });   // prima la cerca online, poi propone la foto
  const [ch2] = await Promise.all([page.waitForFileChooser(), click('#covShot')]);
  await ch2.accept([IMG + '/cover_noisy.jpg']);
  await page.waitForFunction(() => document.querySelector('#list .row[data-id="ph"] .thumb.zoom img'), { timeout: 8000 });
  await click('#list .row[data-id="ph"] .thumb.zoom'); await wait(300);
  s = await lb(); assert(s.reset === 'Togli la mia foto'); await click('#lbClose'); await wait(200);

  // 6) dopo il riavvio le tue foto ci sono ancora
  await page.reload({ waitUntil: 'networkidle0' }); await wait(500);
  assert(/^blob:/.test(await page.$eval('#list .row[data-id="g3"] .sum-img img', e => e.src)));
  assert(/^blob:/.test(await page.$eval('#list .row[data-id="ph"] .sum-img img', e => e.src)));
  console.log('[6 dopo riavvio] foto presenti');

  // 7) backup con le foto (condivisione simulata) e ripristino
  await page.evaluate(() => { window.__shared = null; navigator.canShare = () => true; navigator.share = async (d) => { window.__shared = await d.files[0].text(); }; });
  await click('#btnExport');
  await page.waitForFunction(() => !document.querySelector('#btnShareBackup').disabled && /comprende 2 tue foto/.test(document.querySelector('#backupNote').textContent), { timeout: 8000 });
  console.log('[7]', await page.$eval('#backupNote', e => e.textContent));
  await click('#btnShareBackup'); await wait(400);
  const bk = JSON.parse(await page.evaluate(() => window.__shared));
  assert.deepStrictEqual(Object.keys(bk.covers).sort(), ['g3', 'ph']); assert(bk.covers.ph.startsWith('data:image/jpeg'));
  assert(bk.books.find(b => b.id === 'g1').imgL.includes('zoom=3'));
  fs.writeFileSync(CFG.OUT + '/backup_covers.json', JSON.stringify(bk));
  await click('#exportClose');
  // cancello libro e foto, poi ripristino
  await page.evaluate(async () => { const A = window.__app; A.state.books.splice(A.state.books.findIndex(b => b.id === 'ph'), 1);
    await new Promise(r => { const q = indexedDB.open('catalogo-libri', 1); q.onsuccess = () => { const tx = q.result.transaction('covers', 'readwrite'); tx.objectStore('covers').delete('ph'); tx.oncomplete = r; }; }); });
  await page.reload({ waitUntil: 'networkidle0' }); await wait(400);
  assert.strictEqual(await page.$('#list .row[data-id="ph"]'), null);
  await (await page.$('#fileBackup')).uploadFile(CFG.OUT + '/backup_covers.json');
  await page.waitForFunction(() => { const i = document.querySelector('#list .row[data-id="ph"] .sum-img img'); return i && /^blob:/.test(i.src); }, { timeout: 8000 });
  console.log('[7 ripristino]', await page.$eval('#toastTxt', e => e.textContent));
  // 8) «Torna alla copertina scaricata»
  await click('#list .row[data-id="g3"] .sum-img'); await wait(300);
  await click('#lbReset'); await page.waitForFunction(() => /books\/content/.test(document.querySelector('#lbImg').src), { timeout: 5000 });
  assert((await lb()).reset === ''); await click('#lbClose'); await wait(200);

  // 9) libro nuovo: la copertina grande viene cercata da sola dopo la ricerca
  await page.evaluate(() => window.__app.addIsbn('9788807881213'));
  await page.waitForFunction(() => { const b = window.__app.state.books.find(x => x.i === '9788807881213'); return b && b.imgL; }, { timeout: 15000 });
  console.log('[9 automatico]', (await page.evaluate(() => window.__app.state.books.find(x => x.i === '9788807881213').imgL)).slice(0, 70));
  // 10) vista copertine usa le versioni grandi
  await click('#btnView'); await wait(300);
  const gsrc = await page.$eval('#list .cover[data-id="g1"] img', e => e.src); assert(gsrc.includes('zoom=3'));
  await page.screenshot({ path: CFG.OUT + '/s_grid_big.png' });
  await click('#btnView');
  // 11) «Cerca copertine più grandi» per i libri già inseriti
  await page.evaluate(() => { window.__app.state.books.forEach(b => { b.imgL = ''; }); });
  await page.evaluate(() => { window.__app.openOptions(); document.querySelector('#btnCovers').click(); });
  await page.waitForFunction(() => /^Trovate/.test(document.querySelector('#toastTxt').textContent), { timeout: 20000 });
  console.log('[11]', await page.$eval('#toastTxt', e => e.textContent));
  assert((await book('g1')).imgL && (await book('g2')).imgL && !(await book('g3')).imgL);
  console.log('ERRORI:', errors.length ? errors : 'nessuno'); assert(!errors.length);
  console.log('e2e8 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
