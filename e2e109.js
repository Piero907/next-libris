const CFG = require("./_config");
const H = require('./_harness');
// moduli: social, notifiche   (senza questi file nell'app la prova si salta: vedi esegui.js)
// Condivisione › «Chiave Google e worker» su misura e finestra della chiave (Piero, 16/11/2026); interruttore Libreria/Desideri nel +; scheda di un libro senza titolo (17/11/2026).
// Anna ha chiave e worker: «Presta a un amico» apre la finestra della chiave (non Amici); presta a Bruno; chiudendo si torna a Condivisione.
// Bruno non ha niente: vede «Anna ti presta …» e la guida; la usa e vede «Usi … di Anna» + guida (il caso di Serena); smette dalla finestra.
// Il +: «In Libreria | Nei Desideri», parte dalla scheda in cui sei. Un libro con solo l'ISBN si apre nella disposizione di «Modifica».
// SCHERMATE=cartella per le fotografie (360, 412 scuro).
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
    if (!DB.prof[o].libreria) return send(200, { visibili: false, totale: 0, libri: [] });
    const l = Object.values(DB.rows).filter(x => x.utente === o && !x.cancellato && x.dati.w !== true && !x.dati.xs && !['p', 'q'].includes(x.dati.sk));
    return send(200, { visibili: true, totale: l.length, libri: l.map(x => ({ id: x.id, t: x.dati.t, a: x.dati.a, i: x.dati.i, img: x.dati.img, rs: x.dati.rs, rt: x.dati.rt })) });
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
  if (p === '/rest/v1/rpc/mie_notifiche') return send(200, notifOf(me).map(x => Object.assign(x, { letta: !!DB.read[me + x.id] })));
  if (p === '/rest/v1/rpc/notifiche_lette') { notifOf(me).forEach(x => { DB.read[me + x.id] = 1; }); return send(204); }
  if (p.startsWith('/rest/v1/rpc/')) return send(200, []);
  send(404, { message: 'finto: ' + p });
}
// notifiche come le scrivono i trigger (011_notifiche.sql): prestiti/regali ricevuti e consigli
function notifOf(me) {
  const nm = u => DB.prof[u].utente, n = [];
  DB.sw.filter(x => x.a === me).forEach(x => n.push({ id: 'n-' + x.id, da: x.da, nome: nm(x.da), tipo: x.tipo, rif: x.id, titolo: (x.libro || {}).t || '', creata: x.creato }));
  DB.tips.filter(x => x.a === me).forEach(x => n.push({ id: 'n-' + x.id, da: x.da, nome: nm(x.da), tipo: 'consiglio', rif: x.id, titolo: (x.libro || {}).t || '', creata: x.creato }));
  return n.sort((a, b) => a.creata < b.creata ? 1 : -1);
}
DB.read = {};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/finto/')) { let b = ''; req.on('data', c => b += c); req.on('end', () => { let j = {}; try { j = b ? JSON.parse(b) : {}; } catch (e) {} fake(req, res, j, url); }); return; }
  const p = decodeURIComponent(url.pathname), m = p.match(/^\/next-libris-prova(\/.*)?$/);
  if (!m) { res.writeHead(404); return res.end(); }
  if (!m[1]) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
  const f = path.join(ROOT, m[1] === '/' ? '/index.html' : m[1]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
}).listen(CFG.port(8309));
const base = 'http://localhost:' + CFG.port(8309);

(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const wait = H.wait;   // attesa «finché» (_harness.js)
  const SHOTS = process.env.SCHERMATE;   // cartella: se c'è, fa anche le schermate
  async function phone(name, uid, w, dark) {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: w || 412, height: 915, deviceScaleFactor: SHOTS ? 1 : 2, isMobile: true, hasTouch: true });
    if (dark) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    await page.evaluateOnNewDocument((u, id) => {
      window.NL_SOCIAL = { url: u, key: 'chiave-finta', gClient: 'client-finto' };
      if (!localStorage.getItem('prova:catalogo-libri-social-auth')) localStorage.setItem('prova:catalogo-libri-social-auth', JSON.stringify({ at: 'AT-' + id, rt: 'RT-' + id, exp: Date.now() + 3e6, uid: id, email: id + '@esempio.it' }));
      if (!localStorage.getItem('prova:catalogo-libri-layout')) { localStorage.setItem('prova:catalogo-libri-layout', JSON.stringify({ v: 'a' })); localStorage.setItem('prova:catalogo-libri-card', JSON.stringify({ v: 'd' })); }
    }, base + '/finto', uid);
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) ? r.continue() : r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"totalItems":0}' }));
    await page.goto(base + '/next-libris-prova/?vista=elenco', { waitUntil: 'load' }); await wait(2000);
    if (dark) await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    page.click$ = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error('manca ' + s); e.click(); }, sel);
    page.vis = sel => page.evaluate(s => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, sel);
    page.txt = sel => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
    page.svc = () => page.$$eval('#svcBox [data-svc]', e => e.map(x => x.dataset.svc));
    page.top = sel => page.evaluate(s => { const e = document.querySelector(s + ' .sheet-in'); const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + 20); return !!t && e.contains(t); }, sel);
    page.shot = async (n) => { if (SHOTS) { await wait(250); await page.screenshot({ path: path.join(SHOTS, n + '.png') }); } };
    page.wide = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    return page;
  }
  DB.prof.uA.utente = DB.prof.uA.nome = 'Anna Maria Bellini';
  const KEY = 'AIzaANNA0123456789abcdefghijklmnopq';
  // ---- Anna: chiave e worker suoi ----
  const A = await phone('A', 'uA', 360);
  await A.evaluate((k) => { const s = window.NL.settings; s.gbKey = k; s.sbnUrl = 'https://anna.workers.dev'; s.name = 'Anna'; window.NL.saveSettings(); }, KEY);
  await A.evaluate(() => window.__app.openOptions('search')); await wait(600);   // chiave e worker in Ricerca dei libri (17/11/2026)
  assert.deepStrictEqual(await A.svc(), ['lend'], 'Anna: solo «Presta a un amico»');
  console.log('[Anna]', await A.txt('#svcBox'));
  await A.evaluate(() => window.__app.openOptions('share')); await wait(300);
  assert(/I preferiti di Anna Maria Bellini/.test(await A.txt('#optNameHint')), 'esempio con il suo nome');
  assert(!(await A.$('#svcShareBtn')) && !(await A.$('#optFriKeys')), 'via i due pulsanti di prima');
  await A.shot('109-1-condivisione-anna-360');
  await A.click$('#svcBox [data-svc="lend"]'); await wait(900);
  assert(await A.vis('#kwSheet'), 'si apre la finestra della chiave');
  assert(await A.evaluate(() => { const f = document.getElementById('friSheet'); return !f || f.hidden; }), 'non si apre Amici');
  assert(await A.top('#kwSheet'), 'la finestra della chiave sta sopra Condivisione');
  console.log('[finestra Anna]', await A.txt('#kwBody'));
  assert(/Bruno/.test(await A.txt('#kwBody')) && /Manda con un link/.test(await A.txt('#kwBody')));
  assert(!/Crea la tua chiave/.test(await A.txt('#kwBody')), 'Anna ha la chiave: niente guida');
  await A.shot('109-2-finestra-anna-360');
  await A.click$('#kwBody [data-f="keyshare"][data-id="uB"]'); await wait(300);
  assert(await A.vis('#keySheet') && await A.top('#keySheet'), '«Presta a Bruno» sopra la finestra');
  await A.click$('#keyGo'); await wait(800);
  assert.strictEqual(DB.keys.length, 1, 'prestata a Bruno');
  assert(await A.evaluate(() => document.getElementById('keySheet').hidden) && await A.vis('#kwSheet'));
  assert(/Prestati: chiave API e worker/.test(await A.txt('#kwBody')));
  await A.click$('#kwClose'); await wait(300);
  assert(await A.vis('#optSheet') && !(await A.evaluate(() => { const f = document.getElementById('friSheet'); return f && !f.hidden; })), 'chiudendo si torna a Condivisione');
  assert.strictEqual(await A.wide(), 0, 'niente scorrimento di lato (Anna)');
  await A.evaluate(() => window.__app.closeOptions()); await wait(200);

  // ---- il +: Libreria | Desideri ----
  await A.click$('.lay-plus'); await wait(300);
  let sel = await A.$$eval('#layAdd [data-dest]', e => e.map(x => x.dataset.dest + ':' + x.getAttribute('aria-selected')));
  assert.deepStrictEqual(sel, ['lib:true', 'wish:false'], 'parte da Libreria');
  await A.shot('109-3-aggiungi-360');
  await A.click$('#layAdd [data-dest="wish"]'); await wait(300);
  assert.strictEqual(await A.evaluate(() => window.NL.tab()), 'wish', 'ora aggiunge ai Desideri');
  assert(await A.vis('#layAdd'), 'la finestra resta aperta');
  sel = await A.$$eval('#layAdd [data-dest]', e => e.map(x => x.getAttribute('aria-selected')));
  assert.deepStrictEqual(sel, ['false', 'true']);
  await A.click$('#layAdd [data-l="close"]'); await wait(200);
  await A.click$('.lay-plus'); await wait(300);
  sel = await A.$$eval('#layAdd [data-dest]', e => e.map(x => x.getAttribute('aria-selected')));
  assert.deepStrictEqual(sel, ['false', 'true'], 'dai Desideri parte da Desideri');
  await A.click$('#layAdd [data-l="type"]'); await wait(400);
  console.log('[digita]', await A.txt('#isbnH'));
  assert(/Desideri/.test(await A.txt('#isbnH')));
  await A.evaluate(() => { document.querySelectorAll('.sheet:not([hidden])').forEach(s => { s.hidden = true; }); window.__app.setTab('lib'); });

  // ---- libro con solo l'ISBN: la disposizione di «Modifica» ----
  const eid = await A.evaluate(() => { const b = window.NL.clean({ t: '', i: '9788842827627' }); window.NL.books().unshift(b); window.NL.save(); window.NL.refresh(); return b.id; });
  await A.evaluate(id => document.querySelector('[data-id="' + id + '"] .sum').click(), eid); await wait(500);
  assert(await A.$eval('[data-id="' + eid + '"]', e => e.classList.contains('cv-edit')), 'senza titolo: come in Modifica');

  // ---- Bruno: niente di suo, Anna gli presta i suoi ----
  for (const [w, dark] of [[360, false], [412, true]]) {
    const tag = w + (dark ? '-scuro' : '');
    const B = await phone('B' + w, 'uB', w, dark);
    await B.evaluate(() => { window.NL.settings.name = 'Bruno'; window.NL.saveSettings(); window.__app.openOptions('search'); }); await wait(900);
    console.log('[Bruno ' + tag + ']', await B.txt('#svcBox'));
    assert.deepStrictEqual(await B.svc(), ['offer', 'guide'], 'Bruno: offerta di Anna e guida');
    assert(/Anna Maria Bellini ti presta chiave Google e worker/.test(await B.txt('#svcBox')));
    await B.shot('109-4-condivisione-bruno-offerta-' + tag);
    await B.click$('#svcBox [data-svc="offer"]'); await wait(700);
    await B.click$('#kwBody [data-f="keyuse"]'); await wait(700);
    assert.strictEqual(await B.evaluate(() => window.NL.settings.gbKey), KEY, 'Bruno usa la chiave di Anna');
    await B.click$('#kwClose'); await wait(400);
    console.log('[Bruno usa]', await B.txt('#svcBox'));
    assert.deepStrictEqual(await B.svc(), ['used', 'guide'], 'Bruno: «Usi … di Anna» e la guida (caso di Serena)');
    assert(/Usi la chiave Google e il worker SBN di Anna Maria Bellini/.test(await B.txt('#svcBox')));
    assert.strictEqual(await B.wide(), 0, 'niente scorrimento di lato (Bruno)');
    await B.shot('109-5-condivisione-bruno-usa-' + tag);
    await B.click$('#svcBox [data-svc="used"]'); await wait(600);
    assert(/Non usarla più/.test(await B.txt('#kwBody')) && /Crea la tua chiave/.test(await B.txt('#kwBody')));
    await B.shot('109-6-finestra-bruno-' + tag);
    await B.click$('#kwBody [data-kw="guide"]'); await wait(400);
    assert(await B.vis('#kgSheet') && await B.top('#kgSheet'), 'guida sopra la finestra');
    assert(/non dipendi dalla chiave di un amico/.test(await B.txt('#kgWhy')));
    await B.shot('109-7-guida-' + tag);
    await B.click$('#kgClose'); await wait(200);
    await B.click$('#kwBody [data-f="keyoff"]'); await wait(500);
    await B.click$('#kwClose'); await wait(300);
    assert.deepStrictEqual(await B.svc(), ['offer', 'guide'], 'smesso: torna l\'offerta');
    assert.strictEqual(await B.evaluate(() => window.NL.settings.gbKey || ''), '', 'tornato senza chiave');
  }
  if (errors.length) { console.log(errors); throw new Error('errori nella pagina'); }
  console.log('e2e109 OK');
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
