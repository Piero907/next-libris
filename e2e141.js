const CFG = require('./_config');
const H = require('./_harness');
// 20/11/2026 (richieste di Piero):
// - nella libreria di un amico la freccia ‹ della pagina del libro non chiudeva niente (i tasti dell'ospite erano spenti con pointer-events);
// - «Accetta», «Chiedi l'amicizia», «Presta» nelle righe degli amici: pieni (prima testo chiaro su fondo chiaro);
// - pillola «BETA» accanto a NEXT LIBRIS nella testatina; nella copia di prova una seconda pillola «prova» sotto;
// - «Vedi tutti i libri di» con un'etichetta lunga resta dentro la pagina.
const puppeteer = require('puppeteer-core');
const path = require('path'), assert = require('assert');
const server = H.serve(CFG.port(8341), CFG.APP);
const APP = 'http://localhost:' + CFG.port(8341);
const wait = H.wait;
const books = [{ id: 'k1', t: 'Libro mio', a: 'Autore', ts: Date.now() }];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const p = await browser.newPage(); await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(APP + '/', { waitUntil: 'load' });
  await p.evaluate((b) => { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: Date.now() })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'Piero', lastBackup: Date.now(), donUntil: Date.now() + 9e9, instSnooze: Date.now() })); localStorage.setItem('catalogo-libri-guida', JSON.stringify({ v: 99, path: 0 })); }, books);
  await p.reload({ waitUntil: 'load' }); await wait(900);
  await p.evaluate(() => { if (window.NLGuida && window.NLGuida.close) window.NLGuida.close(); document.querySelectorAll('.sheet:not([hidden])').forEach(x => { x.hidden = true; }); }); await wait(200);

  // 1) BETA nella testatina, niente «prova» nella vera
  let b = await p.evaluate(() => { const g = document.getElementById('gBeta'), r = g.getBoundingClientRect(), run = document.getElementById('gRun').getBoundingClientRect();
    return { t: g.innerText.replace(/\s+/g, ' ').trim(), vis: r.width > 0, prova: !!g.querySelector('.g-prova'), next: r.left >= run.right - 1, bg: getComputedStyle(g.querySelector('b')).backgroundColor }; });
  console.log('[1 beta]', JSON.stringify(b)); assert(b.vis && b.t === 'BETA' && !b.prova && b.next, 'pillola BETA accanto a NEXT LIBRIS, senza «prova» nella vera');
  // nella prova: la seconda pillola sotto
  await p.evaluate(() => { window.PROVA = true; NL.emit && NL.emit('rows', document.getElementById('list')); window.dispatchEvent(new Event('resize')); NLLayout.act('wish'); NLLayout.act('lib'); }); await wait(500);
  b = await p.evaluate(() => { const g = document.getElementById('gBeta'), x = g.querySelector('.g-prova'); if (!x) return null; const a = g.querySelector('b').getBoundingClientRect(), c = x.getBoundingClientRect(); return { t: x.textContent, under: c.top >= a.bottom - 0.5 }; });
  console.log('[1 prova]', JSON.stringify(b)); assert(b && b.t === 'prova' && b.under, 'pillola «prova» sotto BETA nella copia di prova');
  if (process.env.SCHERMATE) await p.screenshot({ path: path.join(process.env.SCHERMATE, 'beta-390.png') });

  // 2) libreria di un amico: ‹ della pagina del libro la chiude; etichetta lunga dentro la pagina
  await p.evaluate(() => NL.guestEnter('Anna', [
    { id: 'g1', t: 'The Passenger', a: 'Cormac McCarthy', gen: 'Narrativa americana in lingua inglese, 1945-1999', e: 'Picador', y: '2022', pg: 383, i: '9781035006236', w: true, ts: 5 },
    { id: 'g2', t: 'Il Gattopardo', a: 'Giuseppe Tomasi di Lampedusa', gen: 'Romanzo', ts: 4 }], { id: 'x', comuni: 0, libVis: true, wishVis: true })); await wait(600);
  await p.evaluate(() => { const t = document.querySelector('#guestBar [data-t="wish"]'); if (t) t.click(); else NLLayout.act('wish'); }); await wait(500);
  await p.evaluate(() => { const c = document.querySelector('#list .cover[data-id="g1"], #list [data-id="g1"] .sum'); c.click(); }); await wait(700);
  let s = await p.evaluate(() => { const r = document.querySelector('.row.open.cv-full'); if (!r) return null; const t = r.querySelector('.cv-tags .fchip'), tabs = document.getElementById('gTabs').getBoundingClientRect();
    return { id: r.dataset.id, back: !!r.querySelector('.cv-back'), chip: t ? Math.round(t.getBoundingClientRect().right) : 0, lim: Math.round(r.getBoundingClientRect().right), tabs: Math.round(tabs.left) }; });
  console.log('[2 pagina]', JSON.stringify(s)); assert(s && s.id === 'g1' && s.back, 'pagina del libro dell\'amico aperta');
  assert(s.chip && s.chip <= s.lim && s.chip <= s.tabs, '«Vedi tutti i libri di» dentro la pagina, fuori dai segnalibri');
  if (process.env.SCHERMATE) await p.screenshot({ path: path.join(process.env.SCHERMATE, 'amico-libro-390.png') });
  await p.click('.row.open.cv-full .cv-back'); await wait(600);
  assert(!(await p.$('.row.open.cv-full')), '‹ chiude la pagina del libro dell\'amico');
  // anche ⋯ risponde
  await p.evaluate(() => NL.guestExit && NL.guestExit()); await wait(400);

  // 3) Accetta / Chiedi l'amicizia pieni
  const col = await p.evaluate(() => {
    const ul = document.createElement('div'); ul.className = 'fri'; ul.innerHTML = '<span class="fr-act"><button class="btn">Rifiuta</button><button class="btn primary">Accetta</button></span>';
    document.body.appendChild(ul); const [no, yes] = ul.querySelectorAll('.btn'), cs = getComputedStyle(yes), acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const tmp = document.createElement('i'); tmp.style.color = acc; document.body.appendChild(tmp); const accRgb = getComputedStyle(tmp).color; tmp.remove();
    const r = { yes: cs.backgroundColor, ink: cs.color, no: getComputedStyle(no).backgroundColor, acc: accRgb }; ul.remove(); return r; });
  console.log('[3 colori]', JSON.stringify(col));
  assert.strictEqual(col.yes, col.acc, 'Accetta pieno del colore dell\'app'); assert.notStrictEqual(col.yes, col.no, 'Rifiuta resta secondario'); assert.notStrictEqual(col.ink, col.yes);

  assert.deepStrictEqual(errors, [], 'nessun errore: ' + errors.join(' | '));
  console.log('e2e141 OK'); await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
