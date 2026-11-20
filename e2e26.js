const CFG = require("./_config");
const H = require('./_harness');
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8139), ROOT);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await browser.newPage();
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem('catalogo-libri-set', JSON.stringify({ installed: true, instScope: '/', swiped: true, lastBackup: Date.now(), price: false }));
    localStorage.setItem('catalogo-libri-v2', JSON.stringify({ updated: Date.now(), books: [
      { id: 'b1', t: 'Il deserto dei Tartari', a: 'Dino Buzzati', e: 'Mondadori', y: '2016', i: '9788804668015', ts: 5 },
      { id: 'b2', t: 'Il nome della rosa', a: 'Umberto Eco', c: 14, i: '9788845292613', ts: 4, p: 'Marco', pd: '2026-10-01' },
      { id: 'b5', t: 'Venduto', a: 'X', c: 3, i: '9788817050562', ts: 3, xs: 'v', xd: '2026-09-01' },
      { id: 'b4', t: '', a: '', i: '9788807881213', ts: 2, nf: true },
      { id: 'b3', t: 'Le città invisibili', a: 'Italo Calvino', i: '9788804668022', ts: 1, w: true } ] }));
  });
  await p.setViewport({ width: 360, height: 800, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.setRequestInterception(true); p.on('request', r => r.url().startsWith('http://localhost:' + CFG.port(8139) + '') ? r.continue() : r.abort());
  await p.goto('http://localhost:' + CFG.port(8139) + '/?vista=elenco', { waitUntil: 'load' }); await new Promise(r => setTimeout(r, 400));
  const wait = H.wait;   // attesa «finché» (_harness.js)
  // pagina del libro (20/11/2026: la scheda «Classica» non c'è più): tasti tondi sotto il titolo, riquadro Prestito, «Cerca sul web» e «Cerca di nuovo» nel ⋯
  async function card(id) {
    await p.evaluate(() => { const b = document.querySelector('#list .row.open.cv-full .cv-back'); if (b) b.click(); }); await wait(300);
    await p.evaluate(id => { const s = document.querySelector('#list .row[data-id="' + id + '"] .sum'); if (s) s.click(); }, id); await wait(300);
    return p.evaluate(id => {
      const r = document.querySelector('#list .row[data-id="' + id + '"]');
      const vis = b => b.getClientRects().length > 0;
      const lab = sel => [...r.querySelectorAll(sel)].filter(vis).map(b => b.getAttribute('aria-label') || b.textContent.trim());
      return { page: r.classList.contains('cv-full'), main: lab('.acts-main button'), loan: lab('.cv-loan button'), more: [...r.querySelectorAll('.cv-popi, .cv-pop button')].map(b => b.dataset.act), back: lab('.cv-back'),
        over: r.scrollWidth - r.clientWidth, out: [...r.querySelectorAll('.acts-main button')].filter(vis).some(b => b.getBoundingClientRect().right > innerWidth + 1) };
    }, id);
  }
  let c = await card('b1'); console.log('[libro]', JSON.stringify(c));
  const TONDI = ['Lo consiglio: gli amici lo vedono nel tuo profilo', 'Sposta nei Desideri', 'Manda questo libro a un amico', 'Modifica i dati del libro', 'Elimina il libro'];
  assert(c.page && c.back.length === 1, 'pagina a tutto schermo con ‹');
  assert.deepStrictEqual(c.main, TONDI, 'tasti tondi: stella, desideri, condividi, matita, elimina');
  assert.deepStrictEqual(c.loan, ['Presta, vendi o regala il libro']); assert.deepStrictEqual(c.more, ['websearch'], '«Cerca sul web» nel ⋯');
  assert(c.over <= 0 && !c.out, 'niente esce dalla pagina');
  c = await card('b2'); console.log('[prestato]', JSON.stringify(c.loan));
  assert(c.loan.length === 2 && /^È tornato/.test(c.loan[0]) && /^Prestato a Marco/.test(c.loan[1])); assert.deepStrictEqual(c.main, TONDI);
  c = await card('b5'); console.log('[venduto]', JSON.stringify(c.loan));
  assert(/^Venduto/.test(c.loan[0]));
  c = await card('b4'); console.log('[non trovato]', JSON.stringify(c.more));
  assert.deepStrictEqual(c.more, ['lookup', 'websearch'], '«Cerca di nuovo» e «Cerca sul web» nel ⋯'); assert(c.over <= 0);
  await p.evaluate(() => { const b = document.querySelector('#list .row.open.cv-full .cv-back'); if (b) b.click(); }); await wait(300);
  await p.evaluate(() => window.__app.setTab('wish')); await wait(200);
  c = await card('b3'); console.log('[desideri]', JSON.stringify(c.main));
  assert.deepStrictEqual(c.main, ['Sposta in Libreria (l\'ho comprato)', 'Manda questo libro a un amico', 'Modifica i dati del libro', 'Elimina il libro']);
  assert.deepStrictEqual(errors, []);
  console.log('e2e26 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
