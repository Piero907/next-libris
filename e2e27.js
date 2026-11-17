const CFG = require("./_config");
// foto vere di retri di libri (non sono nel repository). Cartella FOTO_PB, predefinita /tmp/pb, con cases.json e neg.json: senza, la prova si salta.
const PB = process.env.FOTO_PB || '/tmp/pb';
if (!require('fs').existsSync(PB + '/cases.json') || !require('fs').existsSync(PB + '/neg.json')) { console.log('SALTATA: mancano le foto vere in ' + PB + ' (cases.json, neg.json)'); process.exit(77); }
// lettura del prezzo dentro l'app: casi realistici (orizzontali e verticali) e retri senza prezzo
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.gz': 'application/gzip', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = p.startsWith('/pb/') ? path.join(PB, p.slice(4)) : path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8143));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await browser.newPage();
  await p.evaluateOnNewDocument(() => localStorage.setItem('catalogo-libri-set', JSON.stringify({ installed: true, instScope: '/', swiped: true, lastBackup: Date.now() })));
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.setRequestInterception(true); p.on('request', r => r.url().startsWith('http://localhost:' + CFG.port(8143) + '') ? r.continue() : r.abort());
  await p.goto('http://localhost:' + CFG.port(8143) + '/?vista=elenco', { waitUntil: 'load' });
  const cases = JSON.parse(fs.readFileSync(PB + '/cases.json')).concat(JSON.parse(fs.readFileSync(PB + '/neg.json')));
  const out = await p.evaluate(async cs => {
    const res = [];
    for (const c of cs) {
      const im = await new Promise(r => { const x = new Image(); x.onload = () => r(x); x.src = '/pb/' + c.f; });
      const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight; cv.getContext('2d').drawImage(im, 0, 0);
      const t0 = performance.now(), g = await window.__app.readPrice(cv, 3);
      res.push({ f: c.f, want: c.v, got: g ? g.v : null, sure: g ? g.sure : null, ms: Math.round(performance.now() - t0) });
    }
    return res;
  }, cases);
  const pos = out.filter(r => r.want != null), neg = out.filter(r => r.want == null);
  const ok = pos.filter(r => r.got === r.want).length, wrong = pos.filter(r => r.got != null && r.got !== r.want).length, invented = neg.filter(r => r.got != null).length;
  console.log(`[prezzi] giusti ${ok}/${pos.length}, sbagliati ${wrong} · retri senza prezzo: inventati ${invented}/${neg.length} · tempo medio ${Math.round(out.reduce((a, r) => a + r.ms, 0) / out.length)} ms`);
  assert(ok >= 33, 'almeno 33 prezzi su 40'); assert(wrong <= 1); assert.strictEqual(invented, 0);
  assert.deepStrictEqual(errors, []);
  console.log('e2e27 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
