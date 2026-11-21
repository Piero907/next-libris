const CFG = require("./_config");
// 21/11/2026 (versione 120): Next Libris passa da nextlibris.github.io a nextlibris.app (Piero: solo rimando, niente trasloco dei dati).
// indirizzo.js all'indirizzo nextlibris.github.io (app installata che parte dalla copia sul telefono):
// 1) finche' nextlibris.app non risponde, l'app parte normalmente;
// 2) quando risponde, porta a https://nextlibris.app/ con ?amico= e #k=;
// 3) agli altri indirizzi (copia di prova, computer) non fa niente.
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const P = CFG.port(8346);
const server = http.createServer((req, res) => {
  const q = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(ROOT, q === '/' ? '/index.html' : q); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
}).listen(P);

(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new',
    args: ['--no-sandbox', '--no-proxy-server', '--host-resolver-rules=MAP nextlibris.github.io 127.0.0.1:' + P, '--unsafely-treat-insecure-origin-as-secure=http://nextlibris.github.io:' + P] });
  const V = 'http://nextlibris.github.io:' + P;
  let acceso = false;
  const nuove = [];
  const prepara = async (page) => {
    await page.setRequestInterception(true);
    page.on('request', q => {
      const u = q.url();
      if (!u.startsWith('https://nextlibris.app')) return q.continue();
      if (q.isNavigationRequest()) { nuove.push(u); return q.respond({ status: 200, contentType: 'text/html', body: 'nuovo' }); }
      if (!acceso) return q.abort('namenotresolved');                // prima del passaggio il dominio non risponde
      q.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"v":120}' });
    });
  };
  // 1) nuovo indirizzo spento: l'app parte
  const p1 = await browser.newPage(); await prepara(p1);
  await p1.goto(V + '/?amico=anna#k=abc', { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 1500));
  assert.strictEqual(nuove.length, 0, 'nessun passaggio prima che nextlibris.app risponda: ' + nuove);
  assert.ok(await p1.evaluate(() => !!document.querySelector('#gTabs, #iosGate, #splash')), 'l\'app parte al vecchio indirizzo');
  await p1.close();
  // 2) nuovo indirizzo acceso: porta al nuovo, con invito e chiave
  acceso = true;
  const p2 = await browser.newPage(); await prepara(p2);
  await p2.goto(V + '/?amico=anna#k=abc', { waitUntil: 'load' });
  for (let i = 0; i < 40 && !nuove.length; i++) await new Promise(r => setTimeout(r, 100));
  assert.strictEqual(nuove[0], 'https://nextlibris.app/?amico=anna#k=abc', 'porta al nuovo indirizzo con invito e chiave: ' + nuove);
  await p2.close();
  // 3) altri indirizzi (qui 127.0.0.1): niente passaggio anche con nextlibris.app acceso
  nuove.length = 0;
  const p3 = await browser.newPage(); await prepara(p3);
  await p3.goto('http://127.0.0.1:' + P + '/?amico=bea', { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 1500));
  assert.strictEqual(nuove.length, 0, 'agli altri indirizzi non succede niente: ' + nuove);
  console.log('e2e146 OK: al vecchio indirizzo nextlibris.github.io l\'app installata passa a nextlibris.app solo quando risponde, con invito e chiave');
  await browser.close(); server.close();
})().catch(async e => { console.error('e2e146 FALLITA:', e.message); process.exit(1); });
