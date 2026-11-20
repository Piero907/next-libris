const CFG = require("./_config");
const H = require('./_harness');
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8136), ROOT);
const B = (o) => Object.assign({ t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: Date.now(), sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: '', rt: 0, rd: '' }, o);
const day = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const books = [
  B({ id: 'r1', t: 'Il nome della rosa', a: 'Umberto Eco', e: 'Bompiani', i: '9788845292613', ts: 5, sh: 'Studio' }),
  B({ id: 'r2', t: 'Il nome della rosa', a: 'Umberto Eco', e: 'Bompiani', i: '9788845292613', ts: 4, sh: 'Camera' }),
  B({ id: 'u1', t: 'Lessico famigliare', a: 'Natalia Ginzburg', e: 'Einaudi', c: 13, i: '9788806219000', ts: 3, sh: 'Studio', n: 'regalo di Lucia', rs: 'ok', rt: 5 }),
  B({ id: 'v1', t: 'La storia', a: 'Elsa Morante', e: 'Einaudi', y: '2014', c: 15, i: '9788806219352', ts: 2 }),
];
const json = o => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
const G = { '9788807881213': ['Sostiene Pereira', 'Antonio Tabucchi'], '9788804668015': ['Le città invisibili', 'Italo Calvino'], '9788850262359': ['Giornali di bordo', 'James Cook'] };
let gHits = 0;
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => { const u = r.url();
    if (u.startsWith('http://localhost')) return r.continue();
    if (u.includes('googleapis.com/books/v1/volumes?')) { gHits++; const isbn = (decodeURIComponent(u).match(/97[89]\d{10}/) || [])[0];
      if (!G[isbn]) return r.respond(json({ totalItems: 0 }));
      return r.respond(json({ items: [{ id: 'x' + isbn, volumeInfo: { title: G[isbn][0], authors: [G[isbn][1]], publisher: 'Einaudi', publishedDate: '2020', industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn }] } }] })); }
    if (u.includes('googleapis.com/books/v1/volumes/')) { gHits++; return r.respond(json({ volumeInfo: {} })); }
    if (/openlibrary|crossref/.test(u)) return r.respond(json({}));
    r.abort(); });
  await page.evaluateOnNewDocument((b) => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), price: false, gbKey: 'CHIAVE' })); sessionStorage.seeded = 1; } }, books);
  await page.goto('http://localhost:' + CFG.port(8136) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = H.wait;   // attesa «finché» (_harness.js)
  const click = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error('manca ' + s); e.click(); }, sel);
  const book = id => page.evaluate(i => { const b = window.__app.state.books.find(x => x.id === i); return b && JSON.parse(JSON.stringify(b)); }, id);
  const all = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__app.state.books)));
  const rows = () => page.$$eval('#list .row', e => e.map(r => r.dataset.id));
  const txt = sel => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
  const toastTxt = () => txt('#toastTxt');
  const today = new Date().toISOString().slice(0, 10), itToday = today.split('-').reverse().join('/');
  await wait(400);

  // ---- 1) doppione: l'etichetta si tocca e si sceglie «copie diverse»
  let sum = await txt('#list .row[data-id="r1"] .sum'); console.log('[1 riga]', sum); assert(sum.includes('Doppione?'));
  await click('#list .row[data-id="r1"] .sum .tag[data-act="dup"]'); await wait(150);
  assert(!(await page.$eval('#dupSheet', e => e.hidden)));
  console.log('[1 finestra]', await txt('#dupMsg'));
  assert(await page.$eval('#dupUnmark', e => e.hidden));
  await click('#dupCopies'); await wait(150);
  assert((await book('r1')).cp && (await book('r2')).cp);
  sum = await txt('#list .row[data-id="r2"] .sum'); console.log('[1 copie]', sum, '|', await toastTxt()); assert(sum.includes('2 copie') && !sum.includes('Doppione'));
  assert.strictEqual(await page.$eval('#gRib b', e => e.textContent), '4');   // stile G: il nastro conta i libri
  // annulla e rifai
  await click('#toastBtn'); await wait(100); assert(!(await book('r1')).cp);
  await click('#list .row[data-id="r1"] .sum .tag[data-act="dup"]'); await wait(100); await click('#dupCopies'); await wait(100);
  // 2) «Unisci i doppioni» non tocca le copie
  await page.evaluate(() => { window.__app.openOptions(); });
  await click('#btnMergeDups'); await wait(150);
  console.log('[2 unisci]', await toastTxt()); assert((await toastTxt()).includes('copie diverse') && (await all()).length === 4);
  // 3) «Non sono copie» → torna doppione → «uniscili» + Annulla
  await click('#list .row[data-id="r1"] .sum .tag[data-act="dup"]'); await wait(100);
  assert(!(await page.$eval('#dupUnmark', e => e.hidden)));
  await click('#dupUnmark'); await wait(100);
  assert(!(await book('r1')).cp); assert((await txt('#list .row[data-id="r1"] .sum')).includes('Doppione?'));
  await click('#list .row[data-id="r1"] .sum .tag[data-act="dup"]'); await wait(100); await click('#dupMerge'); await wait(150);
  assert.strictEqual((await all()).length, 3); console.log('[3 uniti]', await toastTxt());
  await click('#toastBtn'); await wait(150); assert.strictEqual((await all()).length, 4);

  // ---- 4) «+ Aggiungi un'altra copia» dalla scheda
  await click('#list .row[data-id="u1"] .sum'); await wait(150);
  const links = await txt('#list .row[data-id="u1"] .links'); console.log('[4 link]', links); assert(links.includes('Aggiungi un\'altra copia'));
  await click('#list .row[data-id="u1"] [data-act="addcopy"]'); await wait(200);
  let cps = (await all()).filter(b => b.i === '9788806219000');
  console.log('[4 copia]', cps.map(b => [b.id, b.cp, b.sh, b.rs, b.n].join('/')).join(' | '), '|', await toastTxt());
  assert.strictEqual(cps.length, 2); assert(cps.every(b => b.cp)); const nuova = cps.find(b => b.id !== 'u1');
  assert.deepStrictEqual([nuova.t, nuova.sh, nuova.n, nuova.rs, nuova.c], ['Lessico famigliare', '', '', 'da', 13]);
  await click('#toastBtn'); await wait(150); assert.strictEqual((await all()).filter(b => b.i === '9788806219000').length, 1); assert(!(await book('u1')).cp);

  // ---- 5) Digita un codice già presente: «Aggiungi un'altra copia» nel toast
  await H.fai(page, 'type'); await wait(100);
  await page.evaluate(() => { document.querySelector('#isbnText').value = '9788806219000'; }); await click('#isbnGo'); await wait(200);
  console.log('[5 digita]', await toastTxt(), '|', await txt('#toastBtn'));
  assert.strictEqual(await txt('#toastBtn'), 'Aggiungi un\'altra copia');
  await click('#toastBtn'); await wait(200);
  assert.strictEqual((await all()).filter(b => b.i === '9788806219000').length, 2);

  // ---- 6) Scansiona un libro che c'è già: pulsante «Aggiungi un'altra copia»
  await page.evaluate(() => { window.__app.setScanMode('add'); window.__app.onScanned('9788806219000'); }); await wait(150);
  console.log('[6 scansione]', await txt('#scanRes'));
  assert((await txt('#scanRes')).includes('2 copie'));
  await click('#scanRes [data-act="addcopy"]'); await wait(150);
  assert.strictEqual((await all()).filter(b => b.i === '9788806219000').length, 3);
  console.log('[6 dopo]', await txt('#scanRes'));

  // ---- 7) nuovo libro scansionato: «Da leggere»; contatore delle richieste a Google
  const q0 = await page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-quota') || '{"g":0}').g);
  await page.evaluate(() => window.__app.addIsbn('9788804668015'));
  await page.waitForFunction(() => { const b = window.__app.state.books.find(x => x.i === '9788804668015'); return b && b.t; }, { timeout: 8000 });
  let nb = (await all()).find(b => b.i === '9788804668015');
  const q1 = await page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-quota')));
  console.log('[7 nuovo]', nb.t, nb.rs, nb.ck, '| richieste Google', q0, '→', q1.g, q1.d);
  assert.strictEqual(nb.rs, 'da'); assert.strictEqual(nb.ck, today); assert(q1.g > q0);
  await page.evaluate(() => { window.__app.setTab('wish'); window.__app.addIsbn('9788807881213'); window.__app.setTab('lib'); });
  await wait(300); assert.strictEqual((await all()).find(b => b.i === '9788807881213').rs, '');
  await page.evaluate(() => { window.__app.openOptions(); }); await wait(50);
  await page.evaluate(() => { window.__app.closeOptions(); window.__app.openOptions(); }); await wait(100);
  console.log('[7 opzioni]', await txt('#gbCount')); assert((await txt('#gbCount')).includes('su 1.000'));

  // ---- 8) limite quasi raggiunto: niente chiamate a Google, il libro aspetta
  await page.evaluate(() => { const q = JSON.parse(localStorage.getItem('catalogo-libri-quota')); q.g = 950; localStorage.setItem('catalogo-libri-quota', JSON.stringify(q)); });
  await page.reload({ waitUntil: 'load' }); await wait(500);
  const h0 = gHits;
  await page.evaluate(() => window.__app.addIsbn('9788807881299'));
  await page.waitForFunction(() => { const b = window.__app.state.books.find(x => x.i === '9788807881299'); const s = b && window.__app.S[b.id]; return s && s.st === 'wait'; }, { timeout: 15000 });
  const s8 = await page.evaluate(() => { const b = window.__app.state.books.find(x => x.i === '9788807881299'); return window.__app.S[b.id].err; });
  console.log('[8 limite]', s8, '| chiamate a Google:', gHits - h0); assert.strictEqual(gHits - h0, 0); assert(s8.includes('quasi finite'));

  // ---- 9) venduto, regalato, smarrito
  await click('#list .row[data-id="v1"] .sum'); await wait(100);
  await click('#list .row[data-id="v1"] .ico[data-act="loan"]'); await wait(100);
  assert.strictEqual(await txt('#loanH'), 'Presta, vendi o regala');
  await wait(120);
  assert(await page.evaluate(() => document.activeElement && document.activeElement.id !== 'loanWho'), 'all\'apertura «A chi» non prende il cursore (niente tastiera)');
  await click('#loanKind [data-k="v"]'); await wait(50);
  await page.screenshot({ path: CFG.OUT + '/s_kinds.png' });
  console.log('[9 venduto]', await txt('#loanH'), '|', await txt('#loanWhoL'), '|', await txt('#loanDateL'));
  await click('#loanSave'); await wait(150);
  let v = await book('v1'); assert.deepStrictEqual([v.xs, v.xd, v.xa, v.p], ['v', today, '', '']);
  const tagV = await txt('#list .row[data-id="v1"] .tag.gone'); console.log('[9 tag]', tagV, '|', await toastTxt()); assert.strictEqual(tagV, 'Venduto il ' + itToday);
  assert(await page.$eval('#list .row[data-id="v1"]', e => e.classList.contains('gone')));
  assert(!(await page.$('#optSumGone')) && !(await page.$('#optSumLoan')) && !(await page.$('#optShowSync')), 'via le opzioni «Riepilogo in alto» (20/11/2026)');
  await page.evaluate(() => window.__app.openDrawer()); await wait(300);
  await click('#drawerFlt [data-g="flt"][data-v="gone"]'); await wait(100); assert.deepStrictEqual(await rows(), ['v1']);
  await click('#drawerFlt [data-g="flt"][data-v="gone"]'); await wait(100);
  await page.evaluate(() => window.__app.closeDrawer()); await wait(300);
  // regalato: serve il nome
  await click('#list .row[data-id="v1"] .tag.gone'); await wait(100);
  assert.strictEqual(await txt('#loanBack'), 'È tornato in libreria');
  await click('#loanKind [data-k="r"]'); await page.evaluate(() => { document.querySelector('#loanWho').value = ''; });
  await click('#loanSave'); await wait(50); assert(!(await page.$eval('#loanErr', e => e.hidden))); console.log('[9 regalato senza nome]', await txt('#loanErr'));
  await page.evaluate(() => { document.querySelector('#loanWho').value = 'Anna'; }); await click('#loanSave'); await wait(150);
  assert.strictEqual(await txt('#list .row[data-id="v1"] .tag.gone'), 'Regalato ad Anna il ' + itToday);
  // smarrito: niente «a chi»
  await click('#list .row[data-id="v1"] .tag.gone'); await wait(100); await click('#loanKind [data-k="s"]');
  assert(await page.$eval('#loanWhoF', e => e.hidden)); await click('#loanSave'); await wait(150);
  v = await book('v1'); assert.deepStrictEqual([v.xs, v.xa], ['s', '']);
  // statistiche, Ce l'ho già?, esportazione
  await H.fai(page, 'stats'); await wait(150);
  const stx = await txt('#statsBody'); console.log('[9 statistiche]', stx.slice(0, 160)); assert(stx.includes('non più in libreria') && stx.includes('1 smarrito')); await click('#statsClose');
  await page.evaluate(() => { window.__app.setScanMode('check'); window.__app.onScanned('9788806219352'); }); await wait(150);
  console.log('[9 ce l\'ho già]', await txt('#scanRes')); assert((await txt('#scanRes')).includes('Non ce l\'hai più'));
  await page.screenshot({ path: CFG.OUT + '/s_gone.png' });
  // ritrovato
  await click('#list .row[data-id="v1"] .tag.gone'); await wait(100);
  assert.strictEqual(await txt('#loanBack'), 'Ritrovato'); await click('#loanBack'); await wait(150);
  v = await book('v1'); assert.strictEqual(v.xs, ''); console.log('[9 ritrovato]', await toastTxt());
  // il prestito funziona come prima
  if (await page.$('#list .row[data-id="v1"].closed')) { await click('#list .row[data-id="v1"] .sum'); await wait(100); }
  await click('#list .row[data-id="v1"] .ico[data-act="loan"]'); await wait(100);
  await page.evaluate(() => { document.querySelector('#loanWho').value = 'Marco'; }); await click('#loanSave'); await wait(150);
  v = await book('v1'); assert.deepStrictEqual([v.p, v.pd, v.xs], ['Marco', today, '']);
  await page.screenshot({ path: CFG.OUT + '/s_list10.png' });
  console.log('ERRORI:', errors.length ? errors : 'nessuno'); assert(!errors.length);
  console.log('e2e10 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
