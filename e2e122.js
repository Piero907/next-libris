const CFG = require("./_config");
const H = require('./_harness');
// moduli: social, amici, profilo   (senza questi file nell'app la prova si salta: vedi esegui.js)
// Giro 3 (18/11/2026, scelte di Piero; Supabase finto). Anna (A) e Bruno (B) amici; Carla (C) non ancora.
// 2) libreria di Bruno nascosta: Anna vede comunque il libro che gli ha prestato («Prestato da te», «Glielo hai prestato tu», nota in cima);
// 14) foto del profilo: quella di Google o una foto scelta (128 px, JPEG piccolo), salvata nel profilo; nell'elenco la foto dell'amico;
// 15) pagina del profilo dal nome in testata e dal Menu: riga dei numeri, citazione preferita scelta tra le proprie, numeri;
//     profilo dell'amico: solo ciò che mostra (numeri solo con la libreria visibile); tre interruttori in «Amici e privacy»;
// 16) «Segui» nell'elenco, nel profilo dell'amico e nella richiesta d'amicizia; notifica «desideri» nella campanella, tocco = i suoi desideri.
// Niente scorrimento di lato a 360. Con SCHERMATE=cartella fa le foto.
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm' };
let clock = Date.parse('2026-11-16T10:00:00Z'); const now = () => new Date(clock += 1000).toISOString();
const PIC = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=';
const P0 = (n, o) => Object.assign({ utente: n, nome: n, desideri: false, libreria: false, creato: '2026-03-02T10:00:00Z', foto: '', foto_il: null, cit: null, stat: null, p_cit: false, p_stat: false, p_cits: false }, o);
const DB = { prof: { uA: P0('Anna'), uB: P0('Bruno', { desideri: true, foto: PIC, foto_il: '2026-11-10T10:00:00Z', p_cit: true, p_stat: true, p_cits: true,
      cit: { x: 'La preferita di Bruno', t: 'Il barone rampante', a: 'Italo Calvino', pg: '12' }, stat: { n: 40, l: 22, ly: 5, y: new Date().getFullYear(), pg: 6100, pgy: 1400, au: 'Italo Calvino', aun: 4, ge: 'Romanzo', gen: 9, pa: ['IT', 'FR'], pr: 1 } }), uC: P0('Carla') },
  am: [{ da: 'uA', a: 'uB', stato: 'amici', creato: now() }], seg: [], noti: [],
  sw: [{ id: '00000001-0000-0000-0000-000000000000', da: 'uA', a: 'uB', tipo: 'prestito', libro: { t: 'Palomar', a: 'Italo Calvino', i: '9788804668022' }, libro_id: 'a1', stato: 'aperto', visto: true, creato: now(), chiuso: null }],
  rows: { 'uB|b1': { utente: 'uB', id: 'b1', cancellato: false, dati: { t: 'Il barone rampante', a: 'Italo Calvino', rs: 'ok', qs: [{ x: 'La preferita di Bruno', pg: '12', d: 5 }, { x: 'Un\'altra di Bruno', d: 4 }], n: 'appunto segreto' } },
    'uB|b2': { utente: 'uB', id: 'b2', cancellato: false, dati: { t: 'Palomar', a: 'Italo Calvino', i: '9788804668022', sk: 'p', sx: '00000001-0000-0000-0000-000000000000', sda: 'Anna', rs: 'in', pp: '40', pg: '120' } },
    'uB|w1': { utente: 'uB', id: 'w1', cancellato: false, dati: { t: 'Lessico famigliare', a: 'Natalia Ginzburg', w: true } } } };
const uidOf = (req) => { const m = /Bearer AT-(\w+)/.exec(req.headers.authorization || ''); return m ? m[1] : null; };
const friendsOk = (x, y) => DB.am.some(f => f.stato === 'amici' && ((f.da === x && f.a === y) || (f.da === y && f.a === x)));
const COLS = ['utente', 'nome', 'desideri', 'libreria', 'creato', 'foto', 'cit', 'p_cit', 'p_stat', 'p_cits'];
function fake(req, res, body, url) {
  const send = (st, j) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(j === undefined ? '' : JSON.stringify(j)); };
  const p = url.pathname.replace(/^\/finto/, ''), q = url.searchParams;
  if (req.headers.apikey !== 'chiave-finta') return send(401, { message: 'no api key' });
  if (p === '/auth/v1/settings') return send(200, { external: { google: true } });
  if (p === '/auth/v1/token') { const id = String(body.refresh_token || '').slice(3); return send(200, { access_token: 'AT-' + id, refresh_token: 'RT-' + id, expires_in: 3600, user: { id } }); }
  const me = uidOf(req); if (!me) return send(401, { message: 'JWT' });
  if (p === '/auth/v1/user') return send(200, { id: me, user_metadata: { picture: 'https://lh3.googleusercontent.com/a/ACg8ocK-finta_1=s96-c' } });
  if (p === '/rest/v1/libri' && req.method === 'GET') return send(200, Object.values(DB.rows).filter(x => x.utente === me).map(x => ({ id: x.id, dati: x.dati, cancellato: x.cancellato, aggiornato: x.aggiornato || now() })));
  if (p === '/rest/v1/libri' && req.method === 'POST') { for (const x of body) DB.rows[me + '|' + x.id] = Object.assign({ utente: me, cancellato: false }, DB.rows[me + '|' + x.id] || {}, x, { aggiornato: now() }); return send(201); }
  if (p === '/rest/v1/profili' && req.method === 'GET') { const pr = DB.prof[me], o = { amici: true, regali: true }; COLS.forEach(k => { o[k] = pr[k]; }); return send(200, [o]); }
  if (p === '/rest/v1/profili') {
    const pr = DB.prof[me];
    if (body.foto !== undefined) { if (body.foto && (body.foto.length > 20000 || !/^(data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+\/]+=*|https:\/\/lh[0-9]\.googleusercontent\.com\/[A-Za-z0-9_=.\/-]+)$/i.test(body.foto))) return send(400, { message: 'check 23514' }); if (body.foto !== pr.foto) pr.foto_il = now(); }
    ['desideri', 'libreria', 'foto', 'cit', 'stat', 'p_cit', 'p_stat', 'p_cits'].forEach(k => { if (body[k] !== undefined) pr[k] = body[k]; });
    DB.posts = (DB.posts || 0) + 1; return send(201);
  }
  if (p === '/rest/v1/rpc/miei_amici') return send(200, DB.am.filter(x => x.da === me || x.a === me).map(x => { const o = x.da === me ? x.a : x.da; return { id: o, utente: DB.prof[o].utente, nome: DB.prof[o].nome, stato: x.stato, verso: x.da === me ? 'inviata' : 'ricevuta', creato: x.creato,
    segue: DB.seg.includes(me + '>' + o), foto_il: x.stato === 'amici' ? DB.prof[o].foto_il : null }; }));
  if (p === '/rest/v1/rpc/foto_amici') { DB.fotoCalls = (DB.fotoCalls || 0) + 1; return send(200, (body.ids || []).filter(o => friendsOk(me, o)).map(o => ({ id: o, foto: DB.prof[o].foto }))); }
  if (p === '/rest/v1/rpc/segui') { const k = me + '>' + body.amico; DB.seg = DB.seg.filter(x => x !== k); if (body.si) { if (!DB.am.some(f => (f.da === me && f.a === body.amico) || (f.a === me && f.da === body.amico))) return send(400, { message: 'non amici' }); DB.seg.push(k); } return send(204); }
  if (p === '/rest/v1/rpc/cerca_utenti') { const s = String(body.q || '').toLowerCase(); return send(200, Object.keys(DB.prof).filter(o => o !== me && DB.prof[o].utente.toLowerCase().startsWith(s)).map(o => ({ id: o, utente: DB.prof[o].utente, nome: DB.prof[o].nome, rel: friendsOk(me, o) ? 'amici' : DB.am.some(f => f.da === me && f.a === o) ? 'inviata' : '' }))); }
  if (p === '/rest/v1/rpc/chiedi_amicizia') { const o = Object.keys(DB.prof).find(k => DB.prof[k].utente === body.utente); DB.am.push({ da: me, a: o, stato: 'attesa', creato: now() }); if (body.segui) DB.seg.push(me + '>' + o); return send(200, 'attesa'); }
  if (p === '/rest/v1/rpc/libreria_di') {
    const o = body.amico; if (!friendsOk(me, o)) return send(400, { message: 'non amici' });
    const miei = DB.sw.filter(s => s.da === me && s.a === o && s.tipo === 'prestito' && s.stato !== 'chiuso').map(s => { const r = Object.values(DB.rows).find(x => x.utente === o && x.dati.sx === s.id), d = r ? r.dati : s.libro;
      return { id: r ? r.id : 'ps-' + s.id, t: d.t, a: d.a, i: d.i, pg: d.pg, rs: r && r.dati.rs, pp: r && r.dati.pp, ts: 5, fuori: false, mio: true }; });
    if (!DB.prof[o].libreria) return send(200, { visibili: false, totale: 0, comuni: 0, libri: miei });
    const l = Object.values(DB.rows).filter(x => x.utente === o && !x.cancellato && x.dati.w !== true && !x.dati.xs && !['p', 'q'].includes(x.dati.sk));
    return send(200, { visibili: true, totale: l.length, comuni: 0, libri: miei.concat(l.map(x => ({ id: x.id, t: x.dati.t, a: x.dati.a, i: x.dati.i, rs: x.dati.rs, rt: x.dati.rt, ts: 3 }))) });
  }
  if (p === '/rest/v1/rpc/desideri_di') {
    const o = body.amico; if (!friendsOk(me, o)) return send(400, { message: 'non amici' });
    if (!DB.prof[o].desideri) return send(200, { visibili: false, libri: [] });
    return send(200, { visibili: true, libri: Object.values(DB.rows).filter(x => x.utente === o && !x.cancellato && x.dati.w === true).map(x => ({ id: x.id, t: x.dati.t, a: x.dati.a, prenotato: '', preso: false })) });
  }
  if (p === '/rest/v1/rpc/profilo_di') {
    const o = body.amico; if (!friendsOk(me, o)) return send(400, { message: 'non amici' });
    const pr = DB.prof[o], r = { utente: pr.utente, creato: pr.creato, foto: pr.foto, desideri: pr.desideri, libreria: pr.libreria, segue: DB.seg.includes(me + '>' + o) };
    if (pr.p_cit && pr.cit) r.cit = pr.cit;
    if (pr.p_stat && pr.libreria && pr.stat) r.stat = pr.stat;
    if (pr.p_cits) r.cits = [].concat(...Object.values(DB.rows).filter(x => x.utente === o && !x.cancellato).map(x => (x.dati.qs || []).filter(c => c.x).map(c => ({ x: c.x, pg: c.pg, d: c.d, t: x.dati.t, a: x.dati.a }))));
    return send(200, r);
  }
  if (p === '/rest/v1/rpc/mie_notifiche') return send(200, DB.noti.filter(n => n.utente === me).map(n => Object.assign({ nome: DB.prof[n.da].utente }, n)));
  if (p === '/rest/v1/rpc/miei_scambi') return send(200, DB.sw.filter(x => x.da === me || x.a === me).map(x => Object.assign({ nome_da: DB.prof[x.da].utente, nome_a: DB.prof[x.a].utente }, x)));
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
}).listen(CFG.port(8322));
const base = 'http://localhost:' + CFG.port(8322);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const wait = H.wait;   // attesa «finché» (_harness.js)
  async function phone(name, uid, w) {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: w || 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    await page.evaluateOnNewDocument((u, id) => {
      window.NL_SOCIAL = { url: u, key: 'chiave-finta', gClient: 'client-finto' };
      if (!localStorage.getItem('prova:catalogo-libri-social-auth')) localStorage.setItem('prova:catalogo-libri-social-auth', JSON.stringify({ at: 'AT-' + id, rt: 'RT-' + id, exp: Date.now() + 3e6, uid: id, email: id + '@esempio.it' }));
    }, base + '/finto', uid);
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) ? r.continue() : r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"totalItems":0}' }));
    await page.goto(base + '/next-libris-prova/?vista=elenco', { waitUntil: 'load' }); await wait(2200);
    page.body = () => page.$eval('#friBody', x => x.innerText.replace(/\s+/g, ' '));
    page.book = (pred) => page.evaluate((p) => { const f = new Function('b', 'return ' + p); const b = window.NL.books().find(f); return b ? JSON.parse(JSON.stringify(b)) : null; }, pred);
    page.openRow = (id) => page.evaluate((id) => document.querySelector('[data-id="' + id + '"] .sum').click(), id);
    page.add = (o) => page.evaluate((o) => { const b = window.NL.clean(o); window.NL.books().unshift(b); window.NL.save(); window.NL.refresh(); return b.id; }, o);
    return page;
  }
  const SHOTS = process.env.SCHERMATE ? path.resolve(process.env.SCHERMATE) : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const shot = async (pg, n) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, n + '.png') }); };
  const txt = (pg, s) => pg.$eval(s, x => x.innerText.replace(/\s+/g, ' '));
  const noSide = async (pg, s, what) => { const d = await pg.$eval(s, x => x.scrollWidth - x.clientWidth); assert(d <= 0, 'niente scorrimento di lato: ' + what + ' (' + d + ')'); };
  const y = new Date().getFullYear(), today = new Date().toISOString().slice(0, 10);
  const A = await phone('A', 'uA', 360);
  
  await A.add({ id: 'a1', t: 'Palomar', a: 'Italo Calvino', i: '9788804668022', p: 'Bruno', pd: today, sx: '00000001-0000-0000-0000-000000000000', rs: 'ok', rd: today, pg: '120', gen: 'Romanzo', qs: [{ x: 'Leggere il mondo come un libro', pg: '33', d: 20 }] });
  await A.add({ id: 'a2', t: 'Il nome della rosa', a: 'Umberto Eco', rs: 'ok', rd: '2020-05-01', pg: '500', gen: 'Romanzo', n: 'appunto di Anna', qs: [{ x: 'Stat rosa pristina nomine', d: 10 }] });
  await A.add({ id: 'a3', t: 'Baudolino', a: 'Umberto Eco', rs: 'da' });
  await A.add({ id: 'a4', t: 'Lolita', a: 'Vladimir Nabokov', w: true });
  await A.evaluate(() => window.NLAmici.load(true)); await wait(900);

  // ---- 15) il tuo profilo: dal nome in testata ----
  assert(await A.$('#gTabs [data-g="prof"]'), 'il profilo si apre dal segnalibro «Tu»');
  await H.fai(A, 'prof'); await wait(1400);   // i numeri salgono (giro 11C): si leggono alla fine
  assert(await A.$eval('#profSheet', x => !x.hidden), 'si apre il profilo');
  let t = await txt(A, '#profBody');
  assert(/Anna Su Next Libris da marzo 2026/i.test(t), 'nome e «Su Next Libris da marzo 2026»: ' + t.slice(0, 80));
  assert(new RegExp('3 libri · 1 letto nel ' + y).test(t), 'riga dei numeri: ' + t);
  assert(/Pagine lette 620/i.test(t) && /Autore più letto (Umberto Eco|Italo Calvino) · 1/i.test(t) && /Genere più letto Romanzo · 2/i.test(t) && /Prestati adesso 1/i.test(t), 'i numeri (elenco «Da sempre», 19/11/2026): ' + t);
  assert(new RegExp('Nel ' + y + ' hai letto 1 libro').test(t) && /Metti un obiettivo per il/i.test(t), 'scheda dell\'anno: ' + t);
  assert(/Tutte le citazioni 2 citazioni/i.test(t) && /Scegli le citazioni/i.test(t), 'citazioni: ' + t);
  assert(/Amici e privacy Gli amici vedono la foto e nient.altro/i.test(t), 'cosa vedono gli amici (scorciatoia, 18/11/2026): ' + t);
  assert.deepStrictEqual(await A.$$eval('#profBody .pf-set [data-p]', a => a.map(x => x.dataset.p)), ['acc', 'privacy', 'push', 'keys', 'menu'], 'scorciatoie del profilo');
  assert(!/Metti una foto/i.test(t) && !/Preferiti/i.test(t), 'via «Metti una foto» e i Preferiti');
  assert(await A.$eval('#profH', x => x.classList.contains('sr')), 'titolo «Il tuo profilo» solo per i lettori di schermo');
  await wait(600);
  assert.strictEqual(DB.prof.uA.stat && DB.prof.uA.stat.l, 2, 'i numeri arrivano al profilo online'); assert.strictEqual(DB.prof.uA.stat.n, 3);
  const posts0 = DB.posts; await A.evaluate(() => window.NLProfilo.push()); await wait(300); assert.strictEqual(DB.posts, posts0, 'senza cambi non rimanda niente');
  // citazione preferita
  await A.click('#profBody [data-p="pick"]'); await wait(300);
  assert.strictEqual(await A.$$eval('#profBody .pf-qpick', x => x.length), 2, 'due citazioni tra cui scegliere');
  await shot(A, 'profilo-scegli-citazione-360');
  await A.click('#profBody .pf-qpick'); await wait(600);     // dal giro 6 la preferita è una citazione in evidenza (puntina): prova completa in e2e125
  assert.strictEqual(await A.$eval('#profBody .pf-qpick', x => x.getAttribute('aria-pressed')), 'true', 'la citazione scelta ha la puntina');
  await A.click('#profSheet .sh-x'); await wait(300);   // stile C: il profilo è una pagina, «Chiudi» è la ×   // «Chiudi» da «Scegli le citazioni» torna al profilo (18/11/2026)
  assert(await A.$eval('#profSheet', x => !x.hidden), 'il profilo resta aperto');
  t = await txt(A, '#profBody'); assert(/Citazioni in evidenza 1 «Leggere il mondo come un libro» — Italo Calvino, Palomar · pagina 33/i.test(t), 'in evidenza nel profilo: ' + t);
  assert.strictEqual(await A.evaluate(() => window.NL.get('a1').qs[0].pin), 1, 'la puntina sta nel libro'); assert(!/appunto/i.test(JSON.stringify(DB.prof.uA)), 'mai gli appunti');
  // stile G (20/11/2026): niente foto nel profilo, il nome sta nell'ex libris
  assert(await A.evaluate(() => { const b = document.querySelector('#profBody [data-p="photo"]'); return !b || !b.getClientRects().length; }), 'niente tasto della foto');
  await noSide(A, '#profSheet .sheet-in', 'il tuo profilo a 360'); await shot(A, 'profilo-mio-360');
  // obiettivo dell'anno (18/11/2026, facoltativo): si mette, si vede la barra, arriva ai numeri online, si toglie
  await A.click('#profBody [data-p="goal"]'); await wait(200);
  await A.$eval('#pfGoal', e => { e.value = '0'; }); await A.click('#profBody [data-p="goalok"]'); await wait(200);
  assert(await A.$('#pfGoal'), 'numero non valido: il campo resta');
  await A.$eval('#pfGoal', e => { e.value = '4'; }); await A.click('#profBody [data-p="goalok"]'); await wait(700);
  t = await txt(A, '#profBody'); assert(/Obiettivo 4 · 25%/i.test(t), 'obiettivo: ' + t.slice(0, 300));
  assert.strictEqual(DB.prof.uA.stat.ob, 4, 'l\'obiettivo arriva ai numeri online');
  await A.evaluate(() => document.querySelector('#profBody .pf-t.big').scrollIntoView({ block: 'start' })); await shot(A, 'profilo-obiettivo-360');
  await A.click('#profBody [data-p="goal"]'); await wait(200); await A.click('#profBody [data-p="goaloff"]'); await wait(700);
  assert(!/Obiettivo 4/i.test(await txt(A, '#profBody')) && !DB.prof.uA.stat.ob, 'obiettivo tolto');
  await A.evaluate(() => document.querySelector('#profSheet .sheet-in').scrollTo(0, 9999)); await wait(200); await shot(A, 'profilo-mio-360-giu');
  // «Cosa vedono gli amici» → Amici e privacy: tre interruttori, spenti di partenza
  await A.click('#profBody [data-p="privacy"]'); await wait(700);
  assert(await A.$eval('#profSheet', x => x.hidden) && await A.$eval('#friSheet', x => !x.hidden), 'si passa ad «Amici e privacy»');
  assert.deepStrictEqual(await A.$$eval('#friPCit, #friPStat, #friPCits', x => x.map(i => i.checked)), [false, false, false], 'spenti di partenza');
  await A.click('#friPCit'); await wait(500); assert.strictEqual(DB.prof.uA.p_cit, true, 'citazioni in evidenza agli amici');
  await A.evaluate(() => document.querySelector('#friPCits').scrollIntoView({ block: 'center' })); await wait(200);
  await noSide(A, '#friSheet .sheet-in', 'Amici e privacy a 360'); await shot(A, 'profilo-privacy-360');
  await A.keyboard.press('Escape'); await wait(200);
  // dal Menu
  assert(await A.$('#drawerOpts .dmain > #goProf:first-child'), '«Il mio profilo» in cima al Menu (giro 7)');

  // ---- 14 e 16) elenco degli amici: foto di Bruno, «Segui» ----
  await A.evaluate(() => window.NLAmici.open()); await wait(900);
  assert(await A.$('#friBody .fr-av .pf-av img'), 'la foto di Bruno nell\'elenco'); assert.strictEqual(DB.fotoCalls, 1, 'foto chiesta una volta');
  assert.strictEqual(await A.$eval('#friBody .fr-fol', x => x.getAttribute('aria-pressed') + x.textContent), 'falseSegui');
  await A.click('#friBody .fr-fol'); await wait(500);
  assert(DB.seg.includes('uA>uB'), 'Anna segue i desideri di Bruno'); assert.strictEqual(await A.$eval('#friBody .fr-fol', x => x.getAttribute('aria-pressed') + x.textContent), 'trueSegui ✓');
  await A.evaluate(() => window.NLAmici.load(true)); await wait(700); assert.strictEqual(DB.fotoCalls, 1, 'la foto non si richiede se non è cambiata');
  // richiesta d'amicizia con «Segui i suoi desideri»
  await A.type('#friQ', 'Carla'); await A.click('#friFormQ button'); await wait(500);
  await A.click('#friSegui'); await noSide(A, '#friSheet .sheet-in', 'Amici a 360'); await shot(A, 'amici-elenco-segui-360');
  await A.click('#friBody [data-f="ask"]'); await wait(700);
  assert(DB.seg.includes('uA>uC') && DB.am.some(f => f.da === 'uA' && f.a === 'uC' && f.stato === 'attesa'), 'richiesta a Carla e la segue già');
  await A.keyboard.press('Escape'); await wait(200);

  // ---- 2) libreria nascosta di Bruno: si vede il libro prestato da Anna ----
  await A.evaluate(() => window.NLAmici.guest('uB')); await wait(900);
  assert.strictEqual(await A.evaluate(() => window.NL.guest()), 'Bruno');
  assert.deepStrictEqual(await A.evaluate(() => window.NL.books().filter(b => !b.w).map(b => b.t)), ['Palomar'], 'solo il libro prestato');
  t = await txt(A, '#guestBar'); assert(/Bruno non mostra la sua libreria: qui vedi solo il libro che ha in prestito da te\./i.test(t), 'nota in cima: ' + t);
  assert(/Sta leggendo «Palomar» pagina 40 di 120/i.test(t), 'con la sua lettura: ' + t);
  await A.openRow('b2'); await wait(500);
  t = await txt(A, '[data-id="b2"]'); assert(/Prestato da te/i.test(t) && /Glielo hai prestato tu/i.test(t) && !/Me lo presti/i.test(t) && !/Ce l.hai anche tu/i.test(t), 'scheda del libro prestato: ' + t.slice(0, 300));
  await shot(A, 'amico-libreria-nascosta-360');
  await A.evaluate(() => { const x = document.querySelector('[data-id="b2"] .tag.recv'); if (x) x.click(); }); await wait(300);
  assert(!(await A.$('#recvSheet:not([hidden])')), 'l\'etichetta è solo da leggere');

  // ---- 15 e 16) profilo di Bruno dal nome in testata ----
  await A.evaluate(() => { const b = document.querySelector('.row.cv-full .cv-back'); if (b) b.click(); }); await wait(400);   // restyle pezzo 2: prima si chiude la pagina del libro
  await A.evaluate(() => window.scrollTo(0, 0)); await A.evaluate(() => document.querySelector('header.top h1 .g-t').click()); await wait(700);   // nella libreria di un amico il titolo apre il suo profilo
  t = await txt(A, '#profBody');
  assert(/Bruno Su Next Libris da marzo 2026/i.test(t) && /Stai seguendo i suoi Desideri ✓/i.test(t) && /Bruno non lo sa\./i.test(t), 'profilo di Bruno: ' + t);
  assert(/«La preferita di Bruno» — Italo Calvino, Il barone rampante · pagina 12/i.test(t) && /Tutte le citazioni 2 citazioni/i.test(t), 'citazioni di Bruno: ' + t);
  assert(!/I suoi numeri/i.test(t) && !/40 libri/i.test(t), 'numeri nascosti con la libreria nascosta');
  assert(await A.$('#profBody .pf-av.big img'), 'la sua foto');
  await A.click('#profBody [data-p="cits"]'); await wait(300);
  t = await txt(A, '#profBody'); assert(/Un.altra di Bruno/i.test(t) && !/appunto segreto/i.test(t), 'tutte le citazioni, mai gli appunti');
  await A.click('#profBody [data-p="back"]'); await wait(200);
  await A.click('#profBody [data-p="segui"]'); await wait(500);
  assert(!DB.seg.includes('uA>uB'), 'smette di seguirlo dal profilo'); assert.strictEqual(await A.$eval('#profBody [data-p="segui"]', x => x.getAttribute('aria-pressed')), 'false');
  await A.click('#profBody [data-p="segui"]'); await wait(500); assert(DB.seg.includes('uA>uB'), 'e lo segue di nuovo');
  await A.click('#profSheet .sh-x'); await wait(200);
  DB.prof.uB.libreria = true; DB.prof.uB.desideri = false;
  await A.evaluate(() => document.querySelector('header.top h1 .g-t').click()); await wait(1600);   // i numeri salgono (giro 11C): si legge alla fine
  t = await txt(A, '#profBody');
  assert(new RegExp('40 libri · 5 letti nel ' + y + ' · 2 paesi').test(t) && new RegExp('I suoi numeri Nel ' + y + ' Bruno ha letto 5 libri', 'i').test(t) && /Pagine lette 6\.100/i.test(t) && /Autore più letto Italo Calvino · 4/i.test(t) && /Prestati adesso 1/i.test(t), 'numeri con la libreria visibile: ' + t);
  assert(!(await A.$('#profBody [data-p="share"]')), 'nel profilo di un amico niente «Condividi» (giro 11C)');
  assert(await A.$('#profBody [data-p="share"]') === null && (await A.$$('#profBody .pf-board .pf-t')).length >= 1 && (await A.$$('#profBody .pf-list .pf-r')).length > 3, 'tessere ed elenco anche nel profilo dell\'amico');
  assert(!(await A.$('#profBody [data-p="segui"]')), 'se nasconde i desideri il tasto «Segui i suoi Desideri» non c\'è (giro 6)');
  await noSide(A, '#profSheet .sheet-in', 'profilo dell\'amico a 360'); await shot(A, 'profilo-amico-360');
  await A.click('#profSheet .sh-x'); await wait(200);
  await A.evaluate(() => window.NL.guestExit()); await wait(400);

  // ---- 16) campanella: il riassunto dei desideri di Bruno; tocco = i suoi desideri ----
  DB.prof.uB.desideri = true;
  DB.noti.push({ id: '00000009-0000-0000-0000-000000000000', utente: 'uA', da: 'uB', tipo: 'desideri', rif: '4', titolo: '«Lessico famigliare», «Gli indifferenti», «La noia»', creata: new Date().toISOString(), letta: false });
  await A.evaluate(() => window.NLAmici.load(true)); await wait(900);
  await A.evaluate(() => window.NLNotifiche.open()); await wait(500);
  t = await txt(A, '#ntBody'); assert(/Bruno ha 4 nuovi desideri: «Lessico famigliare», «Gli indifferenti», «La noia» e altri/i.test(t), 'notifica: ' + t);
  await shot(A, 'campanella-desideri-360');
  await A.click('#ntBody .nt-item'); await wait(1300);
  assert.strictEqual(await A.evaluate(() => window.NL.guest() + '/' + window.NL.tab()), 'Bruno/wish', 'si aprono i desideri di Bruno');
  await A.evaluate(() => window.NL.guestExit()); await wait(300);
  // notifiche push: la voce dei consigli comprende i desideri
  assert(/Consigli e desideri/i.test(fs.readFileSync(path.join(ROOT, 'push.js'), 'utf8')));
  // PC: il profilo senza scorrimento di lato
  await A.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 }); await wait(300);
  await H.fai(A, 'prof'); await wait(500); await noSide(A, '#profSheet .sheet-in', 'profilo a 1280'); await shot(A, 'profilo-mio-1280');
  assert.deepStrictEqual(errors, []);
  console.log('e2e122 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
