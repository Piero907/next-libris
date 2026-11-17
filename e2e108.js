const CFG = require("./_config");
// modulo «Notifiche push» (push.js, sw.js) con un Supabase finto e il push del browser simulato:
// riga dopo l'accesso con la scelta dei tipi (Attiva → permesso, iscrizione, preferenze salvate; Non ora → spente);
// Impostazioni › Notifiche (riga ultima sotto Impostazioni; stato, tipi, orari di silenzio 22-8, spegnere = cancellare l'iscrizione);
// senza account, permesso bloccato; il service worker mostra la notifica e avvisa la pagina; …/?nt=1 apre la campanella;
// numero sull'icona; schermate a 360, 412 scuro e 1280 senza scorrimento di lato.
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
const DB = { iscr: {}, canc: [], prefs: {}, salvate: [], loads: 0,
  notif: { uA: [{ id: 'n1', da: 'uBruno', nome: 'Bruno', tipo: 'richiesta', rif: '', titolo: 'Le città invisibili', creata: ago(2), letta: false }] } };
const uidOf = (req) => { const m = /Bearer AT-(\w+)/.exec(req.headers.authorization || ''); return m ? m[1] : null; };
function fake(req, res, body, url) {
  const send = (st, j) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(j === undefined ? '' : JSON.stringify(j)); };
  const p = url.pathname.replace(/^\/finto/, '');
  if (req.headers.apikey !== 'chiave-finta') return send(401, { message: 'no api key' });
  if (p === '/auth/v1/settings') return send(200, { external: { google: true } });
  const me = uidOf(req); if (!me) return send(401, { message: 'JWT' });
  if (p === '/rest/v1/libri') return send(req.method === 'GET' ? 200 : 201, req.method === 'GET' ? [] : undefined);
  if (p === '/rest/v1/profili' && req.method === 'GET') return send(200, [{ utente: 'Anna', nome: '', desideri: false, libreria: false }]);
  if (p === '/rest/v1/rpc/mie_notifiche') { DB.loads++; return send(200, DB.notif[me] || []); }
  if (p === '/rest/v1/rpc/push_iscrivi') { DB.iscr[body.endpoint] = Object.assign({ utente: me }, body); return send(204); }
  if (p === '/rest/v1/rpc/push_cancella') { DB.canc.push(body.endpoint); delete DB.iscr[body.endpoint]; return send(204); }
  if (p === '/rest/v1/rpc/push_mie_preferenze') return send(200, DB.prefs[me] || { tipi: ['amicizie', 'prestiti', 'consigli', 'chiavi'], silenzio_da: 22, silenzio_a: 8, fuso: 'Europe/Rome' });
  if (p === '/rest/v1/rpc/push_salva_preferenze') { DB.prefs[me] = body; DB.salvate.push(Object.assign({ me }, body)); return send(204); }
  if (p.startsWith('/rest/v1/rpc/')) return send(200, []);
  send(404, { message: 'finto: ' + p });
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/finto/')) { let b = ''; req.on('data', c => b += c); req.on('end', () => { let j = {}; try { j = b ? JSON.parse(b) : {}; } catch (e) {} fake(req, res, j, url); }); return; }
  const p = decodeURIComponent(url.pathname), m = p.match(/^\/next-libris-prova(\/.*)?$/);
  if (!m) { res.writeHead(404); return res.end(); }
  if (!m[1]) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
  const f = path.join(ROOT, m[1] === '/' ? '/index.html' : m[1]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
}).listen(CFG.port(8308));
const base = 'http://localhost:' + CFG.port(8308);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  // perm: permesso del browser simulato ('default' | 'granted' | 'denied'); il push vero (Google) qui non si raggiunge
  async function phone(name, uid, w, h, dark, perm, q) {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: w || 412, height: h || 915, deviceScaleFactor: 2, isMobile: w < 900, hasTouch: w < 900 });
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    await page.evaluateOnNewDocument((u, id, perm) => {
      window.NL_SOCIAL = { url: u, key: 'chiave-finta', gClient: 'client-finto' };
      if (id && !localStorage.getItem('prova:catalogo-libri-social-auth')) localStorage.setItem('prova:catalogo-libri-social-auth', JSON.stringify({ at: 'AT-' + id, rt: 'RT-' + id, exp: Date.now() + 3e6, uid: id, email: id + '@esempio.it' }));
      if (!window.Notification || !window.PushManager) return;
      window.__perm = sessionStorage.getItem('perm') || perm; window.__asked = 0; window.__badge = null;
      Object.defineProperty(Notification, 'permission', { configurable: true, get: () => window.__perm });
      Notification.requestPermission = async () => { window.__asked++; if (window.__perm === 'default') window.__perm = 'granted'; sessionStorage.setItem('perm', window.__perm); return window.__perm; };
      const mk = (o) => ({ endpoint: 'https://push.example/ep-' + (id || 'x'), options: o, toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } }; },
        unsubscribe: async () => { sessionStorage.removeItem('sub'); window.__unsub = (window.__unsub || 0) + 1; return true; } });
      PushManager.prototype.getSubscription = async function () { return sessionStorage.getItem('sub') ? mk() : null; };
      PushManager.prototype.subscribe = async function (o) { window.__subKey = o && o.applicationServerKey && o.applicationServerKey.length; window.__uvo = o && o.userVisibleOnly; sessionStorage.setItem('sub', '1'); return mk(o); };
      navigator.setAppBadge = async (n) => { window.__badge = n; }; navigator.clearAppBadge = async () => { window.__badge = 0; };
    }, base + '/finto', uid, perm || 'default');
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) ? r.continue() : r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"totalItems":0}' }));
    await page.goto(base + '/next-libris-prova/?vista=elenco' + (q || ''), { waitUntil: 'load' }); await wait(2800);
    await page.evaluate((d) => { window.NLLayout && window.NLLayout.set('A'); if (d) document.documentElement.setAttribute('data-theme', 'dark');
      const ic = document.getElementById('instCard'); if (ic) ic.hidden = true; }, !!dark);   // come con l'app già installata: la riga è il primo avviso
    await wait(300);
    return page;
  }
  const side = (P, sel) => P.evaluate((sel) => { const si = document.querySelector(sel); return Math.max(si ? si.scrollWidth - si.clientWidth : 0, document.documentElement.scrollWidth - document.documentElement.clientWidth); }, sel);
  const openSec = async (P) => { await P.evaluate(() => window.__app.openOptions('push')); await wait(700); };
  const stateTxt = (P) => P.$eval('#puState', x => x.className + ' | ' + x.innerText.replace(/\s+/g, ' '));

  // ---- senza account: niente riga; la sezione chiede di entrare ----
  const X = await phone('X', null, 412);
  assert(!(await X.evaluate(() => { const b = document.getElementById('puAsk'); return b && !b.hidden; })), 'senza account niente riga');
  await openSec(X);
  assert(/entra con Google/.test(await stateTxt(X)), 'sezione: entra con Google');
  assert(await X.$eval('#puOn', x => x.disabled), 'interruttore spento senza account');

  // ---- A: riga dopo l'accesso, scelta dei tipi, Attiva ----
  const A = await phone('A', 'uA', 360, 800);
  assert(await A.$eval('#puAsk', x => !x.hidden), 'riga dopo l\'accesso');
  assert(/Ricevi notifiche dagli amici/.test(await A.$eval('#puAsk', x => x.innerText)), 'titolo della riga');
  assert.strictEqual(await A.$$eval('#puAsk .pu-a:checked', x => x.length), 4, '4 tipi spuntati di partenza');
  assert(/Libri in prestito/.test(await A.$eval('#puAsk', x => x.innerText)) && !/Me lo presti/.test(await A.$eval('#puAsk', x => x.innerText)), 'un solo tipo «Libri in prestito»');
  assert(await side(A, '#puAsk') <= 0, 'riga senza scorrimento a 360');
  await A.screenshot({ path: CFG.OUT + '/push-riga-360.png' });
  await A.click('#puAsk .pu-a[value="consigli"]');
  await A.click('#puAskGo'); await wait(1200);
  assert.strictEqual(await A.evaluate(() => window.__asked), 1, 'permesso chiesto una volta');
  assert.strictEqual(await A.evaluate(() => window.__uvo), true, 'userVisibleOnly');
  assert.strictEqual(await A.evaluate(() => window.__subKey), 65, 'chiave VAPID della prova (65 byte)');
  assert(DB.iscr['https://push.example/ep-uA'] && DB.iscr['https://push.example/ep-uA'].utente === 'uA', 'iscrizione sul server');
  const sv = DB.salvate[DB.salvate.length - 1];
  assert.deepStrictEqual(sv.tipi, ['amicizie', 'prestiti', 'chiavi'], 'tipi scelti salvati');
  assert(sv.silenzio_da === 22 && sv.silenzio_a === 8 && sv.fuso, 'silenzio 22-8 e fuso');
  assert(await A.$eval('#puAsk', x => x.hidden), 'riga sparita');
  // menu: «Notifiche» sotto Impostazioni, dopo Account e Amici e privacy, prima di Ricerca (17/11/2026)
  await A.evaluate(() => window.__app.openDrawer()); await wait(500);
  await A.click('#goSettings'); await wait(400);
  assert.strictEqual(await A.$eval('#goPush', x => x.nextElementSibling && x.nextElementSibling.dataset.sec), 'search', 'Notifiche prima di Ricerca dei libri');
  assert(/Attive · silenzio 22-8/.test(await A.$eval('#goPushTxt', x => x.textContent)), 'sottotitolo: attive');
  await A.click('#goPush'); await wait(800);
  assert.strictEqual(await A.$eval('#optH', x => x.textContent), 'Notifiche', 'si apre la sezione');
  assert(/pu-ok/.test(await stateTxt(A)) && /Attive su questo telefono/.test(await stateTxt(A)), 'stato: attive');
  assert(await A.$eval('#puOn', x => x.checked), 'interruttore acceso');
  assert(!(await A.$eval('.pu-t[value="consigli"]', x => x.checked)), 'consigli spento');
  assert(await side(A, '#optSheet .sheet-in') <= 0, 'sezione senza scorrimento a 360');
  assert(await A.evaluate(() => { const a = document.getElementById('puDa').getBoundingClientRect(), b = document.getElementById('puA').getBoundingClientRect(); return Math.abs(a.top - b.top) < 2; }), 'ore su una riga a 360');
  await wait(3500);
  await A.screenshot({ path: CFG.OUT + '/push-impostazioni-360.png' });
  // orari
  await A.select('#puDa', '23'); await wait(700);
  assert.strictEqual(DB.prefs.uA.silenzio_da, 23, 'inizio silenzio salvato');
  await A.click('#puQuiet'); await wait(700);
  assert(DB.prefs.uA.silenzio_da === 0 && DB.prefs.uA.silenzio_a === 0, 'senza silenzio: 0-0');
  assert(await A.$eval('#puDa', x => x.disabled), 'ore spente');
  await A.click('#puQuiet'); await wait(700);
  assert(DB.prefs.uA.silenzio_da === 22 && DB.prefs.uA.silenzio_a === 8, 'silenzio di nuovo 22-8');
  // tipi
  await A.click('.pu-t[value="consigli"]'); await wait(700);
  assert(DB.prefs.uA.tipi.includes('consigli'), 'consigli riacceso');

  // ---- il service worker: push → avvisa la pagina e mostra la notifica; numero sull'icona ----
  const cdp = await A.target().createCDPSession();
  await cdp.send('ServiceWorker.enable');
  let regId = null;
  cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => { e.registrations.forEach(r => { if (r.scopeURL.includes('/next-libris-prova/')) regId = r.registrationId; }); });
  await cdp.send('ServiceWorker.disable'); await cdp.send('ServiceWorker.enable'); await wait(500);
  await A.browserContext().overridePermissions(base, ['notifications']);
  if (regId) {
    const before = DB.loads;
    await cdp.send('ServiceWorker.deliverPushMessage', { origin: base, registrationId: regId, data: JSON.stringify({ title: 'Next Libris', body: 'Bruno ti chiede in prestito «Le città invisibili»', tag: 'nl-n1', n: 1 }) });
    await wait(1500);
    assert(DB.loads > before, 'il push aggiorna la campanella');
    const shown = await A.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); const l = await r.getNotifications(); return l.map(x => x.tag + ' ' + x.body); });
    console.log('[notifiche mostrate con l\'app in primo piano]', shown);
  } else console.log('[avviso] registrazione del service worker non trovata: push del service worker non provato');
  // numero sull'icona = non lette della campanella; aperta la campanella torna 0
  await A.keyboard.press('Escape'); await wait(300);
  await A.evaluate(() => window.NLNotifiche.load()); await wait(600);
  assert.strictEqual(await A.evaluate(() => window.__badge), 1, 'numero 1 sull\'icona');
  await A.evaluate(() => window.NLNotifiche.open()); await wait(800);
  assert.strictEqual(await A.evaluate(() => window.__badge), 0, 'campanella letta: numero tolto');

  // ---- spegnere: iscrizione cancellata ----
  await A.keyboard.press('Escape'); await wait(400);
  await openSec(A);
  await A.click('#puOn'); await wait(900);
  assert(DB.canc.includes('https://push.example/ep-uA') && !DB.iscr['https://push.example/ep-uA'], 'spenta: iscrizione cancellata sul server');
  console.log('[unsub]', await A.evaluate(() => [window.__unsub, sessionStorage.getItem('sub'), window.NLPush.state().on])); assert.strictEqual(await A.evaluate(() => window.__unsub), 1, 'e sul telefono');
  assert(/Spente su questo telefono/.test(await stateTxt(A)), 'stato: spente');
  // riaccendere: niente nuova domanda (permesso già dato)
  await A.click('#puOn'); await wait(1200);
  assert(DB.iscr['https://push.example/ep-uA'], 'riaccesa: di nuovo iscritto');
  assert.strictEqual(await A.evaluate(() => window.__asked), 1, 'permesso non richiesto di nuovo');

  // ---- D: «Non ora» → spente, la riga non torna ----
  const D = await phone('D', 'uD', 412);
  assert(await D.$eval('#puAsk', x => !x.hidden), 'riga per D');
  await D.click('#puAskNo'); await wait(500);
  assert(await D.$eval('#puAsk', x => x.hidden), 'Non ora: riga sparita');
  assert.strictEqual(await D.evaluate(() => window.__asked), 0, 'nessun permesso chiesto');
  await D.reload({ waitUntil: 'load' }); await wait(2800);
  assert(!(await D.evaluate(() => { const b = document.getElementById('puAsk'); return b && !b.hidden; })), 'dopo la riapertura non torna');
  await openSec(D);
  assert(/Spente/.test(await stateTxt(D)) && !(await D.$eval('#puOn', x => x.checked)), 'in Impostazioni: spente');
  // E: permesso già dato (altro telefono riaperto) → si iscrive da solo, senza riga
  const E = await phone('E', 'uE', 412, 915, false, 'granted');
  assert(DB.iscr['https://push.example/ep-uE'], 'permesso già dato: iscritto da solo');
  assert(!(await E.evaluate(() => { const b = document.getElementById('puAsk'); return b && !b.hidden; })), 'e niente riga');

  // ---- C: permesso bloccato ----
  const C = await phone('C', 'uC', 412, 915, false, 'denied');
  assert(!(await C.evaluate(() => { const b = document.getElementById('puAsk'); return b && !b.hidden; })), 'bloccate: niente riga');
  await openSec(C);
  assert(/pu-warn/.test(await stateTxt(C)) && /bloccate/.test(await stateTxt(C)), 'stato: bloccate');

  // ---- …/?nt=1 (tocco su una notifica con l'app chiusa) apre la campanella ----
  DB.notif.uA[0].letta = false;
  const T = await phone('T', 'uA', 412, 915, false, 'granted', '&nt=1');
  await wait(1200);
  assert(await T.$eval('#ntSheet', x => !x.hidden), '?nt=1 apre la campanella');
  assert(!/nt=1/.test(await T.evaluate(() => location.search)), 'e toglie nt dall\'indirizzo');

  // ---- schermate: 412 scuro e 1280 (riga e impostazioni, anche con il permesso mancante) ----
  for (const [w, h, dark] of [[412, 900, true], [1280, 860, false]]) {
    const P = await phone('P' + w, 'uP' + w, w, h, dark);
    assert(await P.$eval('#puAsk', x => !x.hidden), 'riga a ' + w);
    assert(await side(P, '#puAsk') <= 0, 'riga senza scorrimento a ' + w);
    await P.screenshot({ path: CFG.OUT + '/push-riga-' + w + (dark ? '-scuro' : '') + '.png' });
    await openSec(P); await wait(3500);   // il toast se n'è andato
    assert(/Manca solo il permesso/.test(await stateTxt(P)), 'stato: manca il permesso');
    assert(await side(P, '#optSheet .sheet-in') <= 0, 'sezione senza scorrimento a ' + w);
    await P.screenshot({ path: CFG.OUT + '/push-impostazioni-' + w + (dark ? '-scuro' : '') + '.png' });
  }
  assert.deepStrictEqual(errors, []);
  console.log('e2e108 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
