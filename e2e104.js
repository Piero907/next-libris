const CFG = require("./_config");
// modulo «Amici», seconda parte (Supabase finto): A (Anna) e B (Bruno) amici, librerie visibili.
// Nella libreria di B (sola lettura): «Solo quelli che non hai», «Aggiungi ai miei desideri» (nei SUOI desideri), «Me lo presti?»;
// mentre A guarda, i suoi libri non cambiano e non si sincronizza niente; tornando, tutto com'era.
// B riceve la richiesta (avviso in cima) e tocca «Presta»: il prestito parte e A lo trova in Libreria («Prestato da Bruno»).
// «Chi ce l'ha»: nella scheda di un desiderio di A compare «Ce l'hanno i tuoi amici: Bruno · Me lo presti?».
// Consiglio: B condivide un libro e lo consiglia ad A dalla finestra di condivisione; A lo trova in Amici e lo mette nei desideri.
// Chiave Google: A la condivide con B; B «Usala» (la usano tutti e due); A smette → B torna alle sue impostazioni.
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
  if (p === '/rest/v1/rpc/chiavi_mie') return send(200, DB.keys.filter(k => k.da === me).map(k => ({ da: k.da, a: k.a, nome: DB.prof[k.a].utente, gb_key: '', sbn: '' })).concat(DB.keys.filter(k => k.a === me).map(k => ({ da: k.da, a: k.a, nome: DB.prof[k.da].utente, gb_key: k.gb_key, sbn: k.sbn }))));
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
}).listen(CFG.port(8304));
const base = 'http://localhost:' + CFG.port(8304);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const wait = ms => new Promise(r => setTimeout(r, ms));
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
    page.add = (o) => page.evaluate((o) => { const b = window.NL.clean(o); window.NL.books().unshift(b); window.NL.save(); window.NL.refresh(); return b.id; }, o);
    page.titles = () => page.evaluate(() => window.NL.books().map(b => b.t + (b.w ? ' (D)' : '')).sort());
    page.saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('prova:catalogo-libri-v2') || '{}').books.map(b => b.t + (b.w ? ' (D)' : '')).sort());
    page.openRow = (id) => page.evaluate((id) => document.querySelector('[data-id="' + id + '"] .sum').click(), id);
    return page;
  }
  // ---- B: due libri, sincronizzati ----
  const B = await phone('B', 'uB');
  const bDue = await B.add({ t: 'Il giardino dei Finzi-Contini', a: 'Giorgio Bassani', i: '9788807900358' });
  await B.add({ t: 'Il Gattopardo', a: 'Giuseppe Tomasi di Lampedusa', i: '9788807881794' });
  await B.evaluate(() => window.NLSocial.run(false)); await wait(500);
  // ---- A: un libro (lo stesso Gattopardo) e un desiderio (il Giardino, che ha B) ----
  const A = await phone('A', 'uA', 360);
  await A.add({ t: 'Il Gattopardo', a: 'Giuseppe Tomasi di Lampedusa', i: '9788807881794' });
  const aWish = await A.add({ t: 'Il giardino dei Finzi-Contini', a: 'Giorgio Bassani', i: '9788807900358', w: true });
  await A.evaluate(() => window.NLSocial.run(false)); await wait(400);
  const mineBefore = await A.saved();
  // «Chi ce l'ha»: nella scheda del desiderio
  await A.evaluate(() => window.NLAmici.load(true)); await wait(700);
  await A.evaluate(() => window.__app.setTab('wish')); await wait(300); await A.openRow(aWish); await wait(500);
  let t = await A.$eval('[data-id="' + aWish + '"] .cv-who', x => x.innerText.replace(/\s+/g, ' ')); console.log('[chi ce l\'ha]', t);
  assert(/Ce l.hanno i tuoi amici Bruno Me lo presti\?/.test(t), 'Bruno ce l\'ha');
  await A.evaluate(() => window.__app.setTab('lib')); await wait(300);
  // ---- A guarda la libreria di B ----
  const posts0 = DB.libriPosts;
  await A.evaluate(() => window.NLAmici.guest('uB')); await wait(900);
  assert.strictEqual(await A.evaluate(() => window.NL.guest()), 'Bruno');
  t = await A.$eval('#guestBar', x => x.innerText.replace(/\s+/g, ' ')); assert(/1 libro in comune/.test(t), 'in comune: il Gattopardo');
  assert(await A.evaluate(() => { const b = document.getElementById('btnTodo'); return !b || getComputedStyle(b).display === 'none'; }), 'nella sua libreria niente «Completa con l\'ISBN»');
  await A.click('#guestBar [data-g="notmine"]'); await wait(400);
  t = await A.$eval('#list', x => x.innerText); assert(/Finzi-Contini/.test(t) && !/Gattopardo/.test(t), 'solo quelli che non ha');
  assert(await A.evaluate(() => { const si = document.documentElement; return si.scrollWidth <= si.clientWidth; }), 'niente scorrimento di lato a 360 px');
  await A.openRow(bDue); await wait(500);
  t = await A.$eval('[data-id="' + bDue + '"] .cv-guest', x => x.innerText.replace(/\s+/g, ' ')); assert(/È nei tuoi desideri/.test(t) && /Me lo presti\?/.test(t), 'azioni sulla scheda');
  assert(!(await A.$('[data-id="' + bDue + '"] .cv-editb')) || await A.$eval('[data-id="' + bDue + '"] .cv-editb', x => getComputedStyle(x).display === 'none'), 'niente matita');
  await A.evaluate(() => window.NLCard && window.NLCard.set('d')); await wait(500);
  await A.evaluate((id) => document.querySelector('[data-id="' + id + '"]').scrollIntoView(), bDue); await A.screenshot({ path: CFG.OUT + '/amici-libreria-amico.png' });
  await A.evaluate(() => window.NLCard && window.NLCard.set('attuale')); await wait(300);
  await A.click('[data-id="' + bDue + '"] .cv-guest [data-g="ask"]'); await wait(700);
  assert.strictEqual(DB.rq.length, 1, 'richiesta mandata'); assert(/Richiesta mandata/.test(await A.$eval('[data-id="' + bDue + '"] .cv-guest', x => x.innerText)));
  await A.evaluate(() => window.NLSocial.run(false)); await wait(400);
  assert.strictEqual(DB.libriPosts, posts0, 'nessuna sincronizzazione mentre guarda la libreria di Bruno');
  assert.deepStrictEqual(await A.saved(), mineBefore, 'i suoi libri salvati non cambiano');
  // un altro libro di B nei desideri di A (dalla sua libreria)
  await A.click('#guestBar [data-g="notmine"]'); await wait(300);
  const gatt = await A.evaluate(() => window.NL.books().find(b => /Gattopardo/.test(b.t)).id);
  await A.openRow(gatt); await wait(400);
  assert(/Ce l.hai anche tu/.test(await A.$eval('[data-id="' + gatt + '"] .cv-guest', x => x.innerText)));
  await A.click('#guestBar [data-g="back"]'); await wait(500);
  assert.strictEqual(await A.evaluate(() => window.NL.guest()), null);
  assert.deepStrictEqual(await A.titles(), ['Il Gattopardo', 'Il giardino dei Finzi-Contini (D)'], 'tornata: i suoi libri');
  // ---- B: avviso «Me lo presti?» → Presta ----
  await B.evaluate(() => window.NLAmici.load(true)); await wait(700);
  t = await B.$eval('#friAsk', x => x.hidden ? '' : x.innerText.replace(/\s+/g, ' ')); console.log('[richiesta]', t);
  assert(/Anna: «Il giardino dei Finzi-Contini»/.test(t));
  await B.click('#friAskYes'); await wait(1200);
  assert.strictEqual(DB.rq[0].stato, 'accettata'); const sw = DB.sw[0];
  assert(sw && sw.tipo === 'prestito' && sw.da === 'uB' && sw.a === 'uA', 'prestito partito');
  assert.strictEqual((await B.evaluate((id) => window.NL.books().find(b => b.id === id).p, bDue)), 'Anna', 'da B: prestato ad Anna');
  await B.openRow(bDue); await wait(400);
  assert(/È tornato: segna restituito/.test(await B.$eval('[data-id="' + bDue + '"]', x => x.innerText)), 'pulsante chiaro per la restituzione');
  const copia = await B.add({ t: 'Il giardino dei Finzi-Contini', a: 'Giorgio Bassani', i: '9788807900358' });
  assert(!/Doppione/.test(await B.$eval('[data-id="' + copia + '"]', x => x.innerText)), 'il libro prestato non è un doppione da unire');
  await B.evaluate((id) => { const L = window.NL.books(); L.splice(L.findIndex(b => b.id === id), 1); window.NL.save(); window.NL.refresh(); }, copia);
  await A.evaluate(() => window.NLAmici.load(true)); await wait(800);
  assert(await A.evaluate(() => window.NL.books().some(b => b.sk === 'p' && b.sda === 'Bruno' && /Finzi/.test(b.t) && !b.w)), 'A lo trova in Libreria');
  assert(!(await A.$('#friGot')), 'niente riquadro in cima: la novità è nella campanella');
  assert.strictEqual(await A.$eval('#btnBellN', x => x.hidden ? '' : x.textContent), '1', 'campanella: 1 nuova');
  await A.click('#btnBell'); await wait(500);
  t = await A.$eval('#ntBody', x => x.innerText.replace(/\s+/g, ' ')); assert(/Bruno ti ha prestato «Il giardino dei Finzi-Contini»/.test(t), 'il prestito nella campanella: ' + t);
  assert(await A.$eval('#btnBellN', x => x.hidden), 'aperta: segnate lette');
  await A.click('#ntBody [data-n]'); await wait(600);
  const lid = await A.evaluate(() => window.NL.books().find(b => b.sk === 'p').id);
  assert(await A.$('.row.open[data-id="' + lid + '"]'), 'toccando l\'avviso si apre la scheda del libro');
  assert(/L.ho restituito/.test(await A.$eval('.row.open[data-id="' + lid + '"]', x => x.innerText)), 'pulsante «L\'ho restituito»');
  // ---- consiglio: B lo consiglia ad A dalla condivisione ----
  await B.evaluate((id) => window.__app.openShare([window.NL.get(id)], { kind: 'book' }), bDue); await wait(400);
  assert(await B.$eval('#shareExt', x => !x.open), 'il link è in seconda fila');
  await B.screenshot({ path: CFG.OUT + '/amici-condividi.png' });
  await B.click('#shareFriBox [data-share="uA"]'); await B.click('#shareAppGo'); await wait(700);
  assert.strictEqual(DB.tips.length, 1, 'consigliato');
  await wait(200);
  await A.evaluate(() => window.NLAmici.load(true)); await wait(600);
  assert(!(await A.$('#friTip')), 'niente riquadro del consiglio');
  await A.click('#btnBell'); await wait(500);
  assert(/Bruno ti consiglia «Il giardino dei Finzi-Contini»/.test(await A.$eval('#ntBody .nt-new', x => x.innerText)), 'consiglio nella campanella, evidenziato');
  await A.keyboard.press('Escape'); await wait(200);
  await A.click('#btnFri'); await wait(600);
  t = await A.$eval('#friBody', x => x.innerText.replace(/\s+/g, ' ')); assert(/Consigliati dagli amici 1/.test(t), 'tra i consigliati');
  assert(/Bruno 0 amici in comune · 1 libro in comune/.test(t), 'numeri accanto all\'amico');
  await A.screenshot({ path: CFG.OUT + '/amici-finestra.png' });
  await A.click('[data-f="tipdrop"]'); await wait(500); assert.strictEqual(DB.tips.length, 0, 'tolto');
  await A.keyboard.press('Escape'); await wait(200);
  // ---- chiave Google condivisa: la usano tutti e due ----
  await A.evaluate(() => { window.NL.settings.gbKey = 'AIzaChiaveDiAnna'; window.NL.saveSettings(); });
  await A.evaluate(() => window.NLAmici.open(true)); await wait(600);
  await A.click('[data-f="keyshare"][data-id="uB"]'); await wait(500);
  await A.screenshot({ path: CFG.OUT + '/amici-privacy.png' });
  assert.strictEqual(DB.keys.length, 1); assert.strictEqual(await A.evaluate(() => window.NL.settings.gbKey), 'AIzaChiaveDiAnna', 'A la tiene');
  await B.evaluate(() => window.NLAmici.load(true)); await wait(600);
  await B.evaluate(() => window.NLAmici.open(true)); await wait(600);
  assert(/Anna condivide con te la sua chiave Google/.test(await B.$eval('#friBody', x => x.innerText)));
  await B.click('[data-f="keyuse"]'); await wait(500);
  assert.strictEqual(await B.evaluate(() => window.NL.settings.gbKey), 'AIzaChiaveDiAnna', 'B la usa');
  await A.click('[data-f="keyshare"][data-id="uB"]'); await wait(500); assert.strictEqual(DB.keys.length, 0, 'A smette di condividerla');
  await B.evaluate(() => window.NLAmici.load(true)); await wait(600);
  assert.strictEqual(await B.evaluate(() => window.NL.settings.gbKey), '', 'B torna alle sue impostazioni');
  assert.deepStrictEqual(errors, []);
  console.log('e2e104 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
