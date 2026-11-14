const CFG = require("./_config");
// «Descrizione» nella scheda aperta: cerca alla prima apertura, salva nel libro, fonti, errori, lingua, toglila
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(8151);
const B = (o) => Object.assign({ t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: Date.now(), sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: 'da', rt: 0, rd: '' }, o);
const books = [
  B({ id: 'rosa', t: 'Il nome della rosa', a: 'Umberto Eco', e: 'Bompiani', y: '2012', i: '9788845292613' }),
  B({ id: 'eng', t: 'Giornali di bordo', a: 'James Cook', i: '9788850262359' }),
  B({ id: 'none', t: 'Libro senza niente', a: 'Nessuno', i: '9788804668015' }),
  B({ id: 'long', t: 'Le città invisibili', a: 'Italo Calvino', i: '9788804668022' }),
  B({ id: 'tit', t: 'Sostiene Pereira', a: 'Antonio Tabucchi' }),
];
const json = o => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
const IT = '<p>Ultima settimana del novembre 1327. Il novizio Adso da Melk accompagna in un&#39;abbazia dell&#39;Italia settentrionale frate <b>Guglielmo da Baskerville</b>, che deve risolvere una serie di delitti.</p><p>Un romanzo che è anche una storia della filosofia.</p>';
const LONG = 'Marco Polo racconta al Gran Kan le città che ha visto nei suoi viaggi, e ogni città è una storia diversa. '.repeat(14);
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
  await page.goto('http://localhost:8151/', { waitUntil: 'load' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(1200);
  const book = id => page.evaluate(i => { const b = window.__app.state.books.find(x => x.id === i); return b && JSON.parse(JSON.stringify(b)); }, id);
  const open = async id => { if (!await page.$('.row.open[data-id="' + id + '"]')) await page.evaluate(i => document.querySelector('.row[data-id="' + i + '"] [data-act="toggle"]').click(), id); await wait(250); };
  const sumTap = id => page.evaluate(i => document.querySelector('details.desc:not(.quotes)[data-id="' + i + '"] > summary').click(), id);
  const body = id => page.$eval('details.desc:not(.quotes)[data-id="' + id + '"] .desc-b', e => e.textContent.replace(/\s+/g, ' ').trim());
  const doneD = id => page.waitForFunction(i => { const d = document.querySelector('details.desc:not(.quotes)[data-id="' + i + '"] .desc-b'); return d && !d.querySelector('.desc-wait') && d.textContent.trim(); }, { timeout: 15000 }, id);

  // 1) chiusa la scheda: niente riquadro; aperta: riquadro chiuso, nessuna richiesta finché non lo tocco
  assert(!(await page.$('.row:not(.open) details.desc')), 'riquadro solo nella scheda aperta');
  await open('rosa');
  assert(await page.$('details.desc:not(.quotes)[data-id="rosa"]:not([open])'));
  const hint = await page.$eval('details.desc:not(.quotes)[data-id="rosa"] summary', e => e.textContent); console.log('[1 chiuso]', hint); assert(hint.includes('Descrizione'));
  hits = []; await sumTap('rosa'); await doneD('rosa');
  const t1 = await body('rosa'); console.log('[1 Google]', t1.slice(0, 160)); 
  assert(t1.startsWith('Ultima settimana del novembre 1327.') && t1.includes("un'abbazia") && t1.includes('Fonte: Google Libri') && !t1.includes('<b>') && !t1.includes('inglese'));
  assert.strictEqual(hits.length, 1);
  assert(!(await page.$('details.desc:not(.quotes)[data-id="rosa"] .desc-hint')), 'il suggerimento sparisce');
  await wait(600);
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('catalogo-libri-v2'))).books.find(b => b.id === 'rosa');
  assert(saved.ds.includes('Guglielmo da Baskerville') && saved.dsf === 'g' && saved.dsl === 'it'); console.log('[1 salvata]', saved.ds.length, 'caratteri');
  // 2) chiudo e riapro la scheda: il riquadro resta aperto, nessuna nuova richiesta
  hits = [];
  await page.evaluate(() => document.querySelector('.row[data-id="rosa"] .chev-btn').click()); await wait(200);
  await open('rosa');
  assert(await page.$('details.desc:not(.quotes)[data-id="rosa"][open]'), 'resta aperto'); await wait(300);
  assert.strictEqual(hits.length, 0, 'gia\' salvata: niente rete'); console.log('[2 riaperta] nessuna richiesta');
  // 3) solo Open Library, in inglese: fonte, lingua, traduci
  await open('eng'); hits = []; await sumTap('eng'); await doneD('eng');
  const t3 = await body('eng'); console.log('[3 OL]', t3.slice(0, 200)); console.log('    richieste:', hits.join(' | '));
  assert(t3.includes('The journals of Captain James Cook') && t3.includes('notes of the editor.') && !t3.includes('Also contained') && t3.includes('Fonte: Open Library · in inglese'));
  const tr = await page.$eval('details.desc:not(.quotes)[data-id="eng"] a.link', a => a.href); assert(tr.startsWith('https://translate.google.com/?sl=auto&tl=it'));
  assert((await book('eng')).dsf === 'o');
  // 4) niente da nessuna parte -> messaggio e «Cerca di nuovo»
  await open('none'); await sumTap('none'); await doneD('none');
  const t4 = await body('none'); console.log('[4 nessuna]', t4); assert(t4.includes('Nessuna descrizione trovata')); assert((await book('none')).dsn > 0);
  hits = []; await page.evaluate(() => document.querySelector('details.desc:not(.quotes)[data-id="none"] [data-act="descretry"]').click()); await doneD('none');
  assert(hits.length >= 2, 'ha cercato di nuovo'); console.log('[4 di nuovo]', hits.length, 'richieste');
  // 5) testo lungo: tagliato con «Leggi tutto»
  await open('long'); await sumTap('long'); await doneD('long');
  assert(await page.$('details.desc:not(.quotes)[data-id="long"] .desc-t.clip'));
  await page.evaluate(() => document.querySelector('details.desc:not(.quotes)[data-id="long"] [data-act="descmore"]').click()); await wait(100);
  assert(!(await page.$('details.desc:not(.quotes)[data-id="long"] .desc-t.clip')) && !(await page.$('details.desc:not(.quotes)[data-id="long"] [data-act="descmore"]'))); console.log('[5 leggi tutto] ok');
  // 6) senza ISBN, per titolo e autore: preferisce l'italiano
  await open('tit'); await sumTap('tit'); await doneD('tit');
  const t6 = await body('tit'); console.log('[6 titolo]', t6.slice(0, 120)); assert(t6.startsWith('Lisbona, 1938') && !t6.includes('inglese'));
  // 7) «Non è questo libro: toglila»
  await page.evaluate(() => document.querySelector('details.desc:not(.quotes)[data-id="tit"] [data-act="descdel"]').click()); await wait(150);
  const b7 = await book('tit'); assert(!b7.ds && b7.dsn > 0); assert((await body('tit')).includes('Nessuna descrizione')); console.log('[7 tolta] ok');
  // 8) connessione debole: avviso e Riprova, niente «non trovata» salvato
  net = 'weak';
  await page.evaluate(() => { const b = window.__app.state.books.find(x => x.id === 'tit'); b.dsn = 0; });
  await page.evaluate(() => document.querySelector('details.desc:not(.quotes)[data-id="tit"] [data-act="descretry"]').click()); await doneD('tit');
  const t8 = await body('tit'); console.log('[8 debole]', t8); assert(t8.includes('Connessione debole') && t8.includes('Riprova')); assert.strictEqual((await book('tit')).dsn, 0);
  net = 'ok';
  await page.evaluate(() => document.querySelector('details.desc:not(.quotes)[data-id="tit"] [data-act="descretry"]').click()); await doneD('tit');
  assert((await body('tit')).startsWith('Lisbona')); console.log('[8 riprova] ok');
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
