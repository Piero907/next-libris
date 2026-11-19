// Aiutante comune delle prove (17/11/2026, dalla verifica del 17/11).
//   const H = require('./_harness');
//   H.serve(CFG.port(8126))        server dei file dell'app (CFG.APP); al posto delle ~10 righe ripetute in ogni prova
//   const wait = H.wait;           attesa «finché»: aspetta che le pagine abbiano finito, al massimo ms (vedi sotto)
//   H.sleep(ms)                    attesa fissa vera (per le poche prove che misurano il tempo che passa)
//
// Attesa «finché». Prima ogni prova aspettava tempi fissi (1.433 attese, ~680 s in tutto). Ora wait(ms) guarda dentro le pagine
// e torna appena non c'è più niente in corso che arriverebbe entro ms: timer (setTimeout) che scadono prima, richieste di rete
// (fetch e XMLHttpRequest), fotocamera che si accende (getUserMedia, video.play), immagini che si caricano, transazioni del database del telefono (IndexedDB), canvas.toBlob,
// FileReader, animazioni CSS che finiscono prima. Poi due fotogrammi. Se in ms non si calma, torna comunque dopo ms (come prima).
// Le pagine si preparano da sole: questo file aggancia la creazione delle pagine di puppeteer. Una pagina senza il contatore (per esempio
// una finestra aperta dall'app con window.open) fa usare l'attesa fissa. PROVE_ATTESE=fisse rimette le attese fisse dappertutto;
// PROVE_ATTESE=debug stampa alla fine quanto si è aspettato e perché.
const CFG = require('./_config');
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer-core');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.gz': 'application/gzip', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.traineddata': 'application/octet-stream', '.mjpeg': 'video/x-motion-jpeg' };

// server dei file dell'app: '/' = index.html, niente fuori dalla cartella
function serve(port, root) {
  root = root || CFG.APP;
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'Content-Type': (p.endsWith('.wasm.js') ? 'text/javascript' : MIME[path.extname(f)]) || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  }).listen(port);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const FISSE = process.env.PROVE_ATTESE === 'fisse';
const DEBUG = process.env.PROVE_ATTESE === 'debug';
const stat = { chieste: 0, fatte: 0, perche: {} };
if (DEBUG) process.on('exit', () => console.error('[attese] chieste ' + (stat.chieste / 1000).toFixed(1) + ' s, fatte ' + (stat.fatte / 1000).toFixed(1) + ' s', JSON.stringify(stat.perche)));

// ---- dentro la pagina: tiene il conto di quello che è in corso ----
function tracker() {
  if (window.__q) return;
  const q = window.__q = { t: new Map(), n: 0 };
  const now = () => performance.now();
  const st = window.setTimeout, ct = window.clearTimeout;
  window.setTimeout = function (fn, ms) {
    if (typeof fn !== 'function') return st.apply(window, arguments);
    const args = Array.prototype.slice.call(arguments, 2), due = now() + (Number(ms) || 0);
    const id = st.call(window, function () { q.t.delete(id); return fn.apply(this, args); }, ms);
    q.t.set(id, due); return id;
  };
  window.clearTimeout = function (id) { q.t.delete(id); return ct.call(window, id); };
  const busy = (p) => { q.n++; let done = false; const end = () => { if (!done) { done = true; q.n--; } }; Promise.resolve(p).then(end, end); return p; };
  const pending = () => { q.n++; let done = false; return () => { if (!done) { done = true; q.n--; } }; };
  if (window.fetch) { const ff = window.fetch; window.fetch = function () { return busy(ff.apply(this, arguments)); }; }
  const xo = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () { const end = pending(); this.addEventListener('loadend', end); return xo.apply(this, arguments); };
  if (window.IDBDatabase) {
    const tr = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function () { const t = tr.apply(this, arguments), end = pending(); t.addEventListener('complete', end); t.addEventListener('abort', end); t.addEventListener('error', end); return t; };
  }
  if (window.indexedDB) { const op = IDBFactory.prototype.open; IDBFactory.prototype.open = function () { const r = op.apply(this, arguments), end = pending(); r.addEventListener('success', end); r.addEventListener('error', end); r.addEventListener('blocked', end); return r; }; }
  const tb = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function (cb) { const end = pending(), a = Array.prototype.slice.call(arguments, 1); return tb.call(this, function (b) { try { return cb(b); } finally { end(); } }, ...a); };
  ['readAsDataURL', 'readAsText', 'readAsArrayBuffer'].forEach(m => { const o = FileReader.prototype[m]; FileReader.prototype[m] = function () { const end = pending(); this.addEventListener('loadend', end); return o.apply(this, arguments); }; });
  const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', { configurable: true, enumerable: src.enumerable, get: src.get,
    set: function (v) { if (v) { const end = pending(); const t = st.call(window, end, 3000); const fin = () => { ct.call(window, t); end(); }; this.addEventListener('load', fin, { once: true }); this.addEventListener('error', fin, { once: true }); } return src.set.call(this, v); } });
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) { const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); navigator.mediaDevices.getUserMedia = function () { return busy(gum.apply(null, arguments)); }; }
  const play = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { return busy(play.apply(this, arguments)); };
  if (window.createImageBitmap) { const cib = window.createImageBitmap; window.createImageBitmap = function () { return busy(cib.apply(this, arguments)); }; }
  // c'è qualcosa che arriverebbe prima di «fino»?
  q.busy = (fino) => {
    if (q.n > 0) return 'lavori ' + q.n;
    for (const d of q.t.values()) if (d <= fino) return 'timer';
    for (const im of document.images) if (im.getAttribute('src') && !im.complete) return 'immagine';
    if (document.getAnimations) for (const a of document.getAnimations()) {
      if (a.playState !== 'running' || !a.effect) continue;
      const c = a.effect.getComputedTiming(); if (isFinite(c.endTime) && (c.endTime - (a.currentTime || 0)) <= (fino - now())) return 'animazione';
    }
    return '';
  };
  q.frames = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));
}

// pagine preparate: ogni pagina nuova (browser.newPage, anche nei contesti separati) riceve il contatore prima di aprire l'indirizzo.
// (Le funzioni esportate da puppeteer-core non si possono sostituire: si aggancia la classe del browser.)
const created = new Set();
// Content-Security-Policy (17/11/2026): se il browser blocca qualcosa, la prova fallisce alla fine (PROVE_CSP=ignora per non farla fallire)
const csp = [];
process.on('exit', (code) => { if (!csp.length) return; console.error('[CSP] bloccato dal browser:\n  ' + [...new Set(csp)].join('\n  ')); if (!code && process.env.PROVE_CSP !== 'ignora') process.exitCode = 1; });
const CB = puppeteer.CdpBrowser && puppeteer.CdpBrowser.prototype;
if (CB && CB._createPageInContext) {
  const orig = CB._createPageInContext;
  CB._createPageInContext = async function () {
    const p = await orig.apply(this, arguments);
    try { await p.evaluateOnNewDocument(tracker); created.add(p); } catch (e) {}
    // stile G (20/11/2026): le prove di prima controllano le funzioni con i tasti di sempre; lo stile G lo accendono e2e137 e le schermate (window.NL_NO_G = false)
    try { await p.evaluateOnNewDocument(() => { window.NL_NO_G = true; }); } catch (e) {}
    // guida di primo avvio (giro 4): nelle prove non si apre da sola, tranne con ?guida=1 nell'indirizzo (e2e123)
    try { await p.evaluateOnNewDocument(() => { try { if (!/[?&]guida=1/.test(location.search)) (() => { const m = location.pathname.match(/\/next-libris-([a-z]+)(\/|$)/); return [(m ? m[1] + ':' : '') + 'catalogo-libri-guida']; })().forEach(k => { if (!localStorage.getItem(k)) localStorage.setItem(k, '{"seen":1,"v":99}'); }); } catch (e) {} }); } catch (e) {}
    p.on('console', m => { const t = m.text(); if (/Content Security Policy/i.test(t)) csp.push(t.slice(0, 300)); });
    return p;
  };
}

async function pages() {
  const bs = new Set(), all = [];
  for (const p of created) { if (p.isClosed()) created.delete(p); else bs.add(p.browser()); }
  for (const b of bs) { try { all.push(...(await b.pages())); } catch (e) {} }
  return all.filter(p => !p.isClosed() && p.url() !== 'about:blank');
}

// attesa «finché»
async function wait(ms) {
  ms = Number(ms) || 0;
  if (DEBUG) { const t0 = Date.now(); stat.chieste += ms; try { return await wait2(ms); } finally { stat.fatte += Date.now() - t0; } }
  return wait2(ms);
}
async function wait2(ms) {
  if (FISSE || ms <= 30) return sleep(ms);
  const end = Date.now() + ms;
  const ps = await pages();
  if (!ps.length) return sleep(ms);
  let calm = 0;
  while (Date.now() < end) {
    let busy = '';
    for (const p of ps) {
      let r;
      try { r = await p.evaluate((rest) => window.__q ? window.__q.busy(performance.now() + rest) : 'senza', Math.max(0, end - Date.now())); }
      catch (e) { r = 'navigazione'; }
      if (r === 'senza') { if (DEBUG) stat.perche.senza = (stat.perche.senza || 0) + 1; return sleep(Math.max(0, end - Date.now())); }
      if (r) { busy = r; break; }
    }
    if (busy) { if (DEBUG) stat.perche[busy] = (stat.perche[busy] || 0) + 1; calm = 0; await sleep(20); continue; }
    if (++calm >= 2) {
      for (const p of ps) { try { await Promise.race([p.evaluate(() => window.__q && window.__q.frames()), sleep(100)]); } catch (e) {} }
      return;
    }
    await sleep(15);
  }
}

module.exports = { serve, wait, sleep, MIME, CFG, csp };
