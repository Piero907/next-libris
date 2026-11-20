const CFG = require("./_config");
const H = require('./_harness');
const puppeteer = require('puppeteer-core'); const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8143), ROOT);
const B = o => Object.assign({ id: 'x', t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 1, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: '', rt: 0, rd: '' }, o);
const books = [];
const T = [['Il nome della rosa','Umberto Eco','Studio','Narrativa','ok'],['Lessico famigliare','Natalia Ginzburg','Studio','Narrativa','da'],['La storia','Elsa Morante','Camera','Narrativa','in'],['Se questo è un uomo','Primo Levi','Soggiorno','Memorie','ok'],['Il Gattopardo','Giuseppe Tomasi di Lampedusa','Soggiorno','Narrativa','da'],['Le città invisibili','Italo Calvino','Camera','Narrativa',''],['Storia d\'Italia','Indro Montanelli','Studio','Storia','da'],['Breve storia del tempo','Stephen Hawking','Studio','Scienza','']];
T.forEach((x, k) => books.push(B({ id: 'b' + k, t: x[0], a: x[1], sh: x[2], gen: x[3], rs: x[4], e: 'Einaudi', y: '2010', c: 12 + k, i: '978880600000' + k, ts: 100 - k, p: k === 2 ? 'Marco' : '', pd: k === 2 ? '2026-10-01' : '', xs: k === 7 ? 'v' : '', xd: k === 7 ? '2026-11-01' : '' })));
const assert = require('assert');
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => r.url().startsWith('http://localhost') ? r.continue() : r.abort());
  await page.evaluateOnNewDocument((b) => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now() - 3 * 86400000, price: false, swiped: true })); sessionStorage.seeded = 1; } }, books);
  await page.goto('http://localhost:' + CFG.port(8143) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = H.wait;   // attesa «finché» (_harness.js)
  const vis = sel => page.$eval(sel, e => !e.hidden && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none');
  const drawerOpen = () => page.evaluate(() => document.body.classList.contains('drawer-open'));
  await wait(500);
  // la linguetta sta nel margine: non copre le schede
  assert.strictEqual(await page.$('details.opts'), null);
  await page.screenshot({ path: CFG.OUT + '/s_main_gear.png' });
  // 1) ingranaggio -> menu sulla scheda Opzioni
  await page.click('#gMenu'); await wait(350);
  assert(await drawerOpen()); assert(await vis('#drawerOpts')); assert(!(await vis('#drawerFilters'))); assert(!(await vis('#drawerFoot')));
  console.log('[1 voci]', await page.$$eval('#drawerOpts .dopt b', e => e.map(x => x.textContent).join(' | ')));
  await page.screenshot({ path: CFG.OUT + '/s_menu_opts.png' });
  // 2) voce -> pagina; «‹» torna al menu; Indietro torna al menu (17/11/2026), poi Indietro lo chiude
  await page.click('#drawerOpts [data-sec="search"]'); await wait(350);
  assert(!(await drawerOpen())); assert(await vis('#optSheet')); assert(await vis('#svcKey')); assert(!(await vis('#optPrice')));
  console.log('[2 titolo]', await page.$eval('#optH', e => e.textContent), '|', await page.$eval('#gbCount', e => e.textContent));
  await page.screenshot({ path: CFG.OUT + '/s_opt_search.png' });
  await page.click('#optBack'); await wait(350);
  assert(await drawerOpen()); assert(await vis('#drawerOpts')); assert(!(await vis('#optSheet')));
  await page.click('#drawerOpts [data-sec="fix"]'); await wait(350);
  assert(await vis('#btnMergeDups')); console.log('[2 sistema]', await page.$eval('#optH', e => e.textContent));
  await page.screenshot({ path: CFG.OUT + '/s_opt_fix.png' });
  await page.goBack(); await wait(400);
  assert(!(await vis('#optSheet'))); assert(await drawerOpen());
  await page.goBack(); await wait(400);
  assert(!(await vis('#optSheet'))); assert(!(await drawerOpen())); assert.strictEqual(page.url(), 'http://localhost:' + CFG.port(8143) + '/?vista=elenco');
  // le impostazioni funzionano ancora
  await page.click('#gMenu'); await wait(300); await page.click('#drawerOpts [data-sec="cards"]'); await wait(300);
  const pr0 = await page.evaluate(() => window.__app.settings.price);
  await page.click('#optPrice'); await wait(100);
  assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')).price), !pr0);
  await page.click('#optPrice'); await wait(100);
  await page.click('#optClose'); await wait(500); assert(!(await vis('#optSheet')));
  assert(await drawerOpen(), '× torna al Menu (17/11/2026 pomeriggio)'); await page.click('#drawerX'); await wait(400);
  assert.strictEqual(page.url(), 'http://localhost:' + CFG.port(8143) + '/?vista=elenco');
  // 3) Backup ed esportazione
  await page.click('#gMenu'); await wait(300); await page.click('#drawerOpts [data-sec="export"]'); await wait(300);
  assert(await vis('#exportSheet')); assert(!(await drawerOpen())); await page.click('#exportClose'); await wait(500);
  assert(await drawerOpen(), 'Chiudi torna al Menu'); await page.click('#drawerX'); await wait(400);
  // 4) Filtri e linguetta aprono la scheda Filtri
  await page.click('#gMenu'); await wait(300); await page.click('#drawerX'); await wait(300);
  await page.click('#btnFilters'); await wait(300); assert(await vis('#drawerFilters')); assert(await vis('#drawerFoot'));
  await page.click('#drawerBack'); await wait(250); assert(await vis('#drawerOpts')); await page.click('#goFilters'); await wait(150); assert(await vis('#drawerFilters'));   // v84: pagine al posto delle schede
  await page.keyboard.press('Escape'); await wait(300);
  // 5) scheda aperta: X e prestato/smarrito in alto, accanto alla freccetta
  await page.evaluate(() => { window.__app.settings.openAll = false; window.__app.openState()['b2'] = true; window.__app.setTab('lib'); });
  await wait(200);
  const tops = await page.evaluate(() => { const r = document.querySelector('#list .row[data-id="b2"]'); const y = s => Math.round(r.querySelector(s).getBoundingClientRect().top - r.getBoundingClientRect().top);
    return { chev: y('.card-top .chev-btn'), del: y('.top-acts [data-act="del"]'), loan: y('.top-acts [data-act="loan"]'), on: r.querySelector('.top-acts [data-act="loan"]').classList.contains('on'), foot: r.querySelectorAll('.foot [data-act="del"]').length }; });
  console.log('[5 in alto]', JSON.stringify(tops)); assert(tops.chev < 20 && tops.del < 200 && tops.loan < 20 && tops.on && tops.foot === 0);   // stile G: «elimina» nella riga dei tasti tondi sotto la copertina
  await page.click('#list .row[data-id="b2"] .top-acts [data-act="loan"]'); await wait(200);
  console.log('[5 finestra]', await page.$eval('#loanH', e => e.textContent), '|', await page.$eval('#loanBack', e => e.textContent));
  assert.strictEqual(await page.$eval('#loanBack', e => e.textContent), 'Restituito');
  await page.click('#loanCancel').catch(() => page.keyboard.press('Escape')); await wait(200);
  console.log('ERRORI:', errors.length ? errors : 'nessuno'); assert(!errors.length);
  console.log('e2e15 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
