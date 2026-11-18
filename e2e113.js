const CFG = require("./_config");
// 18/11/2026: il trasloco dei dati e' finito (tutti sul nuovo indirizzo, Piero). trasloco.html e' solo «Ci siamo spostati»:
// 1) dal vecchio indirizzo porta al nuovo con ?amico= e #k= (senza i parametri delle prove);
// 2) non legge ne' manda dati: niente postMessage, niente database creati al vecchio indirizzo;
// 3) aperta al nuovo indirizzo apre l'app (./).
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
function serve(p) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const q = decodeURIComponent(url.pathname), m = q.match(/^\/next-libris-prova(\/.*)?$/);
    if (!m) { res.writeHead(404); return res.end(); }
    const f = path.join(ROOT, !m[1] || m[1] === '/' ? '/index.html' : m[1]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
  }).listen(p);
}
const PV = CFG.port(8313), PN = CFG.port(8314);
const servers = [serve(PV), serve(PN)];
const V = 'http://127.0.0.1:' + PV, N = 'http://127.0.0.1:' + PN;

(async () => {
  const src = fs.readFileSync(path.join(ROOT, 'trasloco.js'), 'utf8');
  assert.ok(!/postMessage|indexedDB|localStorage/.test(src), 'trasloco.js non tocca piu\' i dati');
  const html = fs.readFileSync(path.join(ROOT, 'trasloco.html'), 'utf8');
  assert.ok(/Ci siamo spostati/.test(html) && /nextlibris\.github\.io/.test(html), 'testo della pagina');
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  // 1) vecchio → nuovo, con invito e chiave
  const arrivo = new Promise(r => page.on('request', q => { if (q.url().startsWith(N) && q.isNavigationRequest()) r(q.url()); }));
  await page.setRequestInterception(true);
  page.on('request', q => q.url().startsWith(N) ? q.respond({ status: 200, contentType: 'text/html', body: 'ok' }) : q.continue());
  await page.goto(V + '/next-libris-prova/trasloco.html?nuovo=' + encodeURIComponent(N) + '&amico=anna#k=abc', { waitUntil: 'load' });
  assert.strictEqual(await arrivo, N + '/next-libris-prova/?amico=anna#k=abc', 'invito e chiave arrivano al nuovo indirizzo');
  // 2) nessun database creato al vecchio indirizzo
  await page.goto(V + '/next-libris-prova/manifest.json');
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map(x => x.name));
  assert.deepStrictEqual(dbs, [], 'nessun database: ' + dbs);
  // 3) al nuovo indirizzo apre l'app
  await page.setRequestInterception(false);
  const p2 = await browser.newPage(); p2.on('pageerror', e => errors.push(e.message));
  const navi = []; p2.on('framenavigated', fr => { if (fr === p2.mainFrame()) navi.push(fr.url()); });
  await p2.goto(N + '/next-libris-prova/trasloco.html?nuovo=' + encodeURIComponent(N) + '&amico=bea', { waitUntil: 'load' });
  await p2.waitForFunction(() => !/trasloco/.test(location.pathname), { timeout: 10000 });
  assert.ok(navi.includes(N + '/next-libris-prova/?amico=bea'), 'apre l\'app con l\'invito: ' + navi);   // poi l'app legge ?amico= e lo toglie
  const err = errors.filter(e => !/Failed to load resource|net::ERR/.test(e));
  assert.deepStrictEqual(err, [], 'errori JavaScript: ' + err.join(' | '));
  console.log('e2e113 OK: «Ci siamo spostati» porta al nuovo indirizzo (invito e chiave), nessun dato toccato');
  await browser.close(); servers.forEach(s => s.close());
})().catch(async e => { console.error('e2e113 FALLITA:', e.message); process.exit(1); });
