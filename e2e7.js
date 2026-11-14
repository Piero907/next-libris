const CFG = require("./_config");
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(8132);
const B = (o) => Object.assign({ id: 'b' + Math.random().toString(36).slice(2, 9), t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: Date.now(), sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false }, o);
const day = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const books = [
  B({ id: 'rosa', img: 'https://covers.test/c.jpg', t: 'Il nome della rosa', a: 'Umberto Eco', e: 'Bompiani', y: '2012', c: 14, i: '9788806219352', sh: 'Soggiorno 2', p: 'Marco', pd: day(21) }),
  B({ id: 'cook', t: 'Giornali di bordo', a: 'James Cook', e: 'TEA', y: '2021', c: 16, g: ['e'] }),
  B({ id: 'citta', t: 'Le città invisibili', a: 'Italo Calvino', e: 'Mondadori', y: '1993', c: 11, p: 'Anna', pd: day(60) }),
  B({ id: 'levi', t: 'Se questo è un uomo', a: 'Primo Levi', e: 'Einaudi', y: '2014', c: 12 }),
  B({ id: 'nf', t: '', i: '9788850269996', nf: true }),
  B({ id: 'wish', t: 'La storia', a: 'Elsa Morante', w: true }),
];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => r.url().startsWith('http://localhost') ? r.continue() : r.url().includes('covers.test') ? r.respond({ status: 200, contentType: 'image/jpeg', body: fs.readFileSync(CFG.IMG + '/cover.jpg') }) : r.abort());
  await page.evaluateOnNewDocument(() => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true); });
  await page.evaluateOnNewDocument((b) => { if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now() })); sessionStorage.seeded = 1; } }, books);
  await page.goto('http://localhost:8132/?vista=elenco', { waitUntil: 'load' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const rows = () => page.$$eval('#list .row', e => e.map(r => ({ id: r.dataset.id, closed: r.classList.contains('closed'), txt: r.innerText.replace(/\s+/g, ' ').trim().slice(0, 90) })));
  const click = sel => page.evaluate(s => document.querySelector(s).click(), sel);

  // 1) di regola chiuse: solo titolo, autore e (prestito / da verificare); il libro senza titolo è aperto da compilare
  let r = await rows(); console.log('[1]', r.map(x => (x.closed ? '▸ ' : '▾ ') + x.txt).join('\n    '));
  assert.strictEqual(r.length, 5);
  for (const id of ['rosa', 'cook', 'citta', 'levi']) assert(r.find(x => x.id === id).closed, id);
  assert(!r.find(x => x.id === 'nf').closed);
  const rosa = r.find(x => x.id === 'rosa').txt;
  assert(rosa.includes('Il nome della rosa') && rosa.includes('Umberto Eco') && rosa.includes('Prestato a Marco · da 3 settimane'));
  assert(!rosa.includes('Bompiani') && !rosa.includes('14,00') && !rosa.includes('Soggiorno'));
  assert(r.find(x => x.id === 'cook').txt.includes('Da verificare'));
  assert.strictEqual(await page.$('#list .row[data-id="rosa"] textarea'), null);
  // copertina nella riga chiusa: immagine se c'è, altrimenti riquadro con l'iniziale (senza articolo)
  assert(await page.$('#list .row[data-id="rosa"] .sum-img img'));
  assert.strictEqual(await page.$eval('#list .row[data-id="citta"] .sum-img.ph', e => e.textContent), 'C');
  assert.strictEqual(await page.$eval('#list .row[data-id="levi"] .sum-img.ph', e => e.textContent), 'S');
  await page.screenshot({ path: CFG.OUT + '/s_closed.png' });

  // 2) la freccetta apre la scheda con tutti i campi; di nuovo la chiude; si apre anche col tocco sul titolo
  await click('#list .row[data-id="levi"] .sum'); await wait(150);
  assert(await page.$('#list .row[data-id="levi"].open textarea[data-k="e"]'));
  assert.strictEqual(await page.$eval('#list .row[data-id="levi"] [data-k="e"]', e => e.value), 'Einaudi');
  await page.screenshot({ path: CFG.OUT + '/s_open.png' });
  // modifica e resta aperta
  await page.type('#list .row[data-id="levi"] [data-k="c"]', '5'); await wait(150);
  assert(await page.$('#list .row[data-id="levi"].open'));
  await click('#list .row[data-id="levi"] .chev-btn'); await wait(150);
  assert(await page.$('#list .row[data-id="levi"].closed'));
  // tastiera: Invio sul riassunto
  await page.focus('#list .row[data-id="levi"] .sum'); await page.keyboard.press('Enter'); await wait(150);
  assert(await page.$('#list .row[data-id="levi"].open'));
  // il tocco sull'etichetta del prestito apre il prestito, non la scheda
  await click('#list .row[data-id="rosa"] .sum .tag.loan'); await wait(150);
  assert(!(await page.$eval('#loanSheet', e => e.hidden))); assert(await page.$('#list .row[data-id="rosa"].closed'));
  await click('#loanCancel');
  console.log('[2 apri/chiudi] ok');

  // 3) pulsante Prestati: sempre visibile, conta, filtra, prestiti più vecchi prima; di nuovo = tutti
  assert.strictEqual(await page.$eval('#cntLoan', e => e.textContent), '2');
  await click('#fltLoan'); await wait(150);
  r = await rows(); console.log('[3 prestati]', r.map(x => x.txt).join(' | '));
  assert.deepStrictEqual(r.map(x => x.id), ['citta', 'rosa']);
  assert.strictEqual(await page.$eval('#fltLoan', e => e.getAttribute('aria-pressed')), 'true');
  await page.screenshot({ path: CFG.OUT + '/s_loans.png' });
  // restituito dalla lista filtrata
  await click('#list .row[data-id="rosa"] .tag.loan'); await wait(100); await click('#loanBack'); await wait(150);
  assert.deepStrictEqual((await rows()).map(x => x.id), ['citta']);
  assert.strictEqual(await page.$eval('#cntLoan', e => e.textContent), '1');
  console.log('[toast prima di Annulla]', await page.evaluate(() => [document.querySelector('#toastTxt').textContent, document.querySelector('#toastBtn').hidden, document.querySelector('#toastBtn').textContent, !!document.querySelector('#toastBtn').onclick]));
  await click('#toastBtn'); await wait(150);       // Annulla
  assert.strictEqual(await page.$eval('#cntLoan', e => e.textContent), '2');
  await click('#fltLoan'); await wait(150);
  assert.strictEqual((await rows()).length, 5);
  // dai Desideri porta alla Libreria filtrata
  await click('#tabWish'); await wait(100); await click('#fltLoan'); await wait(150);
  assert.strictEqual(await page.$eval('#tabLib', e => e.getAttribute('aria-selected')), 'true');
  assert.strictEqual((await rows()).length, 2);
  await click('#fltLoan');
  // nessun prestito: messaggio
  await page.evaluate(() => { window.__app.state.books.forEach(b => { b.p = ''; b.pd = ''; }); });
  await click('#fltLoan'); await wait(150);
  const none = await page.$eval('#list', e => e.innerText); console.log('[3 vuoto]', none);
  assert(none.includes('Nessun libro in prestito'));
  assert.strictEqual(await page.$eval('#cntLoan', e => e.textContent), '0');
  await click('#fltLoan');

  // 4) opzione «schede sempre aperte»
  await page.evaluate(() => { window.__app.openOptions(); document.querySelector('#optOpenAll').click(); }); await wait(150);
  assert.strictEqual(await page.$('#list .row.closed'), null); assert.strictEqual(await page.$('#list .chev-btn'), null);
  await page.evaluate(() => document.querySelector('#optOpenAll').click()); await wait(150);
  assert(await page.$('#list .row.closed'));
  await page.evaluate(() => { window.__app.closeOptions(); });

  // 5) schermo largo
  await page.setViewport({ width: 1100, height: 800 }); await wait(200);
  await click('#list .row[data-id="levi"].closed .sum').catch(() => {}); await wait(150);
  await page.screenshot({ path: CFG.OUT + '/s_closed_wide.png' });
  console.log('ERRORI:', errors.length ? errors : 'nessuno'); assert(!errors.length);
  console.log('e2e7 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
