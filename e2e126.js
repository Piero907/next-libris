const CFG = require("./_config");
const H = require('./_harness');
// moduli: profilo
// Giro 7 (18/11/2026, scelte di Piero), nella copia di prova:
// 1) profilo più facile da trovare: foto tonda in testata, «Il mio profilo» in cima al Menu, «Profilo» nella barra in basso (tutti e tre da provare);
// 2) prezzi: niente somma in euro nel riepilogo e nelle statistiche, niente prezzo nella condivisione dei Desideri, niente colonna Prezzo nel PDF;
//    restano il campo «Costo» e la domanda del prezzo;
// 3) backup: promemoria dopo 45 giorni o dopo 20 libri nuovi (non prima).
const puppeteer = require('puppeteer-core');
const assert = require('assert');
const server = H.serve(CFG.port(8326), CFG.APP);
const APP = 'http://localhost:' + CFG.port(8326);
const wait = H.wait;
const DAY = 864e5, NOW = Date.now();
function books(n, ts) { const out = []; for (let i = 0; i < n; i++) out.push({ id: 'b' + i, t: 'Libro ' + i, a: 'Autore ' + (i % 4), c: 10 + i, g: [], ts: ts + i, w: i === 0 }); return out; }
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  async function newPage(lib, set) {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: 360, height: 760, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    p.on('pageerror', e => errors.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', r => { const u = r.url(); if (u.startsWith('http://localhost') || u.startsWith('data:')) return r.continue(); r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }); });
    await p.evaluateOnNewDocument((l, s) => {
      if (localStorage.getItem('catalogo-libri-v2')) return;
      localStorage.setItem('catalogo-libri-v2', l); localStorage.setItem('catalogo-libri-set', s);
      localStorage.setItem('catalogo-libri-guida', JSON.stringify({ seen: 1, v: 9 }));
    }, JSON.stringify(lib), JSON.stringify(set));
    await p.goto(APP + '/', { waitUntil: 'load' }); await wait(1500);
    await p.evaluate(() => window.NLLayout && window.NLLayout.set('a')); await wait(300);
    return p;
  }
  const profOpen = (p) => p.evaluate(() => { const s = document.getElementById('profSheet'); return !!s && !s.hidden; });
  const closeAll = (p) => p.keyboard.press('Escape').then(() => wait(300));

  // ---- 1) profilo: testata, Menu, barra in basso ----
  let p = await newPage({ books: books(12, NOW - 100 * DAY), updated: NOW }, { name: 'Piero R.', installed: true, swiped: true, lastBackup: NOW });
  assert(await p.$('#owner #ownerAv .pf-av'), 'foto tonda in testata');
  await p.click('#ownerAv'); await wait(500);
  assert(await profOpen(p), 'la foto in testata apre il profilo');
  await closeAll(p);
  const nav = await p.evaluate(() => [...document.querySelectorAll('#layNav button')].map(b => b.dataset.l));
  assert.deepStrictEqual(nav, ['lib', 'wish', 'add', 'you', 'prof', 'menu'], 'Profilo nella barra in basso: ' + nav);
  const fit = await p.evaluate(() => [...document.querySelectorAll('#layNav button span')].every(s => s.scrollWidth <= s.parentNode.clientWidth + 1));
  assert(fit, 'le scritte della barra stanno nei tasti a 360');
  await p.click('#layNav [data-l="prof"]'); await wait(500);
  assert(await profOpen(p), '«Profilo» nella barra apre il profilo');
  await closeAll(p);
  await p.evaluate(() => window.NL.openMenu()); await wait(400);
  const mp = await p.evaluate(() => { const b = document.querySelector('#drawerOpts .dmain > button'); return b ? b.id + ':' + b.innerText.replace(/\s+/g, ' ') : ''; });
  assert(/^goProf:.*Il mio profilo/.test(mp), '«Il mio profilo» in cima al Menu: ' + mp);
  assert(!(await p.$('#friMenu #goProf')), 'non più sotto Amici');
  await p.evaluate(() => document.getElementById('goProf').click()); await wait(600);
  assert(await profOpen(p), 'dal Menu si apre il profilo');
  await closeAll(p);
  const wide = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(wide <= 0, 'niente scorrimento di lato a 360');
  await p.screenshot({ path: CFG.OUT + '/giro7-testata-barra-360.png' });

  // ---- 2) prezzi ----
  const sum = await p.evaluate(() => document.getElementById('summary').textContent);
  assert(!/€/.test(sum), 'riepilogo senza euro: ' + sum);
  assert(!(await p.$('#optSumEur')), 'niente opzione «Valore in euro»');
  await p.evaluate(() => openStats()); await wait(400);
  const stx = await p.evaluate(() => document.getElementById('statsBody').innerText);
  assert(!/valore di copertina|prezzo medio|€/.test(stx), 'statistiche senza soldi');
  await closeAll(p);
  const wt = await p.evaluate(() => wishText().text);
  assert(/Libro 0/.test(wt) && !/€|Totale/.test(wt), 'Desideri condivisi senza prezzo: ' + wt);
  const sh = await p.evaluate(() => { const o = window.L.buildShare([{ t: 'A', a: 'B', c: 12 }], {}); return JSON.stringify(o); });
  assert(!/"c":/.test(sh), 'il prezzo non viaggia nel link');
  await p.evaluate(() => printCatalog()); await wait(400);
  const pv = await p.evaluate(() => document.getElementById('printView').innerText);
  assert(!/Prezzo|valore di copertina|€/.test(pv), 'PDF senza prezzi');
  assert(await p.evaluate(() => settings.price === true), 'la domanda del prezzo resta');
  await p.evaluate(() => window.NL.openCard('b3')); await wait(500);
  assert(await p.evaluate(() => !!document.querySelector('[data-id="b3"] [data-k="c"]')), 'il campo Costo resta nella scheda');
  await p.close();

  // ---- 3) backup: 45 giorni o 20 libri nuovi ----
  const cases = [
    ['ultimo backup 30 giorni fa, 5 libri nuovi', books(12, NOW - 100 * DAY).concat(books(5, NOW - 2 * DAY).map((b, i) => Object.assign(b, { id: 'n' + i, w: false }))), NOW - 30 * DAY, false],
    ['ultimo backup 46 giorni fa', books(12, NOW - 100 * DAY), NOW - 46 * DAY, true],
    ['ultimo backup 10 giorni fa, 20 libri nuovi', books(12, NOW - 100 * DAY).concat(books(20, NOW - 2 * DAY).map((b, i) => Object.assign(b, { id: 'n' + i, w: false }))), NOW - 10 * DAY, true]
  ];
  for (const [name, bs, last, due] of cases) {
    p = await newPage({ books: bs, updated: NOW }, { name: 'Piero R.', installed: true, swiped: true, lastBackup: last });
    const got = await p.evaluate(() => backupDue());
    assert.strictEqual(got, due, name);
    if (due) {
      await p.evaluate(() => checkBackupNag()); await wait(300);
      const n = await p.evaluate(() => ({ kind: noticeKind, txt: document.getElementById('notice').innerText }));
      assert(n.kind === 'backup' && /Fai il backup/.test(n.txt) && /con un tocco/.test(n.txt), 'avviso del backup: ' + JSON.stringify(n));
    }
    console.log('[backup]', name, '->', got);
    await p.close();
  }

  assert.deepStrictEqual(errors, []);
  console.log('e2e126 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
