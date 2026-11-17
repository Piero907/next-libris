const CFG = require("./_config");
const H = require('./_harness');
const APPU = /'https:\/\/nextlibris\.github\.io\/';/.test(require('fs').readFileSync(require('path').join(CFG.APP, 'app.js'), 'utf8')) ? 'https://nextlibris.github.io/' : 'https://piero907.github.io/next-libris/';   // indirizzo dell'app (dalla versione 100 nextlibris.github.io)
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8130), ROOT);
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const INAPP = 'Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 Instagram 300.0';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const wait = H.wait;   // attesa «finché» (_harness.js)
  async function open(ua, opts = {}) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setUserAgent(ua);
    await page.evaluateOnNewDocument((o) => {
      window.addEventListener('beforeinstallprompt', e => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);   // il vero evento di Chrome non serve: lo simuliamo
      if (o.set) localStorage.setItem('catalogo-libri-set', JSON.stringify(o.set));
      if (o.standalone) { const mm = window.matchMedia.bind(window); window.matchMedia = q => /display-mode: standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q); }
      window.__shared = []; window.__copied = [];
      Object.defineProperty(navigator, 'share', { configurable: true, value: o.noShare ? undefined : (d => { window.__shared.push(d); return Promise.resolve(); }) });
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__copied.push(t); return Promise.resolve(); } } });
    }, opts);
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    page.errors = []; page.on('pageerror', e => page.errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', req => req.url().startsWith('http://localhost:' + CFG.port(8130) + '') ? req.continue() : req.abort());
    await page.goto('http://localhost:' + CFG.port(8130) + '/?vista=elenco', { waitUntil: 'load' }); await wait(400);
    return page;
  }
  const hidden = (page, sel) => page.$eval(sel, e => e.hidden);
  const txt = (page, sel) => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());

  // 1) prima apertura su Android in Chrome: scheda in evidenza; senza richiesta di Chrome, «Installa» spiega i passi
  let p = await open(ANDROID);
  assert(!(await hidden(p, '#instCard')), 'scheda visibile alla prima apertura');
  console.log('[1 scheda]', await txt(p, '#instCard'));
  await p.screenshot({ path: CFG.OUT + '/i_card.png' });
  await p.click('#instGo'); await wait(150);
  assert(!(await hidden(p, '#instSheet')));
  console.log('[1 passi android]', await txt(p, '#instSteps'));
  assert(/Installa app/.test(await txt(p, '#instSteps')));
  assert(await hidden(p, '#instCopy')); assert(await hidden(p, '#instChrome')); assert(!(await hidden(p, '#instWhy')));
  await p.screenshot({ path: CFG.OUT + '/i_steps.png' });
  // il tasto Indietro chiude il foglio
  await p.goBack(); await wait(150);
  assert(await hidden(p, '#instSheet'), 'Indietro chiude il foglio');
  assert.strictEqual(p.url(), 'http://localhost:' + CFG.port(8130) + '/?vista=elenco');

  // 2) Chrome offre l'installazione: «Installa» apre la sua richiesta; accettata -> scheda via per sempre
  await p.evaluate(() => {
    const e = new Event('beforeinstallprompt'); window.__prompted = 0;
    e.prompt = () => { window.__prompted++; }; e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await wait(50);
  await p.click('#instGo'); await wait(100);
  assert.strictEqual(await p.evaluate(() => window.__prompted), 1, 'richiesta di Chrome aperta');
  await p.evaluate(() => window.dispatchEvent(new Event('appinstalled'))); await wait(100);
  assert(await hidden(p, '#instCard'));
  assert.strictEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')).installed), true);
  console.log('[2 dopo installazione]', await txt(p, '.toast'));
  await p.reload({ waitUntil: 'load' }); await wait(300);
  assert(await hidden(p, '#instCard'), 'non torna più dopo l\'installazione');
  assert.deepStrictEqual(p.errors, []);
  await p.browserContext().close();

  // 3) «Non ora»: sparisce, Annulla la riporta, dopo 14 giorni ritorna
  p = await open(ANDROID);
  await p.click('#instLater'); await wait(100);
  assert(await hidden(p, '#instCard'));
  console.log('[3 non ora]', await txt(p, '.toast'));
  await p.click('.toast button'); await wait(100);
  assert(!(await hidden(p, '#instCard')), 'Annulla la riporta');
  await p.click('#instLater'); await wait(50);
  await p.reload({ waitUntil: 'load' }); await wait(300);
  assert(await hidden(p, '#instCard'), 'resta nascosta dopo Non ora');
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('catalogo-libri-set')); s.instSnooze = Date.now() - 15 * 86400000; localStorage.setItem('catalogo-libri-set', JSON.stringify(s)); });
  await p.reload({ waitUntil: 'load' }); await wait(300);
  assert(!(await hidden(p, '#instCard')), 'torna dopo 14 giorni');
  // Opzioni › App: il pulsante «Installa l'app» c'è sempre nel browser
  await p.evaluate(() => window.__app.openOptions('app')); await wait(150);
  assert(!(await hidden(p, '#btnInstall'))); assert(await hidden(p, '#instOkTxt'));
  await p.click('#btnInstall'); await wait(150);
  assert(!(await hidden(p, '#instSheet')), 'senza richiesta di Chrome spiega i passi');
  assert(await hidden(p, '#optSheet'), 'il foglio prende il posto delle Opzioni');
  await p.click('#instOk'); await wait(150);
  assert(await hidden(p, '#instSheet'));
  assert.strictEqual(p.url(), 'http://localhost:' + CFG.port(8130) + '/?vista=elenco');
  // «Non trovi la voce?» porta al controllo del telefono in Opzioni › App
  await p.click('#instGo'); await wait(150);
  await p.click('#instWhy'); await wait(400);
  assert(await hidden(p, '#instSheet')); assert(!(await hidden(p, '#optSheet'))); assert(!(await hidden(p, '#instOut')));
  assert.strictEqual(await txt(p, '#optH'), 'Installazione sul telefono');
  await p.goBack(); await wait(200);
  assert(await hidden(p, '#optSheet'), 'Indietro chiude le Opzioni');
  assert.strictEqual(p.url(), 'http://localhost:' + CFG.port(8130) + '/?vista=elenco');
  await p.browserContext().close();

  // 4) app installata (finestra autonoma): niente scheda, segna «installata»
  p = await open(ANDROID, { standalone: true });
  assert(await hidden(p, '#instCard'));
  await p.evaluate(() => window.__app.openOptions('app')); await wait(150);
  assert(await hidden(p, '#btnInstall')); assert(!(await hidden(p, '#instOkTxt')));
  assert.strictEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')).installed), true);
  console.log('[4 installata]', await txt(p, '#instOkTxt'));
  await p.browserContext().close();

  // 5) link aperto dentro un'altra app (Instagram): «Apri in Chrome» con link intent e «Copia il link»
  p = await open(INAPP);
  assert.strictEqual(await txt(p, '#instGo'), 'Apri in Chrome');
  console.log('[5 in-app]', await txt(p, '#instMsg'));
  await p.click('#instGo'); await wait(150);
  assert(!(await hidden(p, '#instChrome'))); assert(!(await hidden(p, '#instCopy')));
  const href = await p.$eval('#instChrome', a => a.getAttribute('href'));
  console.log('[5 intent]', href);
  assert(href.startsWith('intent://' + APPU.slice(8) + '#Intent;scheme=https;package=com.android.chrome;'));
  await p.click('#instCopy'); await wait(100);
  assert.deepStrictEqual(await p.evaluate(() => window.__copied), [APPU]);
  await p.screenshot({ path: CFG.OUT + '/i_inapp.png' });
  await p.browserContext().close();

  // 6) iPhone: passi per Safari
  p = await open(IPHONE);
  await p.click('#instGo'); await wait(150);
  console.log('[6 iPhone]', await txt(p, '#instSteps'));
  assert(/Aggiungi alla schermata Home/.test(await txt(p, '#instSteps')));
  await p.browserContext().close();

  // 7) Condividi l'app: voce nel menu, QR, Manda il link e Copia il link
  p = await open(ANDROID, { set: { installed: true, instScope: '/' } });
  assert(await hidden(p, '#instCard'));
  await p.evaluate(() => window.__app.openDrawer('opt')); await wait(350);
  console.log('[7 menu]', await txt(p, '#drawerOpts .dmenu'));
  await p.click('#goInfo'); await wait(250);                           // la voce sta sotto «Info e condivisione» (16/11/2026)
  await p.click('#drawerOpts [data-sec="share"]'); await wait(350);
  assert.strictEqual(await txt(p, '#optH'), 'Condivisione');
  const box = await p.$eval('.qr', e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; });
  console.log('[7 QR px]', box);
  assert(box[0] >= 200);
  await p.screenshot({ path: CFG.OUT + '/i_share.png' });
  const qrEl = await p.$('.qr'); await qrEl.screenshot({ path: CFG.OUT + '/i_qr.png' });
  await p.click('#shareApp'); await wait(100);
  const sh = await p.evaluate(() => window.__shared);
  console.log('[7 condiviso]', JSON.stringify(sh));
  assert.strictEqual(sh[0].url, APPU); assert.strictEqual(sh[0].title, 'Next Libris');
  await p.click('#copyApp'); await wait(100);
  assert.deepStrictEqual(await p.evaluate(() => window.__copied), [APPU]);
  console.log('[7 copia]', await txt(p, '.toast'));
  // tema scuro: il QR resta nero su bianco
  await p.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); }); await wait(100);
  await p.screenshot({ path: CFG.OUT + '/i_share_dark.png' });
  assert.deepStrictEqual(p.errors, []);
  await p.browserContext().close();

  // 8) senza navigator.share: «Manda il link» copia
  p = await open(ANDROID, { set: { installed: true, instScope: '/' }, noShare: true });
  await p.evaluate(() => window.__app.openOptions('share')); await wait(150);
  await p.click('#shareApp'); await wait(100);
  assert.deepStrictEqual(await p.evaluate(() => window.__copied), [APPU]);
  await p.browserContext().close();

  // 9) anteprima per WhatsApp e simili
  p = await open(ANDROID, { set: { installed: true, instScope: '/' } });
  const og = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('meta[property^="og:"]')].map(m => [m.getAttribute('property'), m.content])));
  console.log('[9 og]', og);
  assert(fs.existsSync(path.join(ROOT, 'icons/next-libris-og.png')));
  assert.strictEqual(og['og:image'], APPU + 'icons/next-libris-og.png');
  await p.browserContext().close();

  // 10) installata al vecchio indirizzo (catalogo-libri): qui la scheda «Installa» ricompare
  for (const old of [{ installed: true }, { installed: true, instScope: '/catalogo-libri/' }]) {
    p = await open(ANDROID, { set: old });
    assert(!(await hidden(p, '#instCard')), 'scheda visibile: installata altrove ' + JSON.stringify(old));
    await p.browserContext().close();
  }
  p = await open(ANDROID, { set: { installed: true }, standalone: true });
  assert.strictEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')).instScope), '/');
  await p.browserContext().close();
  console.log('[10 vecchio indirizzo] scheda Installa di nuovo visibile');
  console.log('TUTTO OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FALLITO', e); process.exit(1); });
