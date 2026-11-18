const CFG = require("./_config");
const H = require('./_harness');
// moduli: guida
// Giro 4 (18/11/2026, scelte di Piero): guida di primo avvio e libreria di esempio (guida.js).
// 1) prima apertura in assoluto: la guida si apre da sola; ogni schermata con «Prova adesso» trova la sua parte di app; Salta chiude e non torna;
// 2) chi aggiorna (libri o impostazioni già sul telefono) non la vede da sola; Menu › Info e aiuto › Come si usa e «Guarda una libreria di esempio»;
// 3) «Prova adesso» della schermata 3: libreria di esempio con un libro aperto (stella, libricini, film già scritto), tocchi = avviso, nulla cambia;
// 4) l'esempio non fa nessuna richiesta fuori e non salva niente: i tuoi libri restano quelli, uscendo tornano;
// 5) schermata 6: i Desideri dell'esempio; schermata 2: si apre il +. Niente scorrimento di lato a 360.
// Giro 7: nove schermate (Prestiti e Desideri separati) e pillola «‹ Torna alla guida» dopo «Prova adesso» sulle parti vere.
// Giro 5: otto schermate («Trova più libri» con «Crea la chiave»), tocco ai lati per sfogliare; chi usa già l'app la vede una volta dopo l'aggiornamento.
const puppeteer = require('puppeteer-core');
const assert = require('assert');
const server = H.serve(CFG.port(8323), CFG.APP);
const APP = 'http://localhost:' + CFG.port(8323);
const wait = H.wait;
const MIEI = { books: [{ id: 'm1', t: 'Il barone rampante', a: 'Italo Calvino', g: [], ts: 1 }, { id: 'm2', t: 'Lessico famigliare', a: 'Natalia Ginzburg', g: [], ts: 2 }], updated: 5 };
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  async function newPage(seed) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 360, height: 760, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    page.on('pageerror', e => errors.push(e.message));
    page.fuori = [];
    await page.setRequestInterception(true);
    page.on('request', r => { const u = r.url(); if (u.startsWith('http://localhost') || u.startsWith('data:')) return r.continue(); page.fuori.push(u); r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }); });
    if (seed) await page.evaluateOnNewDocument((s) => { if (!localStorage.getItem('catalogo-libri-v2')) localStorage.setItem('catalogo-libri-v2', s); }, JSON.stringify(seed));
    await page.goto(APP + '/?guida=1', { waitUntil: 'load' }); await wait(1800);
    return page;
  }
  const open = (p) => p.evaluate(() => { const g = document.getElementById('guida'); return !!g && !g.hidden; });
  const slide = (p) => p.evaluate(() => ({ h: (document.querySelector('.gd-h') || {}).textContent || '', n: document.getElementById('gdN').textContent, tries: [...document.querySelectorAll('#gdStage [data-gd="try"]')].map(b => b.dataset.go) }));

  // 1) prima apertura: si apre da sola
  let p = await newPage(null);
  assert(await open(p), 'la guida si apre da sola alla prima apertura');
  const scr = await p.evaluate(() => window.NLGuida.screens());
  console.log('[schermate]', scr.map(s => s.h + (s.go ? ' (' + s.go + ')' : '')).join(' · '));
  assert.strictEqual(scr.length, 9, 'nove schermate (giro 7: Prestiti e Desideri separati)');
  for (const s of scr) {
    if (s.sel) assert(await p.evaluate((q) => q.split(',').some(x => document.querySelector(x.trim())), s.sel), 'la parte di app di «' + s.h + '» esiste: ' + s.sel);
    if (s.mod) assert(await p.evaluate((m) => !!window[m], s.mod), 'modulo ' + s.mod);
  }
  assert(await p.evaluate(() => !!(window.NLRicerche && window.NLRicerche.guide) && !!(window.NLAmici && window.NLAmici.open) && !!document.getElementById('sortBar')), 'guida della chiave, amici, Ordina · Raggruppa');
  // sfoglia: tasti e dito
  let seen = [];
  for (let i = 0; i < 9; i++) {
    const s = await slide(p); seen.push(s.h + ':' + s.tries.join('+'));
    const w = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(w <= 0, 'niente scorrimento di lato: ' + s.h);
    if (i === 1) { await p.evaluate(() => { const g = document.getElementById('guida'), ev = (t, x) => g.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: 400, pointerType: 'touch', bubbles: true })); ev('pointerdown', 300); ev('pointerup', 120); }); }
    else if (i === 3) { await p.evaluate(() => { const g = document.querySelector('#gdStage .gd-slide'), ev = (t, x) => g.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: 300, pointerType: 'touch', bubbles: true })); ev('pointerdown', 345); ev('pointerup', 345); }); }   // tocco a destra = avanti
    else await p.click('.gd-next');
    await wait(200);
  }
  console.log('[sfogliate]', seen.join(' | '));
  assert.strictEqual(seen[1], 'Aggiungi i libri:add', 'schermata 2 con il +');
  assert.strictEqual(seen[2], 'Trova più libri (facoltativo):key', 'schermata 3: chiave e worker');
  assert.strictEqual(await p.evaluate(() => { window.NLGuida.open(2); return document.querySelector('#gdStage .gd-try').textContent; }), 'Crea la chiave');
  await p.evaluate(() => window.NLGuida.close()); await wait(200);
  // tocco a sinistra = indietro
  await p.evaluate(() => window.NLGuida.open(4)); await wait(100);
  await p.evaluate(() => { const g = document.querySelector('#gdStage .gd-slide'), ev = (t, x) => g.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: 300, pointerType: 'touch', bubbles: true })); ev('pointerdown', 15); ev('pointerup', 15); }); await wait(100);
  assert.strictEqual(await p.evaluate(() => document.getElementById('gdN').textContent), '4 di 9', 'tocco a sinistra = indietro');
  await p.evaluate(() => window.NLGuida.close()); await wait(200);
  assert(/^La pagina del libro:book/.test(seen[3]) && /^Prestiti:loan/.test(seen[5]) && /^Desideri:wish/.test(seen[6]) && /^Per te:don/.test(seen[8]), 'Prova adesso al posto giusto');
  assert(!(await open(p)), '«Inizia» chiude la guida');
  await p.reload({ waitUntil: 'load' }); await wait(1800);
  assert(!(await open(p)), 'vista una volta, non si riapre da sola');

  // 5a) schermata 2: «Prova adesso» apre il +
  await p.evaluate(() => window.NLLayout.set('a')); await wait(300);   // fuori dalle prove la disposizione è sempre la A, con il +
  await p.evaluate(() => window.NLGuida.open(1)); await wait(300);
  await p.click('#gdStage .gd-try'); await wait(600);
  assert(await p.evaluate(() => !document.getElementById('layAdd').hidden), 'si apre il +');
  // giro 7: pillola «‹ Torna alla guida · 2/9»; Indietro del telefono chiude il + e riapre la guida dalla stessa schermata
  const pl = await p.evaluate(() => { const e = document.getElementById('gdPill'); return e && !e.hidden ? e.textContent : ''; });
  assert(/Torna alla guida/.test(pl) && /2\/9/.test(pl), 'pillola: ' + pl);
  const box = await p.evaluate(() => { const r = document.getElementById('gdPill').getBoundingClientRect(); return { r: r.right, b: r.bottom, w: innerWidth, h: innerHeight }; });
  assert(box.r <= box.w && box.b <= box.h, 'pillola dentro lo schermo');
  await p.goBack().catch(() => {}); await wait(600);
  let g = await p.evaluate(() => ({ open: !document.getElementById('guida').hidden, n: document.getElementById('gdN').textContent, add: !document.getElementById('layAdd').hidden, pill: !document.getElementById('gdPill').hidden }));
  assert(g.open && g.n === '2 di 9' && !g.add && !g.pill, 'Indietro torna alla guida: ' + JSON.stringify(g));
  // di nuovo «Prova adesso», poi il tocco sulla pillola
  await p.click('#gdStage .gd-try'); await wait(600);
  await p.click('#gdPill .gd-pill-go'); await wait(600);
  g = await p.evaluate(() => ({ open: !document.getElementById('guida').hidden, n: document.getElementById('gdN').textContent, add: !document.getElementById('layAdd').hidden }));
  assert(g.open && g.n === '2 di 9' && !g.add, 'la pillola torna alla guida: ' + JSON.stringify(g));
  // la ✕ della pillola: resta dove sei
  await p.click('#gdStage .gd-try'); await wait(600);
  await p.click('#gdPill .gd-pill-x'); await wait(500);
  g = await p.evaluate(() => ({ open: !document.getElementById('guida').hidden, pill: !document.getElementById('gdPill').hidden }));
  assert(!g.open && !g.pill, '✕: la pillola sparisce e la guida resta chiusa');
  // schermata Prestiti: l'esempio apre Pinocchio prestato a Marta
  await p.evaluate(() => window.NLGuida.open(5)); await wait(200);
  await p.click('#gdStage .gd-try'); await wait(1200);
  assert.strictEqual(await p.evaluate(() => (document.querySelector('#list .row.open') || {}).dataset ? document.querySelector('#list .row.open').dataset.id : ''), 'ex4', 'Prestiti: Pinocchio aperto');
  await p.evaluate(() => document.querySelector('#exBar [data-ex="out"]').click()); await wait(300);
  await p.close();

  // 2) chi usa già l'app (libri sul telefono, guida vecchia vista): la vede una volta dopo l'aggiornamento (giro 5); voci nel Menu
  p = await newPage(MIEI);
  assert(await open(p), 'chi usa già l\'app vede la guida nuova una volta');
  await p.click('.gd-skip'); await wait(300);
  assert.strictEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-guida')).v), 2, 'segnata la versione 2');
  await p.reload({ waitUntil: 'load' }); await wait(1800);
  assert(!(await open(p)), 'non torna da sola');
  assert(await p.evaluate(() => !!document.getElementById('goGuida') && !!document.getElementById('goEsempio') && /Guida/.test(document.querySelector('#goInfo small').textContent)), 'Come si usa e Libreria di esempio nel Menu');
  await p.evaluate(() => { window.NL.openMenu(); }); await wait(400);
  await p.evaluate(() => document.getElementById('goInfo').click()); await wait(200);
  await p.evaluate(() => document.getElementById('goGuida').click()); await wait(500);
  assert(await open(p), 'dal Menu si apre la guida');
  const before = await p.evaluate(() => localStorage.getItem('catalogo-libri-v2'));

  // 3) schermata 4: libreria di esempio con il libro aperto
  await p.evaluate(() => window.NLGuida.open(3)); await wait(200);
  p.fuori.length = 0;
  await p.click('#gdStage .gd-try'); await wait(1500);
  const ex = await p.evaluate(() => {
    const card = document.querySelector('#list .row.open');
    return { cls: document.documentElement.className, bar: !document.getElementById('exBar').hidden, owner: document.getElementById('owner').textContent,
      friendBar: !!(document.getElementById('guestBar') && !document.getElementById('guestBar').hidden), n: window.NL.books().length,
      open: card ? card.dataset.id : '', fav: !!(card && card.querySelector('[data-act="fav"]') && card.querySelector('[data-act="fav"]').offsetParent),
      stars: card ? card.querySelectorAll('[data-act="rt"]').length : 0, film: card ? (card.querySelector('.filmbox:not([hidden])') || {}).textContent || '' : '' };
  });
  console.log('[esempio]', JSON.stringify(ex));
  assert(/esempio/.test(ex.cls) && !/\bguest\b/.test(ex.cls) && ex.bar && !ex.friendBar && /Libreria di esempio/.test(ex.owner), 'striscia dell\'esempio');
  assert(ex.n >= 10 && ex.open === 'ex7' && ex.fav && ex.stars === 5 && /serie TV/.test(ex.film) && /Dal libro/.test(ex.film), 'libro aperto con stella, libricini e film');
  // i tocchi: avviso, niente cambia
  await p.evaluate(() => document.querySelector('#list .row.open [data-act="rt"][data-v="2"]').click()); await wait(300);
  const t1 = await p.evaluate(() => ({ toast: document.body.innerText.includes('È solo un esempio'), rt: window.NL.get('ex7').rt }));
  assert(t1.toast && t1.rt === 5, 'libricini: avviso e voto uguale');
  await p.evaluate(() => document.querySelector('#list .row.open [data-act="fav"]').click()); await wait(200);
  assert.strictEqual(await p.evaluate(() => window.NL.get('ex7').fav), true, 'la stella non cambia');
  const inp = await p.evaluate(() => { const i = document.querySelector('#list .row.open input, #list .row.open textarea'); if (!i) return 'nessuno'; i.focus(); return document.activeElement === i ? 'scrive' : 'fermo'; });
  assert(inp !== 'scrive', 'i campi non si scrivono: ' + inp);
  // raggruppa per paese: le bandiere arrivano dai dati scritti
  const pa = await p.evaluate(() => [...new Set(window.NL.books().map(b => window.NL.wdBookCountry(b)))].sort().join(','));
  assert.strictEqual(pa, 'CO,GB,IT,RU,US', 'paesi senza Wikidata');
  // Info Autore: avviso, nessuna richiesta
  await p.evaluate(() => { const b = document.querySelector('#list .row.open [data-act="auinfo"]'); if (b) b.click(); }); await wait(400);
  // 5b) Desideri dell'esempio
  await p.evaluate(() => document.querySelector('#exBar [data-t="wish"]').click()); await wait(400);
  const w = await p.evaluate(() => ({ tab: window.NL.tab(), n: document.querySelectorAll('#list [data-id]').length, owner: document.getElementById('owner').textContent }));
  assert(w.tab === 'wish' && /Desideri di esempio/.test(w.owner), 'Desideri dell\'esempio: ' + JSON.stringify(w));
  // 5c) barra in basso dentro l'esempio (18/11/2026): Libreria/Desideri dell'esempio, Profilo di esempio, + con l'avviso
  const nav = (l) => p.evaluate((l) => { const b = document.querySelector('#layNav [data-l="' + l + '"]'); if (b) b.click(); return !!b; }, l);
  if (await nav('lib')) {
    await wait(300);
    assert(await p.evaluate(() => window.NL.esempio() && window.NL.tab() === 'lib'), 'Libreria resta nell\'esempio');
    await nav('add'); await wait(300);
    assert(await p.evaluate(() => { const s = document.getElementById('layAdd'); return (!s || s.hidden) && window.NL.esempio(); }), '+ nell\'esempio: solo l\'avviso');
    await nav('prof'); await wait(400);
    const pr = await p.evaluate(() => { const s = document.getElementById('profSheet'); return s && !s.hidden ? s.textContent : ''; });
    assert(/Profilo di esempio/.test(pr) && /Lettore di esempio/.test(pr) && /Quel ramo del lago di Como/.test(pr) && /Il fu Mattia Pascal/.test(pr), 'Profilo di esempio: ' + pr.slice(0, 200));
    await p.click('#profSheet [data-p="wish"]'); await wait(300);
    assert(await p.evaluate(() => window.NL.esempio() && window.NL.tab() === 'wish' && document.getElementById('profSheet').hidden), 'dal profilo ai Desideri dell\'esempio');
  }
  const wide = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(wide <= 0, 'esempio a 360 senza scorrimento di lato');
  console.log('[fuori]', p.fuori.length ? p.fuori.join(' ') : 'nessuna richiesta');
  assert.deepStrictEqual(p.fuori, [], 'nessuna chiamata dall\'esempio');
  // 4) uscita: i tuoi libri, nulla salvato dell'esempio
  await p.evaluate(() => document.querySelector('#exBar [data-ex="guide"]').click()); await wait(500);
  assert(await open(p), '«‹ Guida» torna alla guida');
  const back = await p.evaluate(() => ({ ids: window.NL.books().map(b => b.id).sort().join(','), cls: document.documentElement.className, saved: localStorage.getItem('catalogo-libri-v2'), wd: localStorage.getItem('catalogo-libri-auwd') || '' }));
  assert.strictEqual(back.ids, 'm1,m2', 'tornano i tuoi libri');
  assert(!/esempio/.test(back.cls), 'fuori dall\'esempio');
  assert(!/ex\d/.test(back.saved) && JSON.parse(back.saved).books.length === JSON.parse(before).books.length, 'nessun libro dell\'esempio salvato');
  assert(!/gabriel/.test(back.wd), 'i dati dell\'esempio non finiscono tra quelli di Wikidata');
  // dal Menu: esempio ed Esci
  await p.click('.gd-skip'); await wait(300);
  await p.evaluate(() => window.NLGuida.esempio()); await wait(500);
  assert(await p.evaluate(() => !!document.querySelector('#exBar') && !document.getElementById('exBar').hidden && !document.querySelector('#exBar [data-ex="guide"]')), 'esempio dal Menu senza «‹ Guida»');
  await p.evaluate(() => document.querySelector('#exBar [data-ex="out"]').click()); await wait(400);
  assert(await p.evaluate(() => !window.NL.esempio() && document.getElementById('exBar').hidden), 'Esci');

  assert.deepStrictEqual(errors, []);
  console.log('e2e123 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
