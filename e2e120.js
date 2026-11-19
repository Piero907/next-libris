const CFG = require("./_config");
const H = require('./_harness');
// moduli: amici
// Giro 1 (18/11/2026), novità della libreria scelte da Piero:
// 1) libreria di un amico: pillola «In comune» (esclude «Solo quelli che non hai» e viceversa);
// 5) «Da verificare» nella riga chiusa dell'elenco: un tocco verifica senza aprire la scheda (con «Annulla»); da amico solo da leggere;
// 9) icona dell’API sempre nella propria libreria, in alto a destra sulla riga «Libreria di …»: apre la finestra dell’API;
// 11) «Chi è» diventa «Info Autore»;
// 6) dimensione delle copertine: cursore in Aspetto (2-5 per riga) e due dita sulle copertine, ricordata;
// 7) l'app ricorda l'ultima vista (copertine/elenco) e l'ultimo ordine;
// 4) copie dello stesso libro (stesso titolo e autore) in una copertina con «N copie»;
// 10) serie sempre raggruppate: copertina del primo volume e bollino; volumi in ordine di numero; nell'elenco «Serie: … · N volumi»;
// 3) autori con nomi simili («U. Eco» e «Umberto Eco») uniti nei gruppi e nei filtri; i libri restano come sono scritti.
// Con SCHERMATE=cartella: copertine con serie e copie, elenco, testata con l’API.
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8320));
const base = 'http://localhost:' + CFG.port(8320);
const SHOTS = process.env.SCHERMATE ? path.resolve(process.env.SCHERMATE) : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const V = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).v;
const B = o => Object.assign({ id: 'x', t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 1, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: 'da', rt: 0, rd: '' }, o);
const books = [
  B({ id: 'm2', t: 'La voce del violino', a: 'Andrea Camilleri', se: 'Il commissario Montalbano', sn: '4', ts: 20 }),
  B({ id: 'm1', t: 'La forma dell\'acqua', a: 'Andrea Camilleri', se: 'Il commissario Montalbano', sn: '1', ts: 19 }),
  B({ id: 'm3', t: 'Il cane di terracotta', a: 'Andrea Camilleri', se: 'Il commissario Montalbano', sn: '2', ts: 18 }),
  B({ id: 'r1', t: 'Il nome della rosa', a: 'Umberto Eco', e: 'Bompiani', ts: 17 }),
  B({ id: 'r2', t: 'Il nome della rosa: edizione illustrata', a: 'Umberto Eco', e: 'La nave di Teseo', ts: 16 }),
  B({ id: 'u1', t: 'Baudolino', a: 'U. Eco', ts: 15 }),
  B({ id: 'c1', t: 'Palomar', a: 'Italo Calvino', ts: 14, g: ['e'], e: 'Einaudi' }),
  B({ id: 'c2', t: 'Le città invisibili', a: 'Italo Calvino', ts: 13 }),
  B({ id: 's1', t: 'Uno solo', a: 'Elsa Morante', se: 'Serie da un volume', sn: '1', ts: 12 }),
];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const wait = H.wait;
  const p = await (await browser.createBrowserContext()).newPage();
  await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  p.on('pageerror', e => errors.push(e.message));
  await p.evaluateOnNewDocument((b, V) => {
    window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (localStorage.getItem('e2e120')) return; localStorage.setItem('e2e120', '1');
    localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 }));
    localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), price: false, name: 'Piero R.', welcomed: 1, donSeen: 1, viewDef: 'grid', look: 'nuovo', seenV: V, wn2: 1 }));
    localStorage.setItem('catalogo-libri-layout', JSON.stringify({ v: 'a' })); localStorage.setItem('catalogo-libri-card', JSON.stringify({ v: 'd' }));
  }, books, V);
  await p.setRequestInterception(true);
  p.on('request', r => { const u = r.url(); if (u.startsWith(base)) return r.continue(); r.respond({ status: 404, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' }); });
  const tap = async sel => { await p.$eval(sel, e => e.scrollIntoView({ block: 'center' })); await wait(120); await p.click(sel); };   // in mezzo allo schermo: in fondo c'è la barra
  const hideAll = () => p.evaluate(() => { document.querySelectorAll('.sheet:not([hidden])').forEach(x => { x.hidden = true; }); ['#instCard', '#notice'].forEach(s => { const x = document.querySelector(s); if (x) x.hidden = true; }); });
  await p.goto(base + '/', { waitUntil: 'load' }); await wait(1500); await hideAll();
  const cards = () => p.evaluate(() => [...document.querySelectorAll('#list > .grid > .cover, #list .shelf-b > .grid > .cover')].map(c => c.classList.contains('pcard') ? c.querySelector('.cap').textContent + '|' + c.querySelector('.cap2').textContent + '|' + c.querySelector('.gc-n').textContent : c.dataset.id));

  // 10 + 4) copertine: serie (3 volumi) e copie (2 copie); la serie da un volume resta un libro
  let c = await cards(); console.log('[copertine]', c.join(' · '));
  assert.deepStrictEqual(c, ['Serie: Il commissario Montalbano|3 volumi|3', 'Il nome della rosa|2 copie|2', 'u1', 'c1', 'c2', 's1']);
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'copertine-serie-412.png') });
  await p.click('.pcard[data-pk="ser"]'); await wait(300);
  const vol = await p.evaluate(() => { const pc = document.querySelector('.pcard[data-pk="ser"]'), pn = document.getElementById(pc.getAttribute('aria-controls'));
    return { open: !pn.hidden && pc.getAttribute('aria-expanded') === 'true', ids: [...pn.querySelectorAll('.cover')].map(x => x.dataset.id), after: Number(pn.style.order) > Number(pc.style.order) }; });
  console.log('[volumi]', JSON.stringify(vol)); assert(vol.open && vol.after); assert.deepStrictEqual(vol.ids, ['m1', 'm3', 'm2'], 'in ordine di numero');
  assert(await p.evaluate(() => Object.keys(window.__app.settings.grpOpen).some(k => /^p:lib:ser:/.test(k))), 'aperta e ricordata');

  // 9) chiave: non piu' in testata (18/11/2026), ma nel Menu e nel profilo; apre la finestra dell’API
  await p.evaluate(() => NL.openMenu()); await wait(300);
  assert(await p.evaluate(() => !document.getElementById('ownKey') && !!document.getElementById('goKeys')), 'chiave nel Menu, non in testata');
  await p.click('#goKeys'); await wait(500);
  assert(await p.evaluate(() => { const s = document.getElementById('kwSheet'); return s && !s.hidden && /Crea la tua API Google/.test(s.textContent); }), 'finestra dell’API con la guida');
  await hideAll();

  // 7) vista ricordata: Elenco, poi si riapre in elenco; ordine ricordato
  await p.click('#btnView'); await wait(300);
  await p.evaluate(() => { const s = document.getElementById('sort'); s.value = 'titolo'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(300);
  await p.reload({ waitUntil: 'load' }); await wait(1300); await hideAll();
  const vw = await p.evaluate(() => ({ grid: document.body.classList.contains('gridview'), sort: document.getElementById('sort').value }));
  console.log('[vista ricordata]', JSON.stringify(vw)); assert(!vw.grid && vw.sort === 'titolo');

  // 10 + 4) elenco: riga «Serie: … · N volumi» che si apre, copie
  const rows = await p.evaluate(() => [...document.querySelectorAll('#list > .row, #list > .prow, #list .shelf-b > .row, #list .shelf-b > .prow')].map(r => r.classList.contains('prow') ? r.querySelector('.gr-t b').textContent + '|' + r.querySelector('.gr-t small').textContent : r.dataset.id));
  console.log('[elenco]', rows.join(' · '));
  assert(rows.includes('Serie: Il commissario Montalbano|3 volumi · Andrea Camilleri') && rows.includes('Il nome della rosa|2 copie · Umberto Eco'));
  assert(await p.evaluate(() => { const r = document.querySelector('.prow[data-pk="ser"]'); return r.getAttribute('aria-expanded') === 'true' && [...document.getElementById(r.getAttribute('aria-controls')).querySelectorAll('.row')].map(x => x.dataset.id).join() === 'm1,m3,m2'; }), 'serie aperta anche nell\'elenco (ricordata)');
  await tap('.prow[data-pk="cop"]'); await wait(250);
  assert.deepStrictEqual(await p.evaluate(() => [...document.getElementById(document.querySelector('.prow[data-pk="cop"]').getAttribute('aria-controls')).querySelectorAll('.row')].map(x => x.dataset.id).sort()), ['r1', 'r2']);
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'elenco-serie-412.png') });

  // 5) «Da verificare» nella riga chiusa: un tocco, verificato, la scheda resta chiusa; «Annulla» lo rimette
  await tap('.row[data-id="c1"] .tag[data-act="verify"]'); await wait(300);
  let v = await p.evaluate(() => ({ g: NL.get('c1').g.length, open: !!document.querySelector('.row.open[data-id="c1"]'), tag: !!document.querySelector('.row[data-id="c1"] .tag.warn'), toast: document.getElementById('toastTxt').textContent }));
  console.log('[verifica]', JSON.stringify(v)); assert(!v.open && !v.tag && !v.g && /verificato/.test(v.toast));
  await p.click('#toastBtn'); await wait(300);
  assert(await p.evaluate(() => !!document.querySelector('.row[data-id="c1"] .tag[data-act="verify"]')), 'Annulla lo rimette');

  // 11) Info Autore
  assert(await p.evaluate(() => { const r = document.querySelector('.row[data-id="c2"] .sum'); r.click(); return true; })); await wait(400);
  assert.strictEqual(await p.$eval('.row[data-id="c2"] .au-name', e => e.title), 'Info Autore: Italo Calvino');
  await p.evaluate(() => history.back()); await wait(300);

  // 3) autori simili: un gruppo solo «Eco, Umberto» (U. Eco + Umberto Eco); il libro resta «U. Eco»
  await p.click('#btnView'); await wait(300);
  await p.evaluate(() => { const s = document.getElementById('grp'); s.value = 'aut'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(400);
  const au = await p.evaluate(() => [...document.querySelectorAll('.gcard:not(.pcard)')].map(x => x.querySelector('.cap').textContent + ':' + x.querySelector('.gc-n').textContent));
  console.log('[autori]', au.join(' · ')); assert(au.includes('Eco, Umberto:3') && !au.some(x => /^Eco, U\.?:/.test(x)), 'U. Eco unito a Umberto Eco');
  assert.strictEqual(await p.evaluate(() => window.NL.get('u1').a), 'U. Eco', 'il libro resta com\'è scritto');
  // dentro il gruppo dell'autore anche la serie accorpata
  await p.evaluate(() => [...document.querySelectorAll('.gcard:not(.pcard)')].find(x => /Camilleri/.test(x.textContent)).click()); await wait(300);
  assert(await p.evaluate(() => { const g = [...document.querySelectorAll('.gcard:not(.pcard)')].find(x => /Camilleri/.test(x.textContent)); return !!document.getElementById(g.getAttribute('aria-controls')).querySelector('.pcard[data-pk="ser"] .gc-n'); }), 'serie dentro il gruppo dell\'autore');
  // filtro per autore da Eco: anche «U. Eco»
  await p.evaluate(() => { const s = document.getElementById('grp'); s.value = ''; s.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(300);
  await p.click('#btnView'); await wait(300);
  await p.evaluate(() => { const r = document.querySelector('.row[data-id="u1"] .sum'); r.click(); }); await wait(400);
  await tap('.row[data-id="u1"] .fchip[data-f="a"]'); await wait(400);
  const ef = await p.evaluate(() => [...document.querySelectorAll('#list .row')].map(r => r.dataset.id).sort());
  console.log('[filtro Eco]', ef.join(',')); assert.deepStrictEqual(ef, ['r1', 'r2', 'u1'], 'con un filtro i libri uno per uno, U. Eco compreso');
  assert(/Autore: Eco, Umberto/.test(await p.$eval('#activeFlt', e => e.innerText)));
  await p.evaluate(() => window.NL.setFlt && document.querySelector('#activeFlt [data-k="aut"], #activeFlt .chip') && null);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#activeFlt button')].find(x => /Autore/.test(x.textContent) || /Autore/.test(x.getAttribute('aria-label') || '')); if (b) b.click(); }); await wait(300);

  // 6) dimensione delle copertine: cursore in Aspetto, poi due dita
  await p.click('#btnView'); await wait(300);
  const colsOf = () => p.evaluate(() => getComputedStyle(document.querySelector('#list .grid')).gridTemplateColumns.split(' ').length);
  console.log('[colonne prima]', await colsOf());
  await p.evaluate(() => window.__app.openOptions('look')); await wait(350);
  const sl = await p.evaluate(() => { const r = document.getElementById('optCols'); return { v: r.value, txt: document.getElementById('optColsTxt').textContent, legs: [...document.querySelectorAll('.opt-sec[data-sec="look"] legend')].map(x => x.textContent) }; });
  console.log('[cursore]', JSON.stringify(sl)); assert(sl.v === '3' && sl.legs.includes('Dimensione delle copertine') && !sl.legs.includes('All\'apertura mostra'));
  await p.evaluate(() => { const r = document.getElementById('optCols'); r.value = '5'; r.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(200);
  await p.evaluate(() => window.__app.closeOptions()); await wait(300);
  assert.strictEqual(await colsOf(), 5);
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'copertine-5-412.png') });
  // due dita che si allargano: copertine più grandi (meno per riga)
  const cdp = await p.createCDPSession();
  const pinch = async (d0, d1) => {
    const y = 600, cx = 206, pts = d => [{ x: cx - d / 2, y, id: 1 }, { x: cx + d / 2, y, id: 2 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(d0) });
    for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(d0 + (d1 - d0) * i / 6) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await wait(250);
  };
  await pinch(80, 260);
  const c1 = await colsOf(); console.log('[due dita, allargo]', c1, await p.$eval('#toastTxt', e => e.textContent)); assert(c1 < 5 && c1 >= 2);
  await pinch(260, 80); const c2 = await colsOf(); console.log('[due dita, stringo]', c2); assert(c2 > c1);
  await p.reload({ waitUntil: 'load' }); await wait(1200); await hideAll();
  assert.strictEqual(await colsOf(), c2, 'dimensione ricordata');

  // 1) libreria di un amico: «In comune» e «Solo quelli che non hai», una esclude l'altra; «Da verificare» solo da leggere
  await p.evaluate(() => NL.guestEnter('Anna', [
    { id: 'g1', t: 'Palomar', a: 'Italo Calvino', ts: 5, g: ['e'], e: 'Einaudi' },
    { id: 'g2', t: 'Il Gattopardo', a: 'Giuseppe Tomasi di Lampedusa', ts: 4 },
    { id: 'g3', t: 'Le città invisibili', a: 'Italo Calvino', ts: 3 }], { id: 'x', comuni: 0, libVis: true })); await wait(600);
  const pills = () => p.evaluate(() => [...document.querySelectorAll('#guestBar .chip')].map(b => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')));
  console.log('[pillole]', (await pills()).join(' | ')); assert.deepStrictEqual(await pills(), ['Solo quelli che non hai', 'In comune']);
  const ids = () => p.evaluate(() => [...document.querySelectorAll('#list .cover[data-id], #list .row[data-id]')].map(x => x.dataset.id).sort().join());
  await p.click('#guestBar [data-g="common"]'); await wait(300);
  assert.deepStrictEqual(await pills(), ['Solo quelli che non hai', 'In comune*']); assert.strictEqual(await ids(), 'g1,g3');
  await p.click('#guestBar [data-g="notmine"]'); await wait(300);
  assert.deepStrictEqual(await pills(), ['Solo quelli che non hai*', 'In comune']); assert.strictEqual(await ids(), 'g2');
  await p.click('#guestBar [data-g="notmine"]'); await wait(300);
  await p.click('#btnView'); await wait(300);
  assert(await p.evaluate(() => { const t = document.querySelector('.row[data-id="g1"] .tag.warn'); return t && !t.dataset.act; }), 'da amico «Da verificare» non si tocca');
  assert(await p.evaluate(() => window.__app.settings.viewDef === 'grid'), 'da amico la vista non si salva');
  await p.evaluate(() => NL.guestExit()); await wait(400);
  assert(await p.evaluate(() => !document.getElementById('ownKey')), 'tornati ai propri: niente chiave in testata');

  assert.deepStrictEqual(errors, []);
  console.log('e2e120 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
