const CFG = require("./_config");
// rete lentissima: con la copia sul telefono l'app parte entro ~3 s invece di restare bianca
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.gz': 'application/gzip', '.wasm': 'application/wasm' };
let slow = false;
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const go = () => { res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); };
  if (slow && !p.includes('/vendor/') && !p.endsWith('version.json')) setTimeout(go, 9000); else go(); }).listen(8149);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await browser.newPage();
  await p.evaluateOnNewDocument(() => localStorage.setItem('catalogo-libri-set', JSON.stringify({ installed: true, instScope: '/', swiped: true })));
  await p.goto('http://localhost:8149/', { waitUntil: 'load' });
  await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, { timeout: 20000 }).catch(async () => { await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => navigator.serviceWorker.controller, { timeout: 20000 }); });
  await new Promise(r => setTimeout(r, 1500));
  slow = true;
  const t0 = Date.now();
  await p.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await p.waitForFunction(() => !!window.__app, { timeout: 30000 });
  const ms = Date.now() - t0;
  console.log('[rete lenta] app pronta in', ms, 'ms (la rete risponde dopo 9000 ms)');
  assert(ms < 4000, 'parte dalla copia salvata');
  console.log('e2e32 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
