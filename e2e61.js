const CFG = require("./_config");
// obiettivo con la luce, «Prova la luce» (sì/no), Sostieni in evidenza in Opzioni › App: l'app prova gli obiettivi e usa quello con la torcia (e se lo ricorda); se nessuno ce l'ha
// o la luce non si accende davvero, i pulsanti della luce spariscono; Opzioni › App › «Prova gli obiettivi»
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.gz': 'application/gzip', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8181));
// tre obiettivi finti sopra la fotocamera finta di Chrome: anteriore, posteriore grandangolare (senza luce), posteriore principale.
// modi: ok, none (nessuna luce), dead (luce che resta spenta e lo dice), lie (dice accesa ma non si vede, come il Galaxy A32)
function stub(mode) {
  const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  window.__lenses = [{ id: 'f', label: 'camera2 1, facing front', fm: 'user', torch: false }, { id: 'w', label: 'camera2 2, facing back', fm: 'environment', torch: false }, { id: 'm', label: 'camera2 0, facing back', fm: 'environment', torch: mode !== 'none' }];
  window.__opened = []; window.__torchOn = false;
  navigator.mediaDevices.enumerateDevices = async () => window.__lenses.map(l => ({ kind: 'videoinput', deviceId: l.id, label: l.label, groupId: '' }));
  navigator.mediaDevices.getUserMedia = async (c) => {
    const v = (c && c.video) || {};
    let lens;
    if (v.deviceId) { const id = v.deviceId.exact || v.deviceId; lens = window.__lenses.find(l => l.id === id); if (!lens) throw new DOMException('x', 'OverconstrainedError'); }
    else lens = window.__lenses[1];                      // come su molti telefoni: «posteriore» = il grandangolare, senza luce
    const st = await real({ video: true, audio: false }), t = st.getVideoTracks()[0];
    let torch = false;
    t.getCapabilities = () => Object.assign({ facingMode: [lens.fm] }, lens.torch ? { torch: true } : {});
    const gs = t.getSettings.bind(t);
    t.getSettings = () => Object.assign(gs(), { deviceId: lens.id, facingMode: lens.fm }, lens.torch ? { torch } : {});
    t.applyConstraints = async (cc) => { const a = cc && cc.advanced && cc.advanced[0]; if (a && 'torch' in a) { if (!lens.torch) throw new DOMException('x', 'NotSupportedError'); if (mode !== 'dead') torch = a.torch; window.__torchOn = torch; } };
    window.__opened.push(lens.id);
    return st;
  };
}
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + CFG.IMG + '/blank.mjpeg'] });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const errors = [];
  async function open(mode) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    page.on('pageerror', e => errors.push(mode + ': ' + e.message));
    await page.evaluateOnNewDocument(stub, mode);
    await page.evaluateOnNewDocument(() => { if (!localStorage.getItem('catalogo-libri-set')) localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'P', selTip: 1, lastBackup: Date.now(), price: false })); });
    await page.goto('http://localhost:' + CFG.port(8181) + '/?vista=elenco', { waitUntil: 'load' }); await wait(500);
    return { ctx, page };
  }
  async function snapOpen(page) {
    await page.evaluate(() => document.querySelector('#btnPhoto').click()); await wait(150);
    await page.evaluate(() => document.querySelector('#photoCam').click());
    await page.waitForFunction(() => !document.querySelector('#snap').hidden && document.querySelector('#snapVideo').videoWidth > 0, { timeout: 15000 }); await wait(300);
  }
  const snapClose = page => page.evaluate(() => document.querySelector('#snapClose').click()).then(() => wait(300));
  // A) il flash e' sull'obiettivo principale, Chrome apre il grandangolare: l'app lo trova, lo usa e se lo ricorda
  let { ctx, page } = await open('ok');
  await snapOpen(page);
  let st = await page.evaluate(() => ({ opened: window.__opened, cam: window.__app.settings.torchCam, torch: !document.querySelector('#snapTorch').hidden }));
  console.log('[A prima volta]', JSON.stringify(st)); assert(st.cam === 'm' && st.torch && st.opened[st.opened.length - 1] === 'm');
  await page.click('#snapTorch'); await wait(200);
  assert(await page.evaluate(() => window.__torchOn === true && document.querySelector('#snapTorch').getAttribute('aria-pressed') === 'true'), 'luce accesa');
  await page.screenshot({ path: CFG.OUT + '/lens_torch.png' });
  await snapClose(page);
  await page.evaluate(() => { window.__opened = []; });
  await snapOpen(page);
  st = await page.evaluate(() => window.__opened); console.log('[A seconda volta]', JSON.stringify(st)); assert.deepStrictEqual(st, ['m'], 'subito l\'obiettivo giusto, senza riprovare');
  await snapClose(page);
  // anche la scansione usa quello: compaiono torcia (e flash con la copertina)
  await page.evaluate(() => window.__app.startScan()); await page.waitForFunction(() => !document.querySelector('#scan').hidden, { timeout: 8000 }); await wait(900);
  assert(await page.evaluate(() => !document.querySelector('#scanTorch').hidden));
  await page.evaluate(() => document.querySelector('#scanClose').click()); await wait(300);
  // diagnosi nelle Opzioni › App
  await page.evaluate(() => window.__app.openOptions('cards')); await wait(300);
  assert(/obiettivo con la luce/.test(await page.$eval('#lensState', e => e.textContent)));
  await page.click('#lensRun'); await page.waitForFunction(() => document.querySelectorAll('#lensList li').length === 3, { timeout: 15000 });
  const rows = await page.$$eval('#lensList li', e => e.map(x => x.textContent)); console.log('[A diagnosi]', JSON.stringify(rows));
  assert(rows.some(r => /facing back.*posteriore · luce sì · in uso/.test(r)) && rows.some(r => /anteriore · luce no/.test(r)));
  await page.screenshot({ path: CFG.OUT + '/lens_diag.png' });
  await ctx.close();
  // B) nessun obiettivo ha la luce: niente pulsanti della luce, ne' nelle foto ne' nella scansione
  ({ ctx, page } = await open('none'));
  await snapOpen(page);
  st = await page.evaluate(() => ({ cam: window.__app.settings.torchCam, torch: !document.querySelector('#snapTorch').hidden }));
  console.log('[B senza luce]', JSON.stringify(st)); assert(st.cam === 'none' && !st.torch);
  await snapClose(page);
  await page.evaluate(() => window.__app.startScan()); await page.waitForFunction(() => !document.querySelector('#scan').hidden, { timeout: 8000 }); await wait(900);
  await page.evaluate(() => document.querySelector('#scanKinds [data-k="cover"]').click()); await wait(200);
  st = await page.evaluate(() => ({ t: !document.querySelector('#scanTorch').hidden, f: !document.querySelector('#scanFlash').hidden })); assert(!st.t && !st.f, 'scansione senza pulsanti della luce');
  await page.evaluate(() => document.querySelector('#scanClose').click()); await wait(300);
  await ctx.close();
  // C) la torcia e' dichiarata ma non si accende davvero: al primo tocco il pulsante sparisce, con il consiglio della fotocamera del telefono
  ({ ctx, page } = await open('dead'));
  await snapOpen(page);
  assert(await page.evaluate(() => !document.querySelector('#snapTorch').hidden));
  await page.click('#snapTorch'); await wait(300);
  st = await page.evaluate(() => ({ torch: !document.querySelector('#snapTorch').hidden, cam: window.__app.settings.torchCam, msg: document.querySelector('#snapMsg').textContent }));
  console.log('[C luce che non si accende]', JSON.stringify(st)); assert(!st.torch && st.cam === 'none' && /fotocamera del telefono/.test(st.msg));
  await snapClose(page); await ctx.close();
  // D) il telefono dice di averla accesa ma resta spenta (Galaxy A32): «Prova la luce» -> «No» -> niente pulsanti della luce
  ({ ctx, page } = await open('lie'));
  await page.evaluate(() => window.__app.openOptions('cards')); await wait(300);
  const don = await page.$eval('#donOpt', e => ({ bg: getComputedStyle(e).backgroundColor, svg: !!e.querySelector('svg') }));
  console.log('[Sostieni in App]', JSON.stringify(don)); assert(don.svg && don.bg !== 'rgba(0, 0, 0, 0)' && don.bg !== 'rgb(255, 255, 255)', 'Sostieni in evidenza');
  await page.click('#lightRun');
  await page.waitForFunction(() => !document.querySelector('#lightAsk').hidden, { timeout: 15000 });
  assert(await page.evaluate(() => window.__torchOn === false), 'luce spenta di nuovo dopo la prova');
  await page.screenshot({ path: CFG.OUT + '/light_ask.png' });
  await page.click('#lightNo'); await wait(200);
  assert.strictEqual(await page.evaluate(() => window.__app.settings.torchCam), 'none');
  await page.evaluate(() => window.__app.closeOptions()); await wait(300);
  await snapOpen(page);
  assert(await page.evaluate(() => document.querySelector('#snapTorch').hidden), 'foto: niente luce');
  await snapClose(page);
  await page.evaluate(() => window.__app.startScan()); await page.waitForFunction(() => !document.querySelector('#scan').hidden, { timeout: 8000 }); await wait(900);
  assert(await page.evaluate(() => document.querySelector('#scanTorch').hidden), 'scansione: niente luce');
  await page.evaluate(() => document.querySelector('#scanClose').click()); await wait(300);
  // «Sì»: resta tutto
  await page.evaluate(() => window.__app.openOptions('cards')); await wait(300);
  await page.click('#lightRun'); await page.waitForFunction(() => !document.querySelector('#lightAsk').hidden, { timeout: 15000 });
  await page.click('#lightYes'); await wait(200);
  const after = await page.evaluate(() => ({ cam: window.__app.settings.torchCam, ok: window.__app.settings.lightOk })); console.log('[D sì]', JSON.stringify(after));
  assert(after.cam === 'm' && after.ok === true);
  await ctx.close();
  assert.deepStrictEqual(errors, []);
  console.log('e2e61 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
