const CFG = require('./_config');
const H = require('./_harness');
// 20/11/2026 (scelte di Piero):
// - segnalibro «Indice» in cima ai segnalibri a lato, al posto del tasto ≡ della testatina: apre l'Indice con le Impostazioni,
//   resta acceso lui (non più «Tu»), un altro tocco lo richiude; sette segnalibri dentro lo schermo anche a 360×640 e 1280×720;
// - avviso del libro nella sua pagina: un libro senza titolo con «Senza connessione… Riprova ora» o «Non ho trovato questo libro
//   online» si apre a tutta pagina e l'avviso si legge lì (riquadro sotto i tasti tondi, testo intero, tasto al centro);
// - i messaggi dicono «Indice», non più «Menu».
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path'), assert = require('assert');
const server = H.serve(CFG.port(8339), CFG.APP);
const APP = 'http://localhost:' + CFG.port(8339);
const wait = H.wait;
const books = Array.from({ length: 6 }, (_, i) => ({ id: 'k' + i, t: 'Libro numero ' + i, a: 'Autore ' + i, ts: Date.now() - (i + 1) * 864e5 }));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const open = async (w, h) => {
    const p = await browser.newPage(); await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 700, hasTouch: w < 700 });
    p.on('pageerror', e => errors.push(e.message));
    await p.goto(APP + '/?vista=elenco', { waitUntil: 'load' });
    await p.evaluate((b) => { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: Date.now() })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'Piero', lastBackup: Date.now(), donUntil: Date.now() + 9e9, instSnooze: Date.now() })); localStorage.setItem('catalogo-libri-guida', JSON.stringify({ v: 99, path: 0 }));
      const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/^catalogo-libri-(v2|set|guida)$/.test(k)) return; return o.call(this, k, v); }; }, books);
    await p.reload({ waitUntil: 'load' }); await wait(900);
    await p.evaluate(() => { if (window.NLGuida && window.NLGuida.close) window.NLGuida.close(); document.querySelectorAll('.sheet:not([hidden])').forEach(x => { x.hidden = true; }); }); await wait(200);
    return p;
  };

  // 1) sette segnalibri, Indice in cima, dentro lo schermo a tutte le misure
  for (const [w, h] of [[360, 640], [360, 800], [412, 915], [768, 1024], [1280, 720], [1280, 800]]) {
    const p = await open(w, h);
    const t = await p.evaluate(() => ({ ids: [...document.querySelectorAll('#gTabs [data-g]')].map(b => b.dataset.g), lab: document.querySelector('#gTabs [data-g="idx"] span').textContent,
      bot: Math.max(...[...document.querySelectorAll('#gTabs [data-g]')].map(b => b.getBoundingClientRect().bottom)), top: document.querySelector('#gTabs [data-g="idx"]').getBoundingClientRect().top,
      hmin: Math.min(...[...document.querySelectorAll('#gTabs [data-g]')].map(b => b.getBoundingClientRect().height)), H: innerHeight, menu: !!document.getElementById('gMenu'), side: document.scrollingElement.scrollWidth - innerWidth,
      rib: document.getElementById('gRib').getBoundingClientRect().bottom }));
    console.log('[1 ' + w + 'x' + h + ']', JSON.stringify(t));
    assert.deepStrictEqual(t.ids, ['idx', 'lib', 'wish', 'you', 'fri', 'chat', 'prof']); assert.strictEqual(t.lab, 'Indice'); assert(!t.menu, 'niente ≡ in testatina');
    assert(t.bot <= t.H + 0.5, w + 'x' + h + ': i sette segnalibri entrano nello schermo (' + t.bot + ' su ' + t.H + ')'); assert(t.hmin >= 44, 'segnalibri da toccare: almeno 44 px'); assert(t.side <= 0);
    if (w === 360 && h === 800) {
      // 2) il segnalibro apre l'Indice con le Impostazioni, resta acceso lui; un altro tocco lo richiude
      await p.click('#gTabs [data-g="idx"]'); await wait(600);
      let s = await p.evaluate(() => ({ open: document.body.classList.contains('drawer-open') || document.documentElement.classList.contains('drawer-open'), h: document.getElementById('drawerH').textContent,
        look: !!(document.querySelector('#drawerOpts [data-sec="look"]') || {}).offsetParent, on: [...document.querySelectorAll('#gTabs .on')].map(b => b.dataset.g) }));
      console.log('[2 indice]', JSON.stringify(s)); assert(s.open && s.h === 'Indice' && s.look, 'Indice aperto con le Impostazioni'); assert.deepStrictEqual(s.on, ['idx'], 'acceso «Indice», non «Tu»');
      if (process.env.SCHERMATE) await p.screenshot({ path: path.join(process.env.SCHERMATE, 'indice-360.png') });
      // una finestra aperta dall'Indice: resta acceso «Indice»
      await p.click('#drawerOpts [data-sec="look"]'); await wait(500);
      assert.deepStrictEqual(await p.$$eval('#gTabs .on', e => e.map(b => b.dataset.g)), ['idx'], 'con Aspetto aperto resta acceso «Indice»');
      await p.evaluate(() => window.__app.closeOptions()); await wait(500);
      if (!(await p.evaluate(() => document.body.classList.contains('drawer-open') || document.documentElement.classList.contains('drawer-open')))) { await p.click('#gTabs [data-g="idx"]'); await wait(500); }
      await p.click('#gTabs [data-g="idx"]'); await wait(600);
      s = await p.evaluate(() => ({ open: document.body.classList.contains('drawer-open') || document.documentElement.classList.contains('drawer-open'), on: [...document.querySelectorAll('#gTabs .on')].map(b => b.dataset.g) }));
      assert(!s.open, 'un altro tocco richiude l\'Indice'); assert.deepStrictEqual(s.on, ['lib']);
      // «Tu» apre il profilo e accende «Tu»
      await p.click('#gTabs [data-g="prof"]'); await wait(700);
      assert.deepStrictEqual(await p.$$eval('#gTabs .on', e => e.map(b => b.dataset.g)), ['prof']);
      await p.click('#gTabs [data-g="lib"]'); await wait(500);

      // 3) avviso del libro nella sua pagina
      await p.setOfflineMode(true);
      await p.evaluate(() => window.__app.addIsbn('9788804668015')); await wait(700);
      const id = await p.evaluate(() => window.__app.state.books.find(b => b.i === '9788804668015').id);
      const pg = () => p.evaluate((id) => { const r = document.querySelector('.row[data-id="' + id + '"]'), st = r.querySelector('.status'), b = st && st.querySelector('.btn'); if (!st) return { st: false, full: r.classList.contains('cv-full') };
        const sr = st.getBoundingClientRect(), br = b ? b.getBoundingClientRect() : null, acts = r.querySelector('.acts-main').getBoundingClientRect(), rd = r.querySelector('.read').getBoundingClientRect(), tb = document.getElementById('gTabs').getBoundingClientRect();
        return { full: r.classList.contains('cv-full'), st: true, vis: sr.height > 0 && getComputedStyle(st).display !== 'none', txt: st.querySelector('.txt').textContent, btn: b ? b.textContent : '', centro: br ? Math.abs((br.left + br.right) / 2 - (sr.left + sr.right) / 2) : -1,
          sotto: sr.top >= acts.bottom - 0.5 && sr.bottom <= rd.top + 0.5, dentro: sr.right <= tb.left + 0.5 && sr.left >= 0, clip: st.querySelector('.txt').scrollWidth - st.querySelector('.txt').clientWidth }; }, id);
      let a = await pg(); console.log('[3 senza rete]', JSON.stringify(a));
      assert(a.full && a.st && a.vis, 'libro senza titolo: pagina aperta con l\'avviso in vista');
      assert(/^Senza connessione/.test(a.txt) && a.btn === 'Riprova ora' && a.centro <= 1.5 && a.sotto && a.dentro && a.clip <= 0, 'avviso sotto i tasti tondi, testo intero, tasto al centro');
      if (process.env.SCHERMATE) await p.screenshot({ path: path.join(process.env.SCHERMATE, 'avviso-360.png') });
      await p.evaluate((id) => { window.__app.S[id] = { st: 'nf' }; window.NL.refreshRow(id); }, id); await wait(400);
      a = await pg(); console.log('[3 non trovato]', JSON.stringify(a));
      assert(a.vis && a.txt === 'Non ho trovato questo libro online.' && a.btn === 'Scrivi titolo e autore' && a.centro <= 1.5 && a.sotto && a.dentro);
      // un libro normale: nessun avviso nella pagina
      await p.evaluate(() => document.querySelector('.row.open.cv-full [data-act="toggle"]').click()); await wait(400);
      await p.evaluate(() => document.querySelector('.row[data-id="k1"] .sum').click()); await wait(500);
      assert(await p.evaluate(() => { const r = document.querySelector('.row[data-id="k1"]'); return r.classList.contains('cv-full') && !r.querySelector('.status'); }), 'libro a posto: niente avviso');
      await p.setOfflineMode(false);
    }
    await p.close();
  }

  // 4) testi: «Indice», non più «Menu», nei messaggi dell'app
  const src = ['app.js', 'app-avvio.js', 'app-scheda.js', 'guida.js', 'social.js', 'profilo.js', 'amici.js'].map(f => fs.readFileSync(path.join(CFG.APP, f), 'utf8')).join('\n');
  const strings = src.split('\n').filter(l => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
  for (const t of ['Indice › Impostazioni › Installazione sul telefono', 'Indice › Info e aiuto › Come si usa', 'Indice › Info e aiuto › Condivisione', 'da Indice › Account', 'nell\\\'Indice.', 'aggiorna dall\\\'Indice', 'Indice › Impostazioni › Ricerc']) assert(strings.includes(t), 'manca «' + t + '»');
  assert(!/['"][^'"\n]*Menu ›[^'"\n]*['"]/.test(strings.replace(/\/\*[\s\S]*?\*\//g, '')), 'nessun messaggio con «Menu ›»');

  assert.deepStrictEqual(errors, []);
  console.log('e2e139 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
