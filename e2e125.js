const CFG = require("./_config");
const H = require('./_harness');
// moduli: social, amici, profilo   (senza questi file nell'app la prova si salta: vedi esegui.js)
// Giro 6 (18/11/2026, scelte di Piero; Supabase finto). Anna (A) e Bruno (B) amici.
// «Lo consiglio»: coccarda accanto alla stella, solo in Libreria; puntina sulle citazioni (al massimo 3), anche in «Tutte le citazioni»;
// la vecchia citazione preferita diventa una puntina; il tuo profilo con In lettura, Preferiti, Consigliati, citazioni in evidenza, numeri nuovi;
// «Amici e privacy»: tre interruttori nuovi accesi di partenza; il tocco sul nome di un amico apre il suo profilo (Libreria, Desideri,
// icone, «Segui i suoi Desideri» con la frase scelta, file di copertine, numeri tra voi due); «togli dagli amici» in rosso;
// «Ce l'ha già Bruno» quando aggiungi un desiderio (resta nei Desideri) e «Me lo presti?»; campanella: avviso «trovato» con «Me lo presti?».
// Niente scorrimento di lato a 360. Con SCHERMATE=cartella fa le foto.
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm' };
let clock = Date.parse('2026-11-16T10:00:00Z'); const now = () => new Date(clock += 1000).toISOString();
const PIC = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=';
const P0 = (n, o) => Object.assign({ utente: n, nome: n, desideri: false, libreria: false, creato: '2026-03-02T10:00:00Z', foto: '', foto_il: null, cit: null, stat: null, p_cit: false, p_stat: false, p_cits: false, p_let: true, p_pref: true, p_cons: true }, o);
const YY = new Date().getFullYear();
const DB = { prof: { uA: P0('Anna'), uB: P0('Bruno', { desideri: true, libreria: true, p_cit: true, p_stat: true,
      stat: { n: 40, l: 22, ly: 5, y: YY, pg: 6100, pgy: 1400, au: 'Italo Calvino', aun: 4, auy: 'Natalia Ginzburg', auyn: 2, ge: 'Romanzo', gen: 9, pa: ['IT', 'FR'], pr: 1,
        ul: { t: 'Lessico famigliare', a: 'Natalia Ginzburg' }, lu: { t: 'Guerra e pace', a: 'Lev Tolstoj', pg: 1400 } } }), uC: P0('Carla') },
  am: [{ da: 'uA', a: 'uB', stato: 'amici', creato: now() }], seg: [], noti: [], asks: [], chiHa: 0,
  sw: [{ id: '00000001-0000-0000-0000-000000000000', da: 'uA', a: 'uB', tipo: 'prestito', libro: { t: 'Palomar', a: 'Italo Calvino' }, libro_id: 'zz1', stato: 'chiuso', visto: true, creato: now(), chiuso: now() },
    { id: '00000002-0000-0000-0000-000000000000', da: 'uA', a: 'uB', tipo: 'prestito', libro: { t: 'Marcovaldo', a: 'Italo Calvino' }, libro_id: 'zz2', stato: 'chiuso', visto: true, creato: now(), chiuso: now() },
    { id: '00000003-0000-0000-0000-000000000000', da: 'uB', a: 'uA', tipo: 'prestito', libro: { t: 'La luna e i falò', a: 'Cesare Pavese' }, libro_id: 'zz3', stato: 'chiuso', visto: true, creato: now(), chiuso: now() }],
  rows: { 'uB|b1': { utente: 'uB', id: 'b1', cancellato: false, dati: { t: 'Il barone rampante', a: 'Italo Calvino', rs: 'in', pp: '40', pg: '300', ts: 9 } },
    'uB|b2': { utente: 'uB', id: 'b2', cancellato: false, dati: { t: 'Se una notte d\'inverno un viaggiatore', a: 'Italo Calvino', fav: true, rs: 'ok', ts: 8, n: 'appunto segreto' } },
    'uB|b3': { utente: 'uB', id: 'b3', cancellato: false, dati: { t: 'Lessico famigliare', a: 'Natalia Ginzburg', lc: true, fav: true, rs: 'ok', ts: 7, qs: [{ x: 'Una frase con la puntina', pg: '12', d: 5, pin: 1 }, { x: 'Senza puntina', d: 4 }] } },
    'uB|b4': { utente: 'uB', id: 'b4', cancellato: false, dati: { t: 'Il Gattopardo', a: 'Giuseppe Tomasi di Lampedusa', i: '9788807900001', ts: 6 } },
    'uB|w1': { utente: 'uB', id: 'w1', cancellato: false, dati: { t: 'Caro Michele', a: 'Natalia Ginzburg', w: true } } } };
const uidOf = (req) => { const m = /Bearer AT-(\w+)/.exec(req.headers.authorization || ''); return m ? m[1] : null; };
const friendsOk = (x, y) => DB.am.some(f => f.stato === 'amici' && ((f.da === x && f.a === y) || (f.da === y && f.a === x)));
const COLS = ['utente', 'nome', 'desideri', 'libreria', 'creato', 'foto', 'cit', 'p_cit', 'p_stat', 'p_cits', 'p_let', 'p_pref', 'p_cons'];
const key = (t, a) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '') + '|' + String(a || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(w => w.length > 1).sort().join(' ');
const inLib = (x) => !x.cancellato && x.dati.w !== true && !x.dati.xs && !['p', 'q'].includes(x.dati.sk);
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
    if (body.foto !== undefined) { if (body.foto && (body.foto.length > 20000 || !/^(data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+\/]+=*|https:\/\/lh[0-9]\.googleusercontent\.com\/[A-Za-z0-9_=.\/-]+)$/.test(body.foto))) return send(400, { message: 'check 23514' }); if (body.foto !== pr.foto) pr.foto_il = now(); }
    ['desideri', 'libreria', 'foto', 'cit', 'stat', 'p_cit', 'p_stat', 'p_cits', 'p_let', 'p_pref', 'p_cons'].forEach(k => { if (body[k] !== undefined) pr[k] = body[k]; });
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
  if (p === '/rest/v1/rpc/profilo_di') {                 // come la 019
    const o = body.amico; if (!friendsOk(me, o)) return send(400, { message: 'non amici' });
    const pr = DB.prof[o], mine = Object.values(DB.rows).filter(x => x.utente === o), lib = mine.filter(inLib).sort((x, y) => (y.dati.ts || 0) - (x.dati.ts || 0));
    const bk = (x) => ({ id: x.id, t: x.dati.t, a: x.dati.a, img: x.dati.img, i: x.dati.i });
    const r = { utente: pr.utente, creato: pr.creato, foto: pr.foto, desideri: pr.desideri, libreria: pr.libreria, segue: DB.seg.includes(me + '>' + o),
      tra: { dati: DB.sw.filter(s => s.tipo === 'prestito' && s.da === me && s.a === o).length, avuti: DB.sw.filter(s => s.tipo === 'prestito' && s.da === o && s.a === me).length } };
    if (pr.libreria) { if (pr.p_let) r.let = lib.filter(x => x.dati.rs === 'in').map(bk); if (pr.p_pref) r.pref = lib.filter(x => x.dati.fav).map(bk); if (pr.p_cons) r.cons = lib.filter(x => x.dati.lc).map(bk); }
    if (pr.p_cit) { const ev = [].concat(...mine.filter(x => !x.cancellato).map(x => (x.dati.qs || []).filter(c => c.x && c.pin).map(c => ({ x: c.x, pg: c.pg, d: c.d, t: x.dati.t, a: x.dati.a })))).slice(0, 3); if (ev.length) r.evid = ev; else if (pr.cit) r.evid = [pr.cit]; }
    if (pr.p_stat && pr.libreria && pr.stat) r.stat = pr.stat;
    if (pr.p_cits) r.cits = [].concat(...mine.filter(x => !x.cancellato).map(x => (x.dati.qs || []).filter(c => c.x).map(c => ({ x: c.x, pg: c.pg, d: c.d, t: x.dati.t, a: x.dati.a }))));
    return send(200, r);
  }
  if (p === '/rest/v1/rpc/amici_numeri') return send(200, DB.am.filter(x => x.stato === 'amici' && (x.da === me || x.a === me)).map(x => ({ id: x.da === me ? x.a : x.da, comuni: 0, libri: 2 })));
  if (p === '/rest/v1/rpc/chi_ha') {                     // stesso ISBN, oppure stesso titolo e autore
    DB.chiHa++; const k = key(body.titolo, body.autore), i = String(body.isbn || '').replace(/[^0-9X]/g, '');
    return send(200, Object.values(DB.rows).filter(x => x.utente !== me && friendsOk(me, x.utente) && DB.prof[x.utente].libreria && inLib(x) && ((i && x.dati.i === i) || (k[0] !== '|' && key(x.dati.t, x.dati.a) === k)))
      .map(x => ({ amico: x.utente, utente: DB.prof[x.utente].utente, libro_id: x.id, fuori: !!x.dati.p })));
  }
  if (p === '/rest/v1/rpc/chiedi_prestito') { const r = DB.rows[body.amico + '|' + body.libro_id]; if (!r || !inLib(r)) return send(400, { message: 'libro non trovato' }); DB.asks.push({ id: 'r' + DB.asks.length, da: me, a: body.amico, libro_id: body.libro_id, libro: { t: r.dati.t }, stato: 'attesa', creato: now() }); return send(200, 'r'); }
  if (p === '/rest/v1/rpc/mie_richieste') return send(200, DB.asks.filter(x => x.da === me || x.a === me).map(x => Object.assign({ nome_da: DB.prof[x.da].utente, nome_a: DB.prof[x.a].utente }, x)));
  if (p === '/rest/v1/rpc/togli_amicizia') { DB.am = DB.am.filter(f => !((f.da === me && f.a === body.altro) || (f.a === me && f.da === body.altro))); return send(200); }
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
}).listen(CFG.port(8325));
const base = 'http://localhost:' + CFG.port(8325);
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
  await A.evaluate(() => window.NLCard && window.NLCard.set('d')); await wait(300);
  const toast = () => A.$eval('#toastTxt', x => x.textContent);
  const isOpen = (id) => A.evaluate((id) => !!document.querySelector('.row.open[data-id="' + id + '"]'), id);
  await A.add({ id: 'a1', t: 'Palomar', a: 'Italo Calvino', rs: 'ok', rd: today, pg: '120', gen: 'Romanzo', ts: 5, qs: [{ x: 'Prima citazione', pg: '33', d: 20 }, { x: 'Seconda citazione', d: 19 }, { x: 'Terza citazione', d: 18 }] });
  await A.add({ id: 'a2', t: 'Il nome della rosa', a: 'Umberto Eco', rs: 'ok', rd: '2020-05-01', pg: '500', gen: 'Romanzo', fav: true, ts: 4, n: 'appunto di Anna', qs: [{ x: 'Stat rosa pristina nomine', d: 10 }, { x: 'Quinta citazione', d: 9 }] });
  await A.add({ id: 'a3', t: 'Baudolino', a: 'Umberto Eco', rs: 'in', ts: 3 });
  await A.add({ id: 'a4', t: 'Lolita', a: 'Vladimir Nabokov', w: true });
  await A.evaluate(() => window.NLAmici.load(true)); await wait(900);

  // ---- «Lo consiglio»: coccarda accanto alla stella, solo in Libreria ----
  await A.openRow('a1'); await wait(500);
  let acts = await A.$$eval('[data-id="a1"] .acts-main > [data-act]', x => x.map(b => b.dataset.act));
  assert(acts.indexOf('fav') < 0 && acts.indexOf('lc') >= 0 && /^to(wish|lib)$/.test(acts[acts.indexOf('lc') + 1]), 'giro 10: solo la stella «Lo consiglio», poi desideri: ' + acts);
  assert.strictEqual(await A.evaluate(() => window.NL.get('a2').lc), true, 'giro 10: il vecchio preferito è diventato consigliato');
  assert.strictEqual(await A.$eval('[data-id="a1"] [data-act="lc"]', x => x.getAttribute('aria-label')), 'Lo consiglio: gli amici lo vedono nel tuo profilo');
  await A.evaluate(() => document.querySelector('[data-id="a1"] [data-act="lc"]').click()); await wait(400);
  assert.strictEqual(await A.evaluate(() => window.NL.get('a1').lc), true, 'il libro è consigliato');
  assert(await A.$eval('[data-id="a1"] [data-act="lc"]', x => x.classList.contains('on') && /Lo consigli: tocca per toglierlo/.test(x.title)), 'stella accesa');
  assert(/Lo consigli: gli amici lo vedono nel tuo profilo\./.test(await toast()), 'avviso: ' + await toast());
  await shot(A, 'scheda-coccarda-360');
  await A.evaluate(() => window.NL.setTab('wish')); await wait(300); await A.openRow('a4'); await wait(400);
  assert(!(await A.$('[data-id="a4"] [data-act="lc"]')), 'nei Desideri la coccarda non c\'è');
  await A.evaluate(() => window.NL.setTab('lib')); await wait(300);

  // ---- puntina sulle citazioni: al massimo 3 ----
  await A.openRow('a1'); await wait(500);
  const pin = (id, i) => A.evaluate((id, i) => document.querySelector('[data-id="' + id + '"] .qpin[data-i="' + i + '"]').click(), id, i);
  assert.strictEqual(await A.$$eval('[data-id="a1"] .qpin', x => x.length), 3, 'una puntina per ogni citazione');
  await pin('a1', 0); await wait(200); await pin('a1', 1); await wait(200); await pin('a1', 2); await wait(300);
  assert.deepStrictEqual(await A.evaluate(() => window.NL.get('a1').qs.map(c => c.pin)), [1, 1, 1], 'tre in evidenza');
  assert(/In evidenza nel tuo profilo \(3 di 3\)\./.test(await toast()), 'avviso: ' + await toast());
  assert.strictEqual(await A.$$eval('[data-id="a1"] .qpin.on[aria-pressed="true"]', x => x.length), 3);
  await A.evaluate(() => { const d = document.querySelector('[data-id="a1"] details.quotes'); d.open = true; d.scrollIntoView({ block: 'center' }); }); await wait(300); await shot(A, 'scheda-puntine-360');
  await A.openRow('a2'); await wait(500); await pin('a2', 0); await wait(300);
  assert(/In evidenza ne stanno 3: prima togli la puntina a un.altra\./.test(await toast()), 'la quarta no: ' + await toast());
  assert(!(await A.evaluate(() => window.NL.get('a2').qs[0].pin)), 'la quarta non si mette');
  assert.strictEqual(await A.evaluate(() => window.NL.togglePin('a1', 2)), true); await wait(200);
  // anche in «Tutte le citazioni»
  await A.evaluate(() => window.NL.openQuotes()); await wait(500);
  assert.deepStrictEqual(await A.$$eval('#allqList .qpin', x => [x.length, x.filter(b => b.classList.contains('on')).length]), [5, 2], 'puntine in «Tutte le citazioni»');
  await A.evaluate(() => document.querySelector('#allqList .qpin[data-pin="a2"][data-i="1"]').click()); await wait(400);
  assert.strictEqual(await A.evaluate(() => window.NL.get('a2').qs[1].pin), 1); assert.strictEqual(await A.$$eval('#allqList .qpin.on', x => x.length), 3);
  await noSide(A, '#allqSheet .sheet-in', 'Tutte le citazioni a 360');
  await A.evaluate(() => { document.querySelector('#allqSheet').hidden = true; });
  // la vecchia citazione preferita (giro 3) diventa una puntina
  await A.evaluate(() => window.NL.togglePin('a2', 1)); await wait(200);
  await A.evaluate(() => { window.NLProfilo.state().my.cit = { x: 'Stat rosa pristina nomine', b: 'a2', d: 10, t: 'Il nome della rosa', a: 'Umberto Eco' }; return window.NLProfilo.push(); }); await wait(700);
  assert.strictEqual(await A.evaluate(() => window.NL.get('a2').qs[0].pin), 1, 'la preferita di prima ha la puntina');
  assert.strictEqual(await A.evaluate(() => window.NLProfilo.state().my.cit), null); assert.strictEqual(DB.prof.uA.cit, null, 'e online non resta la vecchia');
  assert.strictEqual(DB.prof.uA.stat.ul.t, 'Palomar', 'ultimo libro letto tra i numeri'); assert.strictEqual(DB.prof.uA.stat.lu.t, 'Il nome della rosa'); assert.strictEqual(DB.prof.uA.stat.auy, 'Italo Calvino');
  assert(!/appunto/.test(JSON.stringify(DB.prof.uA)), 'mai gli appunti');

  // ---- il tuo profilo ----
  await A.evaluate(() => { const b = document.querySelector('.row.cv-full .cv-back'); if (b) b.click(); }); await wait(400);   // restyle pezzo 2: la scheda aperta e' una pagina intera
  await A.evaluate(() => window.scrollTo(0, 0)); await A.click('#ownerProf'); await wait(1400);   // i numeri salgono (giro 11C)
  let t = await txt(A, '#profBody');
  assert(/In lettura 1/.test(t) && !/Preferiti/.test(t) && /Consigliati 2/.test(t), 'le due file (via i Preferiti, 18/11/2026): ' + t);
  assert.deepStrictEqual(await A.$$eval('#profBody .pf-strip', x => x.map(s => [...s.querySelectorAll('.pf-bk')].map(b => b.dataset.id).join())), ['a3', 'a1,a2']);   // In lettura, Consigliati (via i Preferiti)
  assert(/Citazioni in evidenza 3 «Prima citazione» — Italo Calvino, Palomar · pagina 33 «Seconda citazione»/.test(t) && /«Stat rosa pristina nomine»/.test(t) && /Cambia/.test(t), 'citazioni in evidenza: ' + t);
  assert(/Ultimo letto «Palomar»/.test(t) && /Il più lungo «Il nome della rosa» · 500 pag\./.test(t) && /Il tuo autore dell'anno Italo Calvino 1 libro/.test(t), 'numeri nuovi: ' + t);
  await noSide(A, '#profSheet .sheet-in', 'il tuo profilo a 360'); await shot(A, 'profilo-mio-360');
  await A.evaluate(() => document.querySelector('#profSheet .sheet-in').scrollTo(0, 9999)); await wait(200); await shot(A, 'profilo-mio-360-giu');
  await A.click('#profBody [data-p="pick"]'); await wait(300);
  assert.deepStrictEqual(await A.$$eval('#profBody .pf-qpick', x => [x.length, x.filter(b => b.getAttribute('aria-pressed') === 'true').length]), [5, 3], 'scelta delle citazioni');
  assert(/In evidenza: 3 di 3/.test(await txt(A, '#profBody')));
  await A.click('#profBody [data-p="back"]'); await wait(200);
  await A.evaluate(() => document.querySelector('#profBody .pf-bk[data-id="a3"]').click()); await wait(600);
  assert(await A.$eval('#profSheet', x => x.hidden) && await isOpen('a3'), 'il tocco sulla copertina apre il libro');

  // ---- «Amici e privacy»: tre interruttori nuovi, accesi di partenza ----
  await A.evaluate(() => window.NLAmici.open(true)); await wait(700);
  assert.deepStrictEqual(await A.$$eval('#friPLet, #friPCons', x => x.map(i => i.checked)), [true, true], 'accesi di partenza');
  assert(!(await A.$('#friPPref')), 'niente più «preferiti» (18/11/2026)');
  assert.deepStrictEqual(await A.$$eval('#friPCit, #friPStat, #friPCits', x => x.map(i => i.checked)), [false, false, false], 'citazioni e numeri spenti di partenza');
  t = await A.body(); assert(/Gli amici vedono cosa sto leggendo/.test(t) && /Gli amici vedono i libri che consiglio/.test(t) && /Gli amici vedono le mie citazioni in evidenza Quelle con la puntina \(fino a 3\)/.test(t), 'testi: ' + t);
  await A.evaluate(() => document.querySelector('#friPCons').scrollIntoView({ block: 'center' })); await wait(200);
  await A.click('#friPCons'); await wait(500); assert.strictEqual(DB.prof.uA.p_cons, false, 'consigliati nascosti agli amici');
  await A.click('#friPCons'); await wait(500); assert.strictEqual(DB.prof.uA.p_cons, true);
  await noSide(A, '#friSheet .sheet-in', 'Amici e privacy a 360'); await shot(A, 'privacy-360');
  await A.keyboard.press('Escape'); await wait(200);

  // ---- il tocco sul nome di un amico apre il suo profilo ----
  await A.evaluate(() => window.NLAmici.open()); await wait(900);
  assert(/Bruno/.test(await A.body()));
  await A.click('#friBody [data-f="friend"]'); await wait(1600);   // i numeri salgono (giro 11C)
  assert(await A.$eval('#profSheet', x => !x.hidden) && await A.$eval('#friSheet', x => x.hidden), 'si apre il profilo, non la libreria');
  assert.strictEqual(await A.evaluate(() => window.NL.guest()), null);
  assert.strictEqual(await A.$eval('#profH', x => x.textContent), 'Profilo di Bruno');
  t = await txt(A, '#profBody');
  assert(/Bruno Su Next Libris da marzo 2026/.test(t) && new RegExp('40 libri · 5 letti nel ' + y + ' · 2 paesi').test(t), 'testa del profilo: ' + t.slice(0, 120));
  assert.deepStrictEqual(await A.$$eval('#profBody .pf-go > .btn', x => x.map(b => b.textContent).filter(t => t !== 'Scrivi')), ['Libreria', 'Desideri']);   // «Scrivi» della chat: e2e128
  assert.deepStrictEqual(await A.$$eval('#profBody .pf-icos > button', x => x.map(b => b.dataset.p + (b.classList.contains('gb-drop') ? '!' : '') + ':' + b.getAttribute('aria-label'))), ['swap:Prestiti e regali tra te e Bruno', 'drop!:Togli Bruno dagli amici'], 'icone (la chiave solo se ne hai una)');
  assert.strictEqual(await A.$eval('#profBody [data-p="drop"]', x => getComputedStyle(x).color), await A.evaluate(() => { const d = document.createElement('i'); d.style.color = 'var(--bad)'; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; }), '«togli dagli amici» in rosso');
  assert(/Segui i suoi Desideri Bruno ti mostra già i suoi Desideri: seguili e scopri cosa sogna di leggere\. Magari ci trovi il regalo giusto, o il tuo prossimo libro\. Ti scriviamo al massimo una volta al giorno, solo quando c.è qualcosa di nuovo, e Bruno non lo saprà\./.test(t), 'frase scelta: ' + t);
  assert(/In lettura 1/.test(t) && !/Preferiti/.test(t) && /Consigliati 1/.test(t), 'le sue file: ' + t);
  assert.deepStrictEqual(await A.$$eval('#profBody .pf-strip', x => x.map(s => [...s.querySelectorAll('.pf-bk')].map(b => b.dataset.id).join())), ['b1', 'b3']);
  assert(/Citazioni in evidenza «Una frase con la puntina» — Natalia Ginzburg, Lessico famigliare · pagina 12/.test(t) && !/Senza puntina/.test(t) && !/appunto segreto/.test(t), 'citazioni in evidenza di Bruno: ' + t);
  assert(/Pagine lette 6\.100/.test(t) && /Il suo autore dell'anno Natalia Ginzburg 2 libri/.test(t) && /Ultimo letto «Lessico famigliare»/.test(t) && /Il più lungo «Guerra e pace» · 1\.400 pag\./.test(t), 'i suoi numeri (tessere ed elenco): ' + t);
  assert(/In comune con te 2 · il 5% dei suoi/.test(t) && /Prestiti tra voi 3 2 da te, 1 a te/.test(t), 'numeri tra voi due: ' + t);
  await noSide(A, '#profSheet .sheet-in', 'profilo dell\'amico a 360'); await shot(A, 'profilo-amico-360');
  await A.evaluate(() => document.querySelector('#profSheet .sheet-in').scrollTo(0, 420)); await wait(200); await shot(A, 'profilo-amico-360-meta');
  await A.evaluate(() => document.querySelector('#profSheet .sheet-in').scrollTo(0, 9999)); await wait(200); await shot(A, 'profilo-amico-360-giu');
  await A.evaluate(() => document.querySelector('#profSheet .sheet-in').scrollTo(0, 0));
  await A.click('#profBody [data-p="segui"]'); await wait(500);
  assert(DB.seg.includes('uA>uB'), 'Anna segue i desideri di Bruno');
  t = await txt(A, '#profBody'); assert(/Stai seguendo i suoi Desideri ✓ Ti scriviamo al massimo una volta al giorno, solo quando c.è qualcosa di nuovo\. Bruno non lo sa\./.test(t), 'acceso: ' + t.slice(0, 400));
  // togli dagli amici: chiede conferma, sopra il profilo
  await A.click('#profBody [data-p="drop"]'); await wait(400);
  assert.strictEqual(await A.$eval('#dropSheet', x => !x.hidden && x.querySelector('h2').textContent), 'Togli Bruno dagli amici?');
  await shot(A, 'profilo-amico-togli-360');
  await A.click('#dropNo'); await wait(300); assert(await A.$eval('#profSheet', x => !x.hidden), 'annullato: il profilo resta');
  // una copertina dei Consigliati apre quel libro nella sua libreria
  await A.evaluate(() => document.querySelector('#profBody .pf-row:last-of-type .pf-bk[data-id="b3"], #profBody .pf-bk[data-id="b3"]').click()); await wait(1400);
  assert.strictEqual(await A.evaluate(() => window.NL.guest() + '/' + window.NL.tab()), 'Bruno/lib'); assert(await isOpen('b3'), 'il libro di Bruno è aperto');
  assert(await A.$eval('#guestDrop', x => x.classList.contains('gb-drop') && !x.hidden), 'anche nella sua libreria l\'icona «togli» è rossa');
  // dal nome in testata di nuovo al profilo, poi i Desideri
  await A.evaluate(() => { const b = document.querySelector('.row.cv-full .cv-back'); if (b) b.click(); }); await wait(400);   // restyle pezzo 2: prima si chiude la pagina del libro
  await A.evaluate(() => window.scrollTo(0, 0)); await A.click('#ownerProf'); await wait(800);
  assert.strictEqual(await A.$eval('#profH', x => x.textContent), 'Profilo di Bruno');
  await A.click('#profBody [data-p="wish"]'); await wait(700);
  assert.strictEqual(await A.evaluate(() => window.NL.guest() + '/' + window.NL.tab()), 'Bruno/wish', 'i suoi Desideri');
  await A.evaluate(() => window.NL.guestExit()); await wait(400);

  // ---- «Ce l'ha già Bruno» quando aggiungi un desiderio: resta nei Desideri, «Me lo presti?» ----
  assert.strictEqual(DB.chiHa, 0, 'finora nessuna domanda');
  await A.evaluate(() => window.NL.setTab('wish')); await wait(300);
  await A.add({ id: 'a5', t: 'Il gattopardo', a: 'Tomasi di Lampedusa, Giuseppe', w: true, ts: Date.now() }); await H.sleep(2600);
  assert.strictEqual(DB.chiHa, 1, 'una sola domanda al database');
  assert(/Ce l.ha già Bruno\. Resta nei tuoi Desideri\./.test(await toast()), 'avviso: ' + await toast());
  assert.strictEqual(await A.$eval('#toastBtn', x => !x.hidden && x.textContent), 'Me lo presti?');
  assert.strictEqual(await A.evaluate(() => window.NL.get('a5').w), true, 'il libro resta nei Desideri');
  await shot(A, 'desiderio-ce-lha-gia-360');
  await A.click('#toastBtn'); await wait(700);
  assert(DB.asks.some(q => q.da === 'uA' && q.a === 'uB' && q.libro_id === 'b4'), 'richiesta di prestito mandata'); assert(/Richiesta mandata a Bruno\./.test(await toast()));
  await A.add({ id: 'a6', t: 'Un libro che nessuno ha', a: 'Autore', w: true, ts: Date.now() }); await H.sleep(2600);
  assert.strictEqual(DB.chiHa, 2); assert(!/Ce l.ha/.test(await toast()) || await A.$eval('#toast', x => x.hidden), 'nessun avviso se nessuno ce l\'ha');
  await A.evaluate(() => window.NL.setTab('lib')); await wait(300);

  // ---- campanella: un tuo desiderio è entrato nella libreria di un amico ----
  const N = (n, rif, titolo) => ({ id: '0000000' + n + '-0000-0000-0000-000000000000', utente: 'uA', da: 'uB', tipo: 'trovato', rif, titolo, creata: new Date().toISOString(), letta: false });
  DB.noti.push(N(1, '1:b2', '«Se una notte d\'inverno un viaggiatore»'), N(2, '4:b1', '«Il barone rampante», «Lessico famigliare», «Il Gattopardo»'), N(3, '1:b4', '«Il Gattopardo»'));
  await A.evaluate(() => window.NLAmici.load(true)); await wait(900);
  await A.evaluate(() => window.NLNotifiche.open()); await wait(600);
  t = await txt(A, '#ntBody');
  assert(/📚 Bruno ha aggiunto «Se una notte d.inverno un viaggiatore», che è nei tuoi Desideri/.test(t), 'avviso: ' + t);
  assert(/📚 Bruno ha aggiunto «Il barone rampante», «Lessico famigliare», «Il Gattopardo» e altri, che sono nei tuoi Desideri/.test(t), 'riassunto di più libri: ' + t);
  assert.deepStrictEqual(await A.$$eval('#ntBody .nt-lend, #ntBody .nt-asked', x => x.map(b => b.className.replace(/btn /, '') + ':' + b.textContent)), ['nt-lend:Me lo presti?', 'nt-asked:Richiesta mandata'], 'tasto solo per un libro; già chiesto = «Richiesta mandata»');
  await noSide(A, '#ntSheet .sheet-in', 'campanella a 360'); await shot(A, 'campanella-trovato-360');
  await A.click('#ntBody .nt-lend'); await wait(900);
  assert(DB.asks.some(q => q.da === 'uA' && q.a === 'uB' && q.libro_id === 'b2'), 'richiesta dalla campanella');
  assert.strictEqual(await A.$$eval('#ntBody .nt-asked', x => x.length), 2); assert(!(await A.$('#ntBody .nt-lend')));
  await A.click('#ntBody .nt-item[data-n="00000001-0000-0000-0000-000000000000"]'); await wait(1500);
  assert.strictEqual(await A.evaluate(() => window.NL.guest() + '/' + window.NL.tab()), 'Bruno/lib', 'il tocco apre la sua libreria'); assert(await isOpen('b2'), 'su quel libro');
  await A.evaluate(() => window.NL.guestExit()); await wait(400);
  assert(/trovato/.test(fs.readFileSync(path.join(__dirname, 'supabase', 'funzioni', 'push', 'index.ts'), 'utf8')), 'il testo del push c\'è');

  // ---- togliere davvero un amico dal profilo: il profilo si chiude ----
  await A.evaluate(() => window.NLProfilo.open('uB')); await wait(800);
  await A.click('#profBody [data-p="drop"]'); await wait(300); await A.click('#dropGo'); await wait(1200);
  assert(!DB.am.some(f => f.a === 'uB'), 'amicizia tolta'); assert(await A.$eval('#profSheet', x => x.hidden), 'il profilo si chiude');
  DB.am.push({ da: 'uA', a: 'uB', stato: 'amici', creato: now() }); await A.evaluate(() => window.NLAmici.load(true)); await wait(900);

  // PC: il profilo dell'amico senza scorrimento di lato
  await A.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 }); await wait(300);
  await A.evaluate(() => window.NLProfilo.open('uB')); await wait(800); await noSide(A, '#profSheet .sheet-in', 'profilo dell\'amico a 1280'); await shot(A, 'profilo-amico-1280');
  assert.deepStrictEqual(errors, []);
  console.log('e2e125 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
