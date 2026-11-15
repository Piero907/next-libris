const CFG = require("./_config");
// condividere chiave Google e worker: avviso, link «#k=», conferma di chi riceve
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP, BASE = 'http://localhost:' + CFG.port(8148) + '/?vista=elenco';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8148));
const W = 'https://sbn-libri.piero.workers.dev', K = 'AIzaSyA1b2C3d4E5f6G7h8I9j0KlMnOpQrStUvW';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function open(url, set) {
    const ctx = await browser.createBrowserContext(); const p = await ctx.newPage();
    await p.evaluateOnNewDocument(s => {
      if (!localStorage.getItem('catalogo-libri-set')) localStorage.setItem('catalogo-libri-set', JSON.stringify(s));
      window.__shared = []; window.__copied = [];
      Object.defineProperty(navigator, 'share', { configurable: true, value: d => { window.__shared.push(d); return Promise.resolve(); } });
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__copied.push(t); return Promise.resolve(); } } });
    }, Object.assign({ installed: true, instScope: '/', swiped: true, lastBackup: Date.now() }, set));
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
    await p.setRequestInterception(true); p.on('request', r => r.url().startsWith(BASE.split('?')[0]) ? r.continue() : r.respond({ status: 404, body: '' }));
    await p.goto(url, { waitUntil: 'load' }); await wait(400); return p;
  }
  const tap = (p, s) => p.$eval(s, e => e.click()), hid = (p, s) => p.$eval(s, e => e.hidden), txt = (p, s) => p.$eval(s, e => e.innerText.replace(/\s+/g, ' ').trim());
  const set = p => p.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')));
  // 1) senza chiave né worker: pulsante disattivato
  let p = await open(BASE, {});
  await p.evaluate(() => window.__app.openOptions('share')); await wait(150);
  assert(await p.$eval('#svcShareBtn', e => e.disabled)); assert(!(await hid(p, '#svcShareNone')));
  await p.browserContext().close();
  // 2) chi invia
  p = await open(BASE, { name: 'Piero', sbnUrl: W, gbKey: K });
  await p.evaluate(() => window.__app.openOptions('share')); await wait(150);
  await tap(p, '#svcShareBtn'); await wait(150);
  assert(!(await hid(p, '#svcSheet'))); console.log('[2 foglio]', await txt(p, '#svcWhat'), '|', (await txt(p, '.svc-warn')).slice(0, 60) + '…');
  await p.screenshot({ path: CFG.OUT + '/svc_send.png' });
  await tap(p, '#svcForm button[type="submit"]'); await wait(300);
  const sh = (await p.evaluate(() => window.__shared))[0]; console.log('[2 messaggio]', sh.text, '\n', sh.url.slice(0, 80) + '…');
  assert(sh.text.startsWith('Piero ti manda la chiave Google e il worker SBN per Next Libris')); assert(/#k=[zj][\w-]+$/.test(sh.url)); assert(!sh.text.includes(K));
  const link = sh.url.split('#')[1];
  // solo il worker
  await p.evaluate(() => window.__app.openOptions('share')); await wait(100); await tap(p, '#svcShareBtn'); await wait(100);
  await p.$eval('#svcKeyOn', e => { e.checked = false; }); await tap(p, '#svcCopy'); await wait(300);
  const onlyW = (await p.evaluate(() => window.__copied))[0]; assert(onlyW.startsWith('Piero ti manda il worker SBN')); const linkW = onlyW.match(/#(k=[\w-]+)$/)[1];
  assert.deepStrictEqual(p.errors, []); await p.browserContext().close();
  // 3) chi riceve senza impostazioni: «Usali», poi Annulla e di nuovo
  p = await open(BASE + '#' + link, { name: 'Anna' });
  assert(!(await hid(p, '#svcInSheet'))); console.log('[3 ricevuto]', await txt(p, '#svcInH'), '|', await txt(p, '#svcInList'));
  assert.strictEqual(await txt(p, '#svcInH'), 'Piero ti manda chiave Google e worker SBN'); assert.strictEqual(p.url(), BASE);
  await p.screenshot({ path: CFG.OUT + '/svc_in.png' });
  await tap(p, '#svcInUse'); await wait(150);
  let st = await set(p); assert.deepStrictEqual([st.sbnUrl, st.gbKey], [W, K]); console.log('[3 usati]', await p.$eval('#toastTxt', e => e.textContent));
  await tap(p, '#toastBtn'); await wait(100); st = await set(p); assert.deepStrictEqual([st.sbnUrl, st.gbKey], ['', '']);
  // tra i salvati comunque (Annulla li tiene lì)
  assert.deepStrictEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-saved'))), { sbn: [W], key: [K] });
  await p.browserContext().close();
  // 4) chi ha già i suoi: «Mettili tra i salvati» non cambia quelli in uso
  p = await open(BASE + '#' + link, { sbnUrl: 'https://mio.anna.workers.dev', gbKey: 'AIzaSyANNAANNAANNAANNAANNAANNAANNAANNAAN' });
  console.log('[4 lista]', await txt(p, '#svcInList')); assert((await txt(p, '#svcInList')).includes('al posto del tuo'));
  await tap(p, '#svcInLater'); await wait(150);
  st = await set(p); assert.strictEqual(st.sbnUrl, 'https://mio.anna.workers.dev');
  const sv = await p.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-saved'))); assert(sv.sbn.includes(W) && sv.key.includes(K));
  // solo worker; «No, grazie» non tocca niente
  await p.evaluate(h => { location.hash = h; }, linkW); await wait(400);
  assert.strictEqual(await txt(p, '#svcInH'), 'Piero ti manda il worker SBN'); await tap(p, '#svcInNo'); assert(await hid(p, '#svcInSheet'));
  // ostile: worker non https e chiave strana -> rifiutato
  const evil = 'j' + Buffer.from(JSON.stringify({ v: 1, t: 'svc', n: '<img src=x onerror=window.__pwn=1>', sb: 'javascript:alert(1)', gk: '<script>' })).toString('base64url');
  await p.evaluate(h => { location.hash = 'k=' + h; }, evil); await wait(400);
  assert(await hid(p, '#svcInSheet')); console.log('[4 ostile]', await p.$eval('#toastTxt', e => e.textContent));
  const evil2 = 'j' + Buffer.from(JSON.stringify({ v: 1, t: 'svc', n: '<img src=x onerror=window.__pwn=1>', sb: W })).toString('base64url');
  await p.evaluate(h => { location.hash = 'k=' + h; }, evil2); await wait(400);
  assert.strictEqual(await p.$$eval('#svcInSheet img', a => a.length), 0); assert.strictEqual(await p.evaluate(() => window.__pwn), undefined);
  assert.deepStrictEqual(p.errors, []); await p.browserContext().close();
  console.log('e2e31 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
