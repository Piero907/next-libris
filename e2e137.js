const CFG = require("./_config");
const H = require('./_harness');
// moduli: guida
// Stile G «Pagina con l'Indice» (Piero, 20/11/2026): l'app si adatta a tutti i telefoni. Alle 5 misure più comuni (360×640, 375×667, 390×844,
// 412×915, 430×932), al tablet (768×1024) e al PC (1280×800): niente scorrimento di lato; testatina, titolo, nastro con il numero giusto,
// frase in prosa con la capolettera; ricerca, ordine, filtri e copertine/elenco dentro lo schermo; linguette visibili e toccabili;
// «+ Aggiungi» dentro lo schermo; Aspetto › «Nastro e linguette a sinistra»; pagina del libro e profilo non finiscono sotto le linguette; Indice dalla testatina; tema scuro.
const puppeteer = require('puppeteer-core');
const assert = require('assert');
const path = require('path');
const server = H.serve(CFG.port(8337), CFG.APP);
const APP = 'http://localhost:' + CFG.port(8337);
const wait = H.wait;
const B = (id, t, a, o) => Object.assign({ id, t, a, g: [], ts: 100 - +id.slice(1) }, o || {});
const MIEI = { books: [B('m1', 'Il fu Mattia Pascal', 'Luigi Pirandello', { rs: 'in' }), B('m2', 'Il barone rampante', 'Italo Calvino'), B('m3', 'Lessico famigliare', 'Natalia Ginzburg'),
  B('m4', 'La coscienza di Zeno', 'Italo Svevo'), B('m5', 'Il Gattopardo', 'Giuseppe Tomasi di Lampedusa'), B('m6', 'Cent’anni di solitudine', 'Gabriel García Márquez'),
  B('m7', 'Se una notte d’inverno un viaggiatore', 'Italo Calvino'), B('w1', 'Anna Karenina', 'Lev Tolstoj', { w: true }), B('w2', 'Il nome della rosa', 'Umberto Eco', { w: true })], updated: 5 };
const SIZES = [[360, 640], [375, 667], [390, 844], [412, 915], [430, 932], [768, 1024], [1280, 800]];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  for (const [w, h] of SIZES) {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    const phone = w < 700;
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
    p.on('pageerror', e => errors.push(w + ': ' + e.message));
    await p.setRequestInterception(true);
    p.on('request', r => { const u = r.url(); if (u.startsWith('http://localhost') || u.startsWith('data:')) return r.continue(); r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }); });
    await p.evaluateOnNewDocument((s) => { if (!localStorage.getItem('catalogo-libri-v2')) { localStorage.setItem('catalogo-libri-v2', s); localStorage.setItem('catalogo-libri-card', JSON.stringify({ v: 'd' })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ look: 'nuovo', welcomed: 1, donSeen: 1, viewDef: 'grid', wn2: 1 })); } }, JSON.stringify(MIEI));
    await p.goto(APP + '/', { waitUntil: 'load' }); await wait(1400);
    await p.evaluate(() => window.NLLayout && window.NLLayout.set('a')); await wait(300);   // fuori dalle prove la disposizione è sempre la A
    await wait(100); await p.evaluate(() => { document.querySelectorAll('.pu-ask, #instCard, .don-ask, #notice').forEach(x => { x.hidden = true; x.style.display = 'none'; }); document.querySelectorAll('.sheet:not([hidden])').forEach(x => { x.hidden = true; }); });
    const tag = w + '×' + h;
    const r = await p.evaluate(() => {
      const box = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height, vis: !!e.getClientRects().length && getComputedStyle(e).display !== 'none' }; };
      const tabs = [...document.querySelectorAll('#gTabs [data-g]')].map(b => { const x = b.getBoundingClientRect(); return { g: b.dataset.g, r: x.right, b: x.bottom, on: b.classList.contains('on') }; });
      return { g: document.documentElement.classList.contains('g-look'), side: document.scrollingElement.scrollWidth - innerWidth, W: innerWidth, H: innerHeight,
        rib: (document.querySelector('#gRib b') || {}).textContent, title: (document.querySelector('header.top h1 .g-t') || {}).textContent, prose: (document.getElementById('gProse') || {}).textContent || '',
        dc: !!document.querySelector('#gProse .g-dc'), run: (document.getElementById('gRun') || {}).textContent, tabs, tabsBox: box('#gTabs'),
        q: box('#q'), sort: box('#sortBar'), view: box('#btnView'), filt: box('#btnFilters'), add: box('#gAdd'), menu: box('#gMenu'), nav: box('#layNav') };
    });
    console.log('[' + tag + ']', JSON.stringify({ rib: r.rib, title: r.title, prose: r.prose, view: r.view && Math.round(r.view.r), tabsL: r.tabsBox && Math.round(r.tabsBox.l), add: r.add && Math.round(r.add.b) }));
    assert(r.g, tag + ': stile G acceso');
    assert(r.side <= 0, tag + ': niente scorrimento di lato (' + r.side + ')');
    assert.strictEqual(r.rib, '7', tag + ': il nastro conta i libri della libreria');
    assert.strictEqual(r.title, 'Libreria', tag + ': titolo');
    assert(/Stai leggendo Il fu Mattia Pascal/.test(r.prose) && !r.dc, tag + ': frase in prosa senza capolettera');
    assert.strictEqual(r.run, 'Next Libris', tag + ': testatina');
    assert(!r.nav || !r.nav.vis, tag + ': niente barra in basso');
    assert.strictEqual(r.tabs.length, 6, tag + ': sei linguette (con la Chat dal 20/11/2026)');
    assert(r.tabs.every(t => t.r <= r.W + 0.5 && t.b <= r.H + 0.5), tag + ': linguette dentro lo schermo ' + JSON.stringify(r.tabs));
    assert(r.tabs.find(t => t.g === 'lib').on, tag + ': linguetta Libri accesa');
    const lim = r.tabsBox.l + 0.5;   // tutto quello della pagina sta a sinistra delle linguette
    for (const k of ['q', 'sort', 'view', 'filt', 'menu']) assert(r[k] && r[k].vis && r[k].r <= lim && r[k].l >= -0.5, tag + ': ' + k + ' dentro lo schermo e prima delle linguette ' + JSON.stringify(r[k]));
    assert(r.add.vis && r.add.b <= r.H + 0.5 && r.add.r <= lim, tag + ': «+ Aggiungi» dentro lo schermo');
    if (w === 390 || w === 360) await p.screenshot({ path: path.join(CFG.OUT, 'e2e137-' + w + '.png') });
    // Desideri dalla linguetta
    await p.evaluate(() => document.querySelector('#gTabs [data-g="wish"]').click()); await wait(400);
    const d = await p.evaluate(() => ({ t: document.querySelector('header.top h1 .g-t').textContent, rib: document.querySelector('#gRib b').textContent, heart: !!document.querySelector('#gRib svg'), on: document.querySelector('#gTabs [data-g="wish"]').classList.contains('on') }));
    assert(d.t === 'Desideri' && d.rib === '2' && d.heart && d.on, tag + ': Desideri ' + JSON.stringify(d));
    await p.evaluate(() => document.querySelector('#gTabs [data-g="lib"]').click()); await wait(400);
    // pagina del libro: non finisce sotto le linguette
    await p.evaluate(() => window.NL.showBook('m2')); await wait(900);
    const bk = await p.evaluate(() => { const e = document.querySelector('.row.open.cv-full'); const t = document.getElementById('gTabs').getBoundingClientRect(); if (!e) return null; const kids = [...e.children].filter(k => k.getClientRects().length); const r = Math.max(...kids.map(k => k.getBoundingClientRect().right)); return { r, tl: t.left, side: e.scrollWidth - e.clientWidth }; });
    assert(bk && bk.r <= bk.tl + 0.5 && bk.side <= 0, tag + ': pagina del libro accanto alle linguette ' + JSON.stringify(bk));
    if (w === 360) await p.screenshot({ path: path.join(CFG.OUT, 'e2e137-360-libro.png') });
    await p.evaluate(() => { const c = document.querySelector('.row.open .chev-btn'); if (c) c.click(); }); await wait(500);
    // Tu: il profilo con l'ex libris
    await p.evaluate(() => document.querySelector('#gTabs [data-g="prof"]').click()); await wait(900);
    const pf = await p.evaluate(() => { const s = document.getElementById('profSheet'); if (!s || s.hidden) return null; const id = s.querySelector('.pf-id'); const t = document.getElementById('gTabs').getBoundingClientRect(), b = { right: Math.max(...[...s.querySelectorAll('.pf-card, .fr-sec')].map(k => k.getBoundingClientRect().right)) };
      return { ex: id ? getComputedStyle(id, '::before').content : '', r: b.right, tl: t.left, on: document.querySelector('#gTabs [data-g="prof"]').classList.contains('on'), add: getComputedStyle(document.getElementById('gAdd')).display }; });
    assert(pf && /EX LIBRIS/.test(pf.ex) && pf.r <= pf.tl + 0.5 && pf.on && pf.add === 'none', tag + ': profilo ' + JSON.stringify(pf));
    await p.evaluate(() => document.querySelector('#gTabs [data-g="lib"]').click()); await wait(600);
    assert(await p.evaluate(() => document.getElementById('profSheet').hidden), tag + ': Libri chiude il profilo');
    // Indice dalla testatina
    await p.evaluate(() => document.getElementById('gMenu').click()); await wait(700);
    const ix = await p.evaluate(() => ({ h: document.getElementById('drawerH').textContent, open: !document.getElementById('drawer').hidden, cap: [...document.querySelectorAll('#drawerOpts>h3, #drawerOpts .dset-t')].map(e => getComputedStyle(e, '::before').content) }));
    assert(ix.h === 'Indice' && ix.open && ix.cap.length >= 3 && ix.cap.every(c => /counter|"\d"/.test(c) || c !== 'none'), tag + ': Indice ' + JSON.stringify(ix));
    await p.evaluate(() => window.__app.closeDrawer()); await wait(400);
    // Per te dalla linguetta
    await p.evaluate(() => document.querySelector('#gTabs [data-g="you"]').click()); await wait(600);
    assert(await p.evaluate(() => !document.getElementById('layYou').hidden && document.querySelector('#gTabs [data-g="you"]').classList.contains('on')), tag + ': Per te');
    await p.evaluate(() => document.querySelector('#gTabs [data-g="lib"]').click()); await wait(400);
    // tema scuro: il nastro prende l'accento della tavolozza
    if (w === 390) {
      await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark')); await wait(200);
      const dk = await p.evaluate(() => ({ rib: getComputedStyle(document.getElementById('gRib')).backgroundColor, acc: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() }));
      console.log('[scuro]', JSON.stringify(dk));
      await p.screenshot({ path: path.join(CFG.OUT, 'e2e137-390-scuro.png') });
    }
    // Aspetto › «Nastro e linguette a sinistra» (Piero, 20/11/2026)
    if (w === 360 || w === 390 || w === 1280) {
      await p.evaluate(() => document.getElementById('optGLeft').click()); await wait(300);
      const L = await p.evaluate(() => { const bx = (s) => document.querySelector(s).getBoundingClientRect(); const t = bx('#gTabs'), q = bx('#q'), r = bx('#gRib'), h = bx('header.top h1 .g-t'), a = bx('#gAdd');
        return { left: document.documentElement.classList.contains('g-left'), saved: !!window.NL.settings.gLeft, side: document.scrollingElement.scrollWidth - innerWidth, tl: t.left, tr: t.right, ql: q.left, qr: q.right, rr: r.right, hl: h.left, al: a.left, W: innerWidth }; });
      console.log('[' + tag + ' sinistra]', JSON.stringify(L));
      assert(L.left && L.saved && L.side <= 0, tag + ': linguette a sinistra salvate');
      assert(L.ql >= L.tr - 0.5 && L.qr <= L.W + 0.5 && L.hl >= L.rr - 0.5 && L.al >= L.tr - 0.5, tag + ': a sinistra niente sotto le linguette e titolo accanto al nastro ' + JSON.stringify(L));
      if (w < 700) assert(L.tl <= 0.5, tag + ': linguette sul bordo sinistro');
      await p.evaluate(() => window.NL.showBook('m2')); await wait(800);
      const bl = await p.evaluate(() => { const e = document.querySelector('.row.open.cv-full'); const t = document.getElementById('gTabs').getBoundingClientRect(); const kids = [...e.children].filter(k => k.getClientRects().length); return { l: Math.min(...kids.map(k => k.getBoundingClientRect().left)), tr: t.right, side: e.scrollWidth - e.clientWidth }; });
      assert(bl.l >= bl.tr - 0.5 && bl.side <= 0, tag + ': pagina del libro accanto alle linguette a sinistra ' + JSON.stringify(bl));
      if (w === 390) await p.screenshot({ path: path.join(CFG.OUT, 'e2e137-390-sinistra-libro.png') });
      await p.evaluate(() => { const c = document.querySelector('.row.open .chev-btn'); if (c) c.click(); }); await wait(500);
      if (w === 390) await p.screenshot({ path: path.join(CFG.OUT, 'e2e137-390-sinistra.png') });
      await p.evaluate(() => document.getElementById('optGLeft').click()); await wait(300);
      assert(await p.evaluate(() => !document.documentElement.classList.contains('g-left') && !window.NL.settings.gLeft), tag + ': di nuovo a destra');
    }
    await ctx.close();
  }
  assert.deepStrictEqual(errors, []);
  console.log('e2e137 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
