const CFG = require("./_config");
const H = require('./_harness');
// Schermate della pagina Suggerimenti e dell'anteprima a tutte le misure (360, 375, 390, 412 scuro, 430, 768, 1280; segnalibri a sinistra a 390),
// con amici finti. Controlla: niente scorrimento di lato, pagina e anteprima fuori dai segnalibri e dentro lo schermo, scaffali che non escono.
const puppeteer = require('puppeteer-core');
const server = H.serve(CFG.port(8346), CFG.APP);
const now = Date.now();
const books = [
  { id: 'm1', t: 'Il barone rampante', a: 'Italo Calvino', rs: 'ok', rt: 5, ts: now },
  { id: 'm2', t: 'Il visconte dimezzato', a: 'Italo Calvino', rs: 'ok', rt: 4, ts: now, se: 'I nostri antenati', sn: '1', sq: '3' },
  { id: 'm3', t: 'Il cavaliere inesistente con un titolo molto lungo per vedere come va a capo', a: 'Italo Calvino', rs: 'da', ts: now, se: 'I nostri antenati', sn: '3', sq: '3', pg: '180' },
];
const RPC = { amici: [{ id: 'u-marta', utente: 'Marta Bianchi Rossi', comuni: 7 }, { id: 'u-luca', utente: 'Luca', comuni: 2 }],
  libri: [
    { amico: 'u-luca', id: 'l1', t: 'La storia', a: 'Elsa Morante', rt: 5 },
    { amico: 'u-marta', id: 'k1', t: 'La Storia', a: 'Elsa Morante', rt: 4, lc: true, fuori: true },
    { amico: 'u-marta', id: 'k2', t: 'Le otto montagne', a: 'Paolo Cognetti', rt: 5 },
    { amico: 'u-luca', id: 'l2', t: 'Il deserto dei Tartari', a: 'Dino Buzzati', lc: true },
    { amico: 'u-luca', id: 'l3', t: 'Cent\'anni di solitudine, edizione speciale con un titolo lunghissimo', a: 'Gabriel García Márquez', rt: 5 },
    { amico: 'u-luca', id: 'l4', t: 'Lessico famigliare', a: 'Natalia Ginzburg', rt: 4 },
  ] };
const SIZES = [[360, 640], [375, 667], [390, 844], [412, 915, 'dark'], [430, 932], [768, 1024], [1280, 800], [390, 844, 'left']];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const bad = [];
  for (const [w, h, mode] of SIZES) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith('http://localhost:' + CFG.port(8346)) ? r.continue() : r.respond({ status: 404, body: '' }));
    await page.goto('http://localhost:' + CFG.port(8346) + '/', { waitUntil: 'load' });
    await page.evaluate((b, mode) => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/^catalogo-libri-v2$/.test(k)) return; return o.call(this, k, v); };
      o.call(localStorage, 'catalogo-libri-v2', JSON.stringify({ books: b, updated: Date.now() }));
      o.call(localStorage, 'catalogo-libri-set', JSON.stringify(Object.assign({ swiped: true, name: 'P', selTip: 1, lastBackup: Date.now(), donUntil: Date.now() + 9e9, suggAuto: false }, mode === 'dark' ? { theme: 'dark', themeV2: true } : {}, mode === 'left' ? { gLeft: true } : {}))); }, books, mode);
    await page.reload({ waitUntil: 'load' }); await H.wait(700);
    await page.evaluate(R => { const A = window.NLAmici; A.uid = () => 'u-me'; A.state = () => ({ list: [{ id: 'u-marta', stato: 'amici' }], asks: [] }); A.rpc = async () => JSON.parse(JSON.stringify(R));
      window.NLGratis.free = () => ({ mine: [], other: [{ t: 'Le città invisibili (esempio)', a: 'Italo Calvino', u: 'https://it.wikisource.org/' }] }); }, RPC);
    await page.evaluate(() => window.__app.openSugg('you')); await H.wait(600);
    const tag = w + 'x' + h + (mode ? '-' + mode : '');
    const chk = async (what) => page.evaluate((what) => {
      const out = [], vw = document.documentElement.clientWidth, vh = innerHeight;
      if (document.documentElement.scrollWidth > vw + 1) out.push('pagina più larga dello schermo');
      const tabs = document.getElementById('gTabs'), tr = tabs && tabs.getBoundingClientRect();
      const pg = document.querySelector(what === 'prev' ? '#sgPrev .sheet-in' : '#suggSheet .sheet-in'); const r = pg.getBoundingClientRect();
      if (r.left < -1 || r.right > vw + 1) out.push('fuori dallo schermo ' + Math.round(r.left) + '-' + Math.round(r.right));
      if (tr && tr.width && r.right > tr.left + 1 && r.left < tr.right - 1) out.push('sotto i segnalibri: pagina ' + Math.round(r.left) + '-' + Math.round(r.right) + ', segnalibri ' + Math.round(tr.left) + '-' + Math.round(tr.right));
      if (pg.scrollWidth > pg.clientWidth + 1) out.push('scorre di lato (' + pg.scrollWidth + '>' + pg.clientWidth + ')');
      if (what !== 'prev') {
        document.querySelectorAll('#suggSheet .sg-row').forEach(row => { const rr = row.getBoundingClientRect(); if (rr.right > r.right + 1) out.push('scaffale esce a destra'); });
        const ti = document.querySelector('#suggSheet .sg-top'); if (ti && ti.scrollWidth > ti.clientWidth + 1) out.push('titolo tagliato');
        document.querySelectorAll('#suggSheet .nx-btns .btn, #suggSheet .sg-nofri').forEach(b => { if (b.scrollWidth > b.clientWidth + 1) out.push('testo che esce: ' + b.innerText.slice(0, 20)); });
      } else document.querySelectorAll('#sgPrev .btn').forEach(b => { if (b.scrollWidth > b.clientWidth + 1) out.push('tasto stretto: ' + b.innerText); });
      return out;
    }, what);
    let p = await chk('page'); if (p.length) bad.push(tag + ' pagina: ' + p.join('; '));
    await page.screenshot({ path: CFG.OUT + '/sg_' + tag + '.png' });
    await page.evaluate(() => document.querySelector('#suggSheet .sheet-in').scrollTop = 520); await H.wait(150);
    await page.screenshot({ path: CFG.OUT + '/sg_' + tag + '_giu.png' });
    await page.evaluate(() => document.querySelector('[data-shelf="fri"] [data-sg]').click()); await H.wait(300);
    p = await chk('prev'); if (p.length) bad.push(tag + ' anteprima: ' + p.join('; '));
    await page.screenshot({ path: CFG.OUT + '/sg_' + tag + '_prev.png' });
    if (errors.length) bad.push(tag + ' errori: ' + errors.join(' | '));
    console.log(tag, 'ok');
    await page.close();
  }
  console.log(bad.length ? 'PROBLEMI:\n' + bad.join('\n') : 'tutto a posto');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
