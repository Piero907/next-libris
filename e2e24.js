const CFG = require("./_config");
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8135));
const W1 = 'https://sbn-libri.piero.workers.dev', W0 = 'https://vecchio.piero.workers.dev', K1 = 'AIzaSyA1b2C3d4E5f6G7h8I9j0KlMnOpQrStUvW';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function open(set, dark) {
    const ctx = await browser.createBrowserContext(); const p = await ctx.newPage();
    await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }]);
    await p.evaluateOnNewDocument(s => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true); if (s && !localStorage.getItem('catalogo-libri-set')) localStorage.setItem('catalogo-libri-set', JSON.stringify(s)); }, set);
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
    await p.setRequestInterception(true); p.on('request', r => r.url().startsWith('http://localhost:' + CFG.port(8135) + '') ? r.continue() : r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }));
    await p.goto('http://localhost:' + CFG.port(8135) + '/?vista=elenco', { waitUntil: 'load' }); await wait(400);
    return p;
  }
  const look = p => p.evaluate(() => [document.documentElement.getAttribute('data-theme'), getComputedStyle(document.body).backgroundColor, JSON.parse(localStorage.getItem('catalogo-libri-set')).theme]);
  const LIGHT = 'rgb(238, 241, 238)', DARK = 'rgb(15, 21, 19)';

  // 1) tema: chiaro di default anche con il telefono in modalità scura
  let p = await open(null, true);
  let l = await look(p); console.log('[1 nuovo, telefono scuro]', l); assert.deepStrictEqual(l, ['light', LIGHT, 'light']);
  await p.browserContext().close();
  p = await open({ installed: true, instScope: '/', theme: 'auto', palV2: true, pal: 'bosco' }, true);          // chi aveva «Automatico» senza averlo mai scelto
  l = await look(p); console.log('[1 vecchio auto]', l); assert.deepStrictEqual(l, ['light', LIGHT, 'light']);
  // Opzioni › Aspetto: «Chiaro» è il primo e selezionato
  await p.evaluate(() => window.__app.openOptions('look')); await wait(150);
  const radios = await p.$$eval('input[name="theme"]', a => a.map(r => r.value + (r.checked ? '*' : '')));
  console.log('[1 scelte]', radios); assert.deepStrictEqual(radios, ['light*', 'dark', 'auto']);
  // scelgo Automatico: resta Automatico anche dopo il riavvio
  await p.evaluate(() => { const r = document.querySelector('input[name="theme"][value="auto"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(100);
  await p.reload({ waitUntil: 'load' }); await wait(300);
  l = await look(p); console.log('[1 auto scelto]', l); assert.deepStrictEqual(l, [null, DARK, 'auto']);
  // «Torna all'aspetto predefinito» rimette il chiaro
  await p.evaluate(() => window.__app.openOptions('look')); await wait(150);
  await p.$eval('#lookReset', b => b.click()); await wait(150);
  l = await look(p); console.log('[1 predefinito]', l); assert.deepStrictEqual(l, ['light', LIGHT, 'light']);
  assert.deepStrictEqual(p.errors, []);
  await p.browserContext().close();
  p = await open({ installed: true, instScope: '/', theme: 'dark' }, false);                                      // chi aveva scelto «Scuro» lo tiene
  l = await look(p); console.log('[1 vecchio scuro]', l); assert.deepStrictEqual(l, ['dark', DARK, 'dark']);
  await p.browserContext().close();

  // 2) benvenuto: tre modi toccabili, nessuna scheda d'esempio, niente suggerimento doppio sotto i tasti
  p = await open({ installed: true, instScope: '/' }, false);
  const w = await p.$eval('.welcome', e => e.innerText.replace(/\s+/g, ' ').trim());
  console.log('[2 benvenuto]', w);
  assert(!/ISBN non valido|Esempio di scheda/.test(w));
  assert.deepStrictEqual(await p.$$eval('.welcome .way', a => a.map(b => b.dataset.act)), ['way-scan', 'way-photo', 'way-type']);
  assert.strictEqual(await p.$eval('#tipTxt', e => getComputedStyle(e).display), 'none');
  await p.$eval('[data-act="way-type"]', b => b.click()); await wait(150);
  assert(!(await p.$eval('#isbnSheet', e => e.hidden)), 'Digita apre il foglio'); await p.keyboard.press('Escape'); await p.evaluate(() => { document.querySelector('#isbnSheet').hidden = true; });
  await p.$eval('[data-act="way-photo"]', b => b.click()); await wait(150);
  assert(!(await p.$eval('#photoSheet', e => e.hidden)), 'Foto apre la scelta'); await p.$eval('#photoClose', b => b.click()); await wait(100);
  // nei Desideri il suggerimento torna
  await p.evaluate(() => window.__app.setTab('wish')); await wait(100);
  assert.notStrictEqual(await p.$eval('#tipTxt', e => getComputedStyle(e).display), 'none');
  await p.evaluate(() => window.__app.setTab('lib')); await wait(100);

  // 3) «Ripristinalo»: backup con libri, worker e chiave -> tornano tutti
  const bk = { app: 'catalogo-libri', v: 4, books: [{ id: 'b1', t: 'Il nome della rosa', a: 'Umberto Eco', i: '9788845292613', ts: 1 }], cfg: { sbnUrl: W1, gbKey: K1, saved: { sbn: [W1, W0], key: [K1] } } };
  fs.writeFileSync(CFG.OUT + '/backup_cfg.json', JSON.stringify(bk));
  const [ch] = await Promise.all([p.waitForFileChooser(), p.$eval('.welcome [data-act="restore"]', b => b.click())]);
  await ch.accept([CFG.OUT + '/backup_cfg.json']); await wait(500);
  const toast = await p.$eval('#toastTxt', e => e.textContent); console.log('[3 ripristino]', toast);
  assert.strictEqual(toast, '1 libro ripristinato. Tornano in uso anche il worker SBN e la chiave Google.');
  let st = await p.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')));
  assert.strictEqual(st.sbnUrl, W1); assert.strictEqual(st.gbKey, K1);
  assert.deepStrictEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-saved'))), { sbn: [W1, W0], key: [K1] });
  await p.evaluate(() => window.__app.openOptions('search')); await wait(150);
  console.log('[3 ricerca]', await p.$eval('#sbnSt', e => e.textContent), await p.$eval('#sbnUrl', e => e.value), '|', await p.$eval('#sbnSaved', e => e.innerText.replace(/\s+/g, ' ')));
  assert.strictEqual(await p.$eval('#sbnUrl', e => e.value), W1);
  await p.evaluate(() => window.__app.closeOptions()); await wait(100);

  // 4) il backup che fai contiene worker e chiave
  await p.evaluate(() => { window.__bk = null; navigator.canShare = () => true; navigator.share = async d => { window.__bk = await d.files[0].text(); }; });
  await p.$eval('#btnShareBackup', b => b.click()); await wait(400);
  const out = JSON.parse(await p.evaluate(() => window.__bk));
  console.log('[4 backup cfg]', JSON.stringify(out.cfg));
  assert.strictEqual(out.cfg.sbnUrl, W1); assert.strictEqual(out.cfg.gbKey, K1); assert.deepStrictEqual(out.cfg.saved.sbn, [W1, W0]);
  assert.strictEqual(out.books.length, 1);
  // ripristino su un telefono che ha già un worker diverso: non lo sostituisce, aggiunge ai salvati
  assert.deepStrictEqual(p.errors, []);
  await p.browserContext().close();
  p = await open({ installed: true, instScope: '/', sbnUrl: 'https://mio.piero.workers.dev' }, false);
  await (await p.$('#fileBackup')).uploadFile(CFG.OUT + '/backup_cfg.json'); await wait(500);
  console.log('[4 già impostato]', await p.$eval('#toastTxt', e => e.textContent));
  st = await p.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')));
  assert.strictEqual(st.sbnUrl, 'https://mio.piero.workers.dev'); assert.strictEqual(st.gbKey, K1);
  assert.deepStrictEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-saved')).sbn), ['https://mio.piero.workers.dev', W1, W0]);
  // backup vecchi (senza cfg) funzionano come prima
  fs.writeFileSync(CFG.OUT + '/backup_old.json', JSON.stringify({ app: 'catalogo-libri', v: 4, books: [{ id: 'b9', t: 'Vecchio', ts: 1 }] }));
  await (await p.$('#fileBackup')).uploadFile(CFG.OUT + '/backup_old.json'); await wait(500);
  console.log('[4 vecchio]', await p.$eval('#toastTxt', e => e.textContent));
  assert.strictEqual(await p.$eval('#toastTxt', e => e.textContent), '1 libro ripristinato.');
  assert.deepStrictEqual(p.errors, []);
  await p.browserContext().close();

  console.log('e2e24 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
