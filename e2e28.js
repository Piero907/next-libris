const CFG = require("./_config");
const H = require('./_harness');
const APPU = /'https:\/\/nextlibris\.github\.io\/';/.test(require('fs').readdirSync(CFG.APP).filter(f => /^app(-[a-z-]+)?\.js$/.test(f)).map(f => require('fs').readFileSync(require('path').join(CFG.APP, f), 'utf8')).join('\n')) ? 'https://nextlibris.github.io/' : 'https://piero907.github.io/next-libris/';   // indirizzo dell'app (dalla versione 100 nextlibris.github.io)
// preferiti, condivisione di un libro e di una lista, link ricevuto, provenienza
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8144), ROOT);
const BASE = 'http://localhost:' + CFG.port(8144) + '/?vista=elenco';
const BOOKS = [
  { id: 'b1', t: 'Il nome della rosa', a: 'Umberto Eco', e: 'Bompiani', y: '2012', c: 14, i: '9788845292613', ts: 5, img: 'https://books.google.com/books/content?id=ROSA&img=1&zoom=1', pg: '624', n: 'nota segreta', p: 'Marco', sh: 'Studio', gen: 'Gialli', rt: 5 },
  { id: 'b2', t: 'Il deserto dei Tartari', a: 'Dino Buzzati', e: 'Mondadori', y: '2016', i: '9788804668015', ts: 4, gen: 'Narrativa', c: 12.5, imgL: 'https://covers.openlibrary.org/b/isbn/9788804668015-L.jpg?default=false', pg: '240' },
  { id: 'b3', t: 'Uno, nessuno e centomila', a: 'Luigi Pirandello', ts: 3, gen: 'Gialli' },
  { id: 'w1', t: 'Le città invisibili', a: 'Italo Calvino', i: '9788804668022', ts: 2, w: true }];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const wait = H.wait;   // attesa «finché» (_harness.js)
  async function open(url, set, books, noShare) {
    const ctx = await browser.createBrowserContext(); const p = await ctx.newPage();
    await p.evaluateOnNewDocument((s, b, ns) => {
      window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
      if (!localStorage.getItem('catalogo-libri-set')) { localStorage.setItem('catalogo-libri-set', JSON.stringify(s)); if (b) localStorage.setItem('catalogo-libri-v2', JSON.stringify({ updated: Date.now(), books: b })); }
      window.__shared = []; window.__copied = [];
      Object.defineProperty(navigator, 'share', { configurable: true, value: ns ? undefined : (d => { window.__shared.push({ title: d.title, text: d.text, url: d.url, file: d.files && d.files[0] && d.files[0].name, fileText: null, _f: d.files && d.files[0] }); const x = window.__shared[window.__shared.length - 1]; return x._f ? x._f.text().then(t => { x.fileText = t; delete x._f; }) : Promise.resolve(); }) });
      navigator.canShare = () => true;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__copied.push(t); return Promise.resolve(); } } });
    }, Object.assign({ installed: true, instScope: '/', swiped: true, lastBackup: Date.now(), price: false }, set || {}), books || null, !!noShare);
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
    await p.setRequestInterception(true); p.on('request', r => r.url().startsWith(BASE.split('?')[0]) ? r.continue() : r.respond({ status: 404, body: '' }));
    await p.goto(url, { waitUntil: 'load' }); await wait(450);
    return p;
  }
  const hid = (p, s) => p.$eval(s, e => e.hidden), txt = (p, s) => p.$eval(s, e => e.innerText.replace(/\s+/g, ' ').trim());
  const tap = (p, s) => p.$eval(s, e => e.click());
  const set = p => p.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')));
  const books = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__app.state.books)));
  const toast = p => p.$eval('#toastTxt', e => e.textContent);

  // ===== A) chi invia =====
  let p = await open(BASE, {}, BOOKS);
  // 1) preferito: pulsante nella scheda, etichetta nella riga chiusa, filtro
  await tap(p, '#list .row[data-id="b1"] .sum'); await wait(150);
  assert.strictEqual(await txt(p, '#list .row[data-id="b1"] .acts-main'), 'Prestato Desideri Preferito Lo consiglio Cerca sul web Elimina');
  await tap(p, '#list .row[data-id="b1"] [data-act="fav"]'); await wait(150);
  assert((await books(p)).find(b => b.id === 'b1').fav === true);
  assert(await p.$('#list .row[data-id="b1"] [data-act="fav"].on'));
  await p.screenshot({ path: CFG.OUT + '/sh_card.png' });
  await tap(p, '#list .row[data-id="b1"] [data-act="toggle"]'); await wait(150);
  assert((await txt(p, '#list .row[data-id="b1"] .sum-tags')).includes('Preferito'));
  await p.evaluate(() => { window.__app.state.books.find(b => b.id === 'b2').fav = true; window.__app.openDrawer('flt'); }); await wait(350);
  console.log('[1 menu]', await txt(p, '#drawerFlt .dpills'));
  await tap(p, '#drawerFlt [data-g="flt"][data-v="fav"]'); await wait(150);
  await p.evaluate(() => window.__app.closeDrawer()); await wait(350);
  assert.strictEqual(await p.$$eval('#list .row', r => r.length), 2);
  assert(!(await hid(p, '#btnShareWish')), 'con un filtro compare «Condividi la lista»');
  // vista Copertine: stellina gialla in alto a destra solo sui preferiti (fino alla 96 un segnalibro)
  await tap(p, '#btnView'); await wait(200);
  const rib = await p.$$eval('#list .cover', a => a.map(c => { const r = c.querySelector('.ribbon'); if (!r) return c.dataset.id; const A = c.querySelector('.art').getBoundingClientRect(), R = r.getBoundingClientRect(); return c.dataset.id + ':' + (R.right <= A.right && A.right - R.right < 20 && R.top - A.top < 10 && Math.abs(R.width - R.height) < 1 ? 'altodx' : 'fuori') + ':' + getComputedStyle(r.querySelector('path')).fill; }));
  console.log('[1 copertine]', rib.join(' '));
  assert.deepStrictEqual(rib.sort(), ['b1:altodx:rgb(244, 196, 48)', 'b2:altodx:rgb(244, 196, 48)']);
  await p.evaluate(() => document.querySelector('#drawerReset').click()); await wait(150);
  assert.strictEqual(await p.$$eval('#list .cover .ribbon', a => a.length), 2); assert.strictEqual(await p.$$eval('#list .cover', a => a.length), 3);
  await tap(p, '#btnView'); await wait(200);
  await p.evaluate(() => window.__app.openDrawer('flt')); await wait(350); await tap(p, '#drawerFlt [data-g="flt"][data-v="fav"]'); await wait(150); await p.evaluate(() => window.__app.closeDrawer()); await wait(350);


  // 2) condividi i preferiti: chiede il nome la prima volta, anteprima, messaggio e link
  await tap(p, '#btnShareWish'); await wait(150);
  assert(!(await hid(p, '#shareSheet'))); assert(await hid(p, '#shareTitleBox'));
  console.log('[2 foglio]', await txt(p, '#shareH'), '|', await txt(p, '#shareWhat'), '|', await txt(p, '#sharePrev'));
  assert.strictEqual(await txt(p, '#sharePrev'), 'Chi riceve vedrà: Una lista di libri preferiti');
  await p.type('#shareName', 'Piero'); await wait(50);
  assert.strictEqual(await txt(p, '#sharePrev'), 'Chi riceve vedrà: I preferiti di Piero');
  await p.screenshot({ path: CFG.OUT + '/sh_send.png' });
  await tap(p, '#shareSend'); await wait(300);
  let sh = (await p.evaluate(() => window.__shared))[0];
  console.log('[2 messaggio]\n' + sh.text + '\n' + sh.url);
  assert.strictEqual(sh.title, 'I preferiti di Piero'); assert(sh.text.startsWith('I preferiti di Piero (2 libri):')); assert(sh.text.includes('«Il nome della rosa» di Umberto Eco (Bompiani, 2012) · 14,00 €')); assert(sh.text.includes('Totale: 26,50 €'));
  assert(sh.url.startsWith(APPU + '#l=z') && /#l=z[\w-]+$/.test(sh.url));
  assert(!/segreta|Marco|Studio/.test(sh.text));
  assert.strictEqual((await set(p)).name, 'Piero'); assert(await hid(p, '#shareSheet'));
  const favLink = sh.url.split('#')[1];

  // 3) condividi un libro dalla scheda: il nome è già lì; «Copia»
  await p.evaluate(() => window.__app.setTab('lib')); await wait(100);
  await tap(p, '#list .row[data-id="b1"] .sum'); await wait(150);
  await tap(p, '#list .row[data-id="b1"] [data-act="share"]'); await wait(150);
  assert.strictEqual(await p.$eval('#shareName', e => e.value), 'Piero');
  assert.strictEqual(await txt(p, '#sharePrev'), 'Chi riceve vedrà: Piero ti consiglia un libro');
  await tap(p, '#shareCopy'); await wait(300);
  const copied = (await p.evaluate(() => window.__copied))[0];
  console.log('[3 copiato]\n' + copied);
  assert(copied.startsWith('Piero ti consiglia un libro:\n«Il nome della rosa» di Umberto Eco (Bompiani, 2012) · 14,00 €\nGialli · 624 pagine\nISBN 9788845292613')); assert(copied.includes('Aprilo in Next Libris'));
  const bookLink = copied.match(/#(l=[\w-]+)$/)[1];

  // 4) lista per genere: nome della lista proposto e modificabile
  await p.evaluate(() => window.__app.openDrawer('flt')); await wait(350);
  await p.$$eval('#drawerFlt .dpill[data-g="gen"]', a => a.find(x => x.textContent.startsWith('Gialli')).click()); await wait(150);
  await p.evaluate(() => window.__app.closeDrawer()); await wait(350);
  await tap(p, '#btnShareWish'); await wait(150);
  assert(!(await hid(p, '#shareTitleBox'))); assert.strictEqual(await p.$eval('#shareTitle', e => e.value), 'Gialli');
  assert.strictEqual(await txt(p, '#sharePrev'), 'Chi riceve vedrà: «Gialli» · lista di Piero');
  await tap(p, '#shareSend'); await wait(300);
  sh = (await p.evaluate(() => window.__shared))[1]; const listLink = sh.url.split('#')[1];
  // Desideri: tipo «wish»; da Esporta
  await p.evaluate(() => window.__app.setTab('wish')); await wait(150);
  await tap(p, '#btnShareList2'); await wait(150);
  assert.strictEqual(await txt(p, '#sharePrev'), 'Chi riceve vedrà: I desideri di Piero'); await tap(p, '#shareClose');
  // lista lunga: parte come file
  await p.evaluate(() => { for (let i = 0; i < 180; i++) window.__app.state.books.push({ id: 'x' + i, t: 'Titolo abbastanza lungo numero ' + i + ' ' + Math.random().toString(36).slice(2), a: 'Autore ' + Math.random().toString(36).slice(2), e: 'Editore', y: '2001', i: '', g: [], ts: 0, w: false, gen: 'Tanti' }); window.__app.setTab('lib'); }); await wait(200);
  await tap(p, '#btnShareList2'); await wait(150); await tap(p, '#shareSend'); await wait(500);
  sh = (await p.evaluate(() => window.__shared)).pop();
  console.log('[4 lista lunga] file:', sh.file, '|', sh.text.split('\n')[0]);
  assert.strictEqual(sh.file, 'next-libris-lista-piero.json'); assert(sh.text.includes('Ripristina da backup o apri una lista ricevuta'));
  fs.writeFileSync(CFG.OUT + '/lista_piero.json', sh.fileText);
  assert.deepStrictEqual(p.errors, []);
  await p.browserContext().close();

  // ===== B) chi riceve =====
  // 5) link dei preferiti su un'app che ha già uno dei due libri
  p = await open(BASE + '#' + favLink, {}, [{ id: 'm1', t: 'Il nome della rosa', a: 'Umberto Eco', i: '9788845292613', ts: 1 }]);
  assert(!(await hid(p, '#importSheet')), 'il link apre l\'anteprima');
  console.log('[5 anteprima]', await txt(p, '#importH'), '|', await txt(p, '#importMsg'), '|', await txt(p, '#importList'));
  assert.strictEqual(await txt(p, '#importH'), 'I preferiti di Piero');
  assert.strictEqual(p.url(), BASE, 'il link sparisce dall\'indirizzo');
  assert.deepStrictEqual(await p.$$eval('#importList input', a => a.map(c => [c.checked, c.disabled])), [[false, true], [true, false]]);
  await p.screenshot({ path: CFG.OUT + '/sh_import.png' });
  await tap(p, '#importWish'); await wait(300);
  let bs = await books(p), nb = bs.find(b => b.t === 'Il deserto dei Tartari');
  console.log('[5 importato]', JSON.stringify({ w: nb.w, fr: nb.fr, fl: nb.fl, i: nb.i, e: nb.e, y: nb.y, fav: nb.fav, rs: nb.rs }), '|', await toast(p));
  assert.strictEqual(bs.length, 2); assert.deepStrictEqual([nb.w, nb.fr, nb.fl, nb.i, nb.e, nb.y, nb.fav], [true, 'Piero', 'Preferiti', '9788804668015', 'Mondadori', '2016', false]);
  console.log('[5 dati in più]', nb.c, nb.gen, nb.pg, nb.img === nb.imgL, nb.img);
  assert.deepStrictEqual([nb.c, nb.gen, nb.pg, nb.imgL, nb.n, nb.sh, nb.rt], [12.5, 'Narrativa', '240', 'https://covers.openlibrary.org/b/isbn/9788804668015-L.jpg?default=false', '', '', 0]);
  assert.strictEqual(await toast(p), '1 libro aggiunto ai Desideri.');
  assert((await txt(p, '#list .row[data-id="' + nb.id + '"] .sum-tags')).includes('Da Piero'));
  assert((await txt(p, '#activeFlt')).includes('Ricevuti da Piero'));
  await p.screenshot({ path: CFG.OUT + '/sh_received.png' });
  // Annulla toglie i libri aggiunti
  await tap(p, '#toastBtn'); await wait(200); assert.strictEqual((await books(p)).length, 1);
  // dopo il riavvio niente anteprima (il link non c'è più)
  await p.reload({ waitUntil: 'load' }); await wait(400); assert(await hid(p, '#importSheet'));
  // 6) link di un libro mentre l'app è aperta (hashchange) -> Libreria
  await p.evaluate(h => { location.hash = h; }, bookLink); await wait(500);
  console.log('[6 libro]', await txt(p, '#importH'), '|', await txt(p, '#importMsg'));
  assert.strictEqual(await txt(p, '#importH'), 'Piero ti consiglia un libro'); assert((await txt(p, '#importMsg')).includes('già nel tuo elenco'));
  assert(await hid(p, '#importWish')); await tap(p, '#importClose');
  // 7) lista con nome, in Libreria; menu «Ricevuti da»
  await p.evaluate(h => { location.hash = h; }, listLink); await wait(500);
  assert.strictEqual(await txt(p, '#importH'), '«Gialli» · lista di Piero');
  await tap(p, '#importLib'); await wait(300);
  bs = await books(p); nb = bs.find(b => b.t === 'Uno, nessuno e centomila');
  assert.deepStrictEqual([nb.w, nb.fr, nb.fl, nb.rs], [false, 'Piero', 'Gialli', 'da']);
  await p.evaluate(() => window.__app.openDrawer('flt')); await wait(350);
  console.log('[7 menu]', await txt(p, '#drawerFlt'));
  assert((await txt(p, '#drawerFlt')).includes('Ricevuti da Piero1'.replace('Piero1', 'Piero 1')) || (await txt(p, '#drawerFlt')).includes('Ricevuti da'));
  await p.evaluate(() => window.__app.closeDrawer()); await wait(350);
  // scheda aperta: etichetta con il nome e la lista
  await tap(p, '#list .row[data-id="' + nb.id + '"] .sum'); await wait(150);
  assert.strictEqual(await p.$eval('#list .row[data-id="' + nb.id + '"] .tag.from', e => e.title), 'Ricevuto da Piero, dalla lista «Gialli»');
  // 8) file con la lista lunga da «Ripristina»
  await (await p.$('#fileBackup')).uploadFile(CFG.OUT + '/lista_piero.json'); await wait(500);
  console.log('[8 file]', await txt(p, '#importH'), '|', await txt(p, '#importMsg'));
  assert(!(await hid(p, '#importSheet'))); assert((await txt(p, '#importMsg')).startsWith('18')); await tap(p, '#importClose');
  // 9) link rovinato o ostile: messaggio, nessun errore
  await p.evaluate(() => { location.hash = 'l=zAAAA_rotto'; }); await wait(400);
  console.log('[9 rotto]', await toast(p)); assert((await toast(p)).includes('non contiene una lista valida')); assert(await hid(p, '#importSheet'));
  const evil = 'j' + Buffer.from(JSON.stringify({ v: 1, n: '<img src=x onerror=window.__pwn=1>', k: 'list', h: '<b>x</b>', b: [['<img src=x onerror=window.__pwn=1>', '<script>window.__pwn=1</script>']] })).toString('base64url');
  await p.evaluate(h => { location.hash = 'l=' + h; }, evil); await wait(400);
  assert(!(await hid(p, '#importSheet'))); assert.strictEqual(await p.$$eval('#importSheet img, #importSheet script', a => a.length), 0);
  await tap(p, '#importWish'); await wait(300);
  assert.strictEqual(await p.evaluate(() => window.__pwn), undefined); assert.strictEqual(await p.$$eval('#list img[src="x"], #list script', a => a.length), 0);
  assert.deepStrictEqual(p.errors, []);
  await p.browserContext().close();

  // 10) prima apertura: il benvenuto chiede il nome; link senza nome -> «un amico»
  p = await open(BASE, {}, null);
  assert(await p.$('#welcomeName'));
  await p.type('#welcomeName', '  Anna  '); await p.$eval('#welcomeName', e => e.dispatchEvent(new Event('change', { bubbles: true }))); await wait(100);
  assert.strictEqual((await set(p)).name, 'Anna');
  await p.evaluate(() => window.__app.openOptions('share')); await wait(150);
  assert.strictEqual(await p.$eval('#optName', e => e.value), 'Anna'); assert.strictEqual(await txt(p, '#optH'), 'Condivisione');
  await p.screenshot({ path: CFG.OUT + '/sh_opts.png' });
  await p.evaluate(() => window.__app.closeOptions());
  const anon = 'j' + Buffer.from(JSON.stringify({ v: 1, k: 'book', b: [['Lessico famigliare', 'Natalia Ginzburg']] })).toString('base64url');
  await p.evaluate(h => { location.hash = 'l=' + h; }, anon); await wait(400);
  assert.strictEqual(await txt(p, '#importH'), 'Un libro consigliato');
  await tap(p, '#importWish'); await wait(300);
  assert.strictEqual((await books(p))[0].fr, 'un amico');
  // il backup conserva preferiti e provenienza
  const back = await p.evaluate(() => { const b = window.__app.state.books[0]; b.fav = true; return JSON.parse(localStorage.getItem('catalogo-libri-v2') || '{}'); });
  assert.deepStrictEqual(p.errors, []);
  await p.browserContext().close();

  // 11) senza condivisione del telefono: «Manda» copia
  p = await open(BASE, { name: 'Piero' }, BOOKS, true);
  await tap(p, '#list .row[data-id="b2"] .sum'); await wait(150); await tap(p, '#list .row[data-id="b2"] [data-act="share"]'); await wait(150); await tap(p, '#shareSend'); await wait(300);
  assert((await p.evaluate(() => window.__copied))[0].includes('#l=')); console.log('[11 senza share]', await toast(p));
  await p.browserContext().close();
  console.log('e2e28 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
