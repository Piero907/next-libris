const CFG = require("./_config");
const H = require('./_harness');
// moduli: social, amici, notifiche   (senza questi file nell'app la prova si salta: vedi esegui.js)
// Amici dell'amico e icona Amici nella libreria di un amico (Piero, 17/11/2026; 015_amici_visibili.sql).
// Anna guarda la libreria di Bruno: l'icona Amici c'è e apre i suoi Amici; «N amici in comune» apre gli amici di Bruno:
// Carla (in comune) in cima, Dario con «Chiedi l'amicizia»; toccando Carla si passa alla sua libreria.
// Bruno spegne «Gli amici vedono i miei amici»: solo quelli in comune. La voce di Anna è accesa di partenza e si spegne.
// SCHERMATE=cartella per le fotografie (360, 412 scuro).
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm' };
let clock = Date.parse('2026-11-16T10:00:00Z'); const now = () => new Date(clock += 1000).toISOString();
const DB = { prof: { uA: { utente: 'Anna', nome: 'Anna', desideri: false, libreria: true, amici: true }, uB: { utente: 'Bruno', nome: 'Bruno', desideri: false, libreria: true, amici: true },
    uC: { utente: 'Carla Maria Benedetti', nome: 'Carla', desideri: false, libreria: true, amici: true }, uD: { utente: 'Dario', nome: 'Dario', desideri: false, libreria: false, amici: true } },
  am: [{ da: 'uA', a: 'uB', stato: 'amici', creato: now() }, { da: 'uC', a: 'uA', stato: 'amici', creato: now() }, { da: 'uB', a: 'uC', stato: 'amici', creato: now() }, { da: 'uD', a: 'uB', stato: 'amici', creato: now() }], rows: {}, sw: [], pren: {}, n: 0, rq: [], tips: [], keys: [], libriPosts: 0 };
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
  if (p === '/rest/v1/profili' && req.method === 'GET') { const pr = DB.prof[me]; return send(200, [{ utente: pr.utente, nome: pr.nome, desideri: pr.desideri, libreria: pr.libreria, amici: pr.amici }]); }
  if (p === '/rest/v1/profili') { ['desideri', 'libreria', 'amici'].forEach(k => { if (body[k] !== undefined) DB.prof[me][k] = body[k]; }); if (body.utente) Object.assign(DB.prof[me], { utente: body.utente, nome: body.utente }); return send(201); }
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
  if (p === '/rest/v1/rpc/amici_di') {   // come 015_amici_visibili.sql
    const o = body.amico; if (!friendsOk(me, o)) return send(400, { message: 'non amici' });
    const vis = DB.prof[o].amici !== false;
    const ids = DB.am.filter(x => x.stato === 'amici' && (x.da === o || x.a === o)).map(x => x.da === o ? x.a : x.da).filter(x => x !== me);
    const rows = ids.map(id => { const f = DB.am.find(x => (x.da === me && x.a === id) || (x.da === id && x.a === me));
      return { id, utente: DB.prof[id].utente, comune: friendsOk(me, id), rel: !f ? '' : f.stato === 'amici' ? 'amici' : f.da === me ? 'inviata' : 'ricevuta' }; })
      .filter(x => vis || x.comune).sort((a, b) => (b.comune - a.comune) || a.utente.localeCompare(b.utente));
    return send(200, { visibili: vis, amici: rows });
  }
  if (p === '/rest/v1/rpc/chiedi_amicizia') { const o = Object.keys(DB.prof).find(k => DB.prof[k].utente.toLowerCase() === String(body.utente).toLowerCase()); if (!DB.am.some(x => x.da === me && x.a === o)) DB.am.push({ da: me, a: o, stato: 'attesa', creato: now() }); return send(200, 'attesa'); }
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
}).listen(CFG.port(8310));
const base = 'http://localhost:' + CFG.port(8310);

(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const wait = H.wait;   // attesa «finché» (_harness.js)
  const SHOTS = process.env.SCHERMATE;
  async function phone(name, uid, w, dark) {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: w || 412, height: 915, deviceScaleFactor: SHOTS ? 1 : 2, isMobile: true, hasTouch: true });
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
    page.shown = sel => page.evaluate(s => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, sel);
    page.txt = sel => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
    page.shot = async (n) => { if (SHOTS) { await wait(250); await page.screenshot({ path: path.join(SHOTS, n + '.png') }); } };
    page.wide = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    return page;
  }
  for (const [w, dark] of [[360, false], [412, true]]) {
    const tag = w + (dark ? '-scuro' : '');
    DB.prof.uB.amici = true; DB.am = DB.am.filter(x => !(x.da === 'uA' && x.a === 'uD'));
    const A = await phone('A' + tag, 'uA', w, dark);
    await A.evaluate(() => window.NLAmici.load(true)); await wait(500);
    // ---- nella libreria di Bruno: l'icona Amici c'è ----
    await A.evaluate(() => window.NLAmici.guest('uB')); await wait(900);
    assert.strictEqual(await A.evaluate(() => window.NL.guest()), 'Bruno');
    assert(await A.shown('#gTabs [data-g="fri"]') && await A.shown('#gBack'), 'stile G: segnalibro Amici e ‹ per tornare anche nella libreria di un amico');
    await A.shot('110-1-libreria-bruno-' + tag);
    // ---- «amici in comune» apre gli amici di Bruno ----
    await A.click$('#guestBar [data-g="ff"]'); await wait(700);
    assert(await A.shown('#friSheet'));
    assert.strictEqual(await A.txt('#friH'), 'Amici di Bruno');
    let t = await A.txt('#friBody'); console.log('[amici di Bruno ' + tag + ']', t);
    assert(/In comune 1 Carla Maria Benedetti/i.test(t), 'Carla in comune, in cima');
    assert(/Altri amici di Bruno 1 Dario Chiedi l.amicizia/i.test(t), 'Dario con «Chiedi l\'amicizia»');
    assert(!/Anna/i.test(t), 'non me stessa');
    assert(/^1 amico in comune/i.test(await A.txt('#guestBar .gb-num')), 'stesso numero nella striscia: ' + await A.txt('#guestBar .gb-num'));
    assert.strictEqual(await A.wide(), 0, 'niente scorrimento di lato');
    await A.shot('110-2-amici-di-bruno-' + tag);
    await A.click$('#friBody [data-f="ask"][data-u="Dario"]'); await wait(700);
    assert(DB.am.some(x => x.da === 'uA' && x.a === 'uD' && x.stato === 'attesa'), 'richiesta a Dario');
    assert(/Dario Richiesta inviata/i.test(await A.txt('#friBody')), 'Dario: richiesta inviata');
    // ---- toccando Carla si apre il suo profilo (giro 6) e da lì la sua libreria ----
    await A.click$('#friBody [data-f="friend"][data-id="uC"]'); await wait(900);
    assert.strictEqual(await A.evaluate(() => document.getElementById('profH').textContent), 'Profilo di Carla Maria Benedetti');
    await A.click$('#profBody [data-p="lib"]'); await wait(1000);
    assert.strictEqual(await A.evaluate(() => window.NL.guest()), 'Carla Maria Benedetti');
    assert(await A.evaluate(() => document.getElementById('friSheet').hidden));
    // ---- l'icona apre i tuoi Amici ----
    await H.fai(A, 'fri'); await wait(700);
    assert(/I tuoi amici/i.test(await A.txt('#friBody')) && await A.txt('#friH') === 'Amici', 'i tuoi Amici');
    await A.click$('#friClose'); await wait(200);
    assert.strictEqual(await A.evaluate(() => window.NL.guest()), 'Carla Maria Benedetti', 'resti nella libreria di Carla');
    // ---- Bruno spegne «amici»: solo quelli in comune ----
    DB.prof.uB.amici = false;
    await A.evaluate(() => window.NLAmici.guest('uB')); await wait(900);
    await A.click$('#guestBar [data-g="ff"]'); await wait(700);
    t = await A.txt('#friBody'); console.log('[spento]', t);
    assert(/Carla/i.test(t) && !/Dario/i.test(t) && /Bruno mostra solo gli amici che avete in comune/i.test(t));
    await A.shot('110-3-amici-di-bruno-spento-' + tag);
    await A.click$('#friClose'); await wait(200);
    // ---- la mia scelta in Amici e privacy, accesa di partenza ----
    await A.evaluate(() => window.NL.guestExit()); await wait(500);
    await A.evaluate(() => window.NLAmici.open(true)); await wait(700);
    assert(await A.$eval('#friAmici', e => e.checked), 'accesa di partenza');
    await A.shot('110-4-privacy-' + tag);
    await A.click$('#friAmici'); await wait(600);
    assert.strictEqual(DB.prof.uA.amici, false, 'spenta sul server');
    await A.click$('#friAmici'); await wait(600);
    assert.strictEqual(DB.prof.uA.amici, true, 'riaccesa');
    await A.browserContext().close();
  }
  if (errors.length) { console.log(errors); throw new Error('errori nella pagina'); }
  console.log('e2e110 OK');
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
