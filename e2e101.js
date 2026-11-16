const CFG = require("./_config");
// copia social: timbro della pubblicazione (pubblica_social.py) → in fondo al Menu «social 97.5 del …», «Ultime novità della copia social»,
// e con una pubblicazione più nuova (version.json: build e copia) l'avviso «C'è un aggiornamento della copia social (97.6 …)» con «Aggiorna adesso»
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.gz': 'application/gzip', '.wasm': 'application/wasm' };
let siteBuild = '2026-11-16 12:00', siteNum = '97.5';
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]), m = p.match(/^\/next-libris-social(\/.*)?$/);
  if (!m) { res.writeHead(404); return res.end(); }
  if (!m[1]) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
  const rel = m[1] === '/' ? '/index.html' : m[1], f = path.join(ROOT, rel);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  if (rel === '/app.js') { res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-cache' }); return res.end(fs.readFileSync(f, 'utf8').replace("var BUILD = { t: '', n: '', note: '' };", 'var BUILD = ' + JSON.stringify({ t: '2026-11-16 12:00', n: '97.5', note: 'Accedi con Google' }) + ';')); }
  if (rel === '/version.json') { const j = JSON.parse(fs.readFileSync(f, 'utf8')); j.build = siteBuild; j.copia = siteNum; res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify(j)); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
}).listen(CFG.port(8301));
const url = 'http://localhost:' + CFG.port(8301) + '/next-libris-social/?vista=elenco';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await page.setRequestInterception(true);
  page.on('request', r => r.url().startsWith('http://localhost:' + CFG.port(8301)) ? r.continue() : r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"totalItems":0}' }));
  await page.goto(url, { waitUntil: 'load' }); await wait(3200);
  let nt = await page.evaluate(() => { const n = document.querySelector('#notice'); return n.hidden ? '' : n.innerText; });
  assert(!/aggiornamento della copia/.test(nt), 'stesso timbro: niente avviso');
  await page.evaluate(() => window.__app.openDrawer('opt')); await wait(500);
  const vd = await page.$eval('#verDate', e => e.textContent), vn = await page.$eval('#verNote', e => e.textContent); console.log('[menu]', vd, '|', vn);
  assert(/social 97\.5 del 16\/11 alle 12:00/.test(vd) && /Ultime novità della copia social: Accedi con Google/.test(vn));
  await page.evaluate(() => window.__app.closeDrawer()); await wait(200);
  siteBuild = '2026-11-16 12:40'; siteNum = '97.6';
  await page.goto(url, { waitUntil: 'load' }); await wait(3200);
  nt = await page.evaluate(() => { const n = document.querySelector('#notice'); return n.hidden ? '' : n.innerText; }); console.log('[timbro nuovo]', nt.replace(/\s+/g, ' '));
  assert(/aggiornamento della copia social \(97\.6, del 16\/11 alle 12:40\)/.test(nt) && /Aggiorna adesso/.test(nt));
  await page.evaluate(() => window.__app.openDrawer('opt')); await wait(500);
  const vs = await page.$eval('#verState', e => e.textContent); console.log('[stato]', vs);
  assert(/aggiornamento della copia social \(97\.6/.test(vs) && await page.$eval('#verUpdate', e => !e.hidden));
  assert.deepStrictEqual(errors, []);
  console.log('e2e101 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
