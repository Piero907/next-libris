const CFG = require("./_config");
// tastiera: «Fatto» (enterkeyhint="done") nei campi della scheda aperta, Costo compreso; Invio chiude la tastiera
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(8174);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await page.goto('http://localhost:8174/', { waitUntil: 'load' });
  await page.evaluate(() => { const o = Storage.prototype.setItem; localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: [{ id: 'k1', t: 'Libro', a: 'Autore', e: 'Editore', y: '2021', c: 24, ts: 1 }], updated: Date.now() })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'P', selTip: 1, extra: true })); Storage.prototype.setItem = function (k, v) { if (/^catalogo-libri-(v2|set)$/.test(k)) return; return o.call(this, k, v); }; });
  await page.reload({ waitUntil: 'load' }); await wait(800);
  await page.click('#list .row .sum'); await wait(400);
  const f = await page.$$eval('#list .row.open input:not([type=date]), #list .row.open textarea', els => els.map(e => e.dataset.k + ':' + e.getAttribute('enterkeyhint')));
  console.log('[campi]', f.join(' '));
  assert(f.length > 6 && f.every(x => x.endsWith(':done')), 'tutti «Fatto»');
  assert(f.includes('c:done'));
  await page.focus('#c-k1'); await page.keyboard.press('Enter'); await wait(150);
  assert.notStrictEqual(await page.evaluate(() => document.activeElement && document.activeElement.id), 'c-k1', 'Invio chiude la tastiera');
  for (const id of ['#bkFrom', '#quotePage', '#loanWho', '#optName']) assert.strictEqual(await page.$eval(id, e => e.getAttribute('enterkeyhint')), 'done', id);
  assert.deepStrictEqual(errors, []);
  console.log('e2e54 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
