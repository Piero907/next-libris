const CFG = require("./_config");
const H = require('./_harness');
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP, IMG = CFG.IMG;
const server = H.serve(CFG.port(8129), ROOT);
const V = (id, t, a, isbn, lang, pub) => ({ id, volumeInfo: { title: t, authors: [a], publisher: pub, publishedDate: '2012', language: lang, industryIdentifiers: isbn ? [{ type: 'ISBN_13', identifier: isbn }] : [], imageLinks: { thumbnail: 'https://books.google.com/x' + id } } });
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!localStorage.getItem('catalogo-libri-set')) localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), swiped: true, price: false, installed: true, instScope: '/' })); });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()); });
  const queries = [];
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith('http://localhost:' + CFG.port(8129) + '')) return req.continue();
    const j = (o) => req.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (u.includes('googleapis.com/books/v1/volumes?')) {
      const qq = decodeURIComponent(u.match(/q=([^&]*)/)[1]); queries.push(qq);
      if (qq.startsWith('isbn:')) return j({ items: [V('r1', 'Il nome della rosa', 'Umberto Eco', qq.slice(5), 'it', 'Bompiani')] });
      return j({ items: [V('en', 'The Name of the Rose', 'Umberto Eco', '9780156001311', 'en', 'Harcourt'), V('it', 'Il nome della rosa', 'Umberto Eco', '9788845292613', 'it', 'Bompiani'), V('no', 'Il nome della rosa (illustrato)', 'Umberto Eco', '', 'it', 'Bompiani')] });
    }
    if (/googleapis|openlibrary|crossref/.test(u)) return j({});
    if (u.includes('books.google.com/x')) return req.respond({ status: 404, body: '' });
    req.abort();
  });
  const resp = await page.goto('http://localhost:' + CFG.port(8129) + '/?vista=elenco', { waitUntil: 'load' }); console.log('[goto]', resp && resp.status(), resp && resp.url());
  const wait = H.wait;   // attesa «finché» (_harness.js)
  const books = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__app.state.books)));
  const txt = sel => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
  await wait(300); console.log('[0 errori all\'avvio]', errors, await page.evaluate(() => [typeof window.__app, document.readyState, document.title, [...document.scripts].map(s => s.src).join(' ')]));
  // 1) Desideri vuoti: «Cerca per titolo»
  await page.evaluate(() => window.__app.setTab('wish')); await wait(200);
  await page.click('#list [data-act="typeadd"]'); await wait(200);
  assert(!(await page.$eval('#isbnSheet', e => e.hidden))); assert.strictEqual(await txt('#isbnH'), 'Aggiungi ai Desideri');
  await page.type('#isbnText', 'il nome della rosa eco'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('#isbnRes .cand').length > 0, { timeout: 5000 });
  const list = await page.$$eval('#isbnRes .cand b', e => e.map(x => x.textContent)); console.log('[1 risultati]', list, '|', await txt('#isbnResMsg'));
  assert.deepStrictEqual(list, ['Il nome della rosa', 'Il nome della rosa (illustrato)', 'The Name of the Rose']);
  assert.strictEqual(queries[0], 'il nome della rosa eco');
  await page.screenshot({ path: CFG.OUT + '/s_title.png' });
  // 2) scelta: aggiunto ai Desideri con l'ISBN, completato dalle banche dati
  await page.click('#isbnRes .cand[data-i="0"]'); await wait(800);
  assert(await page.$eval('#isbnSheet', e => e.hidden));
  let b = (await books()).find(x => x.i === '9788845292613'); console.log('[2 aggiunto]', b.t, b.a, b.e, b.w, '|', await txt('#toastTxt'));
  assert.deepStrictEqual([b.t, b.w, b.e], ['Il nome della rosa', true, 'Bompiani']);
  // 3) di nuovo: risulta «Già nei Desideri» e non si duplica
  await H.aggiungi(page, 'type'); await wait(200);
  await page.type('#isbnText', 'nome della rosa'); await page.click('#isbnGo');
  await page.waitForFunction(() => document.querySelectorAll('#isbnRes .cand').length > 0, { timeout: 5000 });
  console.log('[3 badge]', await txt('#isbnRes .cand[data-i="0"]'));
  assert((await txt('#isbnRes .cand[data-i="0"]')).includes('Già nei Desideri'));
  await page.click('#isbnRes .cand[data-i="0"]'); await wait(200);
  assert.strictEqual((await books()).length, 1); console.log('[3 toast]', await txt('#toastTxt'));
  // 4) senza ISBN: aggiunto con i dati trovati
  await page.click('#isbnRes .cand[data-i="1"]'); await wait(300);
  assert((await books()).some(x => x.t === 'Il nome della rosa (illustrato)' && x.w && !x.i));
  // 5) «Aggiungi solo il titolo»
  await H.aggiungi(page, 'type'); await wait(200);
  await page.type('#isbnText', 'Un libro introvabile di Pinco'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('#isbnAsIs').hidden, { timeout: 5000 });
  console.log('[5 tasto]', await txt('#isbnAsIs'));
  await page.click('#isbnAsIs'); await wait(200);
  b = (await books()).find(x => x.t === 'Un libro introvabile di Pinco'); assert(b && b.w);
  await page.click('#toastBtn'); await wait(200);
  assert(!(await books()).some(x => x.t === 'Un libro introvabile di Pinco'), 'Annulla');
  // 6) gli ISBN funzionano come prima, e in Libreria il titolo va in Libreria
  await page.evaluate(() => window.__app.setTab('lib')); await wait(100);
  await H.aggiungi(page, 'type'); await wait(200);
  assert.strictEqual(await txt('#isbnH'), 'Titolo o ISBN');
  await page.type('#isbnText', '9788806219352'); await page.click('#isbnGo'); await wait(800);
  assert((await books()).some(x => x.i === '9788806219352' && !x.w));
  console.log('ERRORI:', errors.length ? errors : 'nessuno'); assert(!errors.length);
  console.log('e2e21 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
