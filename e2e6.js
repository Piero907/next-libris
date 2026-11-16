const CFG = require("./_config");
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP, IMG = CFG.IMG, DL = CFG.OUT + '/dl';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.gz': 'application/gzip' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': (p.endsWith('.wasm.js') ? 'text/javascript' : MIME[path.extname(f)]) || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(CFG.port(8128));
const mk = (body12) => { let sum = 0; for (let i = 0; i < 12; i++) sum += (+body12[i]) * (i % 2 ? 3 : 1); return body12 + ((10 - sum % 10) % 10); };
const ROSA = '9788806219352';
const PUB = { [ROSA]: 'Bompiani' };
const B1 = mk('978885026001'), B2 = mk('978885026002'), B3 = mk('978880466001'), B4 = mk('978880466002'), W1 = mk('978881700001');
Object.assign(PUB, { [B1]: 'TEA', [B2]: 'Tea Tascabili', [B3]: 'Mondadori', [B4]: 'Arnoldo Mondadori Editore', [W1]: 'Rizzoli' });
const TITLES = { [ROSA]: 'Il nome della rosa', [B1]: 'Primo TEA', [B2]: 'Secondo TEA', [B3]: 'Primo Mondadori', [B4]: 'Secondo Mondadori', [W1]: 'Desiderato' };
let noExtra = new Set();
(async () => {
  fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL);
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new',
    args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + IMG + '/live.mjpeg'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => { if (!localStorage.getItem('catalogo-libri-set')) localStorage.setItem('catalogo-libri-set', JSON.stringify({ openAll: true })); });   // questi test controllano i campi delle schede aperte
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const cdp = await page.target().createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith('http://localhost:' + CFG.port(8128) + '')) return req.continue();
    const j = (o, s = 200) => req.respond({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (u.includes('googleapis.com/books')) {
      const isbn = (decodeURIComponent(u).match(/97[89]\d{10}/) || [])[0];
      if (!isbn || !TITLES[isbn]) return j({ totalItems: 0 });
      const extra = noExtra.has(isbn) ? {} : { categories: ['Fiction / General'], pageCount: 321 };
      return j({ items: [{ id: isbn, volumeInfo: Object.assign({ title: TITLES[isbn], authors: [isbn === ROSA ? 'Umberto Eco' : 'Autore ' + isbn.slice(-3)], publisher: PUB[isbn], publishedDate: '2012', industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn }], imageLinks: isbn === ROSA ? { thumbnail: 'http://books.google.com/c.png' } : undefined }, extra) }] });
    }
    if (u.includes('books.google.com/c.png')) return req.respond({ status: 200, contentType: 'image/png', body: fs.readFileSync(ROOT + '/icons/next-libris-192.png') });
    if (u.includes('openlibrary.org')) return j({});
    if (u.includes('crossref.org')) return j({ message: { items: [] } });
    if (u.includes('fonts.')) return req.respond({ status: 200, contentType: 'text/css', body: '' });
    req.abort();
  });
  await page.goto('http://localhost:' + CFG.port(8128) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const books = () => page.evaluate(() => window.__app.state.books.map(b => ({ i: b.i, t: b.t, e: b.e, w: b.w, p: b.p, pd: b.pd, sh: b.sh, gen: b.gen, pg: b.pg, n: b.n, g: b.g })));
  const click = sel => page.evaluate(s => document.querySelector(s).click(), sel);
  const text = sel => page.$eval(sel, e => e.textContent.trim());
  const toastTxt = () => page.$eval('#toastTxt', e => e.textContent);

  // 1) Libreria: aggiunta con genere e pagine automatici
  await page.evaluate(c => window.__app.addIsbn(c), ROSA); await wait(1200);
  let b = (await books())[0];
  console.log('[1 genere/pagine]', JSON.stringify(b));
  assert.deepStrictEqual([b.t, b.gen, b.pg, b.w], ['Il nome della rosa', 'Narrativa', '321', false]);
  assert(await page.$('#list .row .more [data-k="sh"]'));

  // 2) scaffale e note: scritti a mano, salvati, cercabili
  await page.type('#list .row [data-k="sh"]', 'Soggiorno 2');
  await page.type('#list .row [data-k="n"]', 'Regalo di Anna');
  await wait(500);
  await page.reload({ waitUntil: 'load' }); await wait(400);
  b = (await books())[0]; assert.deepStrictEqual([b.sh, b.n], ['Soggiorno 2', 'Regalo di Anna']);
  await page.type('#q', 'soggiorno'); await wait(200);
  assert.strictEqual((await page.$$('#list .row')).length, 1);
  await page.evaluate(() => { const q = document.querySelector('#q'); q.value = ''; q.dispatchEvent(new Event('input')); });
  // i campi in piu' ci sono sempre: l'opzione per nasconderli e' stata tolta (16/11/2026)
  assert(await page.$('#list .row .more'));
  assert(await page.evaluate(() => !document.querySelector('#optExtra')));
  console.log('[2 scaffale/note/opzione] ok');

  // 3) prestito: presta, filtro, restituito con Annulla
  await click('#list .row [data-act="loan"]'); await wait(150);
  assert(!(await page.$eval('#loanSheet', e => e.hidden)));
  await page.type('#loanWho', 'Marco'); await click('#loanSave'); await wait(200);
  b = (await books())[0]; assert.strictEqual(b.p, 'Marco'); assert(/^\d{4}-\d\d-\d\d$/.test(b.pd));
  assert((await text('#list .tag.loan')).includes('Prestato a Marco'));
  assert((await text('#summary')).includes('1 in prestito'));
  assert.strictEqual(await text('#cntLoan'), '1');
  await click('#fltLoan'); assert.strictEqual((await page.$$('#list .row')).length, 1); await click('#fltLoan');
  await click('#list .tag.loan'); await wait(100);
  assert(!(await page.$eval('#loanBack', e => e.hidden)));
  await click('#loanBack'); await wait(150);
  assert.strictEqual((await books())[0].p, '');
  await click('#toastBtn'); await wait(150);
  assert.strictEqual((await books())[0].p, 'Marco');
  console.log('[3 prestiti] ok:', await text('#summary'));

  // 4) Desideri: aggiunta nella scheda, conteggi, Comprato, spostamento automatico
  await click('#tabWish'); await wait(150);
  assert((await text('#list')).includes('Desideri è vuota'));
  await page.evaluate(c => window.__app.addIsbn(c), W1); await wait(1200);
  b = (await books()).find(x => x.i === W1); assert.strictEqual(b.w, true);
  assert.strictEqual(await text('#cntWish'), '1'); assert.strictEqual(await text('#cntLib'), '1');
  assert((await text('#summary')).includes('da comprare'));
  assert(await page.$('#list .row [data-act="tolib"]')); assert(await page.$('#list .row [data-act="loan"]'), 'anche nei Desideri: Presta, vendi o regala (16/11/2026)');
  await click('#list .row [data-act="tolib"]'); await wait(200);
  assert.strictEqual((await books()).find(x => x.i === W1).w, false);
  await click('#toastBtn'); await wait(150);
  assert.strictEqual((await books()).find(x => x.i === W1).w, true);
  await click('#tabLib'); await wait(150);
  assert.strictEqual((await page.$$('#list .row')).length, 1);
  const mv = await page.evaluate(c => { const r = window.__app.addIsbn(c); return !!r.moved; }, W1);
  assert(mv); assert.strictEqual((await books()).find(x => x.i === W1).w, false);
  await page.evaluate(c => { const b = window.__app.state.books.find(x => x.i === c); b.w = true; }, W1);   // torna nei desideri per il test seguente
  console.log('[4 desideri] ok');

  // 5) «Ce l'ho già?» con la fotocamera finta (codice di Il nome della rosa)
  //   a) è in libreria
  await click('#btnCheck');
  await page.waitForFunction(() => !document.querySelector('#scanRes').hidden, { timeout: 20000, polling: 200 });
  let res = await text('#scanRes'); console.log('[5a]', res);
  assert(res.includes("Ce l'hai già") && res.includes('Il nome della rosa') && res.includes('Scaffale: Soggiorno 2') && res.includes('Prestato a Marco'));
  await page.screenshot({ path: CFG.OUT + '/s_check.png' });
  await click('#scanClose'); await wait(300);
  //   b) non è in elenco: nessuna aggiunta automatica, titolo trovato, aggiungo ai Desideri
  const rosaId = await page.evaluate(() => window.__app.state.books.find(b => b.i === '9788806219352').id);
  const saved = await page.evaluate(id => { const a = window.__app.state.books; const i = a.findIndex(b => b.id === id); return JSON.stringify(a.splice(i, 1)[0]); }, rosaId);
  await click('#btnCheck');
  await page.waitForFunction(() => /Non ce l'hai/.test(document.querySelector('#scanRes').textContent) && /nome della rosa/.test(document.querySelector('#scanRes').textContent), { timeout: 20000, polling: 200 });
  res = await text('#scanRes'); console.log('[5b]', res);
  assert.strictEqual((await books()).some(x => x.i === ROSA), false);
  await page.screenshot({ path: CFG.OUT + '/s_check_no.png' });
  await click('#scanRes [data-act="addwish"]'); await wait(300);
  assert((await text('#scanRes')).includes('Aggiunto ai Desideri'));
  b = (await books()).find(x => x.i === ROSA); assert.strictEqual(b.w, true); assert.strictEqual(b.t, 'Il nome della rosa');
  await click('#scanClose'); await wait(300);
  //   c) è nei Desideri: «l'ho comprato»
  await click('#btnCheck');
  await page.waitForFunction(() => !document.querySelector('#scanRes').hidden && /lista dei Desideri/.test(document.querySelector('#scanRes').textContent), { timeout: 20000, polling: 200 });
  await click('#scanRes [data-act="bought"]'); await wait(200);
  assert((await text('#scanRes')).includes('Spostato in Libreria'));
  assert.strictEqual((await books()).find(x => x.i === ROSA).w, false);
  await click('#scanClose'); await wait(300);
  console.log('[5 ce l\'ho già] ok, toast:', await toastTxt());
  // rimetto il libro originale (con scaffale e prestito)
  await page.evaluate((s) => { const a = window.__app.state.books; const i = a.findIndex(b => b.i === '9788806219352'); a.splice(i, 1, JSON.parse(s)); }, saved);

  // 6) altri libri per statistiche, editori, xlsx
  for (const c of [B1, B2, B3, B4]) await page.evaluate(x => window.__app.addIsbn(x), c);
  await wait(2500);
  await page.evaluate(() => { const r = new Event('input'); document.querySelector('#q').dispatchEvent(r); });
  console.log('[6 libri]', (await books()).map(x => x.t + '/' + x.e + (x.w ? '/W' : '')).join(' | '));

  // 7) vista copertine
  await click('#btnView'); await wait(200);
  const covers = await page.$$eval('#list .cover', e => e.length); console.log('[7 copertine]', covers);
  assert.strictEqual(covers, 5);
  await page.screenshot({ path: CFG.OUT + '/s_grid.png' });
  await page.evaluate(() => document.querySelectorAll('#list .cover')[0].click()); await wait(300);
  assert(await page.$('#list .row.flash'));
  assert.strictEqual(await text('#btnView'), 'Copertine');

  // 8) statistiche: tocca un editore e filtra
  await click('#btnStats'); await wait(200);
  const st = await text('#statsBody'); console.log('[8 statistiche]', st.slice(0, 160));
  assert(st.includes('5') && st.includes('libri') && st.includes('Narrativa') && st.includes('in prestito'));
  await page.screenshot({ path: CFG.OUT + '/s_stats.png' });
  await page.evaluate(() => [...document.querySelectorAll('#statsBody [data-sf="e"]')].find(b => b.dataset.sv === 'Bompiani').click()); await wait(300);
  assert.strictEqual((await page.$$('#list .row')).length, 1);
  // dalle statistiche si apre un vero filtro (casa editrice), non una ricerca: si conta tra i filtri (16/11/2026)
  const sf = await page.evaluate(() => ({ q: document.querySelector('#q').value, f: window.__app.filtersAll(), chip: document.querySelector('[data-clear="ed"]') ? document.querySelector('[data-clear="ed"]').textContent : '' }));
  console.log('[8 filtro dalle statistiche]', JSON.stringify(sf));
  assert(sf.q === '' && sf.f.edFlt && /Casa editrice: Bompiani/.test(sf.chip));
  await page.evaluate(() => document.querySelector('[data-clear="ed"]').click()); await wait(250);

  // 9) uniforma case editrici (+ Annulla)
  await page.evaluate(() => { window.__app.openOptions(); document.querySelector('#btnPubs').click(); }); await wait(200);
  const groups = await page.$$eval('#pubList .pgrp', g => g.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  console.log('[9 gruppi]', groups);
  assert.strictEqual(groups.length, 2);
  await page.screenshot({ path: CFG.OUT + '/s_pubs.png' });
  // nel gruppo Mondadori non cambio «Arnoldo…»: tolgo la spunta
  await page.evaluate(() => { const lab = [...document.querySelectorAll('#pubList .pname')].find(p => /Arnoldo/.test(p.textContent)); lab.querySelector('input[type=checkbox]').click(); });
  await click('#pubApply'); await wait(200);
  let es = (await books()).map(x => x.e).sort(); console.log('[9 dopo]', es);
  assert.strictEqual(es.filter(e => e === 'TEA').length + es.filter(e => e === 'Tea Tascabili').length, 2);
  assert.strictEqual(new Set(es.filter(e => /tea/i.test(e))).size, 1);
  assert(es.includes('Arnoldo Mondadori Editore'));
  await click('#toastBtn'); await wait(150);
  es = (await books()).map(x => x.e); assert(es.includes('TEA') && es.includes('Tea Tascabili'));

  // 10) segna tutto come verificato
  await page.evaluate(() => { window.__app.state.books.forEach((b, i) => { if (i < 2) b.g = ['e']; }); });
  await click('#btnVerifyAll'); await wait(150);
  assert.strictEqual((await books()).filter(x => x.g.length).length, 0);
  console.log('[10 verificato]', await toastTxt());

  // 11) completa genere e pagine dei libri già inseriti
  await page.evaluate(() => { window.__app.state.books.forEach(b => { b.gen = ''; b.pg = ''; b.ck = ''; }); });
  await click('#btnFill');
  await page.waitForFunction(() => /Completati/.test(document.querySelector('#toastTxt').textContent), { timeout: 20000 });
  console.log('[11 completa]', await toastTxt());
  assert((await books()).every(x => x.gen === 'Narrativa' && x.pg === '321'));

  // 12) esporta: Excel e CSV della scheda attuale
  await click('#btnExport'); await wait(150);
  console.log('[12 esporta]', await text('#exportMsg'));
  await click('#btnXlsx'); await click('#btnCsv'); await wait(1500);
  console.log('[12 file]', fs.readdirSync(DL));
  const csv = fs.readFileSync(path.join(DL, fs.readdirSync(DL).find(f => f.endsWith('.csv'))), 'utf8');
  assert(csv.includes('Scaffale') && csv.includes('Prestato a') && csv.includes('Soggiorno 2') && !csv.includes('Desiderato'));

  // 13) backup: condivisione (simulata), annullata, e ripristino da .txt
  await page.evaluate(() => { window.__shared = null; navigator.canShare = (d) => d.files[0].type === 'text/plain'; navigator.share = async (d) => { window.__shared = d.files[0].name; }; });
  await click('#btnShareBackup'); await wait(300);
  const sharedName = await page.evaluate(() => window.__shared); console.log('[13 condiviso]', sharedName, '|', await toastTxt());
  assert(/\.txt$/.test(sharedName));
  assert(await page.evaluate(() => window.__app.settings.lastBackup > 0));
  assert((await text('#backupInfo')).startsWith('Ultimo backup: oggi'));
  await page.evaluate(() => { window.__app.settings.lastBackup = 0; navigator.share = async () => { const e = new Error('x'); e.name = 'AbortError'; throw e; }; });
  await click('#btnShareBackup'); await wait(200);
  assert.strictEqual(await page.evaluate(() => window.__app.settings.lastBackup), 0);
  console.log('[13 annullato]', await toastTxt());
  const backupTxt = await page.evaluate(() => JSON.stringify({ app: 'catalogo-libri', v: 3, books: window.__app.state.books }));
  fs.writeFileSync(CFG.OUT + '/backup_test.txt', backupTxt);
  const n0 = (await books()).length;
  await page.evaluate(() => { window.__app.state.books.splice(0, 2); });
  await (await page.$('#fileBackup')).uploadFile(CFG.OUT + '/backup_test.txt'); await wait(500);
  assert.strictEqual((await books()).length, n0);
  console.log('[13 ripristino .txt]', await toastTxt());

  // 14) promemoria backup: 10+ libri, mai salvati -> avviso; la X lo rimanda
  await page.evaluate(() => {
    const A = window.__app;
    for (let k = 0; k < 8; k++) A.state.books.push({ id: 'x' + k, t: 'Libro ' + k, a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 1, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false });
    A.state.updated = Date.now();
    const s = JSON.parse(localStorage.getItem('catalogo-libri-set')); s.lastBackup = 0; s.snooze = 0; localStorage.setItem('catalogo-libri-set', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'load' }); await wait(500);
  const nag = await page.$eval('#notice', e => !e.hidden ? e.textContent : ''); console.log('[14 promemoria]', nag);
  assert(nag.includes('Ultimo backup: mai') && nag.includes('Fai il backup'));
  await page.screenshot({ path: CFG.OUT + '/s_nag.png' });
  await click('#noticeX'); await wait(100);
  assert(await page.$eval('#notice', e => e.hidden));
  assert(await page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')).snooze > 0));
  await page.reload({ waitUntil: 'load' }); await wait(400);
  assert(await page.$eval('#notice', e => e.hidden));

  // schermate
  await page.screenshot({ path: CFG.OUT + '/s_list6.png' });
  await page.setViewport({ width: 1280, height: 900 }); await wait(300);
  await page.screenshot({ path: CFG.OUT + '/s_desk.png' });
  console.log('ERRORI:', errors.length ? errors : 'nessuno'); assert(!errors.length);
  console.log('e2e6 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
