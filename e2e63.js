const CFG = require("./_config");
const H = require('./_harness');
// Suggerimenti (pagina intera dal 21/11/2026): «Cosa leggere dopo» (seguito della serie, perché, Inizio questo, Un altro, niente libri prestati),
// riquadro in cima all'elenco dopo aver finito un libro, scaffali (autori, generi, serie; solo italiano o tutte le lingue),
// anteprima con + Desideri e Non mi interessa, riquadro «Con gli amici…» senza account, ricerca automatica una volta a settimana
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8183), ROOT);
const D = 864e5, now = Date.now(), today = new Date().toISOString().slice(0, 10);
const books = [
  { id: 'b1', t: 'La forma dell\'acqua', a: 'Andrea Camilleri', rs: 'ok', rt: 5, rd: '2026-09-01', gen: 'Gialli', se: 'Montalbano', sn: '1', sq: '5', ts: now - 500 * D },
  { id: 'b2', t: 'Il cane di terracotta', a: 'Andrea Camilleri', rs: 'ok', rt: 4, rd: today, gen: 'Gialli', se: 'Montalbano', sn: '2', sq: '5', pg: '620', ts: now - 400 * D },
  { id: 'b3', t: 'Il ladro di merendine', a: 'Andrea Camilleri', rs: 'da', gen: 'Gialli', se: 'Montalbano', sn: '3', sq: '5', ts: now - 30 * D },
  { id: 'b4', t: 'La voce del violino', a: 'Andrea Camilleri', rs: 'da', gen: 'Gialli', se: 'Montalbano', sn: '4', sq: '5', ts: now - 30 * D },
  { id: 'b5', t: 'Racconti brevi', a: 'Italo Calvino', rs: 'da', pg: '160', ts: now - 900 * D },
  { id: 'b6', t: 'Libro prestato', a: 'Andrea Camilleri', rs: 'da', p: 'Anna', pd: '2026-10-01', ts: now - 1000 * D },
  { id: 'b7', t: 'Il barone rampante', a: 'Italo Calvino', rs: 'ok', rt: 3, rd: '2025-05-01', ts: now - 800 * D },
  { id: 'b8', t: 'La concessione del telefono', a: 'Andrea Camilleri', rs: 'ok', rd: '2025-01-01', gen: 'Gialli', ts: now - 900 * D },
  { id: 'b9', t: 'Il re di Girgenti', a: 'Andrea Camilleri', rs: 'ok', rd: '2025-02-01', gen: 'Gialli', ts: now - 900 * D },
];
const vol = (t, a, y, lang, isbn) => ({ id: t, volumeInfo: { title: t, authors: [a], publisher: 'Sellerio', publishedDate: String(y), language: lang, industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn }] } });
const Y = new Date().getFullYear();
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const gq = [];
  await page.setRequestInterception(true);
  page.on('request', r => {
    const u = r.url();
    if (u.startsWith('http://localhost:' + CFG.port(8183) + '')) return r.continue();
    if (/googleapis\.com\/books\/v1\/volumes/.test(u)) {
      gq.push(decodeURIComponent(u));
      const items = /inauthor:"Andrea Camilleri"/.test(decodeURIComponent(u)) ? [vol('Il birraio di Preston', 'Andrea Camilleri', 1995, 'it', '9788838912344'), vol('La forma dell\'acqua', 'Andrea Camilleri', 1994, 'it', '9788838911111'), vol('The Shape of Water', 'Andrea Camilleri', 2002, 'en', '9780142004371')]
        : /subject:"mystery"/.test(decodeURIComponent(u)) ? [vol('Un giallo nuovissimo', 'Mario Rossi', Y, 'it', '9788804700001'), vol('A brand new mystery', 'John Doe', Y, 'en', '9780000000002')] : [];
      return r.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ items }) });
    }
    r.respond({ status: 404, body: '' });
  });
  const wait = H.wait;   // attesa «finché» (_harness.js)
  await page.goto('http://localhost:' + CFG.port(8183) + '/?vista=elenco', { waitUntil: 'load' });
  await page.evaluate(b => { const o = Storage.prototype.setItem; localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: Date.now() })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'P', selTip: 1, lastBackup: Date.now(), donUntil: Date.now() + 9e9, suggAuto: true })); Storage.prototype.setItem = function (k, v) { if (/^catalogo-libri-v2$/.test(k)) return; return o.call(this, k, v); }; }, books);
  await page.reload({ waitUntil: 'load' }); await wait(800);
  const txt = s => page.$eval(s, e => e.innerText.replace(/\s+/g, ' ').trim()), hid = s => page.$eval(s, e => e.hidden);
  // 1) l'ordine: prima il seguito della serie, mai il libro prestato
  const nl = await page.evaluate(() => window.__app.nextList());
  console.log('[1 ordine]', nl.map(x => x.id + ':' + x.score).join(' '));
  assert.strictEqual(nl[0].id, 'b3'); assert(/seguito/.test(nl[0].why[0])); assert(!nl.some(x => x.id === 'b6'), 'niente prestati');
  assert(nl.findIndex(x => x.id === 'b4') > nl.findIndex(x => x.id === 'b3'), 'vol. 4 dopo il 3');
  const b5 = nl.find(x => x.id === 'b5'); assert(b5.why.some(w => /breve \(160 pagine\).*620/.test(w)) && b5.why.some(w => /da 2 anni/.test(w)), 'breve dopo lungo, attesa');
  // 2) riquadro in cima: ho finito oggi «Il cane di terracotta» e non ne sto leggendo altri
  assert(!(await hid('#nxBox')), 'riquadro visibile');
  let box = await txt('#nxBox'); console.log('[2 riquadro]', box);
  assert(/Hai finito «Il cane di terracotta»/.test(box) && /Il ladro di merendine/.test(box) && /seguito/.test(box));
  await page.screenshot({ path: CFG.OUT + '/sugg_box.png' });
  await page.click('#nxBoxNext'); await wait(150);
  box = await txt('#nxBoxCard'); assert(!/Il ladro di merendine/.test(box), 'Un altro cambia libro');
  await page.click('#nxBoxX'); await wait(150);
  assert(await hid('#nxBox'), '× nasconde'); assert.strictEqual(await page.evaluate(() => window.__app.settings.nxSeen), 'b2');
  // 3) dal menu: Suggerimenti, pagina intera (21/11/2026): in cima «Cosa leggere dopo», poi gli scaffali
  await page.evaluate(() => window.__app.openDrawer('opt')); await wait(350);
  assert(/Suggerimenti/.test(await txt('#goSugg')));
  await page.click('#goSugg'); await wait(1600);   // la prima volta cerca da sola anche in rete
  assert(!(await hid('#suggSheet')));
  let card = await txt('#sgNextCard'); console.log('[3 leggi dopo]', card);
  assert(/Il ladro di merendine/.test(card) && /vol\. 3 di «Montalbano», hai letto il 2/.test(card) && /Camilleri/.test(card));
  assert(/1 di 3 libri da leggere/.test(card));
  await page.screenshot({ path: CFG.OUT + '/sugg_next.png' });
  await page.click('#sgNextCard [data-act="nxother"]'); await wait(150);
  assert(/2 di 3/.test(await txt('#sgNextCard')));
  const id2 = await page.$eval('#sgNextCard [data-act="nxstart"]', e => e.dataset.id);
  await page.click('#sgNextCard [data-act="nxstart"]'); await wait(250);
  assert.strictEqual(await page.evaluate(id => window.__app.state.books.find(b => b.id === id).rs, id2), 'in');
  assert(/Buona lettura/.test(await txt('#toast')));
  assert(/di 2/.test(await txt('#sgNextCard')), 'il libro iniziato esce dalla lista');
  // annulla: torna da leggere
  await page.click('#toast button'); await wait(200);
  assert.strictEqual(await page.evaluate(id => window.__app.state.books.find(b => b.id === id).rs, id2), 'da');
  // 4) scaffali: altri libri dei tuoi autori, novità dei tuoi generi, serie; solo in italiano. Senza account: il riquadro degli amici
  const shelf = k => page.$eval('[data-shelf="' + k + '"]', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
  console.log('[4 scaffali]', await page.$$eval('#sgShelves [data-shelf]', e => e.map(x => x.dataset.shelf).join(',')));
  console.log('  richieste:', gq.length, gq.map(u => u.replace(/.*q=([^&]*).*/, '$1')).join(' | '));
  assert(gq.length >= 2 && gq.every(u => /langRestrict=it/.test(u)), 'solo italiano');
  assert(gq.some(u => /subject:"mystery"/.test(u)), 'genere Gialli cercato come mystery');
  assert(/Il birraio di Preston/.test(await shelf('autori')) && /Ti piace Andrea Camilleri/.test(await shelf('autori')));
  assert(/Un giallo nuovissimo/.test(await shelf('nuovi')) && /Uscito da poco · Gialli/.test(await shelf('nuovi')));
  assert(/Montalbano, vol\. 5/.test(await shelf('serie')) && /Vol\. 5: ne hai/.test(await shelf('serie')));
  const all = await txt('#sgShelves');
  assert(!/The Shape of Water|brand new mystery/.test(all), 'niente inglese'); assert(!/forma dell'acqua/i.test(all), 'niente libri che ho già');
  assert(/Con gli amici i suggerimenti migliorano/.test(all) && /Aggiungi un amico/.test(all), 'senza amici: il riquadro');
  assert(await page.evaluate(() => { const e = document.querySelector('#suggSheet .sheet-in'); return e.scrollWidth - e.clientWidth <= 0; }), 'niente scorrimento di lato');
  await page.screenshot({ path: CFG.OUT + '/sugg_disc.png' });
  // anteprima, + Desideri e Non mi interessa
  const open = async re => { await page.evaluate(r => [...document.querySelectorAll('#sgShelves [data-sg]')].find(c => new RegExp(r).test(c.innerText)).click(), re); await wait(200); };
  const nW = await page.evaluate(() => window.__app.state.books.filter(b => b.w).length);
  await open('birraio');
  assert(!(await hid('#sgPrev'))); const pv = await txt('#sgPrev'); console.log('[anteprima]', pv);
  assert(/Perché te lo propongo/i.test(pv) && /Di Andrea Camilleri, che ti piace/.test(pv) && /Sellerio · 1995/.test(pv));
  await page.screenshot({ path: CFG.OUT + '/sugg_prev.png' });
  await page.click('#sgPrev [data-act="sgwish"]'); await wait(200);
  assert(await hid('#sgPrev'), 'l\'anteprima si chiude');
  const wb = await page.evaluate(() => window.__app.state.books.filter(b => b.w));
  assert.strictEqual(wb.length, nW + 1); assert(wb.some(b => b.t === 'Il birraio di Preston' && b.a === 'Andrea Camilleri' && b.i === '9788838912344'));
  assert(!/birraio/.test(await txt('#sgShelves')), 'sparisce dagli scaffali');
  await open('vol\\. 5'); await page.click('#sgPrev [data-act="sgwish"]'); await wait(200);
  assert(await page.evaluate(() => window.__app.state.books.some(b => b.w && b.se === 'Montalbano' && b.sn === '5')), 'volume della serie nei Desideri');
  await open('nuovissimo'); await page.click('#sgPrev [data-act="sghide"]'); await wait(200);
  assert(!/nuovissimo/.test(await txt('#sgShelves')));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-sugg')));
  assert(saved.hide.length === 1 && saved.at > 0);
  // 5) anche altre lingue (in Indice › Ricerca dei libri): alla prossima apertura cerca senza langRestrict
  gq.length = 0;
  await page.click('#sgFoot [data-act="sgopts"]'); await wait(400);
  assert(!(await hid('#optSheet')) && (await hid('#suggSheet')), 'dal piede alle impostazioni');
  await page.click('#sgLang'); await wait(200);
  assert.strictEqual(await page.evaluate(() => window.__app.settings.suggLang), 'all');
  await page.keyboard.press('Escape'); await wait(500);
  await page.evaluate(() => { if (window.__app.closeDrawer) window.__app.closeDrawer(); window.__app.openSugg(); }); await wait(1600);
  assert(gq.length >= 2 && gq.every(u => !/langRestrict/.test(u)), 'tutte le lingue');
  const all2 = await txt('#sgShelves'); console.log('[5 altre lingue]', all2.slice(0, 160));
  assert(/The Shape of Water/.test(all2) && !/nuovissimo/.test(all2), 'inglese sì, scartato resta scartato');
  await page.evaluate(() => { window.__app.settings.suggLang = 'it'; });
  // 6) chiusura con Esc; ricerca automatica: non prima di una settimana
  await page.keyboard.press('Escape'); await wait(200); assert(await hid('#suggSheet'));
  gq.length = 0;
  await page.evaluate(() => window.__app.autoSugg()); await wait(600);
  assert.strictEqual(gq.length, 0, 'appena cercato: niente');
  await page.evaluate(() => { const s = window.__app.sugg(); s.at = Date.now() - 8 * 864e5; s.tried = Date.now() - 2 * 864e5; s.items = []; s.hide = []; window.__app.autoSugg(); }); await wait(1500);
  console.log('[6 automatica]', gq.length, 'richieste;', await txt('#toast'));
  assert(gq.length >= 2 && /da scoprire/.test(await txt('#toast')));
  // disattivata: niente
  gq.length = 0;
  await page.evaluate(() => { window.__app.settings.suggAuto = false; const s = window.__app.sugg(); s.at = 0; s.tried = 0; window.__app.autoSugg(); }); await wait(600);
  assert.strictEqual(gq.length, 0);
  // 7) riquadro: non compare se sto già leggendo un libro
  await page.evaluate(() => { const a = window.__app; a.settings.nxSeen = ''; a.state.books.find(b => b.id === 'b4').rs = 'in'; a.setTab('lib'); }); await wait(300);
  assert(await hid('#nxBox'), 'sto leggendo: niente riquadro');
  await page.evaluate(() => { const a = window.__app; a.state.books.find(b => b.id === 'b4').rs = 'da'; a.setTab('lib'); }); await wait(300);
  assert(!(await hid('#nxBox')), 'torna');
  await page.evaluate(() => window.__app.setTab('wish')); await wait(300);
  assert(await hid('#nxBox'), 'non nei Desideri');
  // 8) una collana di 30 volumi conta come un libro solo, per gli autori e per i generi di «Da scoprire»
  const rank = await page.evaluate(() => {
    const A = window.__app, add = o => A.state.books.push(Object.assign({ g: [], ts: 1, rs: 'da', w: false }, o));
    for (let i = 1; i <= 30; i++) add({ id: 'c' + i, t: 'Tex ' + i, a: 'Gian Luigi Bonelli', gen: 'Fumetti', se: 'Tex', sn: String(i) });
    ['Rossi', 'Verdi'].forEach((a, j) => { add({ id: 'x' + j, t: 'Uno ' + a, a: 'Mario ' + a, gen: 'Fumetti' }); add({ id: 'y' + j, t: 'Due ' + a, a: 'Mario ' + a, gen: 'Saggi' }); });
    add({ id: 'z1', t: 'Tre', a: 'Altro', gen: 'Fumetti' });
    return A.suggRank();
  });
  console.log('[8 collana]', JSON.stringify(rank));
  assert(!rank.a.some(x => /^Gian Luigi Bonelli/.test(x)), 'la collana non porta l\'autore in testa (conta 1)');
  const fum = rank.g.find(x => /^Fumetti:/.test(x)); assert(fum && /^Fumetti:4\/33$/.test(fum), 'Fumetti: 4 unità, 33 libri veri');
  assert.deepStrictEqual(errors, []);
  console.log('e2e63 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
