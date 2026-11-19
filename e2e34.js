const CFG = require("./_config");
const H = require('./_harness');
// «Descrizione» nella scheda aperta. Giro 11B (Piero, 19/11/2026): se non e' arrivata con la ricerca del libro, si cerca a richiesta
// aprendo il riquadro (una ricerca Google per ISBN, o per titolo e autore); se non c'e', «Descrizione non disponibile».
// Fonti, lingua, «Leggi tutto», toglila, salvata nel libro.
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8151), ROOT);
const B = (o) => Object.assign({ t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: Date.now(), sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: 'da', rt: 0, rd: '' }, o);
const books0 = [
  B({ id: 'rosa', t: 'Il nome della rosa', a: 'Umberto Eco', e: 'Bompiani', y: '2012', i: '9788845292613' }),
  B({ id: 'eng', t: 'Giornali di bordo', a: 'James Cook', i: '9788850262359' }),
  B({ id: 'none', t: 'Libro senza niente', a: 'Nessuno', i: '9788804668015' }),
  B({ id: 'long', t: 'Le città invisibili', a: 'Italo Calvino', i: '9788804668022' }),
  B({ id: 'tit', t: 'Sostiene Pereira', a: 'Antonio Tabucchi' }),
];
const json = o => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
const IT = '<p>Ultima settimana del novembre 1327. Il novizio Adso da Melk accompagna in un&#39;abbazia dell&#39;Italia settentrionale frate <b>Guglielmo da Baskerville</b>, che deve risolvere una serie di delitti.</p><p>Un romanzo che è anche una storia della filosofia.</p>';
const LONG = 'Marco Polo racconta al Gran Kan le città che ha visto nei suoi viaggi, e ogni città è una storia diversa. '.repeat(14);
const DS = { rosa: ['Ultima settimana del novembre 1327. Il novizio Adso da Melk accompagna in un\'abbazia dell\'Italia settentrionale frate Guglielmo da Baskerville, che deve risolvere una serie di delitti.', 'g', 'it'],
  eng: ['The journals of Captain James Cook on his voyages of discovery, edited from the original manuscripts.', 'o', 'en'], long: [LONG.trim(), 'g', 'it'] };
const books = books0.map(b => DS[b.id] ? Object.assign({}, b, { ds: DS[b.id][0], dsf: DS[b.id][1], dsl: DS[b.id][2] }) : b);
let net = 'ok', hits = [];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => { const u = decodeURIComponent(r.url());
    if (u.startsWith('http://localhost')) return r.continue();
    if (/googleapis|openlibrary/.test(u)) hits.push(u.replace(/^https:\/\/[^/]+/, ''));
    if (net === 'weak' && /googleapis|openlibrary/.test(u)) return r.abort('failed');
    if (u.includes('googleapis.com/books/v1/volumes?')) {
      if (u.includes('isbn:9788845292613')) return r.respond(json({ items: [{ volumeInfo: { title: 'Il nome della rosa', authors: ['Umberto Eco'], language: 'it', description: IT } }] }));
      if (u.includes('isbn:9788804668022')) return r.respond(json({ items: [{ volumeInfo: { title: 'Le città invisibili', language: 'it', description: LONG } }] }));
      if (u.includes('intitle:"Sostiene Pereira"')) return r.respond(json({ items: [
        { volumeInfo: { title: 'Pereira maintains', authors: ['Antonio Tabucchi'], language: 'en', description: 'Set in Lisbon in 1938, the story of a journalist who is slowly drawn into the resistance.' } },
        { volumeInfo: { title: 'Sostiene Pereira. Una testimonianza', authors: ['Antonio Tabucchi'], language: 'it', description: 'Lisbona, 1938: il dottor Pereira dirige la pagina culturale di un giornale del pomeriggio e per lui la vita è tranquilla.' } }] }));
      return r.respond(json({ totalItems: 0 }));
    }
    if (u.includes('openlibrary.org/isbn/9788850262359.json')) return r.respond(json({ title: 'Giornali di bordo', works: [{ key: '/works/OL123W' }] }));
    if (u.includes('openlibrary.org/works/OL123W.json')) return r.respond(json({ description: { type: '/type/text', value: 'The journals of Captain James Cook on his voyages of discovery, edited from the original manuscripts and with the notes of the [editor](https://example.org).\r\n\r\n----------\nAlso contained in: ...' } }));
    if (/openlibrary/.test(u)) return r.respond({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '' });
    r.abort(); });
  await page.evaluateOnNewDocument((b) => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ extra: true, lastBackup: Date.now(), price: false, installed: true, instScope: '/', swiped: true, name: 'Piero' })); sessionStorage.seeded = 1; } }, books);
  await page.goto('http://localhost:' + CFG.port(8151) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = H.wait;   // attesa «finché» (_harness.js)
  await wait(1200);
  const book = id => page.evaluate(i => { const b = window.__app.state.books.find(x => x.id === i); return b && JSON.parse(JSON.stringify(b)); }, id);
  const open = async id => { if (!await page.$('.row.open[data-id="' + id + '"]')) await page.evaluate(i => document.querySelector('.row[data-id="' + i + '"] [data-act="toggle"]').click(), id); await wait(250); };
  const sumTap = id => page.evaluate(i => document.querySelector('details.desc:not(.quotes)[data-id="' + i + '"] > summary').click(), id);
  const body = id => page.$eval('details.desc:not(.quotes)[data-id="' + id + '"] .desc-b', e => e.textContent.replace(/\s+/g, ' ').trim());
  const doneD = id => page.waitForFunction(i => { const d = document.querySelector('details.desc:not(.quotes)[data-id="' + i + '"] .desc-b'); return d && !d.querySelector('.desc-wait') && d.textContent.trim(); }, { timeout: 15000 }, id);

  // 1) chiusa la scheda: niente riquadro; aperta e toccata: la descrizione salvata, nessuna richiesta
  assert(!(await page.$('.row:not(.open) details.desc')), 'riquadro solo nella scheda aperta');
  await open('rosa');
  const hint = await page.$eval('details.desc:not(.quotes)[data-id="rosa"] summary', e => e.textContent); console.log('[1 chiuso]', hint); assert(hint.includes('Descrizione'));
  hits = []; await sumTap('rosa'); await doneD('rosa');
  const t1 = await body('rosa'); console.log('[1 salvata]', t1.slice(0, 100));
  assert(t1.startsWith('Ultima settimana del novembre 1327.') && t1.includes('Fonte: Google Libri') && !t1.includes('inglese'));
  // 2) in inglese da Open Library: fonte, lingua, traduci
  await open('eng'); await sumTap('eng'); await doneD('eng');
  const t2 = await body('eng'); console.log('[2 OL]', t2.slice(0, 120)); assert(t2.includes('Fonte: Open Library · in inglese'));
  const tr = await page.$eval('details.desc:not(.quotes)[data-id="eng"] a.link', a => a.href); assert(tr.startsWith('https://translate.google.com/?sl=auto&tl=it'));
  // 3) nessuna descrizione dalla prima ricerca: «Descrizione non disponibile», nessuna richiesta, niente «Cerca di nuovo»
  await open('none'); await sumTap('none'); await doneD('none');
  const t3 = await body('none'); console.log('[3 nessuna]', t3); assert.strictEqual(t3, 'Descrizione non disponibile.');
  assert((await book('none')).dsn > 0 && !(await page.$('details.desc:not(.quotes)[data-id="none"] [data-act="descretry"]')), 'segnata, senza riprova');
  // 4) testo lungo: tagliato con «Leggi tutto»
  await open('long'); await sumTap('long'); await doneD('long');
  assert(await page.$('details.desc:not(.quotes)[data-id="long"] .desc-t.clip'));
  await page.evaluate(() => document.querySelector('details.desc:not(.quotes)[data-id="long"] [data-act="descmore"]').click()); await wait(100);
  assert(!(await page.$('details.desc:not(.quotes)[data-id="long"] .desc-t.clip')) && !(await page.$('details.desc:not(.quotes)[data-id="long"] [data-act="descmore"]'))); console.log('[4 leggi tutto] ok');
  // 5) senza ISBN: una ricerca per titolo e autore; vince l'edizione con lo stesso titolo (quella italiana)
  await open('tit'); await sumTap('tit'); await doneD('tit');
  const t5 = await body('tit'); console.log('[5 titolo]', t5.slice(0, 40)); assert(t5.startsWith('Lisbona, 1938')); assert.strictEqual((await book('tit')).dsl, 'it');
  // 6) «Non è questo libro: toglila»
  await open('long'); await page.evaluate(() => document.querySelector('details.desc:not(.quotes)[data-id="long"] [data-act="descdel"]').click()); await wait(150);
  const b6 = await book('long'); assert(!b6.ds && b6.dsn > 0); assert.strictEqual(await body('long'), 'Descrizione non disponibile.'); console.log('[6 tolta] ok');
  await wait(2500);
  assert.strictEqual(hits.length, 2, 'una richiesta per «none» e una per «tit»: ' + hits.join(' | '));
  assert(hits.every(h => h.includes('description')));
  // 9) backup: la descrizione c'e'
  const bk = await page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-v2')).books.find(b => b.id === 'eng'));
  assert(bk.ds && bk.dsl === 'en');
  await page.evaluate(() => { document.querySelector('.row[data-id="rosa"]').scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); });
  await wait(300); await page.screenshot({ path: CFG.OUT + '/desc_open.png' });
  await open('eng'); await page.evaluate(() => { document.querySelector('.row[data-id="eng"] details.desc').scrollIntoView({ block: 'center' }); }); await wait(200);
  await page.screenshot({ path: CFG.OUT + '/desc_en.png' });
  await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); }); await wait(100);
  await page.screenshot({ path: CFG.OUT + '/desc_dark.png' });
  await page.setViewport({ width: 1200, height: 900 }); await wait(300);
  await wait(1000);   // il cambio da telefono a schermo grande ricarica la pagina
  await page.evaluate(() => { document.documentElement.removeAttribute('data-theme'); document.querySelector('.row[data-id="rosa"]').scrollIntoView({ block: 'start' }); }); await wait(300);
  hits = []; await open('rosa'); await sumTap('rosa'); await wait(300); assert.strictEqual(hits.length, 0, 'salvata: si legge senza rete');
  await page.evaluate(() => document.querySelector('.row[data-id="rosa"]').scrollIntoView({ block: 'start' })); await wait(300);
  await page.screenshot({ path: CFG.OUT + '/desc_wide.png' });
  assert(await page.$('details.desc:not(.quotes)[data-id="rosa"][open]'));
  assert.deepStrictEqual(errors, []);
  console.log('e2e34 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
