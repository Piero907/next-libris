const CFG = require("./_config");
const H = require('./_harness');
// Schermi di misure diverse (16/11/2026): telefono piccolo, telefono, telefono sdraiato, tablet, PC.
// Sopra gli 880 px la «Pagina del libro» finiva schiacciata nella prima colonna della vecchia tabella: ora e' a tutta larghezza,
// su due colonne (copertina, dati e lettura a sinistra; descrizione a destra); la modifica (matita) resta in colonna come sul telefono;
// stile G (20/11/2026): sei segnalibri al posto della barra in basso, dentro lo schermo. Niente scorrimento orizzontale a nessuna misura.
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8194), ROOT);
const books = [{ id: 'r1', t: 'Il nome della rosa', a: 'Umberto Eco', e: 'Bompiani', y: '2012', pg: '624', c: 13, i: '9788845292613', rs: 'ok', rd: '2026-02-10', rt: 4, gen: 'Narrativa', sh: 'Studio', n: 'Regalo di Anna', fav: true, ts: 900, ds: 'Ultima settimana del novembre 1327: frate Guglielmo da Baskerville e il novizio Adso arrivano in un monastero benedettino. Una serie di morti misteriose sconvolge la vita dei monaci.', dsf: 'google' }]
  .concat(Array.from({ length: 14 }, (_, i) => ({ id: 'f' + i, t: 'Riempitivo ' + i, a: 'Autore ' + i, ts: 800 - i, rs: 'da' })));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [], wait = ms => new Promise(r => setTimeout(r, ms));
  const at = async (w, h, name, check) => {
    const ctx = await browser.createBrowserContext(), page = await ctx.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 800, hasTouch: w < 800 });
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith('http://localhost:' + CFG.port(8194)) ? r.continue() : r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }));
    await page.evaluateOnNewDocument(bk => { if (!localStorage.getItem('catalogo-libri-set')) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: bk, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ look: 'nuovo', seenV: 999, wn2: 1, swiped: true, name: 'P', selTip: 1, lastBackup: Date.now(), donUntil: Date.now() + 9e9, instSnooze: Date.now() + 9e9 })); localStorage.setItem('catalogo-libri-card', JSON.stringify({ v: 'd' })); localStorage.setItem('catalogo-libri-layout', JSON.stringify({ v: 'a' })); } }, books);
    await page.goto('http://localhost:' + CFG.port(8194) + '/?vista=elenco', { waitUntil: 'load' }); await wait(800);
    await page.evaluate(() => document.querySelector('#list .row[data-id="r1"] .sum').click()); await wait(450);
    const m = await page.evaluate(() => {
      const de = document.documentElement, r = document.querySelector('#list .row[data-id="r1"]'), R = r.getBoundingClientRect(), g = s => { const e = r.querySelector(s) || document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
      const pg = g('.cv-page'), hero = g('.cv-hero'), desc = g('.cv-desc'), read = g('.cv-readbox'), nav = g('#gTabs'), b = [...document.querySelectorAll('#gTabs [data-g]')].filter(x => x.getClientRects().length);   // stile G: segnalibri al posto della barra in basso
      return { hscroll: de.scrollWidth > de.clientWidth, rowW: Math.round(R.width), pageW: Math.round(pg.width), twoCols: desc.left >= hero.right - 1 && Math.abs(desc.top - hero.top) < 12, readUnderHero: read.top >= hero.bottom - 1 && Math.abs(read.left - hero.left) < 2,
        out: [...r.querySelectorAll('*')].filter(e => { const x = e.getBoundingClientRect(); return x.width > 0 && (x.right > R.right + 1 || x.left < R.left - 1); }).length,
        order: [...r.children].filter(e => e.getClientRects().length).map(e => (e.className || '').split(' ')[0]).join(' '), visOrder: [...r.children].filter(e => e.getClientRects().length).sort((a, c) => a.getBoundingClientRect().top - c.getBoundingClientRect().top).map(e => (e.className || '').split(' ')[0]).join(' '),
        lbl: [...r.querySelectorAll('.cv-readbox>.lbl')].some(e => e.getClientRects().length), tabs: b.length, tabsIn: b.every(x => { const q = x.getBoundingClientRect(); return q.top >= 0 && q.bottom <= innerHeight + 1; }), topLeft: Math.round(g('.acts-main').left - pg.left) };
    });
    // la matita: campi in colonna, niente tabella
    await page.evaluate(() => document.querySelector('#list .row[data-id="r1"] .cv-editb').click()); await wait(400);
    const ed = await page.evaluate(() => { const r = document.querySelector('#list .row[data-id="r1"]'), R = r.getBoundingClientRect(), t = r.querySelector('[data-k="t"]').getBoundingClientRect(), a = r.querySelector('.f.au-view, [data-k="a"]').getBoundingClientRect(), e = r.querySelector('[data-k="e"]').getBoundingClientRect();
      return { stacked: a.top >= t.bottom - 1 && e.top >= a.bottom - 1, titleW: Math.round(t.width), out: [...r.querySelectorAll('*')].filter(x => { const q = x.getBoundingClientRect(); return q.width > 0 && q.right > R.right + 1; }).length, done: !!r.querySelector('.cv-page .cv-hero [data-k="t"]') && !r.querySelector('.cv-done') }; });
    console.log('[' + name + ' ' + w + '×' + h + ']', JSON.stringify(m), JSON.stringify(ed));
    await page.screenshot({ path: CFG.OUT + '/schermo_' + name + '.png' });
    assert(!m.hscroll, name + ': niente scorrimento orizzontale'); assert.strictEqual(m.out, 0, name + ': niente fuori dalla scheda'); assert.strictEqual(m.order, m.visOrder, name + ': stesso ordine del telefono');
    assert(m.pageW > Math.min(m.rowW - 60, 560), name + ': la pagina del libro usa tutta la larghezza, al massimo 600 px come il profilo (' + m.pageW + ' di ' + m.rowW + ')');   // restyle pezzo 2: pagina intera in una colonna assert(!m.lbl); assert(Math.abs(m.topLeft) < 3, name + ': icone in alto allineate');
    assert(ed.stacked && ed.out === 0 && ed.done && ed.titleW > 150, name + ': modifica nella pagina');
    check(m); await ctx.close();
  };
  const g6 = (name) => m => { assert(!m.twoCols && m.tabs === 7, name + ': sette segnalibri'); };   // stile G: la barra in basso non c'è più
  await at(360, 740, 'tel_piccolo', g6('tel_piccolo'));
  await at(412, 915, 'telefono', g6('telefono'));
  await at(780, 360, 'tel_sdraiato', m => { assert(!m.twoCols && m.readUnderHero && m.tabs === 7); });
  await at(768, 1024, 'tablet', m => { assert(!m.twoCols && m.readUnderHero && m.tabs === 7 && m.tabsIn); });
  await at(1366, 768, 'pc', m => { assert(!m.twoCols && m.readUnderHero && m.tabs === 7 && m.tabsIn, 'una colonna e segnalibri'); });
  await at(1920, 1080, 'pc_grande', m => { assert(!m.twoCols && m.tabs === 7 && m.tabsIn); });
  assert.deepStrictEqual(errors, []);
  console.log('e2e74 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
