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
// 4) «Con gli amici» (l'API; il worker non c'è più: 031) sta in Ricerca dei libri, non piu' in Condivisione.
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
  const openMenu = async (p) => { await p.click('#gMenu'); await wait(450); };   // stile G: ≡ Indice

  // ---------- 412x915 (il telefono di Piero) ----------
  const p = await phone(412, 915);
  // 1) testata
  const hd = await p.evaluate(() => ({ title: document.querySelector('header.top h1 .g-t').textContent, rib: document.getElementById('gRib').textContent, prose: document.getElementById('gProse').textContent,
    old: !!document.querySelector('#owner, #summary, .top-meta, #btnOpts, #sync') }));
  console.log('[1 testata]', JSON.stringify(hd));
  assert(hd.title === 'Libreria' && /^12/.test(hd.rib) && /in prestito/.test(hd.prose) && !hd.old, 'stile G: titolo, nastro con il numero dei libri, frase con i prestiti; niente pezzi della vecchia testata');
  assert(/^Libreria/.test(await p.$eval('header.top h1', x => x.textContent.trim())), 'titolo «Libreria»');
  assert(await p.evaluate(() => { const b = document.getElementById('gMenu').getBoundingClientRect(), r = document.getElementById('gRun').getBoundingClientRect(); return Math.abs((b.top + b.bottom) / 2 - (r.top + r.bottom) / 2) <= 8; }), 'stile G: ≡ Indice sulla riga della testatina');
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
  assert.deepStrictEqual(mn.items, ['Il mio profilo', 'Filtri', 'Suggerimenti', 'Tutte le citazioni', 'Statistiche', 'La tua stagione in libri', 'Sostieni Next Libris', '## Amici', 'I tuoi amici', 'API Google Libri', '## La tua libreria', "Sistema l'elenco", 'Backup ed esportazione',
    'Impostazioni', '  Account e sincronizzazione', '  Amici e privacy', '  Notifiche', '  Ricerca dei libri', '  Aggiunta dei libri', '  Aspetto',
    'Info e aiuto', '  Come si usa', '  Guarda una libreria di esempio', '  Condivisione', '  Installazione sul telefono', '  Privacy', '  Contatti']);   // voci della guida (giro 4)
  assert.deepStrictEqual(mn.bad.filter(x => !/birra/.test(x)), [], 'sottotitoli su una riga (tranne Sostieni, che si legge tutto: 18/11/2026)');
  assert(mn.don > 0.6, 'stile G: Sostieni come fascia dorata in fondo all\'Indice (posizione da rivedere con Piero, IN_SOSPESO 41)');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'menu-412.png') });

  // 3a) Impostazioni aperte, menu scorso, Aspetto (finestra con cronologia) → Indietro → Menu come prima
  await p.evaluate(() => { if (document.getElementById('setList').hidden) document.getElementById('goSettings').click(); }); await wait(400);   // Impostazioni aperte (se lo erano già, restano)
  await p.evaluate(() => { document.getElementById('drawerBody').scrollTop = 120; document.querySelector('#setList .dopt[data-sec="look"]').scrollIntoView({ block: 'center' }); }); await wait(100);   // restyle pezzo 3: la barra in basso resta sopra il Menu
  const top0 = (await st(p)).top;
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'menu-impostazioni-412.png') });
  await p.click('#setList .dopt[data-sec="look"]'); await wait(400);
  let s = await st(p); assert(s.win && !s.drawer, 'Aspetto aperto');
  await back(p); s = await st(p); console.log('[3a Indietro da Aspetto]', JSON.stringify(s));
  assert(s.drawer && !s.win && s.sets && Math.abs(s.top - top0) <= 60 && /drawer/.test(s.state), 'Menu riaperto nello stesso punto');   // 18/11/2026: con Sostieni in cima il tocco su Aspetto fa scorrere un poco il Menu prima di aprire   // 60: dalla 105.2 la frase di Sostieni va su più righe
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
  await openMenu(p); await p.evaluate(() => document.getElementById('goInfo').click()); await wait(300);
  await p.click('#infoList .dopt[data-sec="contact"]'); await wait(400);
  await back(p); s = await st(p); assert(s.drawer && s.info && !s.win, 'Menu con Info e aiuto aperto');
  // 4) l'API in Ricerca
  await p.click('#setList .dopt[data-sec="search"]').catch(async () => { await p.evaluate(() => document.getElementById('goSettings').click()); await wait(300); await p.click('#setList .dopt[data-sec="search"]'); });
  await wait(400);
  const sv = await p.evaluate(() => ({ inSearch: !!document.querySelector('.opt-sec[data-sec="search"] #svcBox'), box: document.getElementById('svcBox').innerText.trim().slice(0, 80) }));
  console.log('[4 Ricerca]', JSON.stringify(sv));
  assert(sv.inSearch && sv.box, '«Con gli amici» in Ricerca dei libri');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'ricerca-412.png'), fullPage: false });
  await p.close();

  // ---------- 5) API di un amico in uso: «Usa la tua» (Piero, 17/11/2026). Il worker di un amico non esiste più (031): sparisce da solo ----------
  {
    const q = await phone(412, 915);
    await q.evaluate(() => {
      localStorage.setItem('prova:catalogo-libri-amici-chiavi-mie', JSON.stringify({ gb: 'AIzaMiaChiave0000000', sbn: '' }));
      localStorage.setItem('prova:catalogo-libri-amici-chiave-in-uso', JSON.stringify({ da: 'uA', nome: 'Anna', gb: 'AIzaDiAnna0000000000', sbn: 'https://sbn-anna.workers.dev' }));
      window.NL.settings.gbKey = 'AIzaDiAnna0000000000'; window.NL.settings.sbnUrl = 'https://sbn-anna.workers.dev'; window.NL.saveSettings();
      window.NL.openOptions('search'); window.NL.svcFold('key', true);   // sezione richiudibile (giro 5)
    }); await wait(500);
    const lab = () => q.$$eval('.svc-own', xs => xs.filter(x => x.offsetParent).map(x => x.dataset.own + ':' + x.textContent));
    let l = await lab(); console.log('[5 prestata]', l.join(' | '));
    assert.deepStrictEqual(l, ['gb:Usa la tua API (AIzaMi…0000)']);
    const sec = await q.$eval('.opt-sec[data-sec="search"]', x => x.innerText);
    assert(/Catalogo delle biblioteche italiane \(SBN\)/.test(sec) && /Incluso/.test(sec) && !/worker/i.test(sec), 'SBN incluso, niente worker: ' + sec.slice(0, 200));
    if (SHOTS) await q.screenshot({ path: path.join(SHOTS, 'ricerca-prestate-412.png') });
    await q.click('.svc-own[data-own="gb"]'); await wait(400);
    let v = await q.evaluate(() => ({ gb: window.NL.settings.gbKey, sbn: window.NL.settings.sbnUrl, field: document.getElementById('gbKey').value, row: document.querySelector('#svcKey .svc-row').hidden, uso: localStorage.getItem('prova:catalogo-libri-amici-chiave-in-uso') }));
    console.log('[5 la mia API]', JSON.stringify(v));
    assert(v.gb === 'AIzaMiaChiave0000000' && v.field === 'AIza…000' && !v.row && v.sbn === '' && (!v.uso || v.uso === 'null'), 'API mia, niente più di Anna (nemmeno il worker)');
    l = await lab(); assert.deepStrictEqual(l, []);
    if (SHOTS) await q.screenshot({ path: path.join(SHOTS, 'ricerca-mie-412.png') });
    // la guida del worker e il suo codice non stanno più nell'app
    const gone = await q.evaluate(async () => ({ how: !!document.getElementById('sbnHow'), copy: !!document.getElementById('sbnCopy'), file: (await fetch('cloudflare-sbn-worker.js')).status }));
    assert(!gone.how && !gone.copy && gone.file === 404, 'niente guida né codice del worker nell\'app: ' + JSON.stringify(gone));
    await q.close();
  }

  // ---------- 360 scuro e 1280: niente scorrimento di lato, schermate ----------
  for (const [w, h, d] of [[360, 740, true], [1280, 800, false]]) {
    const q = await phone(w, h, d);
    if (SHOTS) await q.screenshot({ path: path.join(SHOTS, 'testata-' + w + '.png'), clip: { x: 0, y: 0, width: w, height: 170 } });
    const sw = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(sw <= 0, w + ': scorrimento di lato');
    // stile G: testatina «NEXT LIBRIS» con campanella e ≡ Indice sulla stessa riga, senza toccarsi; il nastro non copre l'Indice
    const ov = await q.evaluate(() => {
      let b = document.getElementById('btnBell');
      if (!b) { b = document.createElement('button'); b.className = 'ico nt-top'; b.id = 'btnBell'; b.textContent = '•'; document.getElementById('gIcs').insertBefore(b, document.getElementById('gMenu')); }
      b.hidden = false;
      const r = e => e.getBoundingClientRect(), run = r(document.getElementById('gRun')), bell = r(b), m = r(document.getElementById('gMenu')), rib = r(document.getElementById('gRib'));
      const mid = x => (x.top + x.bottom) / 2;
      return { c: Math.max(Math.abs(mid(bell) - mid(run)), Math.abs(mid(m) - mid(run))), gap1: bell.left - run.right, gap2: m.left - bell.right, rib: rib.width ? (rib.left >= m.right - 0.5 || rib.top >= m.bottom - 0.5 || rib.right <= m.left + 0.5) : true };
    });
    console.log('[' + w + ' testatina]', JSON.stringify(ov));
    assert(ov.c <= 6 && ov.gap1 >= 0 && ov.gap2 >= 0 && ov.rib, w + ': testatina in fila, senza toccarsi');
    if (SHOTS) await q.screenshot({ path: path.join(SHOTS, 'testata-campanella-' + w + '.png'), clip: { x: 0, y: 0, width: w, height: 170 } });
    await openMenu(q);
    const bad = await q.evaluate(() => [...document.querySelectorAll('#drawerOpts .dopt small')].filter(s => s.offsetParent && s.getBoundingClientRect().height > 20).map(s => s.textContent));
    assert.deepStrictEqual(bad.filter(x => !/birra/.test(x)), [], w + ': sottotitoli su una riga');
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
