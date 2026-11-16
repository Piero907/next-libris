// Schermate degli Amici (seconda versione, 16/11/2026): 360, 412 scuro, 1280, con 12 amici e nomi lunghi. Solo fotografie.
const CFG = require("./_config");
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm' };
let clock = Date.parse('2026-11-16T10:00:00Z'); const now = () => new Date(clock += 1000).toISOString();
const DB = { prof: { uA: { utente: 'Anna', nome: 'Anna', desideri: false, libreria: true }, uB: { utente: 'Bruno', nome: 'Bruno', desideri: false, libreria: true } },
  am: [{ da: 'uA', a: 'uB', stato: 'amici', creato: now() }], rows: {}, sw: [], pren: {}, n: 0, rq: [], tips: [], keys: [], libriPosts: 0 };
const uidOf = (req) => { const m = /Bearer AT-(\w+)/.exec(req.headers.authorization || ''); return m ? m[1] : null; };
const friendsOk = (x, y) => DB.am.some(f => f.stato === 'amici' && ((f.da === x && f.a === y) || (f.da === y && f.a === x)));
function fake(req, res, body, url) {
  const send = (st, j) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(j === undefined ? '' : JSON.stringify(j)); };
  const p = url.pathname.replace(/^\/finto/, ''), q = url.searchParams;
  if (req.headers.apikey !== 'chiave-finta') return send(401, { message: 'no api key' });
  if (p === '/auth/v1/settings') return send(200, { external: { google: true } });
  if (p === '/auth/v1/token') { const id = String(body.refresh_token || '').slice(3); return send(200, { access_token: 'AT-' + id, refresh_token: 'RT-' + id, expires_in: 3600, user: { id } }); }
  const me = uidOf(req); if (!me) return send(401, { message: 'JWT' });
  if (p === '/rest/v1/libri' && req.method === 'GET') {
    const gt = (q.get('aggiornato') || '').replace(/^gt\./, '');
    return send(200, Object.values(DB.rows).filter(x => x.utente === me && (!gt || x.aggiornato > gt)).map(x => ({ id: x.id, dati: x.dati, cancellato: x.cancellato, aggiornato: x.aggiornato })));
  }
  if (p === '/rest/v1/libri' && req.method === 'POST') { DB.libriPosts++; for (const x of body) DB.rows[me + '|' + x.id] = Object.assign({ utente: me, cancellato: false }, DB.rows[me + '|' + x.id] || {}, x, { aggiornato: now() }); return send(201); }
  if (p === '/rest/v1/profili' && req.method === 'GET') { const pr = DB.prof[me]; return send(200, [{ utente: pr.utente, nome: pr.nome, desideri: pr.desideri, libreria: pr.libreria }]); }
  if (p === '/rest/v1/profili') { ['desideri', 'libreria'].forEach(k => { if (body[k] !== undefined) DB.prof[me][k] = body[k]; }); if (body.utente) Object.assign(DB.prof[me], { utente: body.utente, nome: body.utente }); return send(201); }
  if (p === '/rest/v1/rpc/libreria_di') {
    const o = body.amico; if (!friendsOk(me, o)) return send(400, { message: 'non amici' });
    if (!DB.prof[o].libreria) return send(200, { visibili: false, totale: 0, comuni: 1, libri: [] });
    const l = Object.values(DB.rows).filter(x => x.utente === o && !x.cancellato && x.dati.w !== true && !x.dati.xs && !['p', 'q'].includes(x.dati.sk));
    return send(200, { visibili: true, totale: l.length, comuni: 1, libri: l.map(x => ({ id: x.id, t: x.dati.t, a: x.dati.a, i: x.dati.i, img: x.dati.img, rs: x.dati.rs, rt: x.dati.rt })) });
  }
  if (p === '/rest/v1/rpc/miei_amici') return send(200, DB.am.filter(x => x.da === me || x.a === me).map(x => { const o = x.da === me ? x.a : x.da; return { id: o, utente: DB.prof[o].utente, nome: DB.prof[o].nome, stato: x.stato, verso: x.da === me ? 'inviata' : 'ricevuta', creato: x.creato }; }));
  if (p === '/rest/v1/rpc/desideri_di') {
    const o = body.amico; if (!friendsOk(me, o)) return send(400, { message: 'non amici' });
    if (!DB.prof[o].desideri) return send(200, { visibili: false, libri: [] });
    return send(200, { visibili: true, libri: Object.values(DB.rows).filter(x => x.utente === o && !x.cancellato && x.dati.w === true).map(x => {
      const pr = DB.pren[o + '|' + x.id]; return { id: x.id, t: x.dati.t, a: x.dati.a, i: x.dati.i, prenotato: !pr ? '' : pr === me ? 'io' : DB.prof[pr].utente }; }) });
  }
  if (p === '/rest/v1/rpc/prenota_regalo') {
    const k = body.amico + '|' + body.libro;
    if (!body.si) { if (DB.pren[k] === me) delete DB.pren[k]; return send(200, ''); }
    if (DB.pren[k] && DB.pren[k] !== me) return send(400, { message: 'già prenotato' });
    DB.pren[k] = me; return send(200, 'io');
  }
  if (p === '/rest/v1/rpc/crea_scambio') {
    if (!friendsOk(me, body.a)) return send(400, { message: 'non amici' });
    const id = '0000000' + (++DB.n) + '-0000-0000-0000-000000000000';
    DB.sw.push({ id, da: me, a: body.a, tipo: body.tipo, libro: body.libro, libro_id: body.libro_id, stato: 'aperto', visto: false, creato: now(), chiuso: null });
    if (body.tipo === 'regalo') Object.keys(DB.pren).forEach(k => { const [o, l] = k.split('|'); const r = DB.rows[o + '|' + l]; if (o === body.a && DB.pren[k] === me && r && r.dati.i === body.libro.i) delete DB.pren[k]; });
    return send(200, id);
  }
  if (p === '/rest/v1/rpc/chiudi_scambio') { const s = DB.sw.find(x => x.id === body.id && x.da === me && x.stato !== 'chiuso'); if (s) { s.stato = 'chiuso'; s.chiuso = now(); } return send(204); }
  if (p === '/rest/v1/rpc/segnala_reso') { const s = DB.sw.find(x => x.id === body.id && x.a === me && x.stato === 'aperto'); if (s) s.stato = 'reso'; return send(204); }
  if (p === '/rest/v1/rpc/rifiuta_reso') { const s = DB.sw.find(x => x.id === body.id && x.da === me && x.stato === 'reso'); if (s) s.stato = 'aperto'; return send(204); }
  if (p === '/rest/v1/rpc/segna_visto') { const s = DB.sw.find(x => x.id === body.id && x.a === me); if (s) s.visto = true; return send(204); }
  if (p === '/rest/v1/rpc/miei_scambi') return send(200, DB.sw.filter(x => x.da === me || x.a === me).map(x => Object.assign({ nome_da: DB.prof[x.da].utente, nome_a: DB.prof[x.a].utente }, x)));
  if (p === '/rest/v1/rpc/amici_numeri') return send(200, me === 'uA' ? [{ id: 'uB', comuni: 0, libri: 1 }] : []);
  if (p === '/rest/v1/rpc/chiedi_prestito') { if (!friendsOk(me, body.amico)) return send(400, { message: 'non amici' }); const r = { id: 'r' + (++DB.n) + '000000-0000-0000-0000-000000000000', da: me, a: body.amico, libro_id: body.libro_id, libro: { t: DB.rows[body.amico + '|' + body.libro_id].dati.t }, stato: 'attesa', creato: now() }; DB.rq.push(r); return send(200, r.id); }
  if (p === '/rest/v1/rpc/rispondi_richiesta') { const r = DB.rq.find(x => x.id === body.id && x.a === me && x.stato === 'attesa'); if (r) r.stato = body.si ? 'accettata' : 'rifiutata'; return send(204); }
  if (p === '/rest/v1/rpc/annulla_richiesta') { DB.rq = DB.rq.filter(x => !(x.id === body.id && x.da === me)); return send(204); }
  if (p === '/rest/v1/rpc/mie_richieste') return send(200, DB.rq.filter(x => x.da === me || x.a === me).map(x => Object.assign({ nome_da: DB.prof[x.da].utente, nome_a: DB.prof[x.a].utente }, x)));
  if (p === '/rest/v1/rpc/consiglia') { if (!friendsOk(me, body.a)) return send(400, { message: 'non amici' }); DB.tips.push({ id: 't' + (++DB.n) + '000000-0000-0000-0000-000000000000', da: me, a: body.a, libro: body.libro, creato: now() }); return send(200, 'ok'); }
  if (p === '/rest/v1/rpc/miei_consigli') return send(200, DB.tips.filter(x => x.a === me).map(x => ({ id: x.id, da: x.da, nome_da: DB.prof[x.da].utente, libro: x.libro, creato: x.creato })));
  if (p === '/rest/v1/rpc/togli_consiglio') { DB.tips = DB.tips.filter(x => !(x.id === body.id && x.a === me)); return send(204); }
  if (p === '/rest/v1/rpc/chi_ce_lha') return send(200, Object.values(DB.rows).filter(x => x.utente !== me && DB.prof[x.utente].libreria && friendsOk(me, x.utente) && (body.isbn || []).includes(x.dati.i) && x.dati.w !== true).map(x => ({ isbn: x.dati.i, amico: x.utente, utente: DB.prof[x.utente].utente, libro_id: x.id, fuori: !!x.dati.p })));
  if (p === '/rest/v1/rpc/presta_chiavi') { DB.keys = DB.keys.filter(k => !(k.da === me && k.a === body.a)); DB.keys.push({ da: me, a: body.a, gb_key: body.gb_key, sbn: body.sbn }); return send(204); }
  if (p === '/rest/v1/rpc/riprendi_chiavi') { DB.keys = DB.keys.filter(k => !(k.da === me && k.a === body.a)); return send(204); }
  if (p === '/rest/v1/rpc/chiavi_mie') return send(200, DB.keys.filter(k => k.da === me).map(k => ({ da: k.da, a: k.a, nome: DB.prof[k.a].utente, gb_key: k.gb_key ? 'si' : '', sbn: k.sbn ? 'si' : '' })).concat(DB.keys.filter(k => k.a === me).map(k => ({ da: k.da, a: k.a, nome: DB.prof[k.da].utente, gb_key: k.gb_key, sbn: k.sbn }))));
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
}).listen(CFG.port(8393));
const base = 'http://localhost:' + CFG.port(8393);

const OUT = path.join(CFG.OUT, 'schermate-amici2'); fs.mkdirSync(OUT, { recursive: true });
// 12 amici con nomi anche lunghi, numeri in comune, una richiesta, un consiglio, una chiave
const NOMI = ['Bruno', 'Carla Maria De Santis', 'Dario', 'Elena', 'Francesco_lungo', 'Giulia', 'Ilaria', 'Luca', 'Marta', 'Nicola', 'Olga', 'Paolo'];
NOMI.forEach((n, k) => { const id = k ? 'u' + k : 'uB'; DB.prof[id] = DB.prof[id] || { utente: n, nome: n, desideri: true, libreria: true }; if (k) DB.am.push({ da: 'uA', a: id, stato: 'amici', creato: now() }); });
DB.am.push({ da: 'u99', a: 'uA', stato: 'attesa', creato: now() }); DB.prof.u99 = { utente: 'Zeno Cosini', nome: 'Zeno Cosini' };
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function phone(uid, w, h, dark) {
    const page = await (await browser.createBrowserContext()).newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 700, hasTouch: w < 700 });
    page.on('pageerror', e => console.log('ERRORE', e.message));
    await page.evaluateOnNewDocument((u, id) => { window.NL_SOCIAL = { url: u, key: 'chiave-finta', gClient: 'c' };
      localStorage.setItem('prova:catalogo-libri-social-auth', JSON.stringify({ at: 'AT-' + id, rt: 'RT-' + id, exp: Date.now() + 3e6, uid: id, email: id + '@x.it' })); }, base + '/finto', uid);
    await page.setRequestInterception(true); page.on('request', r => r.url().startsWith(base) ? r.continue() : r.respond({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.goto(base + '/next-libris-prova/?vista=elenco', { waitUntil: 'load' }); await wait(600);
    await page.evaluate((d) => { window.NLLayout.set('A'); window.NLCard && window.NLCard.set('d'); if (d) document.documentElement.setAttribute('data-theme', 'dark'); }, dark); await wait(1800);
    page.add = (o) => page.evaluate((o) => { const b = window.NL.clean(o); window.NL.books().unshift(b); window.NL.save(); window.NL.refresh(); return b.id; }, o);
    return page;
  }
  // dati di Bruno (libri) e di Anna
  const B = await phone('uB', 412, 900);
  await B.add({ t: 'Il giardino dei Finzi-Contini', a: 'Giorgio Bassani', i: '9788807900358', rs: 'ok', rt: 4 });
  await B.add({ t: 'Una storia lunghissima con un titolo che non finisce mai, davvero mai', a: 'Autrice Con Un Nome Molto Lungo', rs: 'in', pp: '120', pg: '300' });
  await B.evaluate(() => window.NLSocial.run(false)); await wait(400);
  DB.rq.push({ id: 'r9000000-0000-0000-0000-000000000000', da: 'uB', a: 'uA', libro_id: 'x', libro: { t: 'La coscienza di Zeno' }, stato: 'attesa', creato: now() });
  DB.tips.push({ id: 't9000000-0000-0000-0000-000000000000', da: 'uB', a: 'uA', libro: { t: 'Lessico famigliare', a: 'Natalia Ginzburg' }, creato: now() });
  DB.keys.push({ da: 'u2', a: 'uA', gb_key: 'AIzaX', sbn: '' });
  for (const [w, h, dark] of [[360, 780, false], [412, 900, true], [1280, 860, false]]) {
    const tag = w + (dark ? '-scuro' : '');
    const A = await phone('uA', w, h, dark);
    const shot = async (n) => { await A.screenshot({ path: path.join(OUT, tag + '-' + n + '.png') }); };
    const side = async (n) => { const x = await A.evaluate(() => [...document.querySelectorAll('.sheet:not([hidden]) .sheet-in')].map(s => s.scrollWidth - s.clientWidth).concat([document.documentElement.scrollWidth - document.documentElement.clientWidth])); if (x.some(v => v > 0)) console.log('SCORRE DI LATO', tag, n, x); };
    await A.evaluate(() => { window.NL.settings.gbKey = 'AIzaMia'; window.NL.settings.sbnUrl = 'https://sbn-mio.workers.dev'; window.NL.saveSettings(); });
    const mio = await A.add({ t: 'Il barone rampante', a: 'Italo Calvino', i: '9788804668015' });
    await A.evaluate(() => window.NLAmici.load(true)); await wait(900);
    await shot('1-pagina'); await side('1');
    await A.evaluate(() => window.NLAmici.open()); await wait(800); await shot('2-amici'); await side('2');
    await A.evaluate(() => { const s = document.querySelector('#friSheet .sheet-in'); s.scrollTop = s.scrollHeight; }); await wait(200); await shot('3-amici-giu');
    await A.click('[data-f="opts"]'); await wait(400); await shot('4-privacy'); await side('4');
    await A.evaluate(() => { const s = document.querySelector('#friSheet .sheet-in'); s.scrollTop = s.scrollHeight; }); await wait(200); await shot('5-privacy-giu');
    await A.keyboard.press('Escape'); await wait(300);
    await A.evaluate((id) => window.__app.openShare([window.NL.get(id)], { kind: 'book' }), mio); await wait(500); await shot('6-condividi'); await side('6');
    await A.evaluate(() => { document.getElementById('shareExt').open = true; }); await wait(200); await shot('7-condividi-link');
    await A.evaluate(() => document.getElementById('shareClose').click()); await wait(300);
    await A.evaluate((id) => window.__app.openLoan(id), mio); await wait(500); await shot('8-presta'); await side('8');
    await A.keyboard.press('Escape'); await wait(300);
    await A.evaluate(() => window.NLAmici.guest('uB')); await wait(1200); await shot('9-libreria-amico'); await side('9');
    await A.evaluate(() => { const r = document.querySelector('#list .row'); if (r) r.querySelector('.sum') ? r.querySelector('.sum').click() : r.click(); }); await wait(600);
    await A.evaluate(() => { const r = document.querySelector('#list .row.open'); if (r) r.scrollIntoView(); }); await wait(200); await shot('10-scheda-amico'); await side('10');
    await A.evaluate(() => window.scrollTo(0, 0)); await wait(200);
    await A.click('#guestBar [data-g="key"]'); await wait(500); await shot('11-presta-chiave'); await side('11');
    await A.evaluate(() => document.getElementById('keyNo').click()); await wait(200);
    await A.close();
  }
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
