const CFG = require("./_config");
const puppeteer = require('puppeteer-core'); const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = CFG.APP;
const server = http.createServer((q, s) => { let p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); return s.end(); } const ext = path.extname(p); s.writeHead(200, { 'Content-Type': ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : ext === '.html' ? 'text/html' : ext === '.json' ? 'application/json' : 'application/octet-stream' }); s.end(d); }); }).listen(8144);
const B = o => Object.assign({ id: 'x', t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 1, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: '', rt: 0, rd: '' }, o);
const books = [];
const T = [['Il nome della rosa','Umberto Eco','Studio','Narrativa','ok'],['Lessico famigliare','Natalia Ginzburg','Studio','Narrativa','da'],['La storia','Elsa Morante','Camera','Narrativa','in'],['Se questo è un uomo','Primo Levi','Soggiorno','Memorie','ok'],['Il Gattopardo','Giuseppe Tomasi di Lampedusa','Soggiorno','Narrativa','da'],['Le città invisibili','Italo Calvino','Camera','Narrativa',''],['Storia d\'Italia','Indro Montanelli','Studio','Storia','da'],['Breve storia del tempo','Stephen Hawking','Studio','Scienza','']];
T.forEach((x, k) => books.push(B({ id: 'b' + k, t: x[0], a: x[1], sh: x[2], gen: x[3], rs: x[4], e: 'Einaudi', y: '2010', c: 12 + k, i: '978880600000' + k, ts: 100 - k, p: k === 2 ? 'Marco' : '', pd: k === 2 ? '2026-10-01' : '', xs: k === 7 ? 'v' : '', xd: k === 7 ? '2026-11-01' : '' })));
const assert = require('assert');
books.push(B({ id: 'z1', t: 'Il pendolo di Foucault', a: 'Umberto Eco', e: 'Bompiani', i: '9788845292610', ts: 50, gen: 'Narrativa', g: ['e'] }));
books.push(B({ id: 'z2', t: 'Baudolino', a: 'Umberto Eco, Altro Autore', e: 'Bompiani', i: '9788845292611', ts: 49, sh: 'studio ' }));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => r.url().startsWith('http://localhost') ? r.continue() : r.abort());
  await page.evaluateOnNewDocument((b) => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), price: false, swiped: true })); sessionStorage.seeded = 1; } }, books);
  await page.goto('http://localhost:8144/', { waitUntil: 'load' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const click = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error('manca ' + s); e.click(); }, sel);
  const rows = () => page.$$eval('#list .row', e => e.map(r => r.dataset.id));
  const chips = id => page.$$eval('#list .row[data-id="' + id + '"] .fchip', e => e.map(x => x.dataset.f + ':' + x.innerText.replace(/\s+/g, ' ').trim()));
  await wait(400);
  const all = (await rows()).length;
  // 1) scheda aperta: «Vedi tutti i libri di»
  await page.evaluate(() => { window.__app.openState()['b0'] = true; window.__app.openState()['z1'] = true; window.__app.setTab('lib'); }); await wait(150);
  console.log('[1 b0]', await chips('b0'));
  console.log('[1 z1 (casa editrice da verificare)]', await chips('z1'));
  assert.deepStrictEqual(await chips('b0'), ['a:Umberto Eco 3', 'e:Einaudi 8', 'gen:Narrativa 6', 'sh:Studio 5']);
  assert(!(await chips('z1')).some(c => c.startsWith('e:')), 'niente casa editrice da verificare');
  // 2) tocco sull'autore: filtro, anche con piu' autori
  await click('#list .row[data-id="b0"] .fchip[data-f="a"]'); await wait(200);
  let r = await rows(); console.log('[2 autore]', r, '|', await page.$eval('#activeFlt', e => e.innerText.replace(/\s+/g, ' ')), '|', await page.$eval('#toastTxt', e => e.textContent));
  assert.deepStrictEqual(r.sort(), ['b0', 'z1', 'z2']); assert.strictEqual(await page.$eval('#fltBadge', e => e.textContent), '1');
  // nel pannello si vede e si toglie
  await page.click('#btnFilters'); await wait(300);
  assert((await page.$eval('#drawerFlt', e => e.innerText)).includes('Autore: Umberto Eco'));
  await click('#drawerFlt [data-g="aut"]'); await wait(150);
  assert.strictEqual((await rows()).length, all); await page.keyboard.press('Escape'); await wait(300);
  // 3) casa editrice e scaffale (maiuscole/spazi diversi = stesso scaffale)
  await page.evaluate(() => { window.__app.openState()['b0'] = true; window.__app.setTab('lib'); }); await wait(100);
  await click('#list .row[data-id="b0"] .fchip[data-f="sh"]'); await wait(150);
  r = await rows(); console.log('[3 scaffale]', r); assert(r.includes('z2') && r.length === 5);
  await click('#activeFlt [data-clear="sh"]'); await wait(100);
  await page.evaluate(() => { window.__app.openState()['b0'] = true; window.__app.setTab('lib'); }); await wait(100);
  await click('#list .row[data-id="b0"] .fchip[data-f="e"]'); await wait(150);
  r = await rows(); console.log('[3 casa editrice]', r.length); assert.strictEqual(r.length, 8);
  await click('#activeFlt [data-clear="ed"]'); await wait(100);
  // 4) genere: niente freccia del browser; i suggerimenti compaiono e si scelgono
  await page.evaluate(() => { window.__app.openState()['z2'] = true; window.__app.setTab('lib'); }); await wait(150);
  assert.strictEqual(await page.$eval('#gen-z2', e => e.getAttribute('list')), null);
  await page.focus('#gen-z2'); await wait(100);
  const opts = await page.$$eval('#list .row[data-id="z2"] .sugg [data-v]', e => e.map(x => x.dataset.v));
  console.log('[4 suggerimenti]', opts); assert.strictEqual(opts[0], 'Narrativa');
  await page.type('#gen-z2', 'sto'); await wait(100);
  const opts2 = await page.$$eval('#list .row[data-id="z2"] .sugg [data-v]', e => e.map(x => x.dataset.v));
  console.log('[4 dopo «sto»]', opts2); assert.deepStrictEqual(opts2, ['Storia']);
  await page.click('#list .row[data-id="z2"] .sugg [data-v="Storia"]'); await wait(150);
  const z2 = await page.evaluate(() => window.__app.state.books.find(b => b.id === 'z2').gen);
  console.log('[4 scelto]', z2); assert.strictEqual(z2, 'Storia');
  assert.strictEqual(await page.$('#list .sugg'), null);
  // con la tastiera
  await page.focus('#sh-z2'); await page.$eval('#sh-z2', e => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(100);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await wait(150);
  console.log('[4 scaffale da tastiera]', await page.evaluate(() => window.__app.state.books.find(b => b.id === 'z2').sh));
  // 5) prestito: «a chi» suggerisce i nomi gia' usati
  await page.evaluate(() => { window.__app.openState()['b1'] = true; window.__app.setTab('lib'); }); await wait(100);
  await click('#list .row[data-id="b1"] .top-acts [data-act="loan"]'); await wait(200);
  assert.strictEqual(await page.$eval('#loanWho', e => e.getAttribute('list')), null);
  await page.focus('#loanWho'); await wait(100);
  const names = await page.$$eval('#loanWhoF .sugg [data-v]', e => e.map(x => x.dataset.v)); console.log('[5 nomi]', names);
  assert.deepStrictEqual(names, ['Marco']);
  await page.click('#loanWhoF .sugg [data-v="Marco"]'); await wait(100);
  assert.strictEqual(await page.$eval('#loanWho', e => e.value), 'Marco');
  await page.click('#loanCancel'); await wait(150);
  await page.screenshot({ path: CFG.OUT + '/s_facets.png' });
  console.log('ERRORI:', errors.length ? errors : 'nessuno'); assert(!errors.length);
  console.log('e2e16 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
