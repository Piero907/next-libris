const CFG = require("./_config");
const H = require('./_harness');
// triangolino nel riepilogo: compare quando un avviso ancora valido è stato chiuso (prestiti lunghi, «Hai finito…», trimestre)
// e toccandolo li riapre; senza avvisi chiusi non c'è; nella disposizione A si riparte dal primo avviso
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8188), ROOT);
const today = new Date().toISOString().slice(0, 10), old = new Date(Date.now() - 200 * 864e5).toISOString().slice(0, 10);
const books = Array.from({ length: 8 }, (_, i) => ({ id: 'z' + i, t: 'Libro ' + i, a: 'Autore ' + i, ts: Date.now() - i * 864e5, rs: i === 0 ? 'ok' : 'da', rd: i === 0 ? today : '', p: i === 2 ? 'Anna' : '', pd: i === 2 ? old : '' }));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const wait = H.wait;   // attesa «finché» (_harness.js)
  await page.goto('http://localhost:' + CFG.port(8188) + '/?vista=elenco', { waitUntil: 'load' });
  await page.evaluate(b => { const o = Storage.prototype.setItem; localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: Date.now() })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'P', selTip: 1, lastBackup: Date.now(), donUntil: Date.now() + 9e9, instSnooze: Date.now() + 9e9 })); Storage.prototype.setItem = function (k, v) { if (/^catalogo-libri-v2$/.test(k)) return; return o.call(this, k, v); }; }, books);
  await page.reload({ waitUntil: 'load' }); await wait(3200);
  const st = () => page.evaluate(() => ({ alert: !!document.querySelector('#summary .sum-alert'), label: (document.querySelector('#summary .sum-alert') || {}).ariaLabel || '', notice: !document.querySelector('#notice').hidden, nx: !document.querySelector('#nxBox').hidden, sum: document.querySelector('#summary').innerText }));
  let s = await st(); console.log('[1 avvio]', JSON.stringify(s));
  assert(s.notice && s.nx && s.alert && /Vai ai 2 avvisi/.test(s.label), 'avvisi aperti: il triangolo c\'e\' gia\' (16/11/2026)');
  // toccato con gli avvisi aperti: la pagina va in cima e l'avviso lampeggia
  await page.evaluate(() => window.scrollTo(0, 400)); await wait(100);
  await page.click('#summary .sum-alert').catch(() => page.evaluate(() => document.querySelector('#summary .sum-alert').click())); await wait(450);
  assert(await page.evaluate(() => !!document.querySelector('#notice.flash, #nxBox.flash')), 'lampeggia');
  // chiudo il prestito: compare il triangolo accanto a «1 in prestito»
  await page.click('#noticeX'); await wait(200);
  s = await st(); console.log('[2 chiuso prestito]', JSON.stringify(s)); assert(!s.notice && s.alert && /1 in prestito/.test(s.sum) && /Riapri l'avviso chiuso/.test(s.label));
  const pos = await page.evaluate(() => { const a = document.querySelector('#summary .sum-alert svg').getBoundingClientRect(), l = document.querySelector('#summary [data-sum="loan"]').getBoundingClientRect(); return { dx: Math.round(a.left - l.right), dy: Math.round((a.top + a.height / 2) - (l.top + l.height / 2)) }; });
  console.log('  accanto:', JSON.stringify(pos)); assert(pos.dx >= 0 && pos.dx < 20 && Math.abs(pos.dy) <= 2, 'triangolo allineato alla scritta');
  // chiudo anche «Hai finito…»: due avvisi chiusi
  await page.click('#nxBoxX'); await wait(200);
  s = await st(); assert(s.alert && /Riapri i 2 avvisi chiusi/.test(s.label));
  await page.screenshot({ path: CFG.OUT + '/triangolo.png' });
  // il triangolo li riapre tutti
  await page.click('#summary .sum-alert'); await wait(400);
  s = await st(); console.log('[3 riaperti]', JSON.stringify(s)); assert(s.notice && s.nx && s.alert && /Vai ai 2 avvisi/.test(s.label));
  assert(/Anna ha/.test(await page.$eval('#notice', e => e.innerText)));
  // nei Desideri niente triangolo
  await page.click('#noticeX'); await wait(200); assert((await st()).alert);
  await page.evaluate(() => window.__app.setTab('wish')); await wait(300); assert(!(await st()).alert, 'non nei Desideri');
  await page.evaluate(() => window.__app.setTab('lib')); await wait(300);
  // disposizione A: riaperti, si riparte dal primo avviso
  await page.evaluate(() => window.NLLayout.set('a')); await wait(300);
  await page.evaluate(() => { const b = document.querySelector('#layMore'); if (b && !b.hidden) b.click(); }); await wait(500);
  await page.click('#summary .sum-alert'); await wait(500);
  const lab = await page.$eval('#layMore', e => e.getAttribute('aria-label')); console.log('[4 A]', lab); assert(/^Avviso 1 di/.test(lab));
  assert.deepStrictEqual(errors, []);
  console.log('e2e68 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
