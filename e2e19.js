const CFG = require("./_config");
const puppeteer = require('puppeteer-core'); const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
let fakeVer = null;
const server = http.createServer((q, s) => { let p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html';
  if (fakeVer && q.url.startsWith('/version.json')) { s.writeHead(200, { 'Content-Type': 'application/json' }); return s.end(JSON.stringify(fakeVer)); }
  fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); return s.end(); } const ext = path.extname(p); s.writeHead(200, { 'Content-Type': ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : ext === '.html' ? 'text/html' : ext === '.json' ? 'application/json' : 'application/octet-stream' }); s.end(d); }); }).listen(8148);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.evaluateOnNewDocument(() => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!localStorage.getItem('catalogo-libri-set')) localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), swiped: true })); });
  await page.goto('http://localhost:8148/', { waitUntil: 'load' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const txt = sel => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
  await wait(3200);
  assert(await page.$eval('#notice', e => e.hidden || !e.textContent.includes('versione')), 'nessun avviso: e\' gia\' l\'ultima');
  await page.click('#btnOpts'); await wait(800);
  const v = await txt('#verBox'); console.log('[1 menu]', v);
  const local = JSON.parse(fs.readFileSync(ROOT + '/version.json', 'utf8'));
  assert(v.includes('Versione ' + local.v) && v.includes("È l'ultima versione")); assert(await page.$eval('#verUpdate', e => e.hidden));
  await page.screenshot({ path: CFG.OUT + '/s_version.png' });
  // sul sito c'e' una versione piu' nuova
  fakeVer = { v: local.v + 1, date: '2026-11-20', note: 'prova' };
  await page.click('#drawerX'); await wait(300); await page.click('#btnOpts'); await wait(800);
  const v2 = await txt('#verBox'); console.log('[2 piu nuova]', v2);
  assert(v2.includes('È disponibile la versione ' + (local.v + 1))); assert(!(await page.$eval('#verUpdate', e => e.hidden)));
  await page.click('#drawerX'); await wait(300);
  await page.reload({ waitUntil: 'load' }); await wait(3200);
  const nt = await txt('#noticeTxt'); console.log('[3 avviso]', nt, '|', await txt('#noticeBtn'));
  assert(nt.includes('versione ' + (local.v + 1)));
  // «Aggiorna adesso» ricarica la pagina
  fakeVer = null;
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click('#noticeBtn')]);
  await wait(3200);
  assert(await page.$eval('#notice', e => e.hidden || !e.textContent.includes('versione')));
  // Opzioni › App
  await page.evaluate(() => window.__app.openOptions('app')); await wait(600);
  console.log('[4 app]', await txt('#verApp'));
  console.log('ERRORI:', errors.length ? errors : 'nessuno'); assert(!errors.length);
  console.log('e2e19 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
