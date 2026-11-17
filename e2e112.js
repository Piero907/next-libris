const CFG = require("./_config");
const H = require('./_harness');
// moduli: amici, notifiche   (senza questi file nell'app la prova si salta: vedi esegui.js)
// 17/11/2026, prova 99.10. Menu riordinato, Indietro che torna al Menu, testata su due righe (scelte di Piero).
// 1) Testata: «Next Libris» con le icone centrate sulla stessa linea; sotto una riga sola «Piero R. · 12 libri · 2 in prestito».
// 2) Menu: ordine nuovo (Sostieni sopra Impostazioni, «Invita un amico» tolto, Impostazioni in ordine d'uso, «Info e aiuto»),
//    sottotitoli su una riga, Sostieni intorno a meta' schermo (412x915).
// 3) Indietro da una finestra aperta dal Menu (con e senza cronologia) riapre il Menu nello stesso punto e con i gruppi aperti;
//    «Chiudi» e × fanno come Indietro (17/11/2026 pomeriggio, prima chiudevano tutto) e non lasciano voci in piu' nella cronologia.
//    Sostieni sta prima di Amici (17/11/2026 pomeriggio).
// 4) «Con gli amici» (chiave e worker) sta in Ricerca dei libri, non piu' in Condivisione.
// Con SCHERMATE=cartella: foto a 412, 360 scuro e 1280.
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname), m = p.match(/^\/next-libris-prova(\/.*)?$/);
  if (!m) { res.writeHead(404); return res.end(); }
  if (!m[1]) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
  const f = path.join(ROOT, m[1] === '/' ? '/index.html' : m[1]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
}).listen(CFG.port(8312));
const base = 'http://localhost:' + CFG.port(8312);
const SHOTS = process.env.SCHERMATE ? path.resolve(process.env.SCHERMATE) : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const B = o => Object.assign({ id: 'x', t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 1, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: '', rt: 0, rd: '' }, o);
const books = [];
for (let k = 0; k < 12; k++) books.push(B({ id: 'b' + k, t: 'Libro numero ' + k, a: 'Autore ' + k, e: 'Einaudi', y: '2010', c: 10 + k, i: '97888060000' + String(k).padStart(2, '0'), ts: 100 - k, p: k < 2 ? 'Anna' : '', pd: k < 2 ? '2026-10-01' : '' }));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const wait = H.wait;   // attesa «finché» (_harness.js)
  async function phone(w, h, dark) {
    const page = await (await browser.createBrowserContext()).newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 700, hasTouch: w < 700 });
    page.on('pageerror', e => errors.push(w + ': ' + e.message));
    await page.evaluateOnNewDocument((b) => {
      window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
      if (localStorage.getItem('prova:e2e112')) return; localStorage.setItem('prova:e2e112', '1');
      localStorage.setItem('prova:catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 }));
      localStorage.setItem('prova:catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), price: false, name: 'Piero R.', sumLoan: true, welcomed: 1, donSeen: 1 }));
      localStorage.setItem('prova:catalogo-libri-layout', JSON.stringify({ v: 'a' })); localStorage.setItem('prova:catalogo-libri-card', JSON.stringify({ v: 'd' }));
    }, books);
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) ? r.continue() : r.respond({ status: 200, contentType: 'application/json', body: '{"totalItems":0}' }));
    await page.goto(base + '/next-libris-prova/', { waitUntil: 'load' }); await wait(1500);
    await page.evaluate((d) => {
      document.querySelectorAll('.sheet:not([hidden])').forEach(x => { x.hidden = true; });
      ['#instCard', '#notice'].forEach(s => { const x = document.querySelector(s); if (x) x.hidden = true; });
      if (d) document.documentElement.setAttribute('data-theme', 'dark');
    }, dark); await wait(300);
    return page;
  }
  const st = (p) => p.evaluate(() => ({ drawer: document.getElementById('drawer').classList.contains('open'), win: !!document.querySelector('.sheet:not([hidden]), #wrap:not([hidden])'),
    state: JSON.stringify(history.state), top: document.getElementById('drawerBody').scrollTop, sets: !document.getElementById('setList').hidden, info: !document.getElementById('infoList').hidden }));
  const back = async (p) => { await p.evaluate(() => history.back()); await wait(500); };
  const openMenu = async (p) => { await p.click('#edgeTab'); await wait(450); };

  // ---------- 412x915 (il telefono di Piero) ----------
  const p = await phone(412, 915);
  // 1) testata
  const hd = await p.evaluate(() => {
    const r = e => e.getBoundingClientRect(), h1 = r(document.querySelector('h1')), gear = r(document.getElementById('btnOpts')), meta = document.querySelector('.top-meta');
    return { owner: document.getElementById('owner').innerText, meta: document.getElementById('owner').innerText + ' · ' + document.getElementById('summary').innerText.replace(/\s+/g, ' ').trim(), metaH: r(meta).height, ownH: r(document.getElementById('owner')).height, sumH: r(document.getElementById('summary')).height, h1c: h1.top + h1.height / 2, gearC: gear.top + gear.height / 2, h1R: h1.right, gearL: gear.left };
  });
  console.log('[1 testata]', JSON.stringify(hd));
  assert.strictEqual(hd.owner, 'Libreria di Piero R.');   // «Libreria di» (17/11/2026)
  assert(/^Libreria di Piero R\. · 12 libri · \d+ in prestito/.test(hd.meta), hd.meta);
  assert(hd.ownH < 30 && hd.sumH < 30 && hd.metaH > 30 && hd.metaH < 50, 'due righe: «Libreria di …» sopra, i numeri sotto (17/11/2026)');
  assert(Math.abs(hd.h1c - hd.gearC) <= 4, 'icone centrate sul titolo');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'testata-412.png'), clip: { x: 0, y: 0, width: 412, height: 170 } });

  // 2) menu (NLAmici.load() senza account mette «Amici e privacy», come dopo l'accesso)
  await p.evaluate(() => window.NLAmici.load()); await wait(200);
  await openMenu(p);
  const mn = await p.evaluate(() => {
    const items = [...document.querySelectorAll('#drawerOpts h3, #drawerOpts .dopt')].filter(e => e.offsetParent || e.closest('.dsub'))
      .map(e => (e.tagName === 'H3' ? '## ' : e.closest('.dsub') ? '  ' : '') + (e.querySelector('b') || e).textContent.trim());
    const bad = [...document.querySelectorAll('#drawerOpts .dopt small')].filter(s => s.offsetParent && s.getBoundingClientRect().height > 20).map(s => s.textContent);
    return { items, bad, don: document.getElementById('donMenu').getBoundingClientRect().top / innerHeight };
  });
  console.log('[2 menu]', mn.items.join(' | '), '· Sostieni a', Math.round(mn.don * 100) + '%');
  assert.deepStrictEqual(mn.items, ['Filtri', 'Suggerimenti', 'Statistiche', 'Sostieni Next Libris', '## Amici', 'I tuoi amici', '## La tua libreria', "Sistema l'elenco", 'Backup ed esportazione',
    'Impostazioni', '  Account e sincronizzazione', '  Amici e privacy', '  Notifiche', '  Ricerca dei libri', '  Aggiunta dei libri', '  Aspetto',
    'Info e aiuto', '  Condivisione', '  Installazione sul telefono', '  Privacy', '  Contatti']);
  assert.deepStrictEqual(mn.bad, [], 'sottotitoli su una riga');
  assert(mn.don > 0.15 && mn.don < 0.6, 'Sostieni prima di Amici, nella parte alta-centrale');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'menu-412.png') });

  // 3a) Impostazioni aperte, menu scorso, Aspetto (finestra con cronologia) → Indietro → Menu come prima
  await p.click('#goSettings'); await wait(400);
  await p.evaluate(() => { document.getElementById('drawerBody').scrollTop = 120; }); await wait(100);
  const top0 = (await st(p)).top;
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'menu-impostazioni-412.png') });
  await p.click('#setList .dopt[data-sec="look"]'); await wait(400);
  let s = await st(p); assert(s.win && !s.drawer, 'Aspetto aperto');
  await back(p); s = await st(p); console.log('[3a Indietro da Aspetto]', JSON.stringify(s));
  assert(s.drawer && !s.win && s.sets && s.top === top0 && /drawer/.test(s.state), 'Menu riaperto nello stesso punto');
  // 3b) Statistiche (senza cronologia) → Indietro → Menu
  await p.evaluate(() => { document.getElementById('drawerBody').scrollTop = 0; });
  await p.click('#goStats'); await wait(400);
  s = await st(p); assert(s.win && !s.drawer, 'Statistiche aperte');
  await back(p); s = await st(p); console.log('[3b Indietro da Statistiche]', JSON.stringify(s));
  assert(s.drawer && !s.win && s.sets, 'Menu riaperto dopo Statistiche');
  // 3c) «‹» di Aspetto fa come Indietro
  await p.click('#setList .dopt[data-sec="look"]'); await wait(400);
  await p.click('#optBack'); await wait(500); s = await st(p);
  assert(s.drawer && !s.win && s.sets, '‹ torna al Menu');
  // 3d) Chiudi da una finestra con cronologia (Sostieni): come Indietro, si torna al Menu
  await p.click('#donMenu'); await wait(400);
  await p.click('#donClose'); await wait(700); s = await st(p); console.log('[3d Chiudi da Sostieni]', JSON.stringify(s));
  assert(s.drawer && !s.win && /drawer/.test(s.state) && s.sets, 'Chiudi torna al Menu');
  // 3e) Chiudi da una finestra senza cronologia (Account): come Indietro, si torna al Menu
  await p.click('#goAcc'); await wait(500);
  s = await st(p); assert(s.win && !s.drawer, 'Account aperto');
  await p.click('#accClose'); await wait(800); s = await st(p); console.log('[3e Chiudi da Account]', JSON.stringify(s));
  assert(s.drawer && !s.win && /drawer/.test(s.state), 'Chiudi da Account torna al Menu');
  // 3e') × di Opzioni (Aspetto) e Chiudi di Statistiche (senza cronologia): come Indietro
  await p.click('#setList .dopt[data-sec="look"]'); await wait(400);
  await p.click('#optClose'); await wait(700); s = await st(p); assert(s.drawer && !s.win, '× di Aspetto torna al Menu');
  await p.click('#goStats'); await wait(400);
  await p.click('#statsClose'); await wait(700); s = await st(p);
  assert(s.drawer && !s.win, 'Chiudi di Statistiche torna al Menu: ' + JSON.stringify(s));
  // e dal Menu Indietro lo chiude, poi arriva subito all'uscita (nessuna voce in piu')
  await back(p); s = await st(p); assert(!s.drawer && !s.win, 'Indietro chiude il Menu');
  await back(p); s = await st(p); assert(/root/.test(s.state), 'nessuna voce in piu\' nella cronologia: ' + s.state);
  // 3f) Info e aiuto aperto, Contatti → Indietro → Menu con Info aperto
  await p.evaluate(() => history.pushState({ guard: 1 }, ''));
  await openMenu(p); await p.click('#goInfo'); await wait(300);
  await p.click('#infoList .dopt[data-sec="contact"]'); await wait(400);
  await back(p); s = await st(p); assert(s.drawer && s.info && !s.sets && !s.win, 'Menu con Info e aiuto aperto');
  // 4) chiave e worker in Ricerca
  await p.click('#setList .dopt[data-sec="search"]').catch(async () => { await p.click('#goSettings'); await wait(300); await p.click('#setList .dopt[data-sec="search"]'); });
  await wait(400);
  const sv = await p.evaluate(() => ({ inSearch: !!document.querySelector('.opt-sec[data-sec="search"] #svcBox'), box: document.getElementById('svcBox').innerText.trim().slice(0, 80) }));
  console.log('[4 Ricerca]', JSON.stringify(sv));
  assert(sv.inSearch && sv.box, '«Con gli amici» in Ricerca dei libri');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'ricerca-412.png'), fullPage: false });
  await p.close();

  // ---------- 5) chiave e worker di un amico in uso: «Usa la tua» / «Inserisci il tuo» (Piero, 17/11/2026) ----------
  {
    const q = await phone(412, 915);
    await q.evaluate(() => {
      localStorage.setItem('prova:catalogo-libri-amici-chiavi-mie', JSON.stringify({ gb: 'AIzaMiaChiave0000000', sbn: '' }));
      localStorage.setItem('prova:catalogo-libri-amici-chiave-in-uso', JSON.stringify({ da: 'uA', nome: 'Anna', gb: 'AIzaDiAnna0000000000', sbn: 'https://sbn-anna.workers.dev' }));
      window.NL.settings.gbKey = 'AIzaDiAnna0000000000'; window.NL.settings.sbnUrl = 'https://sbn-anna.workers.dev'; window.NL.saveSettings();
      window.NL.openOptions('search');
    }); await wait(500);
    const lab = () => q.$$eval('.svc-own', xs => xs.filter(x => x.offsetParent).map(x => x.dataset.own + ':' + x.textContent));
    let l = await lab(); console.log('[5 prestate]', l.join(' | '));
    assert.deepStrictEqual(l, ['sbn:Inserisci il tuo worker', 'gb:Usa la tua chiave (AIzaMi…0000)']);
    if (SHOTS) await q.screenshot({ path: path.join(SHOTS, 'ricerca-prestate-412.png') });
    await q.click('.svc-own[data-own="gb"]'); await wait(400);
    let v = await q.evaluate(() => ({ gb: window.NL.settings.gbKey, sbn: window.NL.settings.sbnUrl, field: document.getElementById('gbKey').value, row: document.querySelector('#svcKey .svc-row').hidden, uso: localStorage.getItem('prova:catalogo-libri-amici-chiave-in-uso') }));
    console.log('[5 la mia chiave]', JSON.stringify(v));
    assert(v.gb === 'AIzaMiaChiave0000000' && v.field === 'AIzaMiaChiave0000000' && !v.row && v.sbn === 'https://sbn-anna.workers.dev' && /"nogb":true/.test(v.uso), 'chiave mia, worker ancora di Anna');
    l = await lab(); assert.deepStrictEqual(l, ['sbn:Inserisci il tuo worker']);
    await q.click('.svc-own[data-own="sbn"]'); await wait(400);
    v = await q.evaluate(() => ({ gb: window.NL.settings.gbKey, sbn: window.NL.settings.sbnUrl, focus: document.activeElement && document.activeElement.id, row: document.querySelector('#svcSbn .svc-row').hidden, uso: localStorage.getItem('prova:catalogo-libri-amici-chiave-in-uso') }));
    console.log('[5 il mio worker]', JSON.stringify(v));
    assert(v.gb === 'AIzaMiaChiave0000000' && v.sbn === '' && v.focus === 'sbnUrl' && !v.row && !v.uso, 'campo del worker vuoto e pronto, niente più di Anna');
    if (SHOTS) await q.screenshot({ path: path.join(SHOTS, 'ricerca-mie-412.png') });
    // guida del worker nell'app, con «Copia il codice del worker» (non piu' il LEGGIMI)
    const cp = await q.evaluate(async () => {
      let got = ''; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { got = t; return Promise.resolve(); } } });
      document.getElementById('sbnHow').open = true; document.getElementById('sbnHow').scrollIntoView({ block: 'center' });
      document.getElementById('sbnCopy').click(); await new Promise(r => setTimeout(r, 600));
      return { toast: (document.querySelector('.toast') || {}).textContent, got: got, leggimi: /LEGGIMI/.test(document.querySelector('#svcSbn').innerText), steps: document.querySelectorAll('#sbnHow li').length };
    });
    console.log('[5 guida worker]', cp.toast, cp.steps, 'passi, codice copiato:', /export default/.test(cp.got));
    assert(/ORIGINI_AMMESSE/.test(cp.got) && !cp.leggimi && cp.steps === 5, 'guida del worker');
    if (SHOTS) await q.screenshot({ path: path.join(SHOTS, 'ricerca-guida-worker-412.png') });
    await q.close();
  }

  // ---------- 360 scuro e 1280: niente scorrimento di lato, schermate ----------
  for (const [w, h, d] of [[360, 740, true], [1280, 800, false]]) {
    const q = await phone(w, h, d);
    if (SHOTS) await q.screenshot({ path: path.join(SHOTS, 'testata-' + w + '.png'), clip: { x: 0, y: 0, width: w, height: 170 } });
    const sw = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(sw <= 0, w + ': scorrimento di lato');
    const c = await q.evaluate(() => { const r = e => e.getBoundingClientRect(), a = r(document.querySelector('h1')), g = r(document.getElementById('btnOpts')); return Math.abs((a.top + a.height / 2) - (g.top + g.height / 2)); });
    assert(c <= 4, w + ': icone centrate sul titolo (' + c + ')');
    const ov = await q.evaluate(() => {          // con la campanella (dopo l'accesso): titolo e PROVA non la toccano
      document.documentElement.classList.add('has-bell', 'has-fri');
      let b = document.getElementById('btnBell');
      if (!b) { b = document.createElement('button'); b.className = 'ico nt-top'; b.id = 'btnBell'; b.textContent = '•'; document.querySelector('header.top').appendChild(b); }
      b.hidden = false;
      const h = document.querySelector('h1'), t = h.querySelector('.prova-tag'), r = (t || h).getBoundingClientRect().right;
      const ic = [...document.querySelectorAll('.top .nt-top, .top .fri-top, .top .gear, .top .beer-top')].map(x => x.getBoundingClientRect());
      const bb = document.getElementById('btnBeer').getBoundingClientRect(), left = bb.left + (bb.width - 24) / 2;   // il boccale (17/11/2026) e' l'icona piu' a sinistra
      const bl = b.getBoundingClientRect(); if ((bl.left + bl.width / 2) - (bb.left + bb.width / 2) < 30) return { gap: -1, c: 0, beer: 'troppo vicino alla campanella' };   // le zone da toccare si sovrappongono gia' (e2e105): contano i disegni
      return { gap: left - r, c: Math.max(...ic.map(x => Math.abs((x.top + x.height / 2) - (h.getBoundingClientRect().top + h.getBoundingClientRect().height / 2)))) };
    });
    console.log('[' + w + ' con la campanella]', JSON.stringify(ov));
    assert(ov.gap >= 4 && ov.c <= 4, w + ': titolo e campanella');
    if (SHOTS) await q.screenshot({ path: path.join(SHOTS, 'testata-campanella-' + w + '.png'), clip: { x: 0, y: 0, width: w, height: 170 } });
    await openMenu(q);
    const bad = await q.evaluate(() => [...document.querySelectorAll('#drawerOpts .dopt small')].filter(s => s.offsetParent && s.getBoundingClientRect().height > 20).map(s => s.textContent));
    assert.deepStrictEqual(bad, [], w + ': sottotitoli su una riga');
    const out = await q.evaluate(() => { document.getElementById('goSettings').click(); document.getElementById('goInfo').click(); const d = document.getElementById('drawer').getBoundingClientRect().right;
      return [...document.querySelectorAll('#drawerOpts .dopt')].filter(x => x.offsetParent && x.getBoundingClientRect().right > d + 0.5).map(x => x.textContent.slice(0, 20)); });
    assert.deepStrictEqual(out, [], w + ': voci del menu fuori dal pannello');
    await wait(300);
    if (SHOTS) await q.screenshot({ path: path.join(SHOTS, 'menu-' + w + '.png') });
    await q.close();
  }
  console.log(errors.length ? 'ERRORI: ' + errors.join(' | ') : 'nessun errore di pagina');
  assert.strictEqual(errors.length, 0);
  console.log('E2E112 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('E2E112 FALLITA', e); process.exit(1); });
