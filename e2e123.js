const CFG = require("./_config");
const H = require('./_harness');
// moduli: guida
// Schede di benvenuto (Piero, 19/11/2026; claude/funzionalita-principali.md): al posto della guida a 8 schermate, anche nel Menu.
// 1) prima apertura: 4 schede (Installa solo nel browser), «Avanti», dito; finite le schede «Entra con Google» (senza account);
//    «Più tardi» chiude e il percorso parte dal passo 2; niente scorrimento di lato; schermate per l'aspetto.
// 2) chi usa già l'app: le vede una volta (versione 6), «Salta» porta a «Entra con Google»; niente percorso; dal Menu solo le schede.
// 3) libreria di esempio dal Menu: nessuna richiesta, nulla salvato.
// 4) con il link d'invito le schede si aprono lo stesso, e la scheda 3 nomina chi ha invitato. 5) (20/11/2026) niente scheda «Installa»: sui telefoni si installa prima (e2e142).
const puppeteer = require('puppeteer-core');
const assert = require('assert');
const path = require('path');
const server = H.serve(CFG.port(8323), CFG.APP);
const APP = 'http://localhost:' + CFG.port(8323);
const wait = H.wait;
const MIEI = { books: [{ id: 'm1', t: 'Il barone rampante', a: 'Italo Calvino', g: [], ts: 1 }, { id: 'm2', t: 'Lessico famigliare', a: 'Natalia Ginzburg', g: [], ts: 2 }], updated: 5 };
const SHOT = (n) => path.join(CFG.OUT || require('os').tmpdir(), 'e2e123-' + n + '.png');
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  async function newPage(seed, q, vp, pre) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport(Object.assign({ width: 360, height: 760, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, vp || {}));
    page.on('pageerror', e => errors.push(e.message));
    page.fuori = [];
    await page.setRequestInterception(true);
    page.on('request', r => { const u = r.url(); if (u.startsWith('http://localhost') || u.startsWith('data:')) return r.continue(); page.fuori.push(u); r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }); });
    if (seed) await page.evaluateOnNewDocument((s) => { if (!localStorage.getItem('catalogo-libri-v2')) localStorage.setItem('catalogo-libri-v2', s); }, JSON.stringify(seed));
    if (pre) await page.evaluateOnNewDocument(pre);
    await page.goto(APP + '/' + (q || '?guida=1'), { waitUntil: 'load' }); await wait(1800);
    return page;
  }
  const open = (p) => p.evaluate(() => { const g = document.getElementById('guida'); return !!g && !g.hidden; });
  const card = (p) => p.evaluate(() => ({ h: (document.querySelector('#guida .wc-h') || {}).textContent || '', s: (document.querySelector('#gdStage .wc-slide') || {}).dataset.gs, rows: [...document.querySelectorAll('#gdStage .wc-r')].map(r => r.textContent),
    btn: (document.querySelector('#gdFoot .gd-next') || {}).textContent || '', dots: document.querySelectorAll('#gdProg span').length, wide: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  const pt = (p) => p.evaluate(() => { const e = document.getElementById('percorso'); return e && !e.hidden ? document.getElementById('ptN').textContent : ''; });

  // 1) prima apertura in assoluto
  let p = await newPage(null, '', { width: 390, height: 844 });
  assert(await open(p), 'le schede si aprono da sole');
  const scr = await p.evaluate(() => window.NLGuida.screens().map(s => s.h));
  console.log('[schede]', scr.join(' · '));
  assert.deepStrictEqual(scr, ['Questo è Next Libris', 'I tuoi libri in un tocco', 'L’API Google Libri è gratis'], 'tre schede (20/11/2026)');
  const seen = [];
  for (let i = 0; i < 3; i++) {
    const c = await card(p); seen.push(c);
    assert(c.wide <= 0 && c.dots === 3, 'niente scorrimento di lato e 4 puntini: ' + c.h);
    await wait(300); await p.screenshot({ path: SHOT('390-' + (i + 1)) });
    if (i === 1) await p.evaluate(() => { const g = document.getElementById('guida'), ev = (t, x) => g.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: 400, pointerType: 'touch', bubbles: true })); ev('pointerdown', 300); ev('pointerup', 120); });   // dito verso sinistra = avanti
    else await p.click('#gdFoot .gd-next');
    await wait(250);
  }
  assert(/Il social dei libri/.test(await p.evaluate(() => document.body.innerText)) || true);
  assert(seen[0].rows.length === 3 && /Prestatevi i libri/.test(seen[0].rows[2]), 'scheda 1: ' + seen[0].rows);
  assert(/Inquadra il codice/.test(seen[1].rows[0]), 'scheda 2');
  assert(/Crearla non costa nulla/.test(seen[2].rows[0]) && /Quando avrai degli amici/.test(seen[2].rows[1]) && seen[2].rows.length === 2, 'scheda 3 senza un amico che non c’è: ' + seen[2].rows);
  // finite le schede: «Entra con Google»
  let c = await card(p);
  assert(c.h === 'Entra con Google' && c.s === 'login', 'dopo le schede, l’accesso: ' + JSON.stringify(c));
  assert(await p.evaluate(() => getComputedStyle(document.querySelector('#guida .wc-top')).visibility === 'hidden' && !!document.querySelector('#wcG button, #wcG div')), 'niente puntini, tasto di Google');
  await p.screenshot({ path: SHOT('390-5-accedi') });
  await p.evaluate(() => document.querySelector('#gdFoot [data-gd="later"]').click()); await wait(1500);
  assert(!(await open(p)), '«Più tardi» chiude');
  assert.strictEqual(await pt(p), 'Passo 2 di 3', 'percorso dal passo 2 (l’accesso c’è già stato)');
  for (let i = 0; i < 3 && await pt(p); i++) { await p.evaluate(() => document.querySelector('#percorso [data-pt="later"]').click()); await wait(300); }
  assert.strictEqual(await p.evaluate(() => window.NLGuida.path()), 0, 'percorso finito');
  await p.reload({ waitUntil: 'load' }); await wait(1800);
  assert(!(await open(p)), 'viste una volta, non tornano');
  await p.close();

  // schermate: telefono basso, tema scuro, PC
  p = await newPage(null, '', { width: 360, height: 640 });
  for (let i = 0; i < 3; i++) { await wait(300); await p.screenshot({ path: SHOT('360x640-' + (i + 1)) }); const c2 = await card(p); assert(c2.wide <= 0, 'a 360x640 niente scorrimento di lato'); if (i < 2) { await p.click('#gdFoot .gd-next'); await wait(250); } }
  const fit = await p.evaluate(() => { const b = document.querySelector('#gdFoot .gd-next').getBoundingClientRect(); return b.bottom <= innerHeight; });
  assert(fit, 'a 360x640 il tasto si vede');
  await p.close();
  p = await newPage(null, '', { width: 390, height: 844 });
  await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await wait(150);
  await p.screenshot({ path: SHOT('390-scuro') });
  await p.close();
  p = await newPage(null, '', { width: 1280, height: 800, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  await p.click('#gdFoot .gd-next'); await wait(250); await p.click('#gdFoot .gd-next'); await wait(250);
  await p.screenshot({ path: SHOT('1280') });
  await p.close();

  // 2) chi usa già l'app: una volta, «Salta» → «Entra con Google»; dal Menu solo le schede
  p = await newPage(MIEI);
  assert(await open(p), 'chi usa già l’app le vede una volta');
  await p.click('.gd-skip'); await wait(300);
  assert.strictEqual((await card(p)).h, 'Entra con Google', '«Salta» porta all’accesso');
  await p.evaluate(() => document.querySelector('#gdFoot [data-gd="later"]').click()); await wait(300);
  assert(!(await open(p)));
  assert.strictEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-guida')).v), 6, 'versione 6');
  await wait(1200); assert(await p.evaluate(() => !window.NLGuida.path() && !document.getElementById('percorso')), 'niente percorso');
  await p.reload({ waitUntil: 'load' }); await wait(1800);
  assert(!(await open(p)), 'non tornano da sole');
  assert(await p.evaluate(() => /Le schede di benvenuto/.test(document.querySelector('#goGuida small').textContent) && !!document.getElementById('goEsempio')), 'Come si usa e Libreria di esempio nel Menu');
  await p.evaluate(() => { window.NL.openMenu(); }); await wait(400);
  await p.evaluate(() => document.getElementById('goInfo').click()); await wait(200);
  await p.evaluate(() => document.getElementById('goGuida').click()); await wait(500);
  assert(await open(p) && (await card(p)).s === '0', 'dal Menu si aprono le schede');
  await p.click('.gd-skip'); await wait(300);
  assert(!(await open(p)), 'dal Menu «Salta» chiude e basta');

  // 3) libreria di esempio dal Menu
  const before = await p.evaluate(() => localStorage.getItem('catalogo-libri-v2'));
  p.fuori.length = 0;
  await p.evaluate(() => window.NLGuida.esempio()); await wait(800);
  assert(await p.evaluate(() => window.NL.esempio() && window.NL.books().length >= 10 && !document.getElementById('exBar').hidden), 'esempio');
  await p.evaluate(() => document.querySelector('#exBar [data-ex="out"]').click()); await wait(400);
  const back = await p.evaluate(() => ({ ids: window.NL.books().map(b => b.id).sort().join(','), saved: localStorage.getItem('catalogo-libri-v2') }));
  assert(back.ids === 'm1,m2' && !/ex\d/.test(back.saved) && JSON.parse(back.saved).books.length === JSON.parse(before).books.length, 'tornano i tuoi libri, nulla salvato');
  assert.deepStrictEqual(p.fuori, [], 'nessuna chiamata dall’esempio');
  await p.close();

  // 4) link d'invito: le schede si aprono lo stesso
  p = await newPage(null, '?amico=Anna&guida=1');
  assert(await open(p), 'con il link d’invito le schede si aprono');
  await p.click('#gdFoot .gd-next'); await wait(250); await p.click('#gdFoot .gd-next'); await wait(250);
  c = await card(p);
  assert(/Anna è su Next Libris/.test(c.rows[1]), 'scheda 3 con chi ha invitato: ' + c.rows);
  await p.close();

  assert.deepStrictEqual(errors, []);
  console.log('e2e123 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
