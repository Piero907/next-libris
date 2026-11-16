const CFG = require("./_config");
// v56: ricerca nelle descrizioni, tutte le descrizioni, obiettivo di lettura, serie, novità degli autori, citazioni
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.gz': 'application/gzip', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': (p.endsWith('.wasm.js') ? 'text/javascript' : MIME[path.extname(f)]) || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8152));
const Y = new Date().getFullYear();
const B = (o) => Object.assign({ t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: Date.now(), sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: 'da', rt: 0, rd: '' }, o);
const books = [
  B({ id: 'rosa', t: 'Il nome della rosa', a: 'Umberto Eco', i: '9788845292613', ds: 'Un novizio e il suo maestro indagano sui delitti in una abbazia del nord Italia.', dsf: 'g', dsl: 'it', rs: 'ok', rd: Y + '-02-10' }),
  B({ id: 'pend', t: 'Il pendolo di Foucault', a: 'Umberto Eco', i: '9788845292620', rs: 'ok', rd: (Y - 1) + '-05-01' }),
  B({ id: 'hp1', t: 'Harry Potter e la pietra filosofale', a: 'J. K. Rowling', se: 'Harry Potter', sn: '1', sq: '7' }),
  B({ id: 'hp2', t: 'Harry Potter e la camera dei segreti', a: 'J. K. Rowling', se: 'Harry Potter', sn: '2' }),
  B({ id: 'hp4', t: 'Harry Potter e il calice di fuoco', a: 'J. K. Rowling', se: 'harry potter', sn: '4' }),
  B({ id: 'hp3', t: 'Harry Potter e il prigioniero di Azkaban', a: 'J. K. Rowling' }),
  B({ id: 'w1', t: 'La storia', a: 'Elsa Morante', w: true, rs: '' }),
];
const json = o => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
let hits = [];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  // immagine di una pagina per la lettura da foto
  const pg = await browser.newPage(); await pg.setViewport({ width: 1100, height: 520 });
  await pg.setContent('<body style="margin:0;background:#fff"><div style="font:34px/1.6 Georgia,serif;padding:50px;width:1000px;color:#111">Era una bella mattina di fine novembre. Nella notte aveva nevicato un poco, ma il terreno era coperto di un velo fresco non più alto di tre dita.</div></body>');
  await pg.screenshot({ path: CFG.OUT + '/pagina.png' }); await pg.close();
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => { const u = decodeURIComponent(r.url());
    if (u.startsWith('http://localhost')) return r.continue();
    if (/googleapis|openlibrary/.test(u)) hits.push(u.replace(/^https:\/\/[^/]+/, '').slice(0, 90));
    if (u.includes('googleapis.com/books/v1/volumes?')) {
      if (u.includes('orderBy=newest')) {
        if (u.includes('inauthor:"Umberto Eco"')) return r.respond(json({ items: [
          { id: 'n1', volumeInfo: { title: 'Lezioni inedite', subtitle: 'Scritti ritrovati', authors: ['Umberto Eco'], publisher: 'La nave di Teseo', publishedDate: Y + '-03-01', language: 'it', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9788834600016' }] } },
          { id: 'n2', volumeInfo: { title: 'Il nome della rosa', authors: ['Umberto Eco'], publishedDate: String(Y), language: 'it' } },
          { id: 'n3', volumeInfo: { title: 'Vecchia raccolta', authors: ['Umberto Eco'], publishedDate: '2011', language: 'it' } }] }));
        if (u.includes('Rowling')) return r.respond(json({ items: [{ id: 'n4', volumeInfo: { title: 'Un racconto nuovo', authors: ['J. K. Rowling'], publisher: 'Salani', publishedDate: String(Y - 1), language: 'it' } }] }));
        return r.respond(json({ totalItems: 0 }));
      }
      if (u.includes('isbn:9788845292620')) return r.respond(json({ items: [{ volumeInfo: { title: 'Il pendolo di Foucault', language: 'it', description: 'Tre redattori di una casa editrice milanese inventano per gioco un Piano che è la storia segreta del mondo.' } }] }));
      return r.respond(json({ totalItems: 0 }));
    }
    if (/openlibrary/.test(u)) return r.respond({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '' });
    r.abort(); });
  await page.evaluateOnNewDocument((b) => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ extra: true, lastBackup: Date.now(), price: false, installed: true, instScope: '/', swiped: true, name: 'Piero' })); sessionStorage.seeded = 1; } }, books);
  await page.goto('http://localhost:' + CFG.port(8152) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(1200);
  const click = sel => page.evaluate(s => document.querySelector(s).click(), sel);
  const book = id => page.evaluate(i => { const b = window.__app.state.books.find(x => x.id === i); return b && JSON.parse(JSON.stringify(b)); }, id);
  const all = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__app.state.books)));
  const rows = () => page.$$eval('#list .row', e => e.map(r => r.dataset.id));
  const setQ = async v => { await page.evaluate(v => { const q = document.querySelector('#q'); q.value = v; q.dispatchEvent(new Event('input', { bubbles: true })); }, v); await wait(150); };
  const open = async id => { if (!await page.$('.row.open[data-id="' + id + '"]')) await page.evaluate(i => document.querySelector('.row[data-id="' + i + '"] [data-act="toggle"]').click(), id); await wait(250); };
  const toastTxt = () => page.$eval('#toastTxt', e => e.textContent);
  const type = async (id, k, v) => { await page.evaluate((id, k, v) => { const el = document.querySelector('.row[data-id="' + id + '"] [data-k="' + k + '"]'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, id, k, v); await wait(120); };

  // A) la ricerca trova le parole della descrizione
  await setQ('abbazia'); assert.deepStrictEqual(await rows(), ['rosa']); console.log('[A ricerca nella descrizione] ok'); await setQ('');
  // B) «Scarica tutte le descrizioni» non c'è più (16/11/2026: la descrizione arriva solo con la prima ricerca)
  assert(!(await page.$('#btnDescAll')), 'pulsante tolto');
  // C) obiettivo di lettura
  await click('#btnStats'); await wait(200);
  let g = await page.$eval('#statsBody .goal', e => e.textContent); console.log('[C senza obiettivo]', g.slice(0, 80)); assert(g.includes('Finora ne hai letto 1'));
  await page.evaluate(() => { document.querySelector('#goalIn').value = '4'; }); await click('#goalSave'); await wait(150);
  g = await page.$eval('#statsBody .goal', e => e.textContent.replace(/\s+/g, ' ')); console.log('[C obiettivo]', g.slice(0, 140));
  assert(g.includes('1 di 4 libri') && /mancano 3/.test(g)); assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')).goal), 4);
  const ser = await page.$eval('#statsBody', e => e.textContent); assert(ser.includes('Serie e collane') && ser.includes('3 su 7'), 'serie nelle statistiche');
  await page.screenshot({ path: CFG.OUT + '/v56_stats.png' });
  await click('#statsClose');
  // D) serie
  await open('hp1');
  let sb = await page.$eval('.row[data-id="hp1"] .serbox', e => e.textContent.replace(/\s+/g, ' ')); console.log('[D serie]', sb);
  assert(sb.includes('hai 3 volumi (i numeri 1, 2, 4) su 7') && sb.includes('Mancano: 3, 5, 6, 7') && sb.includes('Metti i 4 mancanti nei Desideri'));
  await open('hp3'); await type('hp3', 'se', 'Harry Potter'); await type('hp3', 'sn', '3');
  const h3 = await book('hp3'); assert.strictEqual(h3.sq, '7', 'totale preso dalla serie');
  sb = await page.$eval('.row[data-id="hp3"] .serbox', e => e.textContent.replace(/\s+/g, ' ')); console.log('[D dopo il 3]', sb); assert(sb.includes('hai 4 volumi') && sb.includes('Mancano: 5, 6, 7'));
  await page.evaluate(() => { document.querySelector('.row[data-id="hp3"]').scrollIntoView({ block: 'start' }); window.scrollBy(0, 250); }); await wait(200); await page.screenshot({ path: CFG.OUT + '/v56_serie.png' });
  await click('.row[data-id="hp3"] [data-act="sermiss"]'); await wait(250);
  let ws = (await all()).filter(b => b.w && b.se); console.log('[D desideri]', ws.map(b => b.t).join(' | '));
  assert.deepStrictEqual(ws.map(b => b.sn), ['5', '6', '7']); assert(ws.every(b => b.a === 'J. K. Rowling' && b.sq === '7' && !b.rs));
  sb = await page.$eval('.row[data-id="hp3"] .serbox', e => e.textContent); assert(sb.includes('Nei Desideri: 5, 6, 7') && !sb.includes('mancanti nei Desideri'));
  await click('.row[data-id="hp3"] [data-act="serall"]'); await wait(250);
  assert.deepStrictEqual((await rows()).sort(), ['hp1', 'hp2', 'hp3', 'hp4']); console.log('[D vedi la serie] ok'); await setQ('');
  // E) novità degli autori
  await click('#tabWish'); await wait(200);
  assert(!(await page.$eval('#btnNews', e => e.hidden))); hits = [];
  await click('#btnNews');
  await page.waitForFunction(() => document.querySelectorAll('#newsList li').length > 0, { timeout: 15000 });
  const nl = await page.$$eval('#newsList li', e => e.map(li => li.querySelector('b').textContent)); console.log('[E novità]', nl.join(' | '), '|', hits.length, 'richieste', '|', await page.$eval('#newsMsg', e => e.textContent));
  assert.deepStrictEqual(nl.sort(), ['Lezioni inedite: Scritti ritrovati', 'Un racconto nuovo']); assert.strictEqual(hits.length, 2);
  await page.screenshot({ path: CFG.OUT + '/v56_news.png' });
  await page.evaluate(() => [...document.querySelectorAll('#newsList li')].find(li => li.textContent.includes('Lezioni')).querySelector('[data-act="newswish"]').click()); await wait(200);
  const nw = (await all()).find(b => b.t.startsWith('Lezioni inedite')); assert(nw && nw.w && nw.i === '9788834600016' && nw.e === 'La nave di Teseo');
  await page.evaluate(() => document.querySelector('#newsList [data-act="newshide"]').click()); await wait(150);
  assert.strictEqual(await page.$$eval('#newsList li', e => e.length), 0); console.log('[E]', await page.$eval('#newsMsg', e => e.textContent));
  hits = []; await click('#newsClose'); await click('#btnNews'); await wait(400); assert.strictEqual(hits.length, 0, 'riaperta: niente nuove richieste');
  await click('#newsAgain'); await wait(1200); assert.strictEqual(await page.$$eval('#newsList li', e => e.length), 0, 'nascosti e gia\' aggiunti non tornano'); await click('#newsClose');
  // F) citazioni
  await click('#tabLib'); await wait(200); await open('rosa');
  await page.evaluate(() => document.querySelector('details.quotes[data-id="rosa"] > summary').click()); await wait(150);
  await click('details.quotes[data-id="rosa"] [data-act="quoteadd"]'); await wait(150);
  await page.evaluate(() => { document.querySelector('#quoteText').value = 'Stat rosa pristina nomine,\nnomina nuda tenemus.'; document.querySelector('#quotePage').value = '503'; });
  await click('#quoteSave'); await wait(200);
  let b = await book('rosa'); assert.strictEqual(b.qs.length, 1); assert(b.qs[0].x.includes('nomina nuda') && b.qs[0].pg === '503');
  assert((await page.$eval('details.quotes[data-id="rosa"]', e => e.textContent)).includes('p. 503'));
  await setQ('nomina nuda'); assert.deepStrictEqual(await rows(), ['rosa']); await setQ(''); await open('rosa');
  await page.evaluate(() => { const d = document.querySelector('details.quotes[data-id="rosa"]'); if (!d.open) d.querySelector('summary').click(); }); await wait(100);
  // da foto
  await click('details.quotes[data-id="rosa"] [data-act="quoteadd"]'); await wait(150);
  const inp = await page.$('#fileQuote'); await inp.uploadFile(CFG.OUT + '/pagina.png'); await page.evaluate(() => document.querySelector('#fileQuote').dispatchEvent(new Event('change', { bubbles: true })));
  await page.waitForFunction(() => !document.querySelector('#quotePh').hidden, { timeout: 10000 }); await page.evaluate(() => document.querySelector('#quoteOcr').click());
  await page.waitForFunction(() => document.querySelector('#quoteText').value.length > 20 || /non riuscita|Non sono riuscito/.test(document.querySelector('#quoteMsg').textContent), { timeout: 90000 });
  const ocr = await page.$eval('#quoteText', e => e.value); console.log('[F da foto]', JSON.stringify(ocr), '|', await page.$eval('#quoteMsg', e => e.textContent));
  assert(/bella mattina di fine novembre/.test(ocr) && /nevicato/.test(ocr) && !/\n/.test(ocr));
  await page.screenshot({ path: CFG.OUT + '/v56_quote.png' });
  await click('#quoteSave'); await wait(200); b = await book('rosa'); assert.strictEqual(b.qs.length, 2);
  await page.evaluate(() => { document.querySelector('details.quotes[data-id="rosa"]').scrollIntoView({ block: 'center' }); }); await wait(200); await page.screenshot({ path: CFG.OUT + '/v56_quotes.png' });
  // modifica ed elimina
  await click('details.quotes[data-id="rosa"] [data-act="quoteedit"][data-i="0"]'); await wait(150);
  assert.strictEqual(await page.$eval('#quotePage', e => e.value), '503'); await click('#quoteDel'); await wait(200);
  b = await book('rosa'); assert.strictEqual(b.qs.length, 1); assert(b.qs[0].x.includes('mattina'));
  await page.evaluate(() => document.querySelector('#toast button').click()); await wait(200); b = await book('rosa'); assert.strictEqual(b.qs.length, 2); assert(b.qs[0].pg === '503'); console.log('[F elimina e annulla] ok');
  await wait(600);
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('catalogo-libri-v2'))).books;
  assert(saved.find(x => x.id === 'rosa').qs.length === 2 && saved.find(x => x.id === 'hp3').se === 'Harry Potter');
  // ricarico: tutto torna
  // v64: l'obiettivo resta dopo il riavvio
  const goalBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')).goal); assert.strictEqual(goalBefore, 4);
  await page.reload({ waitUntil: 'load' }); await wait(1200);
  b = await book('rosa'); assert.strictEqual(b.qs.length, 2); assert.strictEqual((await book('hp3')).sn, '3');
  assert.strictEqual(await page.evaluate(() => window.__app.settings.goal), 4, 'obiettivo ricaricato');
  await page.evaluate(() => window.__app.settings.goal = window.__app.settings.goal); await page.evaluate(() => localStorage.getItem('catalogo-libri-set'));
  assert.deepStrictEqual(errors, []);
  console.log('e2e35 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
