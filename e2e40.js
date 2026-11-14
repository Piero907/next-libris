const CFG = require("./_config");
// selezione di più libri: pressione lunga, tocchi, elimina con conferma, modifiche di gruppo, Indietro
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(8157);
const B = (o) => Object.assign({ t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 0, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: 'da', rt: 0, rd: '' }, o);
const books = [
  B({ id: 'm1', t: 'Montalbano A', a: 'Andrea Camilleri', y: '1998', ts: 6 }), B({ id: 'm2', t: 'Montalbano B', a: 'Andrea Camilleri', y: '1994', ts: 5 }), B({ id: 'm3', t: 'Montalbano C', a: 'Andrea Camilleri', y: '1996', ts: 4 }), B({ id: 'm0', t: 'Montalbano vecchio', a: 'Andrea Camilleri', se: 'Commissario Montalbano', sn: '4', ts: 0 }),
  B({ id: 'x1', t: 'Da eliminare uno', a: 'X', ts: 3 }), B({ id: 'x2', t: 'Da eliminare due', a: 'X', ts: 2 }), B({ id: 'k', t: 'Resta qui', a: 'Y', ts: 1, g: ['e'] }),
];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.evaluateOnNewDocument((b) => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ extra: true, lastBackup: Date.now(), price: false, installed: true, instScope: '/', swiped: true, name: 'Piero' })); sessionStorage.seeded = 1; } }, books);
  await page.goto('http://localhost:8157/', { waitUntil: 'load' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(1200);
  const click = sel => page.evaluate(s => document.querySelector(s).click(), sel);
  const all = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__app.state.books)));
  const book = id => page.evaluate(i => JSON.parse(JSON.stringify(window.__app.state.books.find(x => x.id === i) || null)), id);
  const center = async sel => { await page.$eval(sel, e => e.scrollIntoView({ block: 'center', behavior: 'instant' })); await wait(120); return page.$eval(sel, e => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + 24 }; }); };
  const longPress = async sel => { const c = await center(sel); await page.mouse.move(c.x, c.y); await page.mouse.down(); await wait(650); await page.mouse.up(); await wait(150); };
  const tap = async sel => { const c = await center(sel); await page.mouse.click(c.x, c.y); await wait(150); };
  const selN = () => page.$eval('#selN', e => e.querySelector('b').textContent + ' ' + e.querySelector('small').textContent);
  const selected = () => page.$$eval('#list .row.sel', e => e.map(r => r.dataset.id));
  const openIds = () => page.$$eval('#list .row.open', e => e.map(r => r.dataset.id));
  // tocco normale: apre la scheda, non seleziona
  await tap('.row[data-id="m1"] .sum'); assert.deepStrictEqual(await openIds(), ['m1']); assert(await page.$eval('#selBar', e => e.hidden));
  await page.evaluate(() => history.back()); await wait(300);
  // pressione lunga: entra nella selezione, la scheda non si apre
  await longPress('.row[data-id="m1"] .sum');
  assert(!(await page.$eval('#selBar', e => e.hidden))); assert.deepStrictEqual(await selected(), ['m1']); assert.deepStrictEqual(await openIds(), []);
  assert.strictEqual(await page.$eval('.dock', e => getComputedStyle(e).display), 'none');
  await tap('.row[data-id="m2"] .sum'); await tap('.row[data-id="m3"] .sum');
  assert.deepStrictEqual((await selected()).sort(), ['m1', 'm2', 'm3']); assert.strictEqual(await selN(), '3 selezionati'); assert.deepStrictEqual(await openIds(), []);
  await tap('.row[data-id="m2"] .sum'); assert.deepStrictEqual((await selected()).sort(), ['m1', 'm3']); await tap('.row[data-id="m2"] .sum');
  await page.evaluate(() => window.scrollTo(0, 0)); await wait(100); await page.screenshot({ path: CFG.OUT + '/sel_list.png' });
  console.log('[selezione]', await selN());
  // serie numerata nell'ordine dell'elenco
  await click('#selEdit'); await wait(200);
  // numero d'ordine sui libri selezionati: m1, m3, m2 (m2 tolto e rimesso)
  const ords = await page.$$eval('#list .row.sel', e => e.map(r => r.dataset.id + '=' + r.dataset.ord).sort()); console.log('[ordine]', ords.join(' ')); assert.deepStrictEqual(ords, ['m1=1', 'm2=3', 'm3=2']);
  await page.evaluate(() => { const i = document.querySelector('#bkSe'); i.value = 'Commissario Montalbano'; i.dispatchEvent(new Event('input')); const c = document.querySelector('#bkSeNum'); c.checked = true; c.dispatchEvent(new Event('change')); });
  await wait(100);
  const prev = () => page.$$eval('#bkPrev li', e => e.map(li => li.querySelector('b').textContent + ' ' + li.querySelector('span').firstChild.textContent.trim()));
  let pv = await prev(); console.log('[anteprima]', pv.join(' | '));
  assert.strictEqual(await page.$eval('#bkFrom', e => e.value), '5', 'riparte dopo il 4 della serie');
  assert.deepStrictEqual(pv.map(x => x.split(' ').slice(0, 3).join(' ')), ['5 Montalbano A', '6 Montalbano C', '7 Montalbano B']);
  await page.evaluate(() => { const r = document.querySelector('input[name="bkOrd"][value="year"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(80);
  pv = await prev(); assert.deepStrictEqual(pv.map(x => x.split(' ').slice(0, 3).join(' ')), ['5 Montalbano B', '6 Montalbano C', '7 Montalbano A']);
  await page.evaluate(() => { const r = document.querySelector('input[name="bkOrd"][value="sel"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); const f = document.querySelector('#bkFrom'); f.value = '1'; f.dispatchEvent(new Event('input')); }); await wait(80);
  await page.screenshot({ path: CFG.OUT + '/sel_bulk.png' });
  await click('#bulkSheet [data-bk="se"]'); await wait(200);
  let t = await page.$eval('#toastTxt', e => e.textContent); console.log('[serie]', t);
  const mm = (await all()).filter(b => b.se && b.id !== 'm0').map(b => b.id + ':' + b.sn).sort(); assert.deepStrictEqual(mm, ['m1:1', 'm2:3', 'm3:2']);
  // scaffale, lettura, annulla
  await page.evaluate(() => { document.querySelector('#bkSh').value = 'Studio'; }); await click('#bulkSheet [data-bk="sh"]'); await wait(150);
  assert((await all()).filter(b => b.sh === 'Studio').length === 3);
  await click('#bulkSheet [data-bk="rs"][data-v="ok"]'); await wait(150);
  assert((await book('m2')).rs === 'ok' && (await book('m2')).rd); console.log('[lettura]', await page.$eval('#toastTxt', e => e.textContent));
  await page.evaluate(() => document.querySelector('#toastBtn').click()); await wait(150);
  assert.strictEqual((await book('m2')).rs, 'da', 'annulla');
  assert.strictEqual((await book('m2')).sh, 'Studio');
  await click('#bulkClose'); await wait(100);
  // Indietro esce dalla selezione
  await page.evaluate(() => history.back()); await wait(300);
  assert(await page.$eval('#selBar', e => e.hidden)); assert.deepStrictEqual(await selected(), []); assert.notStrictEqual(await page.$eval('.dock', e => getComputedStyle(e).display), 'none');
  // elimina con conferma: Annulla nella conferma non elimina
  await longPress('.row[data-id="x1"] .sum'); await tap('.row[data-id="x2"] .sum');
  await click('#selDel'); await wait(150);
  const cm = await page.$eval('#confirmSheet', e => e.textContent.replace(/\s+/g, ' ')); console.log('[conferma]', cm);
  assert(cm.includes('Eliminare 2 libri?') && cm.includes('«Da eliminare uno»') && cm.includes('Elimina 2 libri'));
  await page.screenshot({ path: CFG.OUT + '/sel_confirm.png' });
  await click('#confirmNo'); await wait(100); assert.strictEqual((await all()).length, 7);
  await click('#selDel'); await wait(100); await click('#confirmOk'); await wait(300);
  assert.strictEqual((await all()).length, 5); assert(await page.$eval('#selBar', e => e.hidden));
  t = await page.$eval('#toastTxt', e => e.textContent); console.log('[eliminati]', t); assert.strictEqual(t, '2 libri eliminati');
  await page.evaluate(() => document.querySelector('#toastBtn').click()); await wait(200); assert.strictEqual((await all()).length, 7, 'annulla elimina');
  // Tutti / Nessuno, verificati, sposta nei Desideri
  await longPress('.row[data-id="k"] .sum'); await click('#selAll'); await wait(100); assert.strictEqual(await selN(), '7 selezionati'); assert.strictEqual(await page.$eval('#selAll', e => e.textContent), 'Nessuno');
  await click('#selAll'); await wait(100); assert.strictEqual(await selN(), '0 selezionati'); assert(await page.$eval('#selEdit', e => e.disabled));
  await tap('.row[data-id="k"] .sum'); await click('#selEdit'); await wait(150); await click('#bulkSheet [data-bk="verify"]'); await wait(150); assert.deepStrictEqual((await book('k')).g, []);
  await click('#bulkSheet [data-bk="move"]'); await wait(300); assert((await book('k')).w); assert(await page.$eval('#selBar', e => e.hidden));
  // vista Copertine: pressione lunga sulla copertina
  await page.evaluate(() => document.querySelector('#btnView').click()); await wait(300);
  await longPress('.cover[data-id="m1"]'); await tap('.cover[data-id="m3"]');
  assert.deepStrictEqual((await page.$$eval('#list .cover.sel', e => e.map(c => c.dataset.id))).sort(), ['m1', 'm3']);
  assert(await page.$eval('#lightbox', e => e.hidden), 'non apre la copertina');
  await page.evaluate(() => window.scrollTo(0, 0)); await wait(100); await page.screenshot({ path: CFG.OUT + '/sel_grid.png' });
  await click('#selExit'); await wait(150); assert(await page.$eval('#selBar', e => e.hidden));
  assert.deepStrictEqual(errors, []);
  console.log('e2e40 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
