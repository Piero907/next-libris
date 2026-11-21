const CFG = require("./_config");
const H = require('./_harness');
// Suggerimenti dagli amici (033, 21/11/2026): «Piace ai tuoi amici» (un libro di due amici sta una volta sola, «ce l'ha»),
// «Lettori come te» (l'amico con almeno 5 libri in comune), «Leggilo gratis», anteprima con «Me lo presti?» e «Apri la libreria di…»,
// una sola chiamata al database tenuta 6 ore; riquadro «Con gli amici…» solo senza amici. Amici e database finti.
const puppeteer = require('puppeteer-core');
const assert = require('assert');
const server = H.serve(CFG.port(8345), CFG.APP);
const now = Date.now();
const books = [
  { id: 'm1', t: 'Il barone rampante', a: 'Italo Calvino', rs: 'ok', rt: 5, ts: now },
  { id: 'm2', t: 'Lessico famigliare', a: 'Natalia Ginzburg', w: true, ts: now },
];
const RPC = {
  amici: [{ id: 'u-marta', utente: 'Marta', comuni: 7 }, { id: 'u-luca', utente: 'Luca', comuni: 2 }],
  libri: [
    { amico: 'u-luca', id: 'l1', t: 'La storia', a: 'Elsa Morante', rt: 5, fuori: false },
    { amico: 'u-marta', id: 'k1', t: 'La Storia', a: 'Elsa Morante', rt: 4, lc: true, fuori: true },
    { amico: 'u-marta', id: 'k2', t: 'Le otto montagne', a: 'Paolo Cognetti', rt: 5, fuori: false },
    { amico: 'u-luca', id: 'l2', t: 'Il deserto dei Tartari', a: 'Dino Buzzati', lc: true, fuori: false },
    { amico: 'u-luca', id: 'l3', t: 'Lessico famigliare', a: 'Natalia Ginzburg', rt: 5 },   // già nei miei Desideri: non si propone
  ] };
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => r.url().startsWith('http://localhost:' + CFG.port(8345)) ? r.continue() : r.respond({ status: 404, body: '' }));
  const wait = H.wait;
  await page.goto('http://localhost:' + CFG.port(8345) + '/', { waitUntil: 'load' });
  await page.evaluate(b => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/^catalogo-libri-v2$/.test(k)) return; return o.call(this, k, v); }; o.call(localStorage, 'catalogo-libri-v2', JSON.stringify({ books: b, updated: Date.now() })); o.call(localStorage, 'catalogo-libri-set', JSON.stringify({ swiped: true, name: 'P', selTip: 1, lastBackup: Date.now(), donUntil: Date.now() + 9e9, suggAuto: false })); }, books);
  await page.reload({ waitUntil: 'load' }); await wait(800);
  const txt = s => page.$eval(s, e => e.innerText.replace(/\s+/g, ' ').trim()), hid = s => page.$eval(s, e => e.hidden);
  const shelf = k => page.$eval('[data-shelf="' + k + '"]', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
  // amici e database finti
  await page.evaluate(R => {
    window.__calls = [];
    const A = window.NLAmici;
    A.uid = () => 'u-me';
    A.state = () => ({ list: [{ id: 'u-marta', stato: 'amici' }, { id: 'u-luca', stato: 'amici' }], asks: window.__asks || (window.__asks = []) });
    A.rpc = async (n, b) => { window.__calls.push([n, b]); if (n === 'suggerimenti_amici') return JSON.parse(JSON.stringify(R)); if (n === 'chiedi_prestito') return null; throw new Error('?'); };
    A.guest = id => { window.__guest = id; };
    window.NLGratis.free = () => ({ mine: [], other: [{ t: 'I Malavoglia', a: 'Giovanni Verga', u: 'https://it.wikisource.org/wiki/I_Malavoglia' }] });
  }, RPC);
  // 1) da Per te: la pagina, gli scaffali degli amici, una sola chiamata
  await H.fai(page, 'you'); await wait(400);
  await page.evaluate(() => [...document.querySelectorAll('#layYouList [data-l="sugg"], #layYouList button')].find(b => /Suggerimenti/.test(b.innerText)).click()); await wait(800);
  assert(!(await hid('#suggSheet')));
  const order = await page.$$eval('#sgShelves [data-shelf]', e => e.map(x => x.dataset.shelf).join(','));
  console.log('[1 scaffali]', order);
  assert(/^fri,sim,gratis/.test(order), 'amici, lettori come te, gratis');
  const fri = await shelf('fri'), sim = await shelf('sim');
  console.log('[amici]', fri); console.log('[come te]', sim);
  assert.strictEqual(await page.$$eval('[data-shelf="fri"] [data-sg]', e => e.filter(c => /La storia/i.test(c.innerText)).length), 1, 'un libro di due amici una volta sola');
  assert(/Luca e Marta ★★★★★ · ce l'ha/.test(fri), 'Luca ce l\'ha (Marta l\'ha prestato)');
  assert(/Il deserto dei Tartari/.test(fri) && /Luca lo consiglia/.test(fri));
  assert(!/Lessico famigliare/.test(fri + sim), 'niente libri che ho già (anche nei Desideri)');
  assert(/Marta ha 7 libri in comune con te/.test(sim) && /Le otto montagne/.test(sim), 'Lettori come te: Marta');
  assert(!/Le otto montagne/.test(fri), 'i libri della sola Marta stanno in Lettori come te');
  assert(/I Malavoglia/.test(await shelf('gratis')) && /Gratis/.test(await shelf('gratis')));
  assert(!/Con gli amici i suggerimenti migliorano/.test(await txt('#sgShelves')), 'con gli amici niente riquadro');
  assert.strictEqual((await page.evaluate(() => window.__calls.filter(c => c[0] === 'suggerimenti_amici').length)), 1);
  assert(await page.evaluate(() => { const e = document.querySelector('#suggSheet .sheet-in'); return e.scrollWidth - e.clientWidth <= 0; }), 'niente scorrimento di lato');
  assert.strictEqual(await page.evaluate(() => document.querySelector('#gTabs [aria-current="page"], #gTabs .on, #gTabs [aria-pressed="true"]') ? document.querySelector('#gTabs [aria-current="page"], #gTabs .on, #gTabs [aria-pressed="true"]').dataset.g : 'you'), 'you', 'segnalibro Per te acceso');
  await page.screenshot({ path: CFG.OUT + '/sugg_amici.png' });
  await page.evaluate(() => document.querySelector('[data-shelf="sim"]').scrollIntoView()); await wait(100);
  await page.screenshot({ path: CFG.OUT + '/sugg_amici2.png' });
  // 2) anteprima: perché, chi ce l'ha, Me lo presti?
  await page.evaluate(() => [...document.querySelectorAll('[data-shelf="fri"] [data-sg]')].find(c => /La storia/i.test(c.innerText)).click()); await wait(250);
  const pv = await txt('#sgPrev'); console.log('[2 anteprima]', pv);
  assert(/Luca gli ha dato 5 stelle\./.test(pv) && /Marta gli ha dato 4 stelle e lo consiglia\./.test(pv));
  assert(/Ce l'ha Luca Me lo presti\?/.test(pv) && /Ce l'ha Marta Adesso è in prestito/.test(pv));
  await page.screenshot({ path: CFG.OUT + '/sugg_amici_prev.png' });
  await page.click('#sgPrev [data-act="sgask"]'); await wait(250);
  assert.deepStrictEqual(await page.evaluate(() => window.__calls.find(c => c[0] === 'chiedi_prestito')[1]), { amico: 'u-luca', libro_id: 'l1' });
  assert(/Richiesta mandata a Luca/.test(await txt('#toast')) && /Ce l'ha Luca Richiesta mandata/.test(await txt('#sgPrev')));
  // Apri la libreria di Marta
  await page.evaluate(() => [...document.querySelectorAll('#sgPrev [data-act="sglib"]')].find(b => /Marta/.test(b.innerText)).click()); await wait(250);
  assert.strictEqual(await page.evaluate(() => window.__guest), 'u-marta');
  assert(await hid('#suggSheet') && await hid('#sgPrev'), 'si chiude e va alla libreria');
  // 3) di nuovo: niente seconda chiamata (6 ore); ‹ torna a Per te
  await page.evaluate(() => window.__app.openSugg('you')); await wait(400);
  assert.strictEqual((await page.evaluate(() => window.__calls.filter(c => c[0] === 'suggerimenti_amici').length)), 1, 'tenuto 6 ore');
  await page.click('#sgClose'); await wait(300);
  assert(await hid('#suggSheet') && !(await hid('#layYou')), '‹ torna a Per te');
  // 4) senza amici: il riquadro, che porta agli amici
  await page.evaluate(() => { const A = window.NLAmici; A.state = () => ({ list: [], asks: [] }); const f = window.__app.sgf(); f.amici = []; f.libri = []; window.__opened = 0; A.open = () => { window.__opened = 1; }; window.__app.openSugg(); }); await wait(300);
  assert(/Con gli amici i suggerimenti migliorano/.test(await txt('#sgShelves')));
  await page.click('#sgShelves [data-act="sgfri"]'); await wait(200);
  assert.strictEqual(await page.evaluate(() => window.__opened), 1); assert(await hid('#suggSheet'));
  assert.deepStrictEqual(errors, []);
  console.log('e2e145 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
