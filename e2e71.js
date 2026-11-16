const CFG = require("./_config");
// modulo «Scheda aperta del libro» (schede.js/.css): Classica e D, pagina del libro (A, B, C tolte);
// scelta in Opzioni › Aspetto, salvata; i campi spostati si modificano e si salvano come prima.
// D: in alto icone su una riga (preferito, desideri, condividi, elimina), in fondo Presta e Cerca sul web con la scritta; autore che apre la sua finestra; lettura modificabile; etichette = filtri
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8191));
const books = [
  { id: 'r1', t: 'Il nome della rosa', a: 'Umberto Eco', e: 'Bompiani', y: '2012', c: 13, i: '9788845292613', gen: 'Narrativa', pg: '624', sh: 'Studio', rs: 'ok', rt: 5, rd: '2026-10-02', se: 'I grandi romanzi', sn: '3', n: 'Regalo di Anna', ds: 'Ultima settimana del novembre 1327: frate Guglielmo indaga.', dsf: 'google', qs: [{ x: 'Stat rosa', pg: '', d: 1, phs: [] }], ts: 10 },
  { id: 'r2', t: 'Baudolino', a: 'Umberto Eco', e: 'Bompiani', y: '2000', ts: 9, rs: 'da' },
  { id: 'w1', t: 'Il pendolo di Foucault', a: 'Umberto Eco', e: 'Bompiani', y: '1988', w: true, ts: 8 }].concat(Array.from({ length: 25 }, (_, i) => ({ id: 'f' + i, t: 'Riempitivo ' + i, a: 'Autore ' + i, ts: 100 + i, rs: 'da' })));   // libri piu' recenti: la rosa sta in fondo all'elenco
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => r.url().startsWith('http://localhost:' + CFG.port(8191)) ? r.continue() : r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await page.goto('http://localhost:' + CFG.port(8191) + '/?vista=elenco', { waitUntil: 'load' });
  await page.evaluate(b => { const o = Storage.prototype.setItem; localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: Date.now() })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'P', selTip: 1, lastBackup: Date.now(), donUntil: Date.now() + 9e9, instSnooze: Date.now() + 9e9 })); Storage.prototype.setItem = function (k, v) { if (/^catalogo-libri-v2$/.test(k)) return; return o.call(this, k, v); }; }, books);
  await page.reload({ waitUntil: 'load' }); await wait(800);
  const card = () => '#list .row[data-id="r1"]';
  const open = async () => { if (!(await page.$(card() + '.open'))) { await page.evaluate(s => document.querySelector(s + ' .sum').click(), card()); await wait(400); } };
  const pick = async v => { await page.evaluate(v => window.NLCard.set(v), v); await wait(350); };   // la scelta non e' piu' nelle Opzioni: si cambia solo nelle prove
  const book = () => page.evaluate(() => window.__app.state.books.find(b => b.id === 'r1'));
  // nelle Opzioni non c'e' piu' la scelta della scheda: la pagina del libro e' quella dell'app (su localhost parte la classica, per le prove vecchie)
  await page.evaluate(() => window.__app.openOptions('look')); await wait(250);
  assert(await page.evaluate(() => !document.querySelector('#optCard') && !/Scheda aperta del libro/.test(document.querySelector('#optSheet').innerText)), 'sezione tolta');
  await page.evaluate(() => window.__app.closeOptions()); await wait(300);
  assert.strictEqual(await page.evaluate(() => window.NLCard.get()), 'attuale');
  await open();
  const h0 = await page.$eval(card(), e => Math.round(e.getBoundingClientRect().height));
  assert(await page.$eval(card(), e => !e.querySelector('.cv-secs, .cv-tabs, .cv-page')));
  // D: pagina del libro; Modifica mostra i campi, Fatto torna alla pagina
  await pick('d'); await open();
  const d = await page.evaluate(s => { const e = document.querySelector(s); const p = e.querySelector('.cv-page'); return { page: p ? p.innerText.replace(/\s+/g, ' ') : '', headHidden: getComputedStyle(e.querySelector('.head')).display === 'none' }; }, card());
  console.log('[D]', JSON.stringify(d)); assert(/Il nome della rosa/.test(d.page) && /Bompiani · 2012 · 624 pagine/.test(d.page) && d.headHidden);
  // in alto solo preferito, condividi, elimina; sotto, con la scritta: presta, desideri, cerca sul web
  const acts = await page.evaluate(s => { const e = document.querySelector(s); return { top: [...e.querySelectorAll('.acts-main [data-act]')].map(x => x.dataset.act), low: [...e.querySelectorAll('.cv-acts2 [data-act]')].map(x => x.dataset.act + ':' + (getComputedStyle(x.querySelector('.al')).display !== 'none')) }; }, card());
  console.log('  azioni', JSON.stringify(acts)); assert.deepStrictEqual(acts.top, ['fav', 'towish', 'share', 'del']); assert.deepStrictEqual(acts.low, ['loan:true', 'websearch:true']);
  const lay = await page.evaluate(s => { const e = document.querySelector(s), t = [...e.querySelectorAll('.acts-main [data-act]')].map(x => Math.round(x.getBoundingClientRect().top)), low = e.querySelector('.cv-acts2'); return { oneRow: new Set(t).size === 1, last: e.lastElementChild === low }; }, card());
  assert(lay.oneRow && lay.last, 'icone su una riga, Presta e Cerca sul web in fondo');
  // descrizione subito sotto i dati, senza riquadro; etichette in fondo, prima di Presta e Cerca sul web
  const order = await page.evaluate(s => { const e = document.querySelector(s); const kids = [...e.querySelector('.cv-page').children].map(x => x.className.split(' ')[0] || x.tagName); const all = [...e.children].map(x => x.className.split(' ')[0]); return { page: kids, card: all.slice(-2), desc: e.querySelector('.cv-desc .desc-t') ? e.querySelector('.cv-desc .desc-t').textContent : '' }; }, card());
  console.log('  ordine', JSON.stringify(order));
  assert.strictEqual(order.page[0], 'cv-hero'); assert.strictEqual(order.page[1], 'read'); assert.strictEqual(order.page[2], 'desc'); assert(/frate Guglielmo/.test(order.desc));
  assert.deepStrictEqual(order.card, ['cv-tags', 'cv-acts2']);
  // descrizione: anteprima, fonte e «rimuovila» solo aperta, con la freccetta
  const dsc = () => page.evaluate(s => { const d = document.querySelector(s + ' .cv-desc'); return { src: getComputedStyle(d.querySelector('.desc-src')).display, open: d.classList.contains('cv-open'), more: !!d.querySelector('.cv-dmore') }; }, card());
  let dd = await dsc(); assert(dd.more && !dd.open && dd.src === 'none', 'anteprima senza fonte');
  await page.evaluate(s => document.querySelector(s + ' .cv-dmore').click(), card()); await wait(200);
  dd = await dsc(); assert(dd.open && dd.src !== 'none', 'aperta: fonte visibile');
  // Modifica: icona della matita in alto, sulla stessa riga
  const pen = await page.evaluate(s => { const e = document.querySelector(s), p = e.querySelector('.acts-main .cv-editb'), f = e.querySelector('.acts-main [data-act="fav"]'); return p && Math.round(p.getBoundingClientRect().top) === Math.round(f.getBoundingClientRect().top) && getComputedStyle(p.querySelector('.al')).display === 'none'; }, card());
  assert(pen, 'matita in alto, solo icona');
  // lettura e voto: striscia a tutta larghezza subito sotto copertina e titolo, prima della descrizione (proposta C, 16/11/2026)
  const rl = await page.evaluate(s => { const e = document.querySelector(s), p = e.querySelector('.cv-page > .cv-readbox.cv-strip'), hero = e.querySelector('.cv-hero'), ds = e.querySelector('.cv-desc'), st = p && p.querySelector('.stars'), d = p && p.querySelector('.f-rd');
    return { ok: !!p && !!p.querySelector('[data-act="rs"]') && !!st && !!d, afterHero: !!p && hero.nextElementSibling === p, aboveDesc: !!p && p.getBoundingClientRect().bottom <= ds.getBoundingClientRect().top + 1, full: !!p && Math.abs(p.getBoundingClientRect().width - e.querySelector('.cv-page').getBoundingClientRect().width) < 2,
      dateBelow: !!st && !!d && d.getBoundingClientRect().top >= st.getBoundingClientRect().bottom - 1 }; }, card());
  console.log('  striscia', JSON.stringify(rl)); assert(rl.ok && rl.afterHero && rl.aboveDesc && rl.full && rl.dateBelow);
  // voto a libricini con la parola (16/11/2026)
  const rw = await page.evaluate(s => { const e = document.querySelector(s); return { bk: e.querySelectorAll('.cv-readbox .star.bk svg').length, on: e.querySelectorAll('.cv-readbox .star.bk.on').length, w: e.querySelector('.cv-readbox .rt-word').textContent, lbl: e.querySelector('.cv-readbox .star.bk[data-v="5"]').getAttribute('aria-label') }; }, card());
  console.log('  libricini', JSON.stringify(rw)); assert(rw.bk === 5 && rw.on === 5 && rw.w === 'Capolavoro' && rw.lbl === '5 libricini: Capolavoro');
  // una riga sola, al centro della striscia: libricini (libro aperto) e parola a destra; «Letto il» sotto (16/11/2026)
  const one = await page.evaluate(s => { const e = document.querySelector(s), st = e.querySelector('.cv-readbox .stars').getBoundingClientRect(), w = e.querySelector('.cv-readbox .rt-word').getBoundingClientRect(), box = e.querySelector('.cv-readbox').getBoundingClientRect(), mid = (st.left + w.right) / 2;
    return { right: w.left >= st.right - 1, sameRow: Math.abs((st.top + st.bottom) / 2 - (w.top + w.bottom) / 2) < 6, centered: Math.abs(mid - (box.left + box.right) / 2) < 6, pages: e.querySelectorAll('.cv-readbox .star.bk svg .pg').length }; }, card());
  console.log('  riga', JSON.stringify(one)); assert(one.right && one.sameRow && one.centered && one.pages === 10);
  // «Letto il 2 ottobre 2026»: la data per esteso in una pillola; toccandola si apre il calendario (campo data invisibile sopra)
  const rdv = await page.evaluate(s => { const e = document.querySelector(s), sh = e.querySelector('.cv-readbox .rd-show'), inp = e.querySelector('.cv-readbox input[data-k="rd"]'), a = sh.getBoundingClientRect(), b = inp.getBoundingClientRect(); return { t: sh.textContent, cover: b.left <= a.left + 1 && b.right >= a.right - 1, op: getComputedStyle(inp).opacity }; }, card());
  console.log('  letto il', JSON.stringify(rdv)); assert(rdv.t === '2 ottobre 2026' && rdv.cover && rdv.op === '0');
  await page.evaluate(s => { const i = document.querySelector(s + ' .cv-readbox input[data-k="rd"]'); i.value = '2026-03-05'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }, card()); await wait(300);
  assert.strictEqual(await page.evaluate(s => document.querySelector(s + ' .cv-readbox .rd-show').textContent, card()), '5 marzo 2026');
  assert.strictEqual(await page.evaluate(() => window.__app.state.books.find(b => b.id === 'r1').rd), '2026-03-05');
  await page.evaluate(() => window.__app.openOptions('look')); await wait(300);
  assert(await page.evaluate(() => !document.querySelector('#optRtPos')), 'scelta temporanea tolta');
  await page.evaluate(() => window.__app.closeOptions()); await wait(300);
  await page.screenshot({ path: CFG.OUT + '/scheda_d_lettura.png' });
  // lettura modificabile dalla pagina
  assert(await page.evaluate(s => document.querySelector(s + ' .cv-page [data-act="rs"][data-v="ok"]').getAttribute('aria-pressed') === 'true', card()));
  await page.evaluate(s => document.querySelector(s + ' .cv-page [data-act="rs"][data-v="in"]').click(), card()); await wait(400);
  assert.strictEqual((await book()).rs, 'in', 'stato cambiato dalla pagina');
  assert(await page.evaluate(s => !!document.querySelector(s + ' .cv-page'), card()), 'resta la pagina');
  // etichette = filtri; la serie porta alla serie
  const chips = await page.$$eval(card() + ' .cv-chips .fchip', e => e.map(x => (x.dataset.f || x.dataset.act) + ':' + x.textContent.trim()));
  console.log('  etichette', chips.join(' | ')); assert(chips.some(c => /^gen:Narrativa/.test(c)) && chips.some(c => /^sh:Studio/.test(c)) && chips.some(c => /^serall:I grandi romanzi, vol\. 3/.test(c)));
  // l'autore apre la sua finestra
  await page.evaluate(s => document.querySelector(s + ' .cv-au [data-act="auinfo"]').click(), card()); await wait(500);
  assert(await page.evaluate(() => !document.querySelector('#auSheet').hidden), 'finestra dell\'autore');
  await page.keyboard.press('Escape'); await wait(300);
  await page.screenshot({ path: CFG.OUT + '/scheda_d_prova.png' });
  await page.evaluate(s => document.querySelector(s + ' .cv-editb').click(), card()); await wait(300);
  assert(await page.evaluate(s => { const e = document.querySelector(s); return !e.querySelector('.cv-page') && getComputedStyle(e.querySelector('.head')).display !== 'none' && !!e.querySelector('.cv-done'); }, card()));
  await page.evaluate(s => document.querySelector(s + ' .cv-done').click(), card()); await wait(300);
  assert(await page.evaluate(s => !!document.querySelector(s + ' .cv-page'), card()));
  // un'etichetta e' un filtro: «Narrativa» mostra i libri di quel genere; la pagina va in cima (prima tornava a meta' elenco, 16/11/2026)
  await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), card()); await wait(200);
  console.log('  scroll prima', await page.evaluate(() => Math.round(scrollY)));
  await page.evaluate(s => document.querySelector(s + ' .cv-chips .fchip[data-f="gen"]').click(), card()); await wait(700);
  const y1 = await page.evaluate(() => Math.round(scrollY)); console.log('  scroll dopo', y1); assert(y1 < 5, 'in cima all\'elenco filtrato');
  const rows = await page.$$eval('#list [data-id]', e => e.map(x => x.dataset.id)); console.log('  filtro genere:', rows.join(','));
  assert.deepStrictEqual(rows, ['r1']);
  // la copertina (senza immagine) cerca o fa fotografare la copertina; con l'immagine si ingrandisce
  await page.evaluate(() => window.__app.setTab('lib')); await wait(200);
  await open();
  assert(await page.evaluate(s => { const c = document.querySelector(s + ' .cv-cov'); return !!c && (c.dataset.act === 'coverphoto' || c.dataset.act === 'zoom'); }, card()), 'copertina toccabile');
  await page.evaluate(() => { const b = window.__app.state.books.find(x => x.id === 'r1'); b.img = 'https://example.org/c.jpg'; }); await page.evaluate(() => window.NL.refresh()); await wait(300); await open();
  await page.evaluate(s => document.querySelector(s + ' .cv-cov[data-act="zoom"]').click(), card()); await wait(400);
  assert(await page.evaluate(() => !document.querySelector('#lightbox').hidden), 'si ingrandisce');
  await page.keyboard.press('Escape'); await wait(300);
  // la scelta temporanea A-E non c'e' piu' (Piero ha tenuto la C, 16/11/2026)
  await page.evaluate(() => window.__app.openOptions('look')); await wait(300);
  assert(await page.evaluate(() => !document.querySelector('#optReadPos')));
  await page.evaluate(() => window.__app.closeOptions()); await wait(300);
  // nei Desideri: anche preferito e Presta, vendi o regala, come nella scheda normale
  await page.evaluate(() => window.__app.setTab('wish')); await wait(300);
  await page.evaluate(() => document.querySelector('#list .row[data-id="w1"] .sum').click()); await wait(400);
  const wa = await page.evaluate(() => { const e = document.querySelector('#list .row[data-id="w1"]'); return { top: [...e.querySelectorAll('.acts-main [data-act]')].map(x => x.dataset.act), low: [...e.querySelectorAll('.cv-acts2 [data-act]')].map(x => x.dataset.act) }; });
  console.log('  desideri', JSON.stringify(wa)); assert.deepStrictEqual(wa.top, ['fav', 'tolib', 'share', 'del']); assert.deepStrictEqual(wa.low, ['loan', 'websearch']);
  await page.evaluate(() => document.querySelector('#list .row[data-id="w1"] .acts-main [data-act="fav"]').click()); await wait(300);
  assert.strictEqual(await page.evaluate(() => window.__app.state.books.find(b => b.id === 'w1').fav), true, 'preferito anche nei Desideri');
  await page.screenshot({ path: CFG.OUT + '/scheda_d_desideri.png' });
  // la scelta resta dopo la riapertura
  await page.reload({ waitUntil: 'load' }); await wait(700);
  assert.strictEqual(await page.evaluate(() => document.documentElement.dataset.card), 'd');
  assert.deepStrictEqual(errors, []);
  console.log('e2e71 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
