const CFG = require("./_config");
// «In lettura» in cima (16/11/2026): in Libreria, senza ricerca ne' filtri, i libri «In lettura» stanno in una sezione in cima,
// sotto «Gli altri libri»; tutte e due si aprono e chiudono toccando il titolo, e l'app se lo ricorda. Vale in Elenco e in Copertine.
// Con un filtro, una ricerca o un ordine diverso da «Più recenti», o nei Desideri, niente sezioni.
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8196));
const books = [{ id: 'a1', t: 'Cent\'anni di solitudine', a: 'Gabriel García Márquez', rs: 'ok', ts: 9 }, { id: 'r1', t: 'Il nome della rosa', a: 'Umberto Eco', pg: '624', rs: 'in', pp: '212', ts: 8 },
  { id: 'a2', t: 'Il barone rampante', a: 'Italo Calvino', rs: 'da', ts: 7 }, { id: 'r2', t: 'Baudolino', a: 'Umberto Eco', rs: 'in', ts: 6 }, { id: 'w1', t: 'Desiderio', a: 'X', w: true, ts: 5 }];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => r.url().startsWith('http://localhost:' + CFG.port(8196)) ? r.continue() : r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await page.evaluateOnNewDocument(bk => { if (!localStorage.getItem('catalogo-libri-set')) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: bk, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ look: 'nuovo', seenV: 999, wn2: 1, swiped: true, name: 'P', selTip: 1, lastBackup: Date.now(), donUntil: Date.now() + 9e9, instSnooze: Date.now() + 9e9, view: 'list' })); localStorage.setItem('catalogo-libri-card', JSON.stringify({ v: 'd' })); } }, books);
  await page.goto('http://localhost:' + CFG.port(8196) + '/?vista=elenco', { waitUntil: 'load' }); await wait(800);
  const st = () => page.evaluate(() => ({ heads: [...document.querySelectorAll('#list .shelf-h')].map(h => h.textContent.trim() + (h.getAttribute('aria-expanded') === 'true' ? '+' : '-')),
    now: [...document.querySelectorAll('#list .shelf-now [data-id]')].filter(e => e.getClientRects().length).map(e => e.dataset.id), all: [...document.querySelectorAll('#list .shelf-all [data-id]')].filter(e => e.getClientRects().length).map(e => e.dataset.id),
    flat: [...document.querySelectorAll('#list [data-id]')].filter(e => e.getClientRects().length).map(e => e.dataset.id) }));
  // 1) elenco: «In lettura» in cima, nell'ordine di sempre; poi gli altri
  let s = await st(); console.log('[1 elenco]', JSON.stringify(s));
  assert.deepStrictEqual(s.heads, ['In lettura2+', 'Gli altri libri2+']); assert.deepStrictEqual(s.now, ['r1', 'r2']); assert.deepStrictEqual(s.all, ['a1', 'a2']);
  await page.screenshot({ path: CFG.OUT + '/in_lettura_elenco.png' });
  // 2) chiudo «Gli altri libri»: resta chiusa anche dopo la riapertura
  await page.click('#list .shelf-h[data-shelf="all"]'); await wait(200);
  s = await st(); assert.deepStrictEqual(s.heads, ['In lettura2+', 'Gli altri libri2-']); assert.deepStrictEqual(s.all, []);
  await page.reload({ waitUntil: 'load' }); await wait(800);
  s = await st(); assert.deepStrictEqual(s.heads, ['In lettura2+', 'Gli altri libri2-'], 'se lo ricorda');
  await page.click('#list .shelf-h[data-shelf="all"]'); await wait(200);
  // 3) copertine: stesse sezioni
  await page.evaluate(() => document.querySelector('#btnView').click()); await wait(300);
  s = await st(); console.log('[3 copertine]', JSON.stringify(s));
  assert.deepStrictEqual(s.now, ['r1', 'r2']); assert.deepStrictEqual(s.all, ['a1', 'a2']);
  assert(await page.evaluate(() => !!document.querySelector('#list .shelf-now .cover[data-id="r1"] .pp-cov')), 'barretta sulla copertina');
  await page.screenshot({ path: CFG.OUT + '/in_lettura_copertine.png' });
  // la copertina si apre ancora (pagina del libro) e si torna alle copertine
  await page.evaluate(() => document.querySelector('#list .shelf-now .cover[data-id="r2"]').click()); await wait(500);
  assert(await page.evaluate(() => !!document.querySelector('#list .row.open[data-id="r2"]')), 'dalla copertina alla pagina del libro');
  await page.evaluate(() => document.querySelector('#btnView').click()); await wait(300);
  // 4) con una ricerca o un filtro: niente sezioni
  await page.evaluate(() => { const i = document.querySelector('#q'); i.value = 'Eco'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(400);
  s = await st(); assert.deepStrictEqual(s.heads, []); assert.deepStrictEqual(s.flat.sort(), ['r1', 'r2']);
  await page.evaluate(() => { const i = document.querySelector('#q'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(400);
  // con un altro ordine (per voto, titolo…) vale l'ordine scelto: niente sezioni
  await page.select('#sort', 'titolo').catch(() => page.evaluate(() => { const x = document.querySelector('#sort'); x.value = x.options[1].value; x.dispatchEvent(new Event('change', { bubbles: true })); })); await wait(300);
  assert.deepStrictEqual((await st()).heads, [], 'ordine scelto: niente sezioni');
  await page.evaluate(() => { const x = document.querySelector('#sort'); x.value = 'recent'; x.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(300);
  // 5) chiudo «In lettura»: i suoi libri spariscono, gli altri restano
  await page.click('#list .shelf-h[data-shelf="now"]'); await wait(200);
  s = await st(); assert.deepStrictEqual(s.heads, ['In lettura2-', 'Gli altri libri2+']); assert.deepStrictEqual(s.now, []); assert.deepStrictEqual(s.all.length, 2);
  await page.click('#list .shelf-h[data-shelf="now"]'); await wait(200);
  // 6) nei Desideri niente sezioni; senza libri «In lettura» nemmeno
  await page.evaluate(() => window.__app.setTab('wish')); await wait(300);
  assert.deepStrictEqual((await st()).heads, []);
  await page.evaluate(() => window.__app.setTab('lib')); await wait(300);
  await page.evaluate(() => { window.__app.state.books.forEach(b => { if (b.rs === 'in') b.rs = 'da'; }); window.__app.refresh ? window.__app.refresh() : null; }); await wait(300);
  await page.evaluate(() => window.__app.setTab('lib')); await wait(300);
  assert.deepStrictEqual((await st()).heads, [], 'nessuno in lettura: elenco normale');
  assert.deepStrictEqual(errors, []);
  console.log('e2e76 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
