const CFG = require("./_config");
const H = require('./_harness');
const puppeteer = require('puppeteer-core'); const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8146), ROOT);
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
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), swiped: true, look: 'classico' })); sessionStorage.seeded = 1; } }, books);
  await page.goto('http://localhost:' + CFG.port(8146) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = H.wait;   // attesa «finché» (_harness.js)
  const st = () => page.evaluate(() => ({ look: document.documentElement.getAttribute('data-look'), theme: document.documentElement.getAttribute('data-theme'), meta: document.querySelector('meta[name="theme-color"]').content, bg: getComputedStyle(document.body).backgroundColor, font: getComputedStyle(document.querySelector('h1')).fontFamily.split(',')[0] }));
  await wait(400);
  let s = await st(); console.log('[1 predefinito]', s); assert.strictEqual(s.look, 'nuovo'); assert.strictEqual(s.theme, 'light'); assert(s.font.includes('Bricolage'));   // restyle «C · Schede» (19/11/2026)
  await page.click('#gMenu'); await wait(300); await page.click('#drawerOpts [data-sec="look"]'); await wait(300);
  assert(await page.$eval('input[name="theme"][value="light"]', e => e.checked));
  await page.click('.seg-theme input[value="dark"] + span'); await wait(150);
  s = await st(); console.log('[2 scuro]', s); assert.strictEqual(s.theme, 'dark'); assert.strictEqual(s.bg, 'rgb(22, 30, 27)'); assert.strictEqual(s.meta, '#161E1B');   // stile G: pagina --surface, barra di stato dello stesso colore
  assert.strictEqual(await page.$('input[name="look"]'), null, 'niente piu\' scelta dello stile');
  // resta dopo il riavvio, senza lampi (impostato prima del disegno)
  await page.reload({ waitUntil: 'domcontentloaded' });
  s = await page.evaluate(() => ({ look: document.documentElement.getAttribute('data-look'), theme: document.documentElement.getAttribute('data-theme') }));
  console.log('[4 dopo il riavvio]', s); assert.deepStrictEqual(s, { look: 'nuovo', theme: 'dark' });
  await wait(400);
  await page.click('#gMenu'); await wait(300); await page.click('#drawerOpts [data-sec="look"]'); await wait(300);
  await page.click('.seg-theme input[value="light"] + span'); await wait(150);
  s = await st(); console.log('[5 nuovo chiaro]', s); assert.strictEqual(s.bg, 'rgb(252, 249, 242)'); assert.strictEqual(s.meta, '#FCF9F2');   // stile G: carta Avorio
  const set = await page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')));
  assert.strictEqual(set.theme, 'light');
  // palette e caratteri
  await page.keyboard.press('Escape'); await wait(300);
  await page.click('#gMenu'); await wait(300); await page.click('#drawerOpts [data-sec="look"]'); await wait(300);
  assert(!(await page.$eval('#lookNew', e => e.hidden)));
  await page.click('.pal input[value="bordeaux"]').catch(() => page.evaluate(() => { const r = document.querySelector('.pal input[value="bordeaux"]'); r.click(); }));
  await page.evaluate(() => { const r = document.querySelector('input[name="ft"][value="lora"]'); r.click(); });
  await page.evaluate(() => { const r = document.querySelector('input[name="fb"][value="atkinson"]'); r.click(); });
  await wait(200);
  let p = await page.evaluate(() => ({ pal: document.documentElement.getAttribute('data-pal'), ft: document.documentElement.getAttribute('data-ft'), fb: document.documentElement.getAttribute('data-fb'), meta: document.querySelector('meta[name="theme-color"]').content,
    accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), h1: getComputedStyle(document.querySelector('h1')).fontFamily.split(',')[0], body: getComputedStyle(document.body).fontFamily.split(',')[0] }));
  console.log('[6 bordeaux + lora + atkinson]', p);
  assert.deepStrictEqual([p.pal, p.ft, p.fb, p.meta, p.accent], ['bordeaux', 'lora', 'atkinson', '#FCF9F2', '#85283A']);   // stile G: carta Avorio con ogni tavolozza
  assert(p.h1.includes('Lora') && p.body.includes('Atkinson'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  p = await page.evaluate(() => [document.documentElement.getAttribute('data-pal'), document.documentElement.getAttribute('data-ft'), document.documentElement.getAttribute('data-fb')]);
  assert.deepStrictEqual(p, ['bordeaux', 'lora', 'atkinson']); await wait(400);
  await page.keyboard.press('Escape'); await wait(300);
  await page.click('#gMenu'); await wait(300); await page.click('#drawerOpts [data-sec="look"]'); await wait(300);
  await page.evaluate(() => document.querySelector('#lookReset').click()); await wait(150);
  p = await page.evaluate(() => [document.documentElement.getAttribute('data-pal'), document.documentElement.getAttribute('data-ft'), document.documentElement.getAttribute('data-fb')]);
  console.log('[7 predefiniti]', p); assert.deepStrictEqual(p, ['bosco', 'bricolage', 'plex']);
  console.log('ERRORI:', errors.length ? errors : 'nessuno'); assert(!errors.length);
  console.log('e2e17 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
