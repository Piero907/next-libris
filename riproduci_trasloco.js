// riproduce: app 99 installata (service worker e copia) a piero907.github.io/next-libris/, poi il sito passa alla 100
const path = require('path'), fs = require('fs'), http = require('http');
const puppeteer = require('/home/claude/prove/node_modules/puppeteer-core');
const DIR = { v: process.argv[2] }, NUOVA = process.argv[3], VECCHIA = process.argv[4] || '/home/claude/v99';
let servo = VECCHIA;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/plain' };
http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  if (!p.startsWith('/next-libris/')) { r.writeHead(404); return r.end(); }
  p = p.slice('/next-libris/'.length) || 'index.html';
  const f = path.join(servo, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('404'); }
  r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(r);
}).listen(8099);
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--no-proxy-server', '--host-resolver-rules=MAP piero907.github.io 127.0.0.1:8099', '--unsafely-treat-insecure-origin-as-secure=http://piero907.github.io:8099'] });
  const pg = await b.newPage();
  pg.on('console', (m) => { if (/error|warn/i.test(m.type())) console.log('  console:', m.text().slice(0, 150)); });
  const U = 'http://piero907.github.io:8099/next-libris/';
  await pg.goto(U, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch((e) => console.log('goto99', e.message)); await new Promise((r) => setTimeout(r, 4000));
  await pg.evaluate(async () => { const r = await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready; }).catch((e) => console.log('sw', e.message)); await new Promise((r) => setTimeout(r, 3000));
  console.log('99 aperta, service worker:', await pg.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())));
  const FASI = NUOVA.split(',');
  for (let i = 1; i <= 3 * FASI.length; i++) {
    if ((i - 1) % 3 === 0) { servo = FASI[(i - 1) / 3]; console.log('-- il sito ora serve', servo); if (i > 1) await new Promise((r) => setTimeout(r, 70000)); }
    await pg.goto(U, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch((e) => console.log('  goto', e.message));
    await new Promise((r) => setTimeout(r, 4000));
    const s = await Promise.race([new Promise((r) => setTimeout(() => r('(pagina bloccata)'), 5000)), pg.evaluate(() => ({ url: location.pathname, tit: document.title, h1: (document.querySelector('h1') || {}).textContent, testo: document.body ? document.body.innerText.trim().slice(0, 80).replace(/\s+/g, ' ') : '(nessun body)' }))]);
    console.log('apertura', i, JSON.stringify(s));
  }
  await pg.screenshot({ path: '/tmp/riproduci.png' }).catch(() => {});
  await b.close(); process.exit(0);
})();
