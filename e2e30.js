const CFG = require("./_config");
// schermata d'apertura: nome visibile solo nell'app installata, poi sparisce
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(8147);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function open(standalone, theme) {
    const ctx = await browser.createBrowserContext(); const p = await ctx.newPage();
    await p.evaluateOnNewDocument((sa, th) => {
      localStorage.setItem('catalogo-libri-set', JSON.stringify({ installed: true, instScope: '/', swiped: true, theme: th, themeV2: true, name: th === 'dark' ? 'Piero' : '' }));
      if (sa) { const mm = window.matchMedia.bind(window); window.matchMedia = q => /display-mode: standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {} } : mm(q); }
    }, standalone, theme || 'light');
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
    await p.setRequestInterception(true); p.on('request', r => r.url().startsWith('http://localhost:8147') ? r.continue() : r.abort());
    await p.goto('http://localhost:8147/', { waitUntil: 'domcontentloaded' });
    return p;
  }
  let p = await open(true);
  const s0 = await p.$eval('#splash', e => { const r = e.getBoundingClientRect(); return { vis: getComputedStyle(e).display, w: r.width, h: r.height, txt: e.innerText, bg: getComputedStyle(e).backgroundColor }; });
  console.log('[1 installata, subito]', JSON.stringify(s0));
  assert.strictEqual(s0.vis, 'flex'); assert.strictEqual(s0.txt, 'Next Libris');
  // resta visibile ~0,9 s dopo che l'app e' pronta, anche se il caricamento e' stato lento
  await p.waitForFunction(() => !!window.__app, { timeout: 10000 }); await wait(350);
  // nello stesso istante: la schermata c'e' ancora e sotto non si vede niente (niente barra in basso che spunta)
  const under = await p.evaluate(() => ({ on: !!document.querySelector('#splash:not(.out)') && !document.documentElement.classList.contains('splash-out'),
    vis: [...document.body.children].filter(e => e.id !== 'splash' && getComputedStyle(e).visibility === 'visible' && e.getBoundingClientRect().height > 0).map(e => e.className || e.id || e.tagName) }));
  assert(under.on, 'ancora visibile un po\' dopo l\'avvio');
  console.log('[1 visibili sotto]', JSON.stringify(under.vis)); assert.deepStrictEqual(under.vis, []);
  console.log('[1 testata senza nome]', await p.$eval('#owner', e => e.textContent));
  assert.strictEqual(await p.$eval('#owner', e => e.textContent), 'Scrivi il tuo nome'); assert.strictEqual(s0.bg, 'rgb(36, 86, 63)');
  assert.strictEqual(await p.$eval('meta[name="theme-color"]', m => m.content), '#24563F', 'barra in alto verde durante l\'apertura');
  assert.strictEqual(await p.$eval('#splash b', e => getComputedStyle(e).color), 'rgb(244, 241, 232)');
  assert.strictEqual(await p.$eval('link[href*="fonts.googleapis.com/css2"]:not(noscript link)', l => l.media), 'print', 'i caratteri di Google non bloccano (internet bloccato nel test)'); assert(s0.w === 390 && s0.h === 844);
  await p.screenshot({ path: CFG.OUT + '/splash.png' });

  assert.strictEqual(await p.$eval('#splash', e => getComputedStyle(e).zIndex), '10000');
  await wait(1300);
  assert.strictEqual(await p.$('#splash'), null, 'poi sparisce'); assert.deepStrictEqual(p.errors, []);
  assert.strictEqual(await p.$eval('.dock', e => getComputedStyle(e).visibility), 'visible', 'poi l\'app ricompare');
  assert.strictEqual(await p.$eval('meta[name="theme-color"]', m => m.content), '#EEF1EE', 'poi la barra prende il colore dell\'app');
  await p.browserContext().close();
  p = await open(true, 'dark'); await wait(150);
  await p.waitForFunction(() => !!window.__app, { timeout: 10000 }); await wait(100);
  console.log('[2 scuro]', await p.$eval('#splash', e => getComputedStyle(e).backgroundColor + ' | ' + e.innerText.replace(/\s+/g, ' ')));
  assert.strictEqual(await p.$eval('#splash', e => getComputedStyle(e).backgroundColor), 'rgb(36, 86, 63)'); await p.screenshot({ path: CFG.OUT + '/splash_dark.png' });
  assert.strictEqual(await p.$eval('#splashWho', e => e.textContent), 'Libreria di Piero');
  await wait(1300); console.log('[2 testata]', await p.$eval('#owner', e => e.innerText)); assert.strictEqual(await p.$eval('#owner', e => e.innerText), 'Libreria di Piero');
  await p.screenshot({ path: CFG.OUT + '/owner.png', clip: { x: 0, y: 0, width: 390, height: 180 } });
  // cambiare nome aggiorna la testata
  await p.evaluate(() => window.__app.openOptions('share')); await wait(150);
  await p.$eval('#optName', e => { e.value = 'Anna'; e.dispatchEvent(new Event('change')); }); await wait(100);
  assert.strictEqual(await p.$eval('#owner', e => e.innerText), 'Libreria di Anna');
  await p.browserContext().close();
  p = await open(false); await wait(50);
  const b = await p.$eval('#splash', e => getComputedStyle(e).display).catch(() => 'rimossa');
  console.log('[3 nel browser]', b); assert(b === 'none' || b === 'rimossa');
  await wait(1000); assert.strictEqual(await p.$('#splash'), null);
  await p.browserContext().close();
  console.log('e2e30 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
