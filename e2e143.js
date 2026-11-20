const CFG = require("./_config");
const H = require('./_harness');
// Ricerca per titolo con il catalogo SBN (21/11/2026, scelte di Piero): SBN (dal server, ?t=) e Open Library insieme; Google Libri
// solo se manca un'edizione italiana con l'ISBN. Solo libri a stampa (li filtra il worker); le edizioni senza ISBN restano, dopo le altre.
// Stesso conto dell'ISBN: senza account 50 al giorno per telefono (quota.s), poi niente SBN.
const puppeteer = require('puppeteer-core');
const assert = require('assert');
const server = H.serve(CFG.port(8343), CFG.APP);
const SBN = { numFound: 3, briefRecords: [
  { codiceIdentificativo: 'A1', isbn: '88-04-41117-1', autorePrincipale: 'Buzzati, Dino', titolo: 'Il deserto dei tartari / Dino Buzzati', pubblicazione: 'Milano : A. Mondadori, 1995' },
  { codiceIdentificativo: 'A2', autorePrincipale: 'Buzzati, Dino', titolo: 'Il deserto dei Tartari / Dino Buzzati ; introduzione di Alberico Sala', pubblicazione: 'Milano : A. Mondadori, 1972' },
  { codiceIdentificativo: 'A3', isbn: '978-88-04-66796-4', autorePrincipale: 'Buzzati, Dino', titolo: 'Il deserto dei Tartari / Dino Buzzati', pubblicazione: 'Milano : Mondadori, 2016' }] };
const OL = { docs: [{ key: '/works/OL1W', title: 'The Tartar Steppe', author_name: ['Dino Buzzati'], language: ['eng'], editions: { docs: [{ key: '/books/OL2M', title: 'The Tartar Steppe', isbn: ['9781567921373'], language: ['eng'], publisher: ['Godine'], publish_date: '2005' }] } }] };
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!localStorage.getItem('catalogo-libri-set')) localStorage.setItem('catalogo-libri-set', JSON.stringify({ installed: true, instScope: '/', swiped: true, lastBackup: Date.now(), price: false }));
  });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  let g = 0, t = [], olOn = true, sbnOn = true;
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith('http://localhost:' + CFG.port(8343))) return req.continue();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'x-nl-tot, x-nl-mio, x-nl-stop' };
    const j = (o, st) => req.respond({ status: st || 200, contentType: 'application/json', headers: cors, body: JSON.stringify(o) });
    if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: cors });
    if (u.includes('/functions/v1/libri?t=')) { t.push(decodeURIComponent(u.split('?t=')[1]).replace(/\+/g, ' ')); return sbnOn ? j(SBN) : j({ briefRecords: [] }); }
    if (u.includes('openlibrary.org/search.json')) return j(olOn ? OL : { docs: [] });
    if (u.includes('googleapis.com/books/v1/volumes')) { g++; return j({ items: [{ id: 'gx', volumeInfo: { title: 'Il deserto dei Tartari', authors: ['Dino Buzzati'], language: 'it', publisher: 'Oscar', publishedDate: '2020', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9788804724407' }] } }] }); }
    if (/openlibrary|covers|crossref/.test(u)) return req.respond({ status: 404, headers: cors, body: '' });
    req.abort();
  });
  await page.goto('http://localhost:' + CFG.port(8343) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = H.wait;
  const txt = sel => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
  await wait(500);
  async function cerca(q) {
    await page.evaluate(() => { if (!document.getElementById('isbnSheet').hidden) return; window.__app.openIsbnSheet ? window.__app.openIsbnSheet() : null; });
    if (await page.$eval('#isbnSheet', e => e.hidden)) await H.aggiungi(page, 'type');
    await wait(200);
    await page.$eval('#isbnText', e => { e.value = ''; });
    await page.type('#isbnText', q); await page.click('#isbnGo');
    await page.waitForFunction(() => !/^Cerco/.test(document.getElementById('isbnResMsg').textContent), { timeout: 10000 });
    await wait(300);
    return page.$$eval('#isbnRes .cand', e => e.map(x => x.innerText.replace(/\s+/g, ' ').trim()));
  }

  // 1) c'è un'edizione italiana con l'ISBN in SBN: Google non serve; senza ISBN in fondo; niente avviso sull'API
  let r = await cerca('il deserto dei tartari');
  console.log('[1]', r.join(' | '), '|', await txt('#isbnResMsg'));
  assert.deepStrictEqual(t, ['il deserto dei tartari'], 'una ricerca SBN per titolo, dal server');
  assert.strictEqual(g, 0, 'Google non serve');
  assert.strictEqual(r.length, 4);
  assert(/Mondadori, 2016/.test(r[0]) && /A\. Mondadori, 1995/.test(r[1]), 'prima le italiane con ISBN, la più recente in cima: ' + r);
  assert(/Tartar Steppe/.test(r[2]) && /1972/.test(r[3]), 'poi le altre con ISBN, in fondo quella senza ISBN: ' + r);
  assert(/^Tocca il libro giusto/.test(await txt('#isbnResMsg')) && await page.$eval('#isbnKey', e => e.hidden), 'nessun avviso');
  assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-quota')).s), 1, 'contata come una ricerca SBN');
  // 2) l'edizione senza ISBN si aggiunge con i dati del catalogo
  await page.click('#isbnRes .cand[data-i="3"]'); await wait(500);
  const b = await page.evaluate(() => window.__app.state.books.find(x => x.y === '1972'));
  assert(b && b.t === 'Il deserto dei Tartari' && b.a === 'Dino Buzzati' && b.e === 'A. Mondadori' && !b.i, 'aggiunto senza ISBN: ' + JSON.stringify(b));

  // 3) nessuna edizione italiana con ISBN: si chiede anche a Google, e i risultati si sommano
  sbnOn = false;
  r = await cerca('tartar steppe');
  console.log('[3]', r.join(' | '));
  assert.strictEqual(g >= 1, true, 'Google serve');
  assert(r.some(x => /Oscar/.test(x)) && r.some(x => /Godine/.test(x)), 'Google e Open Library insieme');

  // 4) senza account, finite le 50 ricerche SBN del giorno: niente SBN, si va avanti con Open Library (e Google)
  await page.evaluate(() => { const q = JSON.parse(localStorage.getItem('catalogo-libri-quota')); q.s = 50; localStorage.setItem('catalogo-libri-quota', JSON.stringify(q)); window.__app.loadQuota && window.__app.loadQuota(); });
  await page.reload({ waitUntil: 'load' }); await wait(500);
  const n = t.length; sbnOn = true;
  r = await cerca('il deserto dei tartari');
  assert.strictEqual(t.length, n, 'al limite SBN non si chiama');
  assert(r.length >= 1);

  assert.deepStrictEqual(errors, []);
  console.log('e2e143 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
