const CFG = require("./_config");
const H = require('./_harness');
// Schermate su 6 telefoni comuni + scritta grande (18/11/2026, richiesta di Piero). Solo fotografie e controllo dello scorrimento di lato.
// SCHERMATE=cartella (predefinita: <PROVE_OUT>/telefoni). Base: Supabase finto di e2e125.
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
const DB = { prof: { uA: P0('Piero R.'), uB: P0('Davide Pica', { desideri: true, libreria: true, p_cit: true, p_stat: true,
      stat: { n: 40, l: 22, ly: 5, y: YY, pg: 6100, pgy: 1400, au: 'Italo Calvino', aun: 4, auy: 'Natalia Ginzburg', auyn: 2, ge: 'Romanzo', gen: 9, pa: ['IT', 'FR'], pr: 1,
        ul: { t: 'Lessico famigliare', a: 'Natalia Ginzburg' }, lu: { t: 'Guerra e pace', a: 'Lev Tolstoj', pg: 1400 } } }), uC: P0('Mariomaria80'), uD: P0('Next Libris'), uE: P0('Serena B.'), uF: P0('Giovanna Bartolomei-Rossi') },
  am: ['uB', 'uC', 'uD', 'uE', 'uF'].map(x => ({ da: 'uA', a: x, stato: 'amici', creato: now() })), seg: [], noti: [], asks: [], chiHa: 0,
  sw: [{ id: '00000001-0000-0000-0000-000000000000', da: 'uA', a: 'uB', tipo: 'prestito', libro: { t: 'Palomar', a: 'Italo Calvino' }, libro_id: 'zz1', stato: 'chiuso', visto: true, creato: now(), chiuso: now() },
    { id: '00000002-0000-0000-0000-000000000000', da: 'uA', a: 'uB', tipo: 'prestito', libro: { t: 'Marcovaldo', a: 'Italo Calvino' }, libro_id: 'zz2', stato: 'chiuso', visto: true, creato: now(), chiuso: now() },
    { id: '00000003-0000-0000-0000-000000000000', da: 'uB', a: 'uA', tipo: 'prestito', libro: { t: 'La luna e i falò', a: 'Cesare Pavese' }, libro_id: 'zz3', stato: 'chiuso', visto: true, creato: now(), chiuso: now() }],
  rows: { 'uB|b1': { utente: 'uB', id: 'b1', cancellato: false, dati: { t: 'Il barone rampante', a: 'Italo Calvino', rs: 'in', pp: '40', pg: '300', ts: 9 } },
    'uB|b2': { utente: 'uB', id: 'b2', cancellato: false, dati: { t: 'Se una notte d\'inverno un viaggiatore', a: 'Italo Calvino', fav: true, rs: 'ok', ts: 8, n: 'appunto segreto' } },
    'uB|b3': { utente: 'uB', id: 'b3', cancellato: false, dati: { t: 'Lessico famigliare', a: 'Natalia Ginzburg', lc: true, fav: true, rs: 'ok', ts: 7, qs: [{ x: 'Una frase con la puntina', pg: '12', d: 5, pin: 1 }, { x: 'Senza puntina', d: 4 }] } },
    'uB|b4': { utente: 'uB', id: 'b4', cancellato: false, dati: { t: 'Il Gattopardo', a: 'Giuseppe Tomasi di Lampedusa', i: '9788807900001', ts: 6 } },
    'uB|w1': { utente: 'uB', id: 'w1', cancellato: false, dati: { t: 'Caro Michele', a: 'Natalia Ginzburg', w: true } } } };

const V = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).v;
const AUT = ['Jorge Luis Borges', 'Italo Calvino', 'Andrea Camilleri', 'Dino Buzzati', 'Nora Burnett Abrams', 'Douglas Adams', 'Simone Amicucci', 'Balsamini', 'Letizia Battaglia', 'Gabriel Bauret',
  'Osvaldo Bayer', 'Giuseppe Berto', 'Pasquale Bona', 'Gian Butturini', 'Wu Ming 1', 'Gabriel García Márquez', 'Giuseppe Tomasi di Lampedusa', 'Fëdor Dostoevskij', 'Aleksandr Solženicyn', 'Ibn Jubayr',
  'Natalia Ginzburg', 'Elsa Morante', 'Umberto Eco', 'Cesare Pavese', 'Primo Levi', 'Alessandro Manzoni', 'Luigi Pirandello', 'Isaac Asimov', 'Jane Austen', 'Lev Tolstoj',
  'Virginia Woolf', 'Herman Melville', 'Ursula K. Le Guin', 'Chimamanda Ngozi Adichie', 'Haruki Murakami', 'Sándor Márai', 'Antonio Tabucchi', 'Alberto Moravia', 'Leonardo Sciascia', 'Grazia Deledda'];
const TIT = ['Finzioni', 'Il barone rampante', 'Il birraio di Preston', 'Il deserto dei Tartari', 'Abstract Expressionism and the Art of Our Time', 'Guida galattica per gli autostoppisti', 'Fotografia di viaggio',
  'Racconti', 'Palermo', 'Lo sguardo', 'La Patagonia rebelde', 'Il male oscuro', 'Diario', 'Fotografie', 'New Thing', 'Cent\'anni di solitudine', 'Il Gattopardo', 'Delitto e castigo', 'Arcipelago Gulag', 'Viaggio in Sicilia'];
const BOOKS = [];
for (let i = 0; i < 150; i++) {
  const a = AUT[i % AUT.length], t = (i < 20 ? TIT[i] : TIT[i % TIT.length] + ' ' + (i + 1));
  BOOKS.push({ id: 'k' + i, t, a, e: 'Editore', y: '2001', c: null, i: '', g: [], img: '', nf: false, ts: 1000 - i, sh: '', n: '', gen: ['Romanzo', 'Saggio', 'Fotografia', 'Fantascienza'][i % 4], pg: String(200 + i), p: i % 30 === 3 ? 'Marta Bianchi' : '', pd: i % 30 === 3 ? '2026-10-01' : '', w: i >= 140, rs: i === 19 ? 'in' : i % 3 ? 'ok' : 'da', pp: i === 19 ? '120' : '', rt: 0, rd: '' });
}
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
  // chat finte per le schermate del pezzo 4
  const U = (id, da, testo, min) => ({ id, da, nome: DB.prof[da].utente, tipo: 'testo', testo, libro: null, su: null, creato: new Date(Date.now() - min * 60000).toISOString(), el: false });
  if (p === '/rest/v1/rpc/chat_mie') return send(200, [
    { id: 'c1', tipo: 'due', nome: 'Davide Pica', altro: 'uB', stato: 'attiva', silenziata: false, membri: null, nl: false, bloccato: false, nuovi: 2, ultimo: U(3, 'uB', 'Te lo presto sabato!', 12) },
    { id: 'c2', tipo: 'gruppo', nome: 'Lettori di gialli', altro: null, stato: 'attiva', silenziata: false, membri: 4, nl: false, bloccato: false, nuovi: 1, ultimo: U(9, 'uE', 'Chi ha letto l\'ultimo?', 70) },
    { id: 'c3', tipo: 'due', nome: 'Serena B.', altro: 'uE', stato: 'attiva', silenziata: false, membri: null, nl: false, bloccato: false, nuovi: 0, ultimo: U(7, 'uA', 'Grazie del consiglio', 3000) }]);
  if (p === '/rest/v1/rpc/chat_numeri') return send(200, { nuovi: 2, richieste: 1 });
  if (p === '/rest/v1/rpc/chat_leggi') return send(200, { chat: body.chat, tipo: 'due', stato: 'attiva', scrivibile: true, altri: false,
    messaggi: [U(1, 'uB', 'Ciao! Ho visto che hai Il Gattopardo 😍', 40), U(2, 'uA', 'Sì, ed è bellissimo. Vuoi che te lo presti?', 36), U(3, 'uB', 'Te lo presto sabato! Intanto metto questo nei Desideri', 12)].map(m => Object.assign({ su_nome: '', nl: false, nasc: false }, m)) });
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
}).listen(CFG.port(8340));
const base = "http://localhost:" + CFG.port(8340);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const wait = H.wait;   // attesa «finché» (_harness.js)
  async function phone(name, uid, w, hh) {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: w || 412, height: hh || 915, deviceScaleFactor: (w || 412) > 1100 ? 1 : 2, isMobile: (w || 412) < 1100, hasTouch: (w || 412) < 1100 });
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    await page.evaluateOnNewDocument((g) => { window.NL_NO_G = g; }, !!process.env.NO_G);
    await page.evaluateOnNewDocument((u, id) => {
      window.NL_SOCIAL = { url: u, key: 'chiave-finta', gClient: 'client-finto' };
      if (!localStorage.getItem('prova:catalogo-libri-social-auth')) localStorage.setItem('prova:catalogo-libri-social-auth', JSON.stringify({ at: 'AT-' + id, rt: 'RT-' + id, exp: Date.now() + 3e6, uid: id, email: id + '@esempio.it' }));
    }, base + '/finto', uid);
    await page.evaluateOnNewDocument((b, V) => {
      window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
      if (localStorage.getItem('prova:catalogo-libri-v2')) return;
      localStorage.setItem('prova:catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 }));
      localStorage.setItem('prova:catalogo-libri-set', JSON.stringify({ lastBackup: Date.now() - 60 * 864e5, price: false, name: 'Piero R.', welcomed: 1, donSeen: 1, viewDef: 'grid', look: 'nuovo', seenV: V, wn2: 1, grp: 'aut', sumLoan: true }));
      localStorage.setItem('prova:catalogo-libri-layout', JSON.stringify({ v: 'a' })); localStorage.setItem('prova:catalogo-libri-card', JSON.stringify({ v: 'd' }));
    }, BOOKS, V);
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) ? r.continue() : r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"totalItems":0}' }));
    await page.goto(base + '/next-libris-prova/', { waitUntil: 'load' }); await wait(2200);
    await page.evaluate(() => {                     // film finti (formato di app-wiki.js), poi si riapre
      const L = window.Lib, F = (t, y, d, s, book) => ({ q: 'x' + L.norm(t + y).replace(/[^a-z0-9]+/g, ''), t, y, d, s: s ? 1 : 0, u: 'https://it.wikipedia.org/wiki/X', k: [L.titleKey(book), L.norm(book).replace(/[^a-z0-9]+/g, ' ').trim()] });
      const m = { '~v': window.WD_V }, now = Date.now(), A = (n, f) => { m[L.norm(n)] = { q: 'q' + n.length, c: 'IT', t: now, f }; };
      A('Giuseppe Tomasi di Lampedusa', [F('Il Gattopardo', 1963, 'Luchino Visconti', 0, 'Il Gattopardo'), F('Il Gattopardo', 2025, 'Tom Shankland', 1, 'Il Gattopardo')]);
      A('Fëdor Dostoevskij', [F('Delitto e castigo', 1935, 'Josef von Sternberg', 0, 'Delitto e castigo'), F('Delitto e castigo', 1956, 'Georges Lampin', 0, 'Delitto e castigo'), F('Delitto e castigo', 1970, 'Lev Kulidžanov', 0, 'Delitto e castigo'), F('Delitto e castigo, una storia di amore e di morte nella San Pietroburgo dell\'Ottocento', 2002, 'Menahem Golan', 1, 'Delitto e castigo')]);
      A('Gabriel García Márquez', [F('Cent\'anni di solitudine', 2024, 'Laura Mora, Alex García López', 1, 'Cent\'anni di solitudine')]);
      A('Douglas Adams', [F('Guida galattica per gli autostoppisti', 2005, 'Garth Jennings', 0, 'Guida galattica per gli autostoppisti'), F('The Hitchhiker\'s Guide to the Galaxy', 1981, 'Alan J. W. Bell', 1, 'Guida galattica per gli autostoppisti')]);
      A('Dino Buzzati', [F('Il deserto dei Tartari', 1976, 'Valerio Zurlini', 0, 'Il deserto dei Tartari')]);
      A('Italo Calvino', [F('Il barone rampante', 1964, 'Mario Craveri', 1, 'Il barone rampante')]);
      A('Osvaldo Bayer', [F('La Patagonia rebelde', 1974, 'Héctor Olivera', 0, 'La Patagonia rebelde')]);
      A('Giuseppe Berto', [F('Il male oscuro', 1990, 'Mario Monicelli', 0, 'Il male oscuro')]);
      A('Andrea Camilleri', [F('Il birraio di Preston', 2017, 'Rocco Mortelliti', 0, 'Il birraio di Preston')]);
      localStorage.setItem('prova:catalogo-libri-auwd', JSON.stringify(m));
    });
    await page.reload({ waitUntil: 'load' }); await wait(1500);
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

  // Restyle «C · Schede» (19/11/2026): librerie e profili, chiaro e scuro. TELEFONI=390,360 SCURO=1
  const OUT = SHOTS || path.join(CFG.OUT, 'restyle'); fs.mkdirSync(OUT, { recursive: true });
  const PH = [['390', 390, 844], ['360', 360, 800], ['412', 412, 915], ['768', 768, 1024], ['1280', 1280, 800]];
  const only = process.env.TELEFONI ? process.env.TELEFONI.split(',') : ['390'];
  const side = [];
  const closeAll = (pg) => pg.evaluate(() => { document.querySelectorAll('.sheet:not([hidden])').forEach(x => { x.hidden = true; }); document.documentElement.classList.remove('drawer-open'); window.scrollTo(0, 0); });
  for (const [nm0, w, h] of PH) {
    if (!only.includes(nm0)) continue;
    for (const dark of (process.env.SCURO ? [false, true] : [false])) {
    const nm = nm0 + (dark ? '-scuro' : '');
    const pg = await phone(nm, 'uA', w, h);
    if (dark) { await pg.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); }); }
    const sh = async (n) => {
      const d = await pg.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
      if (d > 0) side.push(nm + ' ' + n + ' (' + d + ' px)');
      await pg.screenshot({ path: path.join(OUT, nm + '-' + n + '.png') });
    };
    await pg.evaluate(() => { const x = document.getElementById('instCard'); if (x) x.hidden = true; });
    await closeAll(pg); await wait(400);
    if (process.env.ALTRO) {                        // restyle pezzo 4: amici, chat, Per te, Desideri, guida (ALTRO=1)
      await pg.evaluate(() => document.querySelector('#layNav [data-l="wish"]').click()); await wait(700); await sh('a1-desideri');
      await pg.evaluate(() => window.scrollTo(0, 600)); await wait(300); await sh('a1-desideri-b'); await pg.evaluate(() => { window.scrollTo(0, 0); document.querySelector('#layNav [data-l="lib"]').click(); }); await wait(500);
      await pg.evaluate(() => document.querySelector('#layNav [data-l="you"]').click()); await wait(700); await sh('a2-perte'); await closeAll(pg); await wait(300);
      await pg.evaluate(() => window.NLAmici.open()); await wait(1400); await sh('a3-amici');
      await pg.evaluate(() => { const s = document.querySelector('#friSheet .sheet-in'); if (s) s.scrollTop = 640; }); await wait(300); await sh('a3-amici-b');
      await pg.evaluate(() => { const s = document.getElementById('friSheet'); if (s) s.hidden = true; }); await wait(300);
      await pg.evaluate(() => window.NLChat.open()); await wait(1400); await sh('a4-chat');
      await pg.evaluate(() => { const r = document.querySelector('#chSheet [data-c="c1"], #chSheet [data-id="c1"], #chSheet .ch-row'); if (r) r.click(); }); await wait(1400); await sh('a5-chat-aperta');
      await pg.evaluate(() => { const s = document.getElementById('chSheet'); if (s) s.hidden = true; document.documentElement.classList.remove('ch-open'); }); await wait(300);
      await pg.evaluate(() => window.NLGuida.open(3)); await wait(900); await sh('a6-guida-api');
      await pg.evaluate(() => document.querySelector('#gdStage [data-gd="info"]').click()); await wait(500); await sh('a6-guida-info'); await pg.evaluate(() => { document.getElementById('gdInfo').hidden = true; });
      await pg.evaluate(() => window.NLGuida.open(4)); await wait(900); await sh('a6-guida');
      await pg.evaluate(() => window.NLGuida.close()); await wait(400);
      await pg.evaluate(() => window.NLGuida.pathShow && window.NLGuida.pathShow(2)); await wait(900); await sh('a7-percorso');
      await pg.close(); continue;
    }
    if (process.env.MENU) {                         // restyle pezzo 3: Menu, Impostazioni, finestre dal basso (MENU=1)
      const ds = async (n, sel) => { for (const [k, y] of [['a', 0], ['b', 640], ['c', 1280]]) { const h = await pg.evaluate((sel, y) => { const e = document.querySelector(sel); if (!e) return -1; e.scrollTop = y; return e.scrollHeight - e.clientHeight; }, sel, y); if (h < 0) break; await wait(250); await sh(n + '-' + k); if (h <= y + 640) break; } };
      await pg.evaluate(() => window.__app.openDrawer('opt')); await wait(700); await pg.evaluate(() => { const w = document.getElementById('goWrapTxt'); if (w && !w.textContent) w.textContent = 'Riepilogo · settembre – novembre 2026 (fino a oggi)'; }); await ds('m1-menu', '#drawerBody');
      await pg.evaluate(() => { const b = document.getElementById('goSettings'); if (b) b.click(); const c = document.getElementById('goInfo'); if (c) c.click(); }); await wait(400); await ds('m2-menu-aperto', '#drawerBody');
      await pg.evaluate(() => window.__app.closeDrawer()); await wait(500);
      await pg.evaluate(() => document.querySelector('.lay-plus').click()); await wait(700); await sh('m3-piu');
      await closeAll(pg); await wait(300);
      for (const [sec, n] of [['search', 'm4-ricerca'], ['look', 'm5-aspetto'], ['cards', 'm6-aggiunta'], ['export', 'm7-backup']]) {
        await pg.evaluate((sec) => window.__app.openOptions(sec), sec); await wait(700); await ds(n, '#optSheet .sheet-in'); await pg.evaluate(() => window.__app.closeOptions()); await wait(400);
      }
      await pg.evaluate(() => window.__app.openLoan && window.__app.openLoan('k5')); await wait(600); await sh('m8-prestito'); await closeAll(pg); await wait(300);
      await pg.evaluate(() => { const b = document.querySelector('#layNav [data-l="you"]'); if (b) b.click(); }); await wait(600); await sh('m9-perte'); await closeAll(pg); await wait(300);
      await pg.close(); continue;
    }
    if (process.env.SCHEDA) {                       // restyle pezzo 2: solo la scheda del libro (SCHEDA=1)
      await pg.evaluate(() => { const b = window.NL.books().find(x => x.id === 'k15'); b.ds = 'Una saga familiare lunga cento anni nel villaggio di Macondo, tra miracoli, guerre civili e solitudini che si ripetono di generazione in generazione. Il romanzo che ha reso celebre il realismo magico.'; b.lc = true; b.rt = 5; b.qs = [{ x: 'Il segreto di una buona vecchiaia non è altro che un patto onesto con la solitudine.', pg: '211', d: 5 }]; b.sh = 'Salotto'; b.n = 'Regalo di Marta'; window.NL.save(); window.NL.refresh(); });
      await wait(400);
      for (const [id, n] of [['k15', 'sc1'], ['k16', 'sc2'], ['k3', 'sc3']]) {
        await pg.evaluate((id) => { const t = document.querySelector('[data-id="' + id + '"] .sum') || document.querySelector('[data-id="' + id + '"]'); t.click(); }, id); await wait(900);
        await pg.evaluate((id) => { const r = document.querySelector('[data-id="' + id + '"]'); r.scrollIntoView(); window.scrollBy(0, -70); }, id); await wait(300); await sh(n + '-a');
        if (process.env.DOM && n === 'sc1') fs.writeFileSync(path.join(OUT, nm + '-scheda-dom.html'), await pg.evaluate(() => document.querySelector('.row.open').outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>')));
        const scr = (y) => pg.evaluate((y) => { const r = document.querySelector('.row.open.cv-full'); if (r) r.scrollTop = y; else window.scrollBy(0, y); }, y);
        await scr(640); await wait(300); await sh(n + '-b'); await scr(1280); await wait(300); await sh(n + '-c'); await scr(0);
        if (n === 'sc2') { await pg.evaluate(() => document.querySelector('.cv-morebtn').click()); await wait(300); await sh(n + '-piu'); await pg.evaluate(() => document.querySelector('.cv-morebtn').click()); }
        if (n === 'sc1') { await pg.evaluate((id) => { document.querySelector('[data-id="' + id + '"] .cv-editb').click(); document.querySelector('[data-id="' + id + '"]').scrollIntoView(); window.scrollBy(0, -70); }, id); await wait(600); await sh(n + '-mod'); await scr(640); await wait(300); await sh(n + '-mod-b'); await pg.evaluate((id) => document.querySelector('[data-id="' + id + '"] .cv-editb').click(), id); await wait(400); }
        await pg.evaluate((id) => { const c = document.querySelector('.row.open [data-act="toggle"], .row.open .chev-btn'); if (c) c.click(); }); await wait(700);
      }
      await pg.close(); continue;
    }
    await sh('01-libreria');
    await pg.evaluate(() => window.scrollTo(0, 700)); await wait(300); await sh('02-copertine');
    await pg.evaluate(() => { const b = document.getElementById('btnView'); if (b) b.click(); }); await wait(500);
    await pg.evaluate(() => window.scrollTo(0, 0)); await wait(200); await sh('03-elenco');
    await pg.evaluate(() => window.scrollTo(0, 700)); await wait(300); await sh('04-elenco-giu');
    await pg.evaluate(() => { const b = document.getElementById('btnView'); if (b) b.click(); }); await wait(400);
    await pg.evaluate(() => { const b = document.querySelector('#layNav [data-l="wish"]'); if (b) b.click(); }); await wait(500); await sh('05-desideri');
    await pg.evaluate(() => { const b = document.querySelector('#layNav [data-l="lib"]'); if (b) b.click(); }); await wait(300);
    await pg.evaluate(() => { const b = document.querySelector('#layNav [data-l="prof"]'); if (b) b.click(); }); await wait(900); await sh('06-profilo');
    await pg.evaluate(() => { const s = document.querySelector('#profSheet .sheet-in'); if (s) s.scrollTop = 700; }); await wait(300); await sh('07-profilo-giu');
    await closeAll(pg);
    await pg.evaluate(() => window.NLProfilo.open('uB')); await wait(1200); await sh('08-profilo-amico');
    await pg.evaluate(() => { const s = document.querySelector('#profSheet .sheet-in'); if (s) s.scrollTop = 700; }); await wait(300); await sh('09-profilo-amico-giu');
    await pg.evaluate(() => { const s = document.querySelector('#profSheet .sheet-in'); if (s) s.scrollTop = 0; const b = document.querySelector('#profSheet [data-p="lib"]'); if (b) b.click(); }); await wait(1500); await sh('10-libreria-amico');
    await pg.evaluate(() => window.scrollTo(0, 500)); await wait(300); await sh('11-libreria-amico-giu');
    if (process.env.DOM) fs.writeFileSync(path.join(OUT, nm + '-dom.html'), await pg.evaluate(() => document.querySelector('main').outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>')));
    await pg.close();
    }
  }
  console.log('Schermate in ' + OUT);
  console.log(side.length ? 'SCORRIMENTO DI LATO: ' + side.join(' | ') : 'Nessuno scorrimento di lato');
  if (errors.length) console.log('ERRORI:', errors.join(' | '));
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
