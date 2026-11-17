const CFG = require("./_config");
// modulo «Amici» (amici.js) con un Supabase finto: parte «Amici» nel Menu (sotto Filtri/Statistiche, prima di «La tua libreria»),
// icona accanto all'ingranaggio con il numero delle richieste; un solo nome (quello dell'app = quello per gli amici: proposto,
// già preso senza badare alle maiuscole → messaggio; cambiato nelle Impostazioni → anche per gli amici, se preso torna com'era);
// ricerca per nome (da 3 lettere), richiesta, avviso in cima PRIMA degli altri avvisi (disposizione A, con «Installa»), accetta,
// amici da tutte e due le parti, togli con conferma (dalla pagina dell'amico); finestra che non esce di lato a 360 px; link d'invito (…/?amico=Nome) senza
// account: entra con Google, sceglie il nome e chiede l'amicizia a chi l'ha invitato; indirizzo pulito
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm' };
// ---- Supabase finto ----
const DB = { users: { 'anna@esempio.it': 'uA', 'bruno@esempio.it': 'uB' }, prof: { uA: { nome: 'Anna', utente: null }, uB: { nome: 'Bruno', utente: 'Bruno' } }, am: [] };
const low = (x) => String(x || '').toLowerCase();
const uidOf = (req) => { const m = /Bearer AT-(\w+)/.exec(req.headers.authorization || ''); return m ? m[1] : null; };
function rel(me, o) { const f = DB.am.find(x => (x.da === me && x.a === o) || (x.da === o && x.a === me)); return !f ? '' : f.stato === 'amici' ? 'amici' : f.da === me ? 'inviata' : 'ricevuta'; }
function fake(req, res, body, url) {
  const send = (st, j) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(j === undefined ? '' : JSON.stringify(j)); };
  const p = url.pathname.replace(/^\/finto/, ''), q = url.searchParams;
  if (req.headers.apikey !== 'chiave-finta') return send(401, { message: 'no api key' });
  if (p === '/auth/v1/settings') return send(200, { external: { google: true } });
  if (p === '/auth/v1/token' && q.get('grant_type') === 'id_token') {
    const em = /^IDT-([^.]+@[^.]+\.[a-z]+)\./.exec(body.id_token || '')[1];
    const id = DB.users[em] || (DB.users[em] = 'u' + Object.keys(DB.users).length);
    DB.prof[id] = DB.prof[id] || { nome: '', utente: null };
    return send(200, { access_token: 'AT-' + id, refresh_token: 'RT-' + id, expires_in: 3600, user: { id, email: em, user_metadata: {} } });
  }
  const me = uidOf(req); if (!me) return send(401, { message: 'JWT' });
  if (p === '/rest/v1/libri') return send(req.method === 'GET' ? 200 : 201, req.method === 'GET' ? [] : undefined);
  if (p === '/rest/v1/profili' && req.method === 'GET') { const pr = DB.prof[me]; return send(200, pr ? [{ utente: pr.utente, nome: pr.nome }] : []); }
  if (p === '/rest/v1/profili' && req.method === 'POST') {
    if (body.utente) {
      if (!/^[0-9A-Za-zÀ-ÖØ-öø-ÿ ._'-]{3,20}$/.test(body.utente) || body.utente !== body.utente.trim()) return send(400, { code: '23514', message: 'new row violates check constraint' });
      if (Object.keys(DB.prof).some(k => k !== me && low(DB.prof[k].utente) === low(body.utente))) return send(409, { code: '23505', message: 'duplicate key value violates unique constraint "profili_utente_key"' });
    }
    DB.prof[me] = Object.assign(DB.prof[me] || { nome: '', utente: null }, body.utente ? { utente: body.utente } : {}, body.nome ? { nome: body.nome } : {});
    return send(201);
  }
  if (p === '/rest/v1/rpc/cerca_utenti') {
    DB.cerche = (DB.cerche || 0) + 1;
    const s = low(body.q).replace(/^@/, '').trim();
    if (s.length < 3) return send(200, []);
    return send(200, Object.keys(DB.prof).filter(k => k !== me && DB.prof[k].utente && low(DB.prof[k].utente).startsWith(s)).map(k => ({ id: k, utente: DB.prof[k].utente, nome: DB.prof[k].nome, rel: rel(me, k) })));
  }
  if (p === '/rest/v1/rpc/chiedi_amicizia') {
    const o = Object.keys(DB.prof).find(k => low(DB.prof[k].utente) === low(body.utente).trim());
    if (!o) return send(400, { message: 'utente non trovato' });
    const back = DB.am.find(x => x.da === o && x.a === me); if (back) { back.stato = 'amici'; return send(200, 'amici'); }
    if (!DB.am.find(x => x.da === me && x.a === o)) DB.am.push({ da: me, a: o, stato: 'attesa', creato: new Date().toISOString() });
    return send(200, 'attesa');
  }
  if (p === '/rest/v1/rpc/rispondi_amicizia') {
    const i = DB.am.findIndex(x => x.da === body.da && x.a === me && x.stato === 'attesa');
    if (i >= 0) { if (body.accetta) DB.am[i].stato = 'amici'; else DB.am.splice(i, 1); }
    return send(204);
  }
  if (p === '/rest/v1/rpc/togli_amicizia') { DB.am = DB.am.filter(x => !((x.da === me && x.a === body.altro) || (x.da === body.altro && x.a === me))); return send(204); }
  if (p === '/rest/v1/rpc/miei_amici') {
    return send(200, DB.am.filter(x => x.da === me || x.a === me).map(x => { const o = x.da === me ? x.a : x.da; return { id: o, utente: DB.prof[o].utente, nome: DB.prof[o].nome, stato: x.stato, verso: x.da === me ? 'inviata' : 'ricevuta', creato: x.creato }; }));
  }
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
}).listen(CFG.port(8302));
const base = 'http://localhost:' + CFG.port(8302);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function phone(name, uid, email, query) {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    const GIS = "window.google={accounts:{id:{initialize:function(o){window.__gis=o;},renderButton:function(el){var b=document.createElement('button');b.type='button';b.id='gisFinto';b.textContent='Accedi con Google';b.onclick=function(){window.__gis.callback({credential:'IDT-" + email + ".'+window.__gis.nonce});};el.appendChild(b);}}}};";
    await page.evaluateOnNewDocument((u, id, em) => {
      window.NL_SOCIAL = { url: u, key: 'chiave-finta', gClient: 'client-finto' };
      if (id && !localStorage.getItem('prova:catalogo-libri-social-auth')) localStorage.setItem('prova:catalogo-libri-social-auth', JSON.stringify({ at: 'AT-' + id, rt: 'RT-' + id, exp: Date.now() + 3e6, uid: id, email: em }));
    }, base + '/finto', uid || '', email);
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith('https://accounts.google.com/gsi/client') ? r.respond({ status: 200, contentType: 'text/javascript', body: GIS }) : r.url().startsWith(base) ? r.continue() : r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"totalItems":0}' }));
    await page.goto(base + '/next-libris-prova/' + (query || '?vista=elenco'), { waitUntil: 'load' }); await wait(800);
    page.body = () => page.$eval('#friBody', x => x.innerText.replace(/\s+/g, ' '));
    page.openFri = async () => { await page.evaluate(() => window.__app.openDrawer('opt')); await wait(400); await page.click('#goFri'); await wait(700); };
    return page;
  }
  // ---- A: Anna, già entrata; parte «Amici» nel Menu, icona in alto ----
  const A = await phone('A', 'uA', 'anna@esempio.it');
  await A.evaluate(() => { window.__app.settings.name = 'Anna'; }); await wait(2000);
  assert(await A.$('header.top #btnFri') && !(await A.$('#btnFriN')), 'icona Amici in testata, senza numero (il numero è sulla campanella)');
  await A.evaluate(() => window.__app.openDrawer('opt')); await wait(400);
  const menu = await A.evaluate(() => { const o = document.getElementById('drawerOpts'); return { heads: [...o.querySelectorAll('h3')].filter(h => h.getClientRects().length).map(h => h.textContent),
    m: [...document.getElementById('friMenu').children].map(x => x.id), after: document.getElementById('friMenuH').previousElementSibling.classList.contains('dmain'),
    acc: document.getElementById('goAcc').parentNode.id, fri: document.getElementById('goFriTxt').textContent }; });
  console.log('[menu]', JSON.stringify(menu));
  assert.deepStrictEqual(menu.heads, ['Amici', 'La tua libreria']); assert(menu.after && menu.m.join() === 'goFri', 'Amici subito dopo Filtri/Statistiche («Invita» nella finestra Amici, 17/11/2026)');
  assert.strictEqual(menu.acc, 'setList', 'Account e sincronizzazione sotto Impostazioni');
  assert(/Scegli il tuo nome/.test(menu.fri), 'senza nome il Menu lo chiede');
  await A.evaluate(() => window.__app.closeDrawer()); await wait(300);
  await A.click('#btnFri'); await wait(700);
  assert.strictEqual(await A.$eval('#friU', x => x.value), 'Anna', 'il nome proposto è quello dell\'app');
  await A.$eval('#friU', x => { x.value = 'bruno'; }); await A.click('#friSaveU'); await wait(500);
  let t = await A.body(); console.log('[nome preso]', t.slice(0, 160)); assert(/già usato da un altro/.test(t), 'preso, anche con le maiuscole diverse');
  await A.$eval('#friU', x => { x.value = '  Anna  R. '; }); await A.click('#friSaveU'); await wait(700);
  assert.strictEqual(DB.prof.uA.utente, 'Anna R.', 'nome salvato com\'è scritto (spazi in più tolti)');
  assert.strictEqual(await A.evaluate(() => window.NL.name()), 'Anna R.', 'è anche il nome dell\'app');
  t = await A.body(); assert(/Ancora nessuno/.test(t), 'nessun amico');
  await A.click('[data-f="opts"]'); await wait(300); assert(/Il tuo nome Anna R\./.test(await A.body()), 'il nome sta in «Amici e privacy»'); await A.click('[data-f="optsback"]'); await wait(200);
  // nome cambiato nelle Impostazioni: vale anche per gli amici; se è preso torna com'era
  await A.evaluate(() => window.NL.setName('Anna Rossi')); await wait(600);
  assert.strictEqual(DB.prof.uA.utente, 'Anna Rossi', 'nome dell\'app → nome per gli amici');
  await A.evaluate(() => window.NL.setName('BRUNO')); await wait(600);
  assert.strictEqual(DB.prof.uA.utente, 'Anna Rossi'); assert.strictEqual(await A.evaluate(() => window.NL.name()), 'Anna Rossi', 'preso: torna com\'era');
  // ricerca: 2 lettere no, 3 sì (senza badare alle maiuscole)
  await A.evaluate(() => { window.NLAmici.open(); }); await wait(600);
  await A.type('#friQ', 'br'); await A.click('#friFormQ button'); await wait(300);
  assert(/almeno 3 lettere/.test(await A.body()), 'ricerca da 3 lettere');
  await A.$eval('#friQ', x => { x.value = 'BRU'; }); await A.click('#friFormQ button'); await wait(500);
  t = await A.body(); console.log('[ricerca]', t.slice(0, 200)); assert(/Bruno Chiedi l.amicizia/.test(t));
  await A.click('[data-f="ask"][data-u="Bruno"]'); await wait(700);
  assert(DB.am.length === 1 && DB.am[0].da === 'uA' && DB.am[0].a === 'uB' && DB.am[0].stato === 'attesa', 'richiesta salvata');
  t = await A.body(); assert(/Richiesta inviata/.test(t) && /Richieste che hai mandato/.test(t) && /In attesa/.test(t), 'richiesta tra quelle mandate');
  await A.screenshot({ path: CFG.OUT + '/amici-cerca.png' });
  // ---- B: Bruno apre l'app (disposizione A, telefono stretto): avviso PRIMA di «Installa», numero sull'icona e nel Menu ----
  const B = await phone('B', 'uB', 'bruno@esempio.it');
  await B.setViewport({ width: 360, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await B.evaluate(() => { window.NLLayout.set('A'); const c = document.getElementById('instCard'); if (c) c.hidden = false; }); await wait(2200);
  assert(!(await B.$('#friNote')), 'niente riquadro in cima: la richiesta è nella campanella (notifiche.js, e2e105)');
  await B.screenshot({ path: CFG.OUT + '/amici-avviso.png' });
  await B.evaluate(() => window.__app.openDrawer('opt')); await wait(400);
  assert(/1 richiesta per te/.test(await B.$eval('#goFriTxt', x => x.textContent)), 'richiesta scritta nel Menu');
  await B.evaluate(() => window.__app.closeDrawer()); await wait(300);
  await B.click('#btnFri'); await wait(900);
  t = await B.body(); assert(/Vogliono essere tuoi amici 1/.test(t) && /Anna Rossi/.test(t));
  const side = await B.evaluate(() => { const si = document.querySelector('#friSheet .sheet-in'); return si.scrollWidth - si.clientWidth; });
  assert(side <= 0, 'la finestra non esce di lato a 360 px (' + side + ')');
  await B.screenshot({ path: CFG.OUT + '/amici-richiesta.png' });
  await B.click('[data-f="yes"]'); await wait(800);
  assert.strictEqual(DB.am[0].stato, 'amici', 'accettata');
  t = await B.body(); assert(/I tuoi amici 1/.test(t) && /Anna Rossi/.test(t) && !/Richieste per te/.test(t), 'B: amici');
  // A vede l'amico (aggiornando)
  await A.evaluate(() => window.NLAmici.load(true)); await wait(500);
  t = await A.body(); assert(/I tuoi amici 1/.test(t) && /Bruno/.test(t) && !/Richieste che hai mandato/.test(t), 'A: amici');
  // togli con conferma
  await A.evaluate(() => window.NLAmici.friend('uB')); await wait(500);      // «Togli» sta in «Prestiti, regali e altro» (toccando l'amico si apre la sua libreria)
  await A.click('[data-f="ask-drop"]'); await wait(200);
  assert(/Togli Bruno dagli amici\?/.test(await A.body()), 'conferma'); assert.strictEqual(DB.am.length, 1, 'non ancora tolto');
  await A.click('[data-f="drop"]'); await wait(700);
  assert.strictEqual(DB.am.length, 0, 'tolto'); assert(/Ancora nessuno/.test(await A.body()));
  // ---- C: apre il link d'invito senza account ----
  const C = await phone('C', '', 'carla@esempio.it', '?amico=Anna%20Rossi&vista=elenco'); await wait(600);
  const url = await C.evaluate(() => location.href); console.log('[indirizzo]', url);
  assert(!/amico=/.test(url) && /vista=elenco/.test(url), 'indirizzo pulito, il resto resta');
  t = await C.body(); assert(/Ti ha invitato Anna Rossi/.test(t) && /serve l.account/.test(t), 'invito senza account');
  await C.click('[data-f="login"]'); await wait(900);
  await C.click('#gisFinto'); await wait(1500);
  assert(await C.$eval('#friSheet', x => !x.hidden), 'dopo l\'accesso torna la finestra Amici');
  t = await C.body(); assert(/Ti ha invitato Anna Rossi/.test(t) && /Il tuo nome/.test(t), 'prima il nome');
  await C.$eval('#friU', x => { x.value = 'Carla'; }); await C.click('#friSaveU'); await wait(900);
  t = await C.body(); console.log('[invito]', t.slice(0, 200)); assert(/Ti ha invitato Anna Rossi Chiedi l.amicizia/.test(t), 'scheda di chi ha invitato');
  await C.click('.fr-inv [data-f="ask"]'); await wait(700);
  const uC = DB.users['carla@esempio.it'];
  assert(DB.am.some(x => x.da === uC && x.a === 'uA' && x.stato === 'attesa'), 'C chiede l\'amicizia ad A');
  assert.strictEqual(await C.evaluate(() => window.NLAmici.state().invite), null, 'invito usato');
  await C.screenshot({ path: CFG.OUT + '/amici-invito.png' });
  // Indietro/Esc chiude
  await C.keyboard.press('Escape'); await wait(200); assert(await C.$eval('#friSheet', x => x.hidden), 'Esc chiude');
  assert.deepStrictEqual(errors, []);
  console.log('e2e102 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
