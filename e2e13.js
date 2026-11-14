const CFG = require("./_config");
const puppeteer = require('puppeteer-core'); const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = CFG.APP;
const server = http.createServer((q, s) => { let p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); return s.end(); } const ext = path.extname(p); s.writeHead(200, { 'Content-Type': ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : ext === '.html' ? 'text/html' : ext === '.json' ? 'application/json' : 'application/octet-stream' }); s.end(d); }); }).listen(8142);
const B = o => Object.assign({ id: 'x', t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 1, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: '', rt: 0, rd: '' }, o);
const assert = require('assert');
const books = [
  B({ id: 'v1', t: 'A', a: 'X', e: 'Einaudi', i: '9788806000011', ts: 9 }),
  B({ id: 'v2', t: 'B', a: 'X', e: 'Einaudi', i: '9788806000028', ts: 8 }),
  B({ id: 'f1', t: 'C', a: 'X', e: 'Einaudi', i: '9788806000035', ts: 7, g: ['e'] }),
  B({ id: 'm1', t: 'D', a: 'X', e: 'Mondadori', i: '9788804000013', ts: 6 }),
  B({ id: 'm2', t: 'E', a: 'X', e: 'Oscar Mondadori', i: '9788804000020', ts: 5 }),
  B({ id: 'f2', t: 'F', a: 'X', e: 'Mondadori', i: '9788804000037', ts: 4, g: ['e'] }),
  B({ id: 'c1', t: 'G', a: 'X', e: 'Einaudi', y: '2001', i: '9788806000097', ts: 3, g: ['e', 'y', 'i'] }),
];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => { const u = r.url();
    if (u.startsWith('http://localhost')) return r.continue();
    const j = o => r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (u.includes('googleapis.com/books/v1/volumes?')) { const isbn = (decodeURIComponent(u).match(/97[89]\d{10}/) || [])[0];
      return j({ items: [{ id: 'z' + isbn, volumeInfo: { title: 'Libro ' + isbn, authors: ['Autore'], publishedDate: '2020', industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn }] } }] }); }
    if (/googleapis|openlibrary/.test(u)) return j({});
    if (u.includes('crossref')) return j({ message: { items: [] } });
    r.abort(); });
  await page.evaluateOnNewDocument((b) => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), price: false })); sessionStorage.seeded = 1; } }, books);
  await page.goto('http://localhost:8142/?vista=elenco', { waitUntil: 'load' });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const g = id => page.evaluate(i => window.__app.state.books.find(b => b.id === i).g.join(','), id);
  await wait(1200);
  console.log('[1 dopo l\'avvio] f1:', await g('f1'), '| f2:', await g('f2'), '| c1:', await g('c1'));
  assert.strictEqual(await g('f1'), ''); assert.strictEqual(await g('f2'), 'e'); assert.strictEqual(await g('c1'), 'e,y,i');
  const nt = await page.$eval('#noticeTxt', e => e.textContent); console.log('[1 avviso]', nt); assert(nt.includes('da 1 casa editrice'));
  await page.click('#noticeBtn'); await wait(100); assert.strictEqual(await g('f1'), 'e');
  // una volta sola
  await page.reload({ waitUntil: 'load' }); await wait(1200);
  assert.strictEqual(await g('f1'), 'e'); assert(await page.$eval('#notice', e => e.hidden || !e.textContent.includes('Ho tolto')));
  // libri nuovi: editore copiato dai tuoi libri -> verificato; dalla tabellina -> da verificare
  await page.evaluate(() => { window.__app.addIsbn('9788806000042'); window.__app.addIsbn('9788850200016'); });
  await page.waitForFunction(() => ['9788806000042', '9788850200016'].every(i => { const b = window.__app.state.books.find(x => x.i === i); return b && b.t; }), { timeout: 15000 });
  const nb = await page.evaluate(() => ['9788806000042', '9788850200016'].map(i => { const b = window.__app.state.books.find(x => x.i === i); return b.e + ' [' + b.g.join(',') + ']'; }));
  console.log('[2 nuovi]', nb);
  assert.deepStrictEqual(nb, ['Einaudi []', 'TEA [e]']);
  console.log('ERRORI:', errors.length ? errors : 'nessuno'); assert(!errors.length);
  console.log('e2e13 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
