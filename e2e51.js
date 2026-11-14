const CFG = require("./_config");
// novità delle versioni dentro l'app (registro impaginato), versione attuale in evidenza, senza rete dalla copia
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };
let down = false;
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; if (down) { res.writeHead(503); return res.end(); } const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res); }).listen(8170);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.evaluateOnNewDocument(() => { localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), installed: true, instScope: '/', swiped: true, name: 'Piero', selTip: 1 })); });
  await page.goto('http://localhost:8170/?vista=elenco', { waitUntil: 'load' });
  await page.waitForFunction(() => navigator.serviceWorker.controller, { timeout: 20000 }).catch(async () => { await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller, { timeout: 20000 }); });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(1500);
  const click = sel => page.evaluate(s => document.querySelector(s).click(), sel);
  await page.evaluate(() => window.__app.openOptions('app')); await wait(400);
  assert.strictEqual(await page.$eval('#verLog', e => e.tagName), 'BUTTON', 'non e\' piu\' un link esterno');
  await click('#verLog');
  await page.waitForFunction(() => document.querySelectorAll('#logBody .log-v').length > 10, { timeout: 8000 });
  const info = await page.evaluate(() => ({ n: document.querySelectorAll('#logBody .log-v').length, first: document.querySelector('#logBody .log-v h3').textContent, cur: document.querySelector('#logBody .log-v.cur h3') && document.querySelector('#logBody .log-v.cur h3').textContent, items: document.querySelectorAll('#logBody li').length, raw: /##|\*\*/.test(document.querySelector('#logBody').textContent), links: [...document.querySelectorAll('#logBody a')].map(a => a.href).slice(0, 2) }));
  console.log('[registro]', JSON.stringify(info));
  const vn = (await page.$eval('#verNum', e => e.textContent)).replace(/\D/g, '');
  assert(info.n > 40 && info.cur && info.cur.startsWith('Versione ' + vn) && !info.raw && info.items > 60, 'registro impaginato ' + vn);
  await page.screenshot({ path: CFG.OUT + '/log.png' });
  // il registro sta sopra le Opzioni (non dietro)
  const top = await page.evaluate(() => { const r = document.querySelector('#logSheet .sheet-in').getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + 30); return !!el.closest('#logSheet'); });
  assert(top, 'registro in primo piano');
  // Indietro chiude il registro e lascia aperte le Opzioni; un altro Indietro chiude le Opzioni
  await page.evaluate(() => history.back()); await wait(400);
  let st = await page.evaluate(() => ({ log: document.querySelector('#logSheet').hidden, opt: document.querySelector('#optSheet').hidden }));
  console.log('[indietro 1]', JSON.stringify(st)); assert(st.log && !st.opt);
  await page.evaluate(() => history.back()); await wait(400);
  st = await page.evaluate(() => ({ log: document.querySelector('#logSheet').hidden, opt: document.querySelector('#optSheet').hidden }));
  console.log('[indietro 2]', JSON.stringify(st)); assert(st.log && st.opt);
  // la X chiude solo il registro
  await page.evaluate(() => window.__app.openOptions('app')); await wait(300);
  await click('#verLog'); await page.waitForFunction(() => document.querySelectorAll('#logBody .log-v').length > 10);
  await click('#logClose'); await wait(400);
  st = await page.evaluate(() => ({ log: document.querySelector('#logSheet').hidden, opt: document.querySelector('#optSheet').hidden }));
  console.log('[chiudi]', JSON.stringify(st)); assert(st.log && !st.opt);
  // senza rete: dalla copia salvata
  down = true;
  await click('#verLog');
  await page.waitForFunction(() => document.querySelectorAll('#logBody .log-v').length > 10 || /Non riesco/.test(document.querySelector('#logBody').textContent), { timeout: 8000 });
  const off = await page.$$eval('#logBody .log-v', e => e.length); console.log('[senza rete]', off, 'versioni'); assert(off > 40);
  assert.deepStrictEqual(errors, []);
  console.log('e2e51 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
