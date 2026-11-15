const CFG = require("./_config");
const puppeteer = require('puppeteer-core'); const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = CFG.APP;
const server = http.createServer((q, s) => { let p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); return s.end(); } const ext = path.extname(p); s.writeHead(200, { 'Content-Type': ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : ext === '.html' ? 'text/html' : ext === '.json' ? 'application/json' : 'application/octet-stream' }); s.end(d); }); }).listen(CFG.port(8149));
const B = o => Object.assign({ id: 'x', t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 1, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: '', rt: 0, rd: '' }, o);
const books = [];
const T = [['Il nome della rosa','Umberto Eco','Studio','Narrativa','ok'],['Lessico famigliare','Natalia Ginzburg','Studio','Narrativa','da'],['La storia','Elsa Morante','Camera','Narrativa','in'],['Se questo è un uomo','Primo Levi','Soggiorno','Memorie','ok'],['Il Gattopardo','Giuseppe Tomasi di Lampedusa','Soggiorno','Narrativa','da'],['Le città invisibili','Italo Calvino','Camera','Narrativa',''],['Storia d\'Italia','Indro Montanelli','Studio','Storia','da'],['Breve storia del tempo','Stephen Hawking','Studio','Scienza','']];
T.forEach((x, k) => books.push(B({ id: 'b' + k, t: x[0], a: x[1], sh: x[2], gen: x[3], rs: x[4], e: 'Einaudi', y: '2010', c: 12 + k, i: '978880600000' + k, ts: 100 - k, p: k === 2 ? 'Marco' : '', pd: k === 2 ? '2026-10-01' : '', xs: k === 7 ? 'v' : '', xd: k === 7 ? '2026-11-01' : '' })));
const assert = require('assert');
for (let k = 0; k < 14; k++) books.push(B({ id: 'x' + k, t: 'Libro di prova ' + k, a: 'Autore ' + k, ts: 50 - k }));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => r.url().startsWith('http://localhost') ? r.continue() : r.abort());
  await page.evaluateOnNewDocument((b) => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), swiped: true, price: false })); sessionStorage.seeded = 1; } }, books);
  await page.goto('http://localhost:' + CFG.port(8149) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const st = () => page.evaluate(() => { const s = document.querySelector('#stick'); return { top: Math.round(s.getBoundingClientRect().top), pos: getComputedStyle(s).position, stuck: s.classList.contains('stuck'), tip: getComputedStyle(document.querySelector('.tip')).display, h: getComputedStyle(document.documentElement).getPropertyValue('--stick-h') }; });
  await wait(400);
  await page.evaluate(() => window.scrollTo(0, 900)); await wait(300);
  let s = await st(); console.log('[1 scorrendo]', s); assert.deepStrictEqual([s.top, s.pos, s.stuck, s.tip], [0, 'sticky', true, 'none']);
  // il tasto Copertine resta raggiungibile
  const hit = await page.evaluate(() => { const r = document.querySelector('#btnView').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && (e.id || e.closest('button').id); });
  assert.strictEqual(hit, 'btnView');
  // un libro sotto la barra: toccandolo si apre e la barra scorre via
  await page.$eval('#list .row[data-id="x6"]', e => e.scrollIntoView({ block: 'center' })); await wait(200);
  await page.click('#list .row[data-id="x6"] .sum'); await wait(300);
  s = await st(); console.log('[2 scheda aperta]', s); assert.strictEqual(s.pos, 'static');
  const top = await page.$eval('#list .row[data-id="x6"]', e => Math.round(e.getBoundingClientRect().top)); console.log('[2 scheda in vista a]', top); assert(top >= 0 && top < 700);
  // chiusa: la barra torna ferma
  await page.click('#list .row[data-id="x6"] .chev-btn'); await wait(300);
  s = await st(); console.log('[3 scheda chiusa]', s); assert.strictEqual(s.pos, 'sticky');
  const rowTop = await page.$eval('#list .row[data-id="x6"]', e => Math.round(e.getBoundingClientRect().top)), barBottom = await page.$eval('#stick', e => Math.round(e.getBoundingClientRect().bottom));
  console.log('[3 riga / barra]', rowTop, barBottom); assert(rowTop >= barBottom - 1, 'la riga chiusa non resta sotto la barra');
  // in cima: niente ombra, suggerimento visibile
  await page.evaluate(() => window.scrollTo(0, 0)); await wait(300);
  s = await st(); assert.strictEqual(s.stuck, false); assert.notStrictEqual(s.tip, 'none');
  console.log('ERRORI:', errors.length ? errors : 'nessuno'); assert(!errors.length);
  console.log('e2e20 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
