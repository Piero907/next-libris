const CFG = require("./_config");
// avvio dalla copia: la versione nuova si scarica in sottofondo e arriva all'apertura dopo; mai file di versioni diverse
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.OUT + '/site33';
fs.rmSync(ROOT, { recursive: true, force: true }); fs.cpSync(CFG.APP, ROOT, { recursive: true, filter: src => !/[\\/](prove|\.git|node_modules)$/.test(src) });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
let failApp = false;
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
  if (failApp && p === '/app.js') { res.writeHead(500); return res.end(); }
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8150));
const bump = (v) => {
  const h = path.join(ROOT, 'index.html'), a = path.join(ROOT, 'app.js');
  fs.writeFileSync(h, fs.readFileSync(h, 'utf8').replace(/<meta name="prova"[^>]*>\n?/, '').replace('</head>', '<meta name="prova" content="' + v + '">\n</head>'));
  fs.writeFileSync(a, fs.readFileSync(a, 'utf8').replace(/\nwindow\.__prova = \d+;$/, '') + '\nwindow.__prova = ' + v + ';');
};
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await browser.newPage();
  await p.evaluateOnNewDocument(() => localStorage.setItem('catalogo-libri-set', JSON.stringify({ installed: true, instScope: '/', swiped: true })));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  // il service worker ricontrolla i file al massimo una volta al minuto: invece di aspettare 61 secondi lo fermo (riparte da zero alla prossima apertura)
  const cdp = await p.target().createCDPSession(); await cdp.send('ServiceWorker.enable');
  const swReset = async () => { await cdp.send('ServiceWorker.stopAllWorkers'); await wait(300); };
  const ver = () => p.evaluate(() => document.querySelector('meta[name="prova"]').content + '/' + window.__prova);   // la versione che sta girando: pagina/codice
  bump(1);
  await p.goto('http://localhost:' + CFG.port(8150) + '/?vista=elenco', { waitUntil: 'load' });
  await p.waitForFunction(() => navigator.serviceWorker.controller, { timeout: 20000 }).catch(async () => { await p.reload(); await p.waitForFunction(() => navigator.serviceWorker.controller, { timeout: 20000 }); });
  await p.reload({ waitUntil: 'load' }); await wait(800);
  console.log('[1 copia]', await ver()); assert.strictEqual(await ver(), '1/1');
  // esce la versione 2: la prima apertura usa ancora la copia (veloce), intanto scarica; la seconda e' la nuova
  bump(2); await swReset();
  await p.goto('http://localhost:' + CFG.port(8150) + '/?vista=elenco', { waitUntil: 'load' }); await wait(1500);
  const a = await ver(); console.log('[2 subito]', a); assert.strictEqual(a, '1/1');
  await p.goto('http://localhost:' + CFG.port(8150) + '/?vista=elenco', { waitUntil: 'load' }); await wait(500);
  const b = await ver(); console.log('[2 apertura dopo]', b); assert.strictEqual(b, '2/2');
  // esce la 3 ma un file non arriva: nessuna versione mescolata, resta la 2
  bump(3); failApp = true; await swReset();
  await p.goto('http://localhost:' + CFG.port(8150) + '/?vista=elenco', { waitUntil: 'load' }); await wait(1500);
  await p.goto('http://localhost:' + CFG.port(8150) + '/?vista=elenco', { waitUntil: 'load' }); await wait(500);
  const c = await ver(); console.log('[3 file mancante]', c); assert.strictEqual(c, '2/2');
  failApp = false;
  console.log('e2e33 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
