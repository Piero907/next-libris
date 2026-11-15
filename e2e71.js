const CFG = require("./_config");
// modulo «Scheda aperta del libro» (schede.js/.css): Attuale, A (ordinata), B (sezioni), C (linguette), D (pagina del libro);
// scelta in Opzioni › Aspetto, salvata; i campi spostati si modificano e si salvano come prima
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8191));
const books = [
  { id: 'r1', t: 'Il nome della rosa', a: 'Umberto Eco', e: 'Bompiani', y: '2012', c: 13, i: '9788845292613', gen: 'Narrativa', pg: '624', sh: 'Studio', rs: 'ok', rt: 5, rd: '2026-10-02', se: 'I grandi romanzi', sn: '3', n: 'Regalo di Anna', qs: [{ x: 'Stat rosa', pg: '', d: 1, phs: [] }], ts: 10 },
  { id: 'r2', t: 'Baudolino', a: 'Umberto Eco', e: 'Bompiani', y: '2000', ts: 9, rs: 'da' }];
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
  const pick = async v => { await page.evaluate(() => window.__app.openOptions('look')); await wait(250); await page.click('#optCard input[value="' + v + '"]'); await wait(300); await page.evaluate(() => window.__app.closeOptions()); await wait(350); };
  const book = () => page.evaluate(() => window.__app.state.books.find(b => b.id === 'r1'));
  // scelta nelle Opzioni: Attuale di predefinito
  await page.evaluate(() => window.__app.openOptions('look')); await wait(250);
  const opts = await page.$$eval('#optCard input', e => e.map(x => x.value + (x.checked ? '*' : ''))); console.log('[opzioni]', opts.join(' '));
  assert.deepStrictEqual(opts, ['attuale*', 'a', 'b', 'c', 'd']);
  await page.evaluate(() => window.__app.closeOptions()); await wait(300);
  await open();
  const h0 = await page.$eval(card(), e => Math.round(e.getBoundingClientRect().height));
  assert(await page.$eval(card(), e => !e.querySelector('.cv-secs, .cv-tabs, .cv-page')));
  // A: azioni solo icona, scheda piu' corta
  await pick('a'); await open();
  const a = await page.evaluate(s => { const e = document.querySelector(s); const lab = e.querySelector('.acts-main .ico.act .al'); return { h: Math.round(e.getBoundingClientRect().height), lab: lab ? getComputedStyle(lab).display : '' }; }, card());
  console.log('[A]', JSON.stringify(a), 'attuale:', h0); assert(a.lab === 'none' && a.h < h0);
  // B: sezioni; «Dati» aperta, le altre chiuse col riassunto; si modifica la casa editrice
  await pick('b'); await open();
  const b = await page.evaluate(s => [...document.querySelectorAll(s + ' .cv-sec')].map(d => d.dataset.k + (d.open ? '*' : '') + ':' + d.querySelector('.cv-sum').textContent), card());
  console.log('[B]', b.join(' | ')); assert.deepStrictEqual(b.map(x => x.split(':')[0]), ['dati*', 'lettura', 'libreria', 'altro']);
  assert(/Letto ★★★★★/.test(b[1]) && /Studio · I grandi romanzi, 3/.test(b[2]));
  await page.evaluate(s => { const i = document.querySelector(s + ' .cv-sec[data-k="dati"] [data-k="e"]'); i.focus(); i.value = 'Bompiani Editore'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); i.blur(); }, card()); await wait(400);
  assert.strictEqual((await book()).e, 'Bompiani Editore', 'campo spostato: si salva');
  await page.evaluate(s => { const d = document.querySelector(s + ' .cv-sec[data-k="lettura"]'); d.open = true; }, card()); await wait(200);
  await page.evaluate(s => document.querySelector(s + ' .cv-sec[data-k="lettura"] [data-act="rs"][data-v="in"]').click(), card()); await wait(400);
  assert.strictEqual((await book()).rs, 'in', 'lettura cambiata');
  assert(await page.evaluate(s => document.querySelector(s + ' .cv-sec[data-k="lettura"]').open, card()), 'la sezione resta aperta dopo il ridisegno');
  // C: linguette
  await pick('c'); await open();
  const tabs = await page.$$eval(card() + ' .cv-tab', e => e.map(x => x.textContent + (x.getAttribute('aria-selected') === 'true' ? '*' : ''))); console.log('[C]', tabs.join(' '));
  assert.deepStrictEqual(tabs, ['Dati*', 'Lettura', 'In libreria', 'Altro']);
  await page.evaluate(s => document.querySelector(s + ' .cv-tab[data-k="libreria"]').click(), card()); await wait(200);
  const vis = await page.evaluate(s => [...document.querySelectorAll(s + ' .cv-pane')].filter(p => !p.hidden).map(p => p.dataset.k), card());
  assert.deepStrictEqual(vis, ['libreria']); assert(await page.evaluate(s => !!document.querySelector(s + ' .cv-pane[data-k="libreria"] [data-k="sh"]'), card()));
  // D: pagina del libro; Modifica mostra i campi, Fatto torna alla pagina
  await pick('d'); await open();
  const d = await page.evaluate(s => { const e = document.querySelector(s); const p = e.querySelector('.cv-page'); return { page: p ? p.innerText.replace(/\s+/g, ' ') : '', headHidden: getComputedStyle(e.querySelector('.head')).display === 'none' }; }, card());
  console.log('[D]', JSON.stringify(d)); assert(/Il nome della rosa/.test(d.page) && /Bompiani Editore · 2012 · 624 pagine/.test(d.page) && /In lettura/.test(d.page) && d.headHidden);
  await page.screenshot({ path: CFG.OUT + '/scheda_d_prova.png' });
  await page.evaluate(s => document.querySelector(s + ' .cv-editb').click(), card()); await wait(300);
  assert(await page.evaluate(s => { const e = document.querySelector(s); return !e.querySelector('.cv-page') && getComputedStyle(e.querySelector('.head')).display !== 'none' && !!e.querySelector('.cv-done'); }, card()));
  await page.evaluate(s => document.querySelector(s + ' .cv-done').click(), card()); await wait(300);
  assert(await page.evaluate(s => !!document.querySelector(s + ' .cv-page'), card()));
  // la scelta resta dopo la riapertura
  await page.reload({ waitUntil: 'load' }); await wait(700);
  assert.strictEqual(await page.evaluate(() => document.documentElement.dataset.card), 'd');
  assert.deepStrictEqual(errors, []);
  console.log('e2e71 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
