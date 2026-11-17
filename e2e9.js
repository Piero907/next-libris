const CFG = require("./_config");
const H = require('./_harness');
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8135), ROOT);
const B = (o) => Object.assign({ t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: Date.now(), sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: '', rt: 0, rd: '' }, o);
const day = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const books = [
  B({ id: 'eco1', t: 'Il nome della rosa', a: 'Umberto Eco', e: 'Bompiani', y: '2012', c: 14, sh: 'Studio' }),
  B({ id: 'eco2', t: 'Il pendolo di Foucault', a: 'Umberto Eco', e: 'Bompiani', y: '1988', c: 16, p: 'Marco', pd: day(70) }),
  B({ id: 'dupA', t: 'Lessico famigliare', a: 'Natalia Ginzburg', i: '9788806219000', ts: 5, n: 'regalo' }),
  B({ id: 'dupB', t: 'Lessico Famigliare', a: 'Natalia Ginzburg', e: 'Einaudi', c: 13, ts: 2 }),
  B({ id: 'pend', i: '9788807881213' }),                                // rimasto in attesa: cercato all'avvio
  B({ id: 'w1', t: 'La storia', a: 'Elsa Morante', e: 'Einaudi', y: '2014', c: 15, i: '9788806219352', w: true }),
  B({ id: 'w2', t: 'Sostiene Pereira', a: 'Antonio Tabucchi', c: 9.5, w: true }),
];
const json = o => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
const G = { '9788807881213': ['Sostiene Pereira', 'Antonio Tabucchi'], '9788804668015': ['Le città invisibili', 'Italo Calvino'], '9788850262359': ['Giornali di bordo', 'James Cook'] };
let net = 'ok', sbnHits = 0;
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => { const u = r.url();
    if (u.startsWith('http://localhost')) return r.continue();
    if (net === 'weak' && /googleapis|openlibrary|crossref|sbn\.test/.test(u)) return r.abort('failed');
    if (u.includes('sbn.test.workers.dev')) { sbnHits++; const isbn = new URL(u).searchParams.get('isbn');
      return r.respond(json(isbn === '9788850262359' ? { briefRecords: [{ codiceIdentificativo: 'IT\\ICCU\\X\\1', titolo: 'Giornali di bordo / James Cook', autorePrincipale: 'Cook, James', pubblicazione: 'Milano : TEA, 2021' }], full: { descrizioneFisica: '412 p. ; 20 cm', classificazioneDewey: ['910.4 VIAGGI'] } } : { briefRecords: [] })); }
    if (u.includes('googleapis.com/books/v1/volumes?')) { const isbn = (decodeURIComponent(u).match(/97[89]\d{10}/) || [])[0];
      if (!G[isbn]) return r.respond(json({ totalItems: 0 }));
      return r.respond(json({ items: [{ id: 'x' + isbn, volumeInfo: { title: G[isbn][0], authors: [G[isbn][1]], publishedDate: '2020', industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn }] } }] })); }
    if (u.includes('googleapis.com/books/v1/volumes/')) return r.respond(json({ volumeInfo: {} }));
    if (/openlibrary|crossref/.test(u)) return r.respond(json({}));
    r.abort(); });
  await page.evaluateOnNewDocument((b) => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), price: false })); sessionStorage.seeded = 1; } }, books);
  await page.goto('http://localhost:' + CFG.port(8135) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = H.wait;   // attesa «finché» (_harness.js)
  const click = sel => page.evaluate(s => document.querySelector(s).click(), sel);
  const book = id => page.evaluate(i => { const b = window.__app.state.books.find(x => x.id === i); return b && JSON.parse(JSON.stringify(b)); }, id);
  const byIsbn = isbn => page.evaluate(i => { const b = window.__app.state.books.find(x => x.i === i); return b && JSON.parse(JSON.stringify(b)); }, isbn);
  const st = id => page.evaluate(i => { const s = window.__app.S[i]; return s ? { st: s.st, err: s.err } : null; }, id);
  const rows = () => page.$$eval('#list .row', e => e.map(r => r.dataset.id));

  // ---- 3) all'avvio: il libro rimasto in attesa viene cercato da solo
  await page.waitForFunction(() => window.__app.state.books.find(b => b.id === 'pend').t, { timeout: 8000 });
  const tAvvio = await page.$eval('#toastTxt', e => e.textContent); console.log('[3 avvio]', (await book('pend')).t, '|', tAvvio); assert(tAvvio.includes('rimasto in attesa'));
  // ---- 7b) promemoria prestito lungo
  await page.waitForFunction(() => !document.querySelector('#notice').hidden, { timeout: 6000 });
  const nag = await page.$eval('#notice', e => e.innerText); console.log('[7 promemoria]', nag.replace(/\s+/g, ' '));
  assert(nag.includes('Marco ha «Il pendolo di Foucault» da 2 mesi'));
  await click('#noticeBtn'); await wait(200);
  assert.deepStrictEqual(await rows(), ['eco2']);
  assert(await page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')).loanSnooze > 0));
  await click('#fltLoan'); await wait(100);

  // ---- 3) senza rete: in attesa, poi cercato da solo quando torna
  await page.setOfflineMode(true); await wait(200);
  await page.evaluate(() => window.__app.addIsbn('9788804668015')); await wait(400);
  let b = await byIsbn('9788804668015'); let s = await st(b.id); console.log('[3 offline]', s);
  assert.strictEqual(s.st, 'wait'); assert(s.err.includes('Senza connessione'));
  assert((await page.$eval('#list .row[data-id="' + b.id + '"]', e => e.innerText)).includes('Riprova ora'));
  await page.setOfflineMode(false);
  await page.waitForFunction(i => window.__app.state.books.find(x => x.i === i).t, { timeout: 8000 }, '9788804668015');
  console.log('[3 di nuovo online]', (await byIsbn('9788804668015')).t, '|', await page.$eval('#toastTxt', e => e.textContent));
  // ---- 3) rete debole (le banche dati non rispondono): riprova da sola dopo 20 s
  net = 'weak';
  await page.evaluate(() => window.__app.addIsbn('9788807881299'));
  await page.waitForFunction(() => { const b = window.__app.state.books.find(x => x.i === '9788807881299'); const s = b && window.__app.S[b.id]; return s && s.st === 'wait'; }, { timeout: 15000 });
  b = await byIsbn('9788807881299'); s = await st(b.id); console.log('[3 rete debole]', s.err);
  assert(s.err.includes('riprovo da solo tra 20 secondi'));
  net = 'ok'; G['9788807881299'] = ['Requiem', 'Antonio Tabucchi'];
  const t0 = Date.now();
  await page.waitForFunction(() => window.__app.state.books.find(x => x.i === '9788807881299').t, { timeout: 30000, polling: 500 });
  console.log('[3 ritentato da solo dopo]', Math.round((Date.now() - t0) / 1000), 's');

  // ---- 4) lettura: Letto + voto, etichetta, filtro, ordinamento, statistiche, export
  await click('#list .row[data-id="eco1"] .sum'); await wait(150);
  await click('#list .row[data-id="eco1"] [data-act="rs"][data-v="ok"]'); await wait(100);
  await click('#list .row[data-id="eco1"] [data-act="rt"][data-v="4"]'); await wait(100);
  b = await book('eco1'); console.log('[4]', b.rs, b.rt, b.rd);
  assert.deepStrictEqual([b.rs, b.rt, b.rd], ['ok', 4, new Date().toISOString().slice(0, 10)]);
  assert(await page.$('#list .row[data-id="eco1"] input[data-k="rd"]'));
  await page.screenshot({ path: CFG.OUT + '/s_read.png' });
  await click('#list .row[data-id="eco1"] .chev-btn'); await wait(100);
  assert((await page.$eval('#list .row[data-id="eco1"] .sum', e => e.innerText)).includes('Letto · Bellissimo'));   // il voto a parole (libricini, 16/11/2026)
  await click('#list .row[data-id="eco2"] .sum'); await wait(100);
  await click('#list .row[data-id="eco2"] [data-act="rs"][data-v="da"]'); await wait(100);
  await click('#list .row[data-id="eco2"] [data-act="rs"][data-v="da"]'); await wait(100);     // di nuovo: tolto
  assert.strictEqual((await book('eco2')).rs, '');
  await click('#list .row[data-id="eco2"] [data-act="rs"][data-v="in"]'); await wait(100);
  await page.evaluate(() => window.__app.openDrawer()); await wait(300);
  console.log('[4 filtro]', await page.$$eval('#drawerFlt [data-g="read"]', o => o.map(x => x.innerText.replace(/\s+/g, ' ')).join(' | ')));
  await click('#drawerFlt [data-g="read"][data-v="ok"]'); await wait(150);
  assert.deepStrictEqual(await rows(), ['eco1']);
  await click('#drawerFlt [data-g="read"][data-v=""]'); await wait(150);
  await page.evaluate(() => window.__app.closeDrawer()); await wait(300);
  await page.select('#sort', 'voto'); await wait(150);
  assert.strictEqual((await rows())[0], 'eco1');
  await page.select('#sort', 'recent');
  await click('#btnStats'); await wait(150);
  const stx = await page.$eval('#statsBody', e => e.innerText.replace(/\s+/g, ' ')); console.log('[4 statistiche]', stx.slice(0, 200));
  assert(stx.includes('letti') && stx.includes('4,0 su 5') && stx.includes('voto medio: bellissimo') && stx.includes('1 in lettura'));
  await click('#statsClose');

  // ---- 7a) tutti i libri dello stesso autore
  await click('#list .row[data-id="eco1"] .sum'); await wait(100);
  const link = await page.$eval('#list .row[data-id="eco1"] .fchip[data-f="a"]', e => e.innerText.replace(/\s+/g, ' ').trim()); console.log('[7 autore]', link);
  assert.strictEqual(link, 'Umberto Eco 2');
  await click('#list .row[data-id="eco1"] .fchip[data-f="a"]'); await wait(150);
  assert.deepStrictEqual((await rows()).sort(), ['eco1', 'eco2']);
  assert((await page.$eval('#activeFlt', e => e.innerText)).includes('Autore: Eco, Umberto'));   // cognome prima nei filtri (102.3)
  await click('#activeFlt [data-clear="aut"]'); await wait(100);

  // ---- 5) catalogo SBN: indirizzo nelle opzioni, editore/anno/pagine/genere da SBN
  await page.evaluate(() => { window.__app.openOptions(); });
  await page.type('#sbnUrl', 'http://sbagliato'); await page.evaluate(() => document.querySelector('#sbnUrl').dispatchEvent(new Event('change'))); await wait(100);
  assert((await page.$eval('#toastTxt', e => e.textContent)).includes('https://'));
  await page.evaluate(() => { const i = document.querySelector('#sbnUrl'); i.value = 'https://sbn.test.workers.dev/'; i.dispatchEvent(new Event('change')); }); await wait(100);
  assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')).sbnUrl), 'https://sbn.test.workers.dev');
  await page.evaluate(() => window.__app.addIsbn('9788850262359'));
  await page.waitForFunction(() => { const b = window.__app.state.books.find(x => x.i === '9788850262359'); return b && b.t; }, { timeout: 8000 });
  b = await byIsbn('9788850262359'); console.log('[5 SBN]', b.t, '|', b.e, b.y, b.pg, b.gen);
  assert.deepStrictEqual([b.e, b.y, b.pg, b.gen], ['TEA', '2021', '412', 'Viaggi']);
  await click('#btnDiag');
  await page.waitForFunction(() => /Catalogo SBN/.test(document.querySelector('#diagOut').innerText), { timeout: 15000 });
  console.log('[5 diagnosi]', (await page.$eval('#diagOut', e => e.innerText)).split('\n').find(l => l.includes('SBN')));

  // ---- 7c) unisci i doppioni (+ Annulla)
  await click('#btnMergeDups'); await wait(200);
  console.log('[7 doppioni]', await page.$eval('#toastTxt', e => e.textContent));
  b = await book('dupB'); assert(!(await book('dupA')));
  assert.deepStrictEqual([b.i, b.e, b.c, b.n], ['9788806219000', 'Einaudi', 13, 'regalo']);
  await click('#toastBtn'); await wait(150);
  assert(await book('dupA') && await book('dupB'));
  await click('#btnMergeDups'); await wait(150);
  await page.evaluate(() => { window.__app.closeOptions(); });

  // ---- 6) condividi la lista dei Desideri
  await click('#tabWish'); await wait(150);
  assert(!(await page.$eval('#btnShareWish', e => e.hidden)));
  await page.evaluate(() => window.__app.openDrawer()); await wait(300);
  assert(!(await page.$$eval('#drawerFlt h3', e => e.map(x => x.textContent))).includes('Lettura'));
  await page.evaluate(() => window.__app.closeDrawer()); await wait(300);
  await page.evaluate(() => { window.__sh = null; navigator.share = async (d) => { window.__sh = d; }; });
  await click('#btnShareWish'); await wait(200); await click('#shareSend'); await wait(300);
  const sh = await page.evaluate(() => window.__sh); console.log('[6 condiviso]\n' + sh.text);
  assert(sh.text.startsWith('Una lista dei desideri (2 libri):') && sh.text.includes('«La storia» di Elsa Morante (Einaudi, 2014)') && sh.text.includes('«La storia» di Elsa Morante (Einaudi, 2014) · 15,00 €') && sh.text.includes('Totale: 24,50 €') && /#l=[zj]/.test(sh.url));
  await page.evaluate(() => { delete navigator.share; navigator.share = undefined; window.__clip = null; navigator.clipboard.writeText = async (t) => { window.__clip = t; }; });
  await click('#btnShareWish'); await wait(200); await click('#shareSend'); await wait(300);
  assert((await page.evaluate(() => window.__clip)).includes('Sostiene Pereira'));
  console.log('[6 copiata]', await page.$eval('#toastTxt', e => e.textContent));
  await click('#tabLib'); await wait(150);

  // ---- 7d) stampa / PDF
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await click('#btnExport'); await wait(150);
  await click('#printCovers');
  await click('#btnPrint'); await wait(800);
  assert.strictEqual(await page.evaluate(() => window.__printed), 1);
  const pv = await page.$eval('#printView', e => ({ rows: e.querySelectorAll('tbody tr').length, head: [...e.querySelectorAll('th')].map(t => t.textContent).join('|'), sub: e.querySelector('.pv-sub').textContent }));
  console.log('[7 stampa]', JSON.stringify(pv));
  assert.strictEqual(pv.rows, await page.evaluate(() => window.__app.state.books.filter(b => !b.w).length));
  assert(pv.head.includes('Scaffale') && pv.head.includes('Lettura') && pv.head.includes('Prestato a'));
  await page.emulateMediaType('print');
  await page.pdf({ path: CFG.OUT + '/catalogo.pdf', format: 'A4', printBackground: true });
  await page.emulateMediaType(null);
  console.log('ERRORI:', errors.length ? errors : 'nessuno'); assert(!errors.length);
  console.log('e2e9 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
