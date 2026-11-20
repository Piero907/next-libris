const CFG = require("./_config");
const HN = require('./_harness');
// moduli: social   (senza questi file nell'app la prova si salta: vedi esegui.js)
// 032 (Piero, 21/11/2026): errori dei telefoni veri. Gli errori di nlErr() partono in forma anonima verso errori_manda
// (senza account e senza Authorization): file:riga, messaggio senza email né link, versione, tipo di telefono, app installata sì/no.
// 1) un invio con al massimo 5 errori; 2) un secondo invio entro il minuto aspetta; forzato parte con gli altri;
// 3) già mandati = non si rimandano; 4) 10 invii al giorno per telefono, poi niente; 5) quando l'app va in secondo piano parte da solo.
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const CALLS = [];
function fake(req, res, body, url) {
  const send = (st, j) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(j === undefined ? '' : JSON.stringify(j)); };
  const p = url.pathname.replace(/^\/finto/, '');
  if (req.headers.apikey !== 'chiave-finta') return send(401, { message: 'no api key' });
  if (p === '/auth/v1/settings') return send(200, { external: { google: true } });
  if (p === '/rest/v1/rpc/errori_manda') { CALLS.push({ body, auth: req.headers.authorization || '' }); return send(204); }
  if (p.startsWith('/rest/v1/rpc/')) return send(200, []);
  send(404, { message: 'finto: ' + p });
}
const srv = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/finto/')) { let b = ''; req.on('data', c => b += c); req.on('end', () => { let j = {}; try { j = b ? JSON.parse(b) : {}; } catch (e) {} fake(req, res, j, url); }); return; }
  const p = decodeURIComponent(url.pathname), m = p.match(/^\/next-libris-prova(\/.*)?$/);
  if (!m) { res.writeHead(404); return res.end(); }
  if (!m[1]) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
  const f = path.join(ROOT, m[1] === '/' ? '/index.html' : m[1]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
}).listen(CFG.port(8344));
const base = 'http://localhost:' + CFG.port(8344);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const wait = HN.wait;
  try {
    const A = await browser.newPage();
    await A.setViewport({ width: 1280, height: 800 });
    await A.evaluateOnNewDocument((u) => {
      window.NL_SOCIAL = { url: u, key: 'chiave-finta', gClient: 'client-finto' };
      localStorage.setItem('prova:catalogo-libri-guida', JSON.stringify({ seen: 1, v: 99 }));
    }, base + '/finto');
    await A.setRequestInterception(true);
    A.on('request', r => { if (r.url().startsWith(base)) return r.continue(); r.respond({ status: 404, body: '' }); });
    await A.goto(base + '/next-libris-prova/', { waitUntil: 'networkidle0' });
    await A.waitForFunction(() => window.NLSocial && window.NLSocial.errSend && window.nlErr, { timeout: 15000 });
    const callsNow = async (n, ms) => { const t = Date.now(); while (CALLS.length < n && Date.now() - t < (ms || 4000)) await wait(100); return CALLS.length; };
    const base0 = CALLS.length;

    // 1) sette errori diversi (uno con email e link): un invio forzato porta i primi 5, senza account
    await A.evaluate(() => {
      nlErr(new Error('Scrivi a mario.rossi@esempio.it o vai su https://esempio.it/x?y=1'));
      for (let i = 2; i <= 7; i++) nlErr(new Error('Errore di prova ' + i));
      window.NLSocial.errSend(true);
    });
    await callsNow(base0 + 1);
    assert.strictEqual(CALLS.length, base0 + 1, '1) un invio');
    let c = CALLS[CALLS.length - 1];
    assert.strictEqual(c.auth, '', '1) senza Authorization (anonimo)');
    assert.strictEqual(c.body.lista.length, 5, '1) al massimo 5 errori per invio');
    assert.ok(/<email>/.test(c.body.lista[0].msg) && /<link>/.test(c.body.lista[0].msg) && !/esempio\.it/.test(c.body.lista[0].msg), '1) email e link tolti: ' + c.body.lista[0].msg);
    assert.strictEqual(c.body.tel, 'pc', '1) tipo di telefono');
    assert.strictEqual(c.body.inst, false, '1) nel browser, non installata');
    assert.ok(c.body.ver && c.body.ver !== '?', '1) versione');
    assert.deepStrictEqual(Object.keys(c.body).sort(), ['inst', 'lista', 'tel', 'ver'], '1) solo questi dati');
    console.log('ok 1: invio anonimo di 5 errori, email e link tolti');

    // 2) subito dopo, non forzato: aspetta il minuto; forzato: partono gli altri 2
    await A.evaluate(() => window.NLSocial.errSend());
    await wait(800);
    assert.strictEqual(CALLS.length, base0 + 1, '2) entro il minuto non riparte');
    await A.evaluate(() => window.NLSocial.errSend(true));
    await callsNow(base0 + 2);
    assert.strictEqual(CALLS[CALLS.length - 1].body.lista.length, 2, '2) gli altri 2');
    console.log('ok 2: uno al minuto, poi i rimanenti');

    // 3) niente di nuovo: niente invio
    await A.evaluate(() => window.NLSocial.errSend(true));
    await wait(600);
    assert.strictEqual(CALLS.length, base0 + 2, '3) già mandati, niente invio');
    console.log('ok 3: gli errori già mandati non ripartono');

    // 4) 10 invii al giorno per telefono
    await A.evaluate(() => {
      localStorage.setItem('prova:catalogo-libri-errori-inviati', JSON.stringify({ d: new Date().toISOString().slice(0, 10), n: 10 }));
      nlErr(new Error('Oltre il limite')); window.NLSocial.errSend(true);
    });
    await wait(800);
    assert.strictEqual(CALLS.length, base0 + 2, '4) oltre i 10 invii del giorno niente');
    console.log('ok 4: tetto di 10 invii al giorno');

    // 5) app in secondo piano: parte da solo
    await A.evaluate(() => {
      localStorage.removeItem('prova:catalogo-libri-errori-inviati');
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await callsNow(base0 + 3);
    assert.strictEqual(CALLS.length, base0 + 3, '5) invio quando l\'app va in secondo piano');
    assert.ok(CALLS[CALLS.length - 1].body.lista.some(x => /Oltre il limite/.test(x.msg)), '5) l\'errore rimasto');
    console.log('ok 5: invio quando l\'app va in secondo piano');
    console.log('e2e144: tutto a posto');
  } catch (e) { console.error('FALLITA:', e.message); process.exitCode = 1; }
  finally { await browser.close(); srv.close(); }
})();
