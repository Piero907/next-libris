const CFG = require("./_config");
// moduli: social, amici, notifiche   (senza questi file nell'app la prova si salta: vedi esegui.js)
// modulo «Notifiche» (notifiche.js) con un Supabase finto: campanella in testata prima dell'icona Amici, solo con l'account;
// numero delle non lette; finestra con tutti i tipi di notifica (testi), le nuove evidenziate; aprendo si segnano lette sul server;
// senza rete si segnano al caricamento dopo; tocco su un prestito → si apre la scheda del libro, su un'amicizia → finestra Amici;
// nessuna notifica → frase vuota; niente numero sull'icona Amici; schermate a 360, 412 scuro e 1280 senza scorrimento di lato.
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
const N = (id, tipo, nome, titolo, min, letta, rif) => ({ id, da: 'u' + nome, nome, tipo, rif: rif || '', titolo: titolo || '', creata: ago(min), letta: !!letta });
const DB = {
  notif: {
    uA: [
      N('n01', 'amicizia', 'Carla Bianchi dei Monti', '', 1),
      N('n02', 'prestito', 'Bruno', 'La coscienza di Zeno', 12, false, '5a000000-0000-0000-0000-00000000005a'),
      N('n03', 'consiglio', 'Bruno', 'Il nome della rosa: un titolo molto lungo per vedere come va a capo', 90),
      N('n04', 'chiavi', 'Bruno', '', 60 * 5),
      N('n05', 'regalo', 'Dario', 'Il barone rampante', 60 * 26, true),
      N('n06', 'reso', 'Bruno', 'Il Gattopardo', 60 * 30, true),
      N('n07', 'reso_ok', 'Bruno', 'Se questo è un uomo', 60 * 50, true),
      N('n08', 'reso_no', 'Bruno', 'Lessico famigliare', 60 * 60, true),
      N('n09', 'chiuso', 'Bruno', 'Il sentiero dei nidi di ragno', 60 * 70, true),
      N('n10', 'richiesta', 'Dario', 'Le città invisibili', 60 * 80, true),
      N('n11', 'richiesta_si', 'Bruno', 'Marcovaldo', 60 * 24 * 3, true),
      N('n12', 'richiesta_no', 'Dario', 'La luna e i falò', 60 * 24 * 6, true),
      N('n13', 'amico', 'Bruno', '', 60 * 24 * 12, true)],
    uC: []
  },
  lette: 0, failRead: false
};
const uidOf = (req) => { const m = /Bearer AT-(\w+)/.exec(req.headers.authorization || ''); return m ? m[1] : null; };
function fake(req, res, body, url) {
  const send = (st, j) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(j === undefined ? '' : JSON.stringify(j)); };
  const p = url.pathname.replace(/^\/finto/, '');
  if (req.headers.apikey !== 'chiave-finta') return send(401, { message: 'no api key' });
  if (p === '/auth/v1/settings') return send(200, { external: { google: true } });
  if (p === '/auth/v1/token') { const id = String(body.refresh_token || '').slice(3); return send(200, { access_token: 'AT-' + id, refresh_token: 'RT-' + id, expires_in: 3600, user: { id } }); }
  const me = uidOf(req); if (!me) return send(401, { message: 'JWT' });
  if (p === '/rest/v1/libri') return send(req.method === 'GET' ? 200 : 201, req.method === 'GET' ? [] : undefined);
  if (p === '/rest/v1/profili' && req.method === 'GET') return send(200, [{ utente: me === 'uA' ? 'Anna' : 'Carla', nome: '', desideri: false, libreria: false }]);
  if (p === '/rest/v1/rpc/miei_amici') return send(200, me === 'uA' ? [{ id: 'uCarla Bianchi dei Monti', utente: 'Carla Bianchi dei Monti', nome: '', stato: 'attesa', verso: 'ricevuta', creato: ago(1) },
    { id: 'uBruno', utente: 'Bruno', nome: '', stato: 'amici', verso: 'inviata', creato: ago(9000) }] : []);
  if (p === '/rest/v1/rpc/mie_notifiche') return send(200, (DB.notif[me] || []).slice().sort((a, b) => a.creata < b.creata ? 1 : -1));
  if (p === '/rest/v1/rpc/notifiche_lette') {
    if (DB.failRead) { req.socket.destroy(); return; }                                  // come senza rete
    DB.lette++; (DB.notif[me] || []).forEach(x => { if (!body.ids || body.ids.includes(x.id)) x.letta = true; }); return send(204);
  }
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
}).listen(CFG.port(8305));
const base = 'http://localhost:' + CFG.port(8305);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function phone(name, uid, w, h, dark) {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: w || 412, height: h || 915, deviceScaleFactor: 2, isMobile: w < 900, hasTouch: w < 900 });
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    await page.evaluateOnNewDocument((u, id) => {
      window.NL_SOCIAL = { url: u, key: 'chiave-finta', gClient: 'client-finto' };
      if (id && !localStorage.getItem('prova:catalogo-libri-social-auth')) localStorage.setItem('prova:catalogo-libri-social-auth', JSON.stringify({ at: 'AT-' + id, rt: 'RT-' + id, exp: Date.now() + 3e6, uid: id, email: id + '@esempio.it' }));
    }, base + '/finto', uid);
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) ? r.continue() : r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"totalItems":0}' }));
    await page.goto(base + '/next-libris-prova/?vista=elenco', { waitUntil: 'load' }); await wait(2600);
    await page.evaluate((d) => { window.NLLayout && window.NLLayout.set('A'); if (d) document.documentElement.setAttribute('data-theme', 'dark'); }, !!dark);
    return page;
  }
  const side = (P) => P.evaluate(() => { const si = document.querySelector('#ntSheet .sheet-in'); return Math.max(si.scrollWidth - si.clientWidth, document.documentElement.scrollWidth - document.documentElement.clientWidth); });
  const headOk = (P) => P.evaluate(() => {          // titolo e stato non finiscono sotto le icone
    // dalla 99.10 a 360 px le icone sono più strette e le zone da toccare si sovrappongono un poco: si guardano i disegni (svg)
    const box = (id) => { const b = document.getElementById(id), g = b.querySelector('svg'); return (g || b).getBoundingClientRect(); };
    const bell = box('btnBell'), h = document.querySelector('header.top h1').getBoundingClientRect(), fri = box('btnFri'), gear = box('btnOpts');
    return h.right <= bell.left + 1 && bell.right <= fri.left + 8 && fri.right <= gear.left + 8 && Math.abs(bell.top - gear.top) < 2;
  });

  // ---- senza account: niente campanella ----
  const X = await phone('X', null, 412);
  assert(!(await X.evaluate(() => { const b = document.getElementById('btnBell'); return b && !b.hidden; })), 'senza account niente campanella');

  // ---- A: 13 notifiche, 4 nuove ----
  const A = await phone('A', 'uA', 360, 780);
  await A.evaluate(() => { const b = window.NL.clean({ t: 'La coscienza di Zeno', a: 'Italo Svevo', sx: '5a000000-0000-0000-0000-00000000005a', sk: 'p', sda: 'Bruno', rs: 'da' }); window.NL.books().unshift(b); window.NL.save(); window.NL.refresh(); });
  assert(await A.$('header.top #btnBell + #btnFri'), 'campanella subito prima dell\'icona Amici');
  assert.strictEqual(await A.$eval('#btnBellN', x => x.hidden ? '' : x.textContent), '4', '4 nuove sul numero');
  assert(!(await A.$('#btnFriN')), 'icona Amici senza numero');
  assert(!(await A.$('#friNote')), 'niente riquadro della richiesta in cima');
  assert(await headOk(A), 'testata in ordine a 360');
  await A.screenshot({ path: CFG.OUT + '/notifiche-testata-360.png', clip: { x: 0, y: 0, width: 360, height: 140 } });
  await A.click('#btnBell'); await wait(600);
  const t = await A.$eval('#ntBody', x => x.innerText.replace(/\s+/g, ' ')); console.log('[campanella]', t.slice(0, 300) + '…');
  for (const r of [/Carla Bianchi dei Monti vuole essere tuo amico/, /Bruno ti ha prestato «La coscienza di Zeno»/, /Bruno ti consiglia «Il nome della rosa/,
    /Bruno condivide con te la sua chiave per cercare i libri/, /Dario ti ha regalato «Il barone rampante»/, /Bruno dice di averti restituito «Il Gattopardo»/,
    /Bruno conferma di aver riavuto «Se questo è un uomo»/, /Bruno dice di non avere ancora ricevuto «Lessico famigliare»/,
    /Bruno ha segnato come restituito «Il sentiero dei nidi di ragno»/, /Dario ti chiede in prestito «Le città invisibili»/, /Bruno ti presta «Marcovaldo»/,
    /Dario ora non può prestarti «La luna e i falò»/, /Bruno ha accettato la tua amicizia/, /adesso|1 min fa/, /12 min fa/, /5 ore fa/, /ieri/, /3 giorni fa/]) assert(r.test(t), 'testo: ' + r);
  assert.strictEqual(await A.$$eval('#ntBody .nt-new', x => x.length), 4, '4 evidenziate');
  assert.strictEqual(await A.$eval('#ntBody .nt-item', x => x.dataset.n), 'n01', 'la più recente in cima');
  await wait(300);
  assert(await A.$eval('#btnBellN', x => x.hidden), 'aperta: numero sparito');
  assert(DB.notif.uA.every(x => x.letta) && DB.lette === 1, 'segnate lette sul server');
  assert(await side(A) <= 0, 'niente scorrimento di lato a 360');
  await A.screenshot({ path: CFG.OUT + '/notifiche-360.png' });
  // tocco su un prestito: la scheda del libro
  await A.click('#ntBody [data-n="n02"]'); await wait(700);
  assert(await A.$eval('#ntSheet', x => x.hidden), 'finestra chiusa');
  const zeno = await A.evaluate(() => window.NL.books().find(b => b.sx === '5a000000-0000-0000-0000-00000000005a').id);
  assert(await A.$('.row.open[data-id="' + zeno + '"]'), 'si apre la scheda del libro prestato');
  // tocco su una richiesta d'amicizia: la finestra Amici
  await A.click('#btnBell'); await wait(400);
  assert.strictEqual(await A.$$eval('#ntBody .nt-new', x => x.length), 0, 'riaperta: nessuna più evidenziata');
  await A.click('#ntBody [data-n="n01"]'); await wait(900);
  assert(await A.$eval('#friSheet', x => !x.hidden), 'si apre la finestra Amici');
  assert(/Carla Bianchi dei Monti/.test(await A.$eval('#friBody', x => x.innerText)), 'con la richiesta');
  await A.keyboard.press('Escape'); await wait(300);
  // ---- una nuova, poi «letta» senza rete: si segna al caricamento dopo ----
  DB.notif.uA.push(N('n14', 'consiglio', 'Dario', 'Il deserto dei Tartari', 0));
  await A.evaluate(() => window.NLAmici.load(true)); await wait(800);
  assert.strictEqual(await A.$eval('#btnBellN', x => x.hidden ? '' : x.textContent), '1', 'arriva insieme agli amici');
  DB.failRead = true;
  await A.click('#btnBell'); await wait(700);
  assert(await A.$eval('#btnBellN', x => x.hidden), 'senza rete: letta sul telefono');
  assert(!DB.notif.uA.find(x => x.id === 'n14').letta, 'non ancora sul server');
  await A.keyboard.press('Escape'); await wait(200);
  DB.failRead = false;
  await A.evaluate(() => window.NLAmici.load(true)); await wait(900);
  assert(DB.notif.uA.find(x => x.id === 'n14').letta, 'segnata al caricamento dopo');
  assert(await A.$eval('#btnBellN', x => x.hidden), 'e resta letta');

  // ---- C: nessuna notifica ----
  const C = await phone('C', 'uC', 412);
  assert(await C.$eval('#btnBellN', x => x.hidden), 'niente numero');
  await C.click('#btnBell'); await wait(400);
  assert(/Nessuna notifica per ora/.test(await C.$eval('#ntBody', x => x.innerText)), 'frase per la campanella vuota');

  // ---- schermate: 412 scuro e 1280 ----
  DB.notif.uA.forEach((x, i) => { x.letta = i > 2; });
  for (const [w, h, dark] of [[412, 900, true], [1280, 860, false]]) {
    const P = await phone('P' + w, 'uA', w, h, dark);
    assert(await headOk(P), 'testata in ordine a ' + w);
    await P.click('#btnBell'); await wait(600);
    assert(await side(P) <= 0, 'niente scorrimento di lato a ' + w);
    await P.screenshot({ path: CFG.OUT + '/notifiche-' + w + (dark ? '-scuro' : '') + '.png' });
    DB.notif.uA.forEach((x, i) => { x.letta = i > 2; });
  }
  assert.deepStrictEqual(errors, []);
  console.log('e2e105 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
