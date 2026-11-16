const CFG = require("./_config");
// Segnalibro (16/11/2026): nella pagina del libro «In lettura» si scrive la pagina a cui si e' arrivati («Sono a pagina [212] di 624 · 34%»)
// con la barra; nell'elenco «In lettura · 34%» con una linea sottile, sulle copertine una barretta. Solo cifre; si salva (con la data) e resta.
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8195));
const books = [{ id: 'r1', t: 'Il nome della rosa', a: 'Umberto Eco', e: 'Bompiani', y: '2012', pg: '624', rs: 'in', pp: '212', ts: 9 },
  { id: 'r2', t: 'Baudolino', a: 'Umberto Eco', rs: 'in', ts: 8 }, { id: 'r3', t: 'Le città invisibili', a: 'Italo Calvino', pg: '170', rs: 'ok', pp: '170', ts: 7 }];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => r.url().startsWith('http://localhost:' + CFG.port(8195)) ? r.continue() : r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await page.evaluateOnNewDocument(bk => { if (!localStorage.getItem('catalogo-libri-set')) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: bk, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ look: 'nuovo', seenV: 999, wn2: 1, swiped: true, name: 'P', selTip: 1, lastBackup: Date.now(), donUntil: Date.now() + 9e9, instSnooze: Date.now() + 9e9, view: 'list' })); localStorage.setItem('catalogo-libri-card', JSON.stringify({ v: 'd' })); } }, books);
  await page.goto('http://localhost:' + CFG.port(8195) + '/?vista=elenco', { waitUntil: 'load' }); await wait(800);
  const tag = id => page.evaluate(id => { const t = document.querySelector('#list .row[data-id="' + id + '"] .tag.read'); return t ? { t: t.textContent, pp: t.classList.contains('has-pp'), v: t.style.getPropertyValue('--pp') } : null; }, id);
  // 1) elenco
  let t1 = await tag('r1'), t2 = await tag('r2'), t3 = await tag('r3'); console.log('[1 elenco]', JSON.stringify([t1, t2, t3]));
  assert.deepStrictEqual(t1, { t: 'In lettura · 34%', pp: true, v: '34%' }); assert.deepStrictEqual(t2, { t: 'In lettura', pp: false, v: '' }); assert(/^Letto/.test(t3.t) && !t3.pp, 'letto: niente avanzamento');
  // 2) pagina del libro
  await page.evaluate(() => document.querySelector('#list .row[data-id="r1"] .sum').click()); await wait(400);
  const box = () => page.evaluate(() => { const b = document.querySelector('#list .row[data-id="r1"] .pp'); return b ? { v: b.querySelector('input[data-k="pp"]').value, of: (b.querySelector('.pp-of') || {}).textContent, pct: (b.querySelector('.pp-pct') || {}).textContent, bar: b.querySelector('.pp-bar i') && b.querySelector('.pp-bar i').style.width, txt: b.innerText.replace(/\s+/g, ' ').trim() } : null; });
  let bx = await box(); console.log('[2 segnalibro]', JSON.stringify(bx));
  assert.deepStrictEqual([bx.v, bx.of, bx.pct, bx.bar], ['212', 'di 624', '34%', '34%']); assert(/^Sono a pagina/.test(bx.txt));
  assert(await page.evaluate(() => !document.querySelector('#list .row[data-id="r1"] .pp [data-act="ppadd"], #list .row[data-id="r1"] .pp button')), 'niente +10/+25: solo la pagina');
  // 3) scrivo la pagina: solo cifre, barra e percentuale subito, la scheda non si ridisegna (la tastiera resta)
  await page.evaluate(() => { const i = document.querySelector('#list .row[data-id="r1"] input[data-k="pp"]'); i.focus(); i.value = '5a00'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(200);
  bx = await box(); console.log('[3 scritto]', JSON.stringify(bx));
  assert.deepStrictEqual([bx.v, bx.pct, bx.bar], ['500', '80%', '80%']);
  assert(await page.evaluate(() => document.activeElement && document.activeElement.dataset.k === 'pp'), 'il campo resta attivo');
  const st = await page.evaluate(() => { const b = window.__app.state.books.find(x => x.id === 'r1'); return { pp: b.pp, ppd: b.ppd }; });
  assert.strictEqual(st.pp, '500'); assert(/^\d{4}-\d\d-\d\d$/.test(st.ppd), 'con la data');
  // oltre l'ultima pagina: 100%
  await page.evaluate(() => { const i = document.querySelector('#list .row[data-id="r1"] input[data-k="pp"]'); i.value = '700'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(150);
  assert.strictEqual((await box()).pct, '100%');
  await page.evaluate(() => { const i = document.querySelector('#list .row[data-id="r1"] input[data-k="pp"]'); i.value = '500'; i.dispatchEvent(new Event('input', { bubbles: true })); i.blur(); }); await wait(300);
  await page.screenshot({ path: CFG.OUT + '/segnalibro_scheda.png' });
  // 4) libro senza pagine: il campo c'e', niente barra; nell'elenco «pagina N»
  await page.evaluate(() => document.querySelector('#list .row[data-id="r2"] .sum').click()); await wait(400);
  const b2 = await page.evaluate(() => { const b = document.querySelector('#list .row[data-id="r2"] .pp'); return { inp: !!b.querySelector('input[data-k="pp"]'), bar: !!b.querySelector('.pp-bar'), pct: !!b.querySelector('.pp-pct') }; });
  assert.deepStrictEqual(b2, { inp: true, bar: false, pct: false });
  await page.evaluate(() => { const i = document.querySelector('#list .row[data-id="r2"] input[data-k="pp"]'); i.value = '50'; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(200);
  // 5) dopo la riapertura dell'app resta tutto; elenco e copertine mostrano l'avanzamento
  await page.reload({ waitUntil: 'load' }); await wait(800);
  t1 = await tag('r1'); t2 = await tag('r2'); console.log('[5 riaperta]', JSON.stringify([t1, t2]));
  assert.deepStrictEqual(t1, { t: 'In lettura · 80%', pp: true, v: '80%' }); assert.strictEqual(t2.t, 'In lettura · pagina 50');
  await page.evaluate(() => document.querySelector('#btnView').click()); await wait(300);
  const cv = await page.evaluate(() => [...document.querySelectorAll('#list .cover')].map(c => { const p = c.querySelector('.pp-cov i'); return c.dataset.id + ':' + (p ? p.style.width : '-'); }));
  console.log('[5 copertine]', cv.join(' ')); assert.deepStrictEqual(cv.sort(), ['r1:80%', 'r2:-', 'r3:-']);
  await page.screenshot({ path: CFG.OUT + '/segnalibro_copertine.png' });
  // 6) «Letto»: il segnalibro sparisce dalla pagina del libro
  await page.evaluate(() => document.querySelector('#btnView').click()); await wait(300);
  await page.evaluate(() => document.querySelector('#list .row[data-id="r1"] .sum').click()); await wait(400);
  await page.evaluate(() => document.querySelector('#list .row[data-id="r1"] [data-act="rs"][data-v="ok"]').click()); await wait(400);
  assert(await page.evaluate(() => !document.querySelector('#list .row[data-id="r1"] .pp')), 'letto: niente segnalibro');
  assert.deepStrictEqual(errors, []);
  console.log('e2e75 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
