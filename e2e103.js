const CFG = require("./_config");
const H = require('./_harness');
// moduli: social, amici   (senza questi file nell'app la prova si salta: vedi esegui.js)
// modulo «Amici»: libreria, desideri, prestiti e regali tra amici (Supabase finto). A (Anna) e B (Bruno) amici.
// B accende «Gli amici vedono la mia libreria»: A tocca Bruno e la vede nella schermata principale (barra con libri in comune e letti di recente;
// mai le note), nei suoi desideri apre la scheda e «Te lo regalo io», poi torna alla sua libreria intatta;
// B accende «Gli amici vedono i miei desideri»; A apre la pagina di B, vede i desideri e «Te lo regalo io» (prenotazione);
// A presta un libro a B scegliendolo tra gli amici in «Presta, vendi o regala»: dopo «Annulla» non parte niente, dopo «Salva» sì;
// B lo trova subito nella sua Libreria con «Prestato da Anna» e l'avviso in cima; B tocca «Prestato da Anna» › Restituito:
// «da confermare» (B non chiude da solo); A riceve l'avviso: «Non ancora» → per B torna «Prestato da Anna»; di nuovo, A «Confermo»
// → da B «Restituito ad Anna» (storico), da A il prestito sparisce; A regala a B un libro che era tra i desideri di B:
// da B passa dai Desideri alla Libreria con «Regalato da Anna», la prenotazione sparisce; la pagina dell'amico non esce di lato a 360 px
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm' };
let clock = Date.parse('2026-11-16T10:00:00Z'); const now = () => new Date(clock += 1000).toISOString();
const DB = { prof: { uA: { utente: 'Anna', nome: 'Anna', desideri: false, libreria: false }, uB: { utente: 'Bruno', nome: 'Bruno', desideri: false, libreria: false } },
  am: [{ da: 'uA', a: 'uB', stato: 'amici', creato: now() }], rows: {}, sw: [], pren: {}, n: 0 };
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
  if (p === '/rest/v1/libri' && req.method === 'POST') { for (const x of body) DB.rows[me + '|' + x.id] = Object.assign({ utente: me, cancellato: false }, DB.rows[me + '|' + x.id] || {}, x, { aggiornato: now() }); return send(201); }
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
}).listen(CFG.port(8303));
const base = 'http://localhost:' + CFG.port(8303);
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
    page.add = (o) => page.evaluate((o) => { const b = window.NL.clean(o); window.NL.books().unshift(b); window.NL.save(); window.NL.refresh(); return b.id; }, o);
    return page;
  }
  // ---- B: due desideri (uno con ISBN), sincronizzati; accende «Gli amici vedono i miei desideri» ----
  const B = await phone('B', 'uB', 360);
  await B.add({ t: 'Il nome della rosa', a: 'Umberto Eco', i: '9788845292613', w: true });
  await B.add({ t: 'Lessico famigliare', a: 'Natalia Ginzburg', w: true });
  await B.add({ t: 'Il deserto dei Tartari', a: 'Dino Buzzati', i: '9788804668015', rs: 'ok', rt: 5, n: 'nota segreta' });
  await B.evaluate(() => window.NLSocial.run(false)); await wait(500);
  assert.strictEqual(Object.values(DB.rows).filter(r => r.utente === 'uB' && r.dati.w === true).length, 2, 'desideri di B online');
  await B.evaluate(() => window.NLAmici.open(true)); await wait(700);
  assert(!(await B.$eval('#friWish', x => x.checked)), 'desideri nascosti di partenza');
  await B.click('#friWish'); await wait(500);
  assert.strictEqual(DB.prof.uB.desideri, true, 'B mostra i desideri');
  assert(!(await B.$eval('#friLib', x => x.checked)), 'libreria nascosta di partenza');
  await B.click('#friLib'); await wait(500); assert.strictEqual(DB.prof.uB.libreria, true, 'B mostra la libreria');
  await B.keyboard.press('Escape'); await wait(200);
  // ---- A: tocca Bruno → la sua libreria nella schermata principale (sola lettura), desideri, «Te lo regalo io» ----
  const A = await phone('A', 'uA');
  await A.add({ t: 'Il deserto dei Tartari', a: 'Dino Buzzati', i: '9788804668015' });
  await A.click('#btnFri'); await wait(700);
  await A.click('[data-f="friend"]'); await wait(900);                  // dal giro 6 il nome apre il profilo: da lì «Libreria»
  if (await A.$('#profBody [data-p="lib"]')) { await A.click('#profBody [data-p="lib"]'); await wait(1200); }
  assert.strictEqual(await A.evaluate(() => window.NL.guest()), 'Bruno', 'libreria di Bruno aperta');
  let t = await A.$eval('#guestBar', x => x.innerText.replace(/\s+/g, ' ')); console.log('[barra di Bruno]', t);
  assert(/0 amici in comune · 1 libro in comune/.test(t) && /Letti di recente «Il deserto dei Tartari» Capolavoro/.test(t), 'barra in cima');
  assert(/Libreria di Bruno/.test(await A.$eval('#owner', x => x.textContent)));
  t = await A.$eval('#list', x => x.innerText.replace(/\s+/g, ' ')); assert(/Il deserto dei Tartari/.test(t) && !/nota segreta/.test(await A.evaluate(() => document.body.innerText)), 'la sua libreria, mai le note');
  await A.evaluate(() => window.__app.setTab('wish')); await wait(400);
  t = await A.$eval('#list', x => x.innerText.replace(/\s+/g, ' ')); assert(/Il nome della rosa/.test(t) && /Lessico famigliare/.test(t), 'i suoi desideri');
  const rosa = Object.values(DB.rows).find(r => r.dati.i === '9788845292613').id;
  await A.evaluate((id) => document.querySelector('[data-id="' + id + '"] .sum').click(), rosa); await wait(500);
  await A.click('[data-id="' + rosa + '"] .cv-guest [data-g="gift"]'); await wait(700);
  assert.strictEqual(DB.pren['uB|' + rosa], 'uA', 'prenotato da A'); assert(/Lo regali tu/.test(await A.$eval('[data-id="' + rosa + '"] .cv-guest', x => x.innerText)));
  await A.screenshot({ path: CFG.OUT + '/amici-desideri.png' });
  await A.evaluate(() => window.NL.guestExit());   // «‹ La tua libreria» tolto (17/11/2026 notte)
  await wait(500);
  assert.strictEqual(await A.evaluate(() => window.NL.guest()), null, 'tornata alla sua libreria');
  assert.deepStrictEqual(await A.evaluate(() => window.NL.books().map(b => b.t)), ['Il deserto dei Tartari'], 'i suoi libri, intatti');
  // ---- A presta un libro a B: prima «Annulla» (non parte niente), poi davvero ----
  const zeno = await A.add({ t: 'La coscienza di Zeno', a: 'Italo Svevo', i: '9788807900891', c: 12 });
  await A.evaluate((id) => window.__app.openLoan(id), zeno); await wait(400);
  assert(await A.$eval('#loanFri', x => !x.hidden), 'amici da scegliere in «Presta»');
  await A.click('#loanFri [data-u="uB"]'); await wait(200);
  assert.strictEqual(await A.$eval('#loanWho', x => x.value), 'Bruno'); assert(/Bruno lo vedrà nella sua app/.test(await A.$eval('#loanFri', x => x.innerText)));
  await A.screenshot({ path: CFG.OUT + '/amici-presta.png' });
  await A.click('#loanSave'); await wait(400); await A.click('#toastBtn'); await wait(5000);
  assert.strictEqual(DB.sw.length, 0, 'Annulla: nessun prestito partito');
  await A.evaluate((id) => window.__app.openLoan(id), zeno); await wait(300);
  await A.click('#loanFri [data-u="uB"]'); await A.click('#loanSave'); await wait(5200);
  assert.strictEqual(DB.sw.length, 1, 'prestito partito'); const sw1 = DB.sw[0];
  assert(sw1.tipo === 'prestito' && sw1.a === 'uB' && sw1.libro.t === 'La coscienza di Zeno' && sw1.libro.c === undefined, 'prestito ad B, senza prezzo');
  assert.strictEqual((await A.book("b.id==='" + zeno + "'")).sx, sw1.id, 'A ricorda il prestito');
  // ---- B: il libro compare nella sua Libreria con «Prestato da Anna» e l'avviso in cima ----
  await B.evaluate(() => window.NLAmici.load(true)); await wait(800);
  let bz = await B.book("b.sx==='" + sw1.id + "'"); console.log('[B ricevuto]', JSON.stringify(bz && { t: bz.t, w: bz.w, sk: bz.sk, sda: bz.sda }));
  assert(bz && !bz.w && bz.sk === 'p' && bz.sda === 'Anna' && bz.i === '9788807900891', 'nella Libreria di B');
  assert(sw1.visto, 'segnato come visto');
  assert(!(await B.$('#friGot')), 'niente riquadro in cima: il prestito arriva nella campanella');
  assert(/Prestato da Anna/.test(await B.$eval('[data-id="' + bz.id + '"]', x => x.innerText)), 'etichetta sul libro');
  await B.evaluate(() => window.NLAmici.load(true)); await wait(500);
  assert.strictEqual((await B.evaluate(() => window.NL.books().filter(b => b.t === 'La coscienza di Zeno').length)), 1, 'una volta sola');
  await B.screenshot({ path: CFG.OUT + '/amici-ricevuto.png' });
  // B dice «Restituito»: da confermare, non si chiude da solo (il libro va al centro: in fondo lo copre la barra «Scansiona»)
  const restituisci = async () => { await B.$eval('[data-id="' + bz.id + '"] [data-act="recv"]', e => e.scrollIntoView({ block: 'center' })); await B.click('[data-id="' + bz.id + '"] [data-act="recv"]'); await wait(300); await B.click('#recvYes'); await wait(600); };
  await B.$eval('[data-id="' + bz.id + '"] [data-act="recv"]', e => e.scrollIntoView({ block: 'center' })); await B.click('[data-id="' + bz.id + '"] [data-act="recv"]'); await wait(300);
  assert(/Hai restituito «La coscienza di Zeno» ad Anna\?/.test(await B.$eval('#recvTxt', x => x.textContent)) && /Anna dovrà confermare/.test(await B.$eval('#recvSub', x => x.textContent)));
  await B.click('#recvYes'); await wait(600);
  assert.strictEqual(sw1.stato, 'reso', 'online: da confermare'); bz = await B.book("b.id==='" + bz.id + "'"); assert(bz.sk === 'q' && !bz.xs, 'da B: in attesa');
  assert(/Restituito ad Anna · da confermare/.test(await B.$eval('[data-id="' + bz.id + '"]', x => x.innerText)));
  // A: avviso; «Non ancora» → per B torna «Prestato da Anna»
  await A.evaluate(() => window.NLAmici.load(true)); await wait(600);
  assert(/Bruno dice di averti restituito «La coscienza di Zeno»/.test(await A.$eval('#friRet', x => x.hidden ? '' : x.innerText)), 'avviso per chi ha prestato');
  await A.screenshot({ path: CFG.OUT + '/amici-reso.png' });
  await A.click('#friRetNo'); await wait(500);
  assert.strictEqual(sw1.stato, 'aperto'); assert(await A.$eval('#friRet', x => x.hidden), 'avviso tolto');
  await B.evaluate(() => window.NLAmici.load(true)); await wait(600);
  assert.strictEqual((await B.book("b.id==='" + bz.id + "'")).sk, 'p', 'da B: di nuovo «Prestato da Anna»');
  // di nuovo; A conferma
  await restituisci(); assert.strictEqual(sw1.stato, 'reso');
  await A.evaluate(() => window.NLAmici.load(true)); await wait(600);
  await A.click('#friRetYes'); await wait(600);
  assert.strictEqual(sw1.stato, 'chiuso', 'chiuso da chi ha prestato');
  const az = await A.book("b.id==='" + zeno + "'"); assert(!az.p && !az.sx, 'da A: non più in prestito');
  await B.evaluate(() => window.NLAmici.load(true)); await wait(600);
  bz = await B.book("b.id==='" + bz.id + "'"); assert(bz.xs === 'b' && bz.xa === 'Anna', 'da B: restituito (storico)');
  assert(/Restituito ad Anna/.test(await B.$eval('[data-id="' + bz.id + '"]', x => x.innerText)));
  // ---- A regala a B il libro che B desiderava: da B passa dai Desideri alla Libreria, la prenotazione sparisce ----
  const rosaA = await A.add({ t: 'Il nome della rosa', a: 'Umberto Eco', i: '9788845292613' });
  await A.evaluate((id) => window.__app.openLoan(id, 'r'), rosaA); await wait(300);
  await A.click('#loanFri [data-u="uB"]'); await A.click('#loanSave'); await wait(5200);
  const sw2 = DB.sw[1]; assert(sw2 && sw2.tipo === 'regalo', 'regalo partito'); assert(!DB.pren['uB|' + rosa], 'prenotazione tolta');
  await B.evaluate(() => window.NLAmici.load(true)); await wait(800);
  const br = await B.book("b.i==='9788845292613'");
  assert(br && !br.w && br.sk === 'r' && br.sda === 'Anna', 'da B: dai Desideri alla Libreria, «Regalato da Anna»');
  assert.strictEqual(await B.evaluate(() => window.NL.books().filter(b => b.i === '9788845292613').length), 1, 'nessun doppione');
  // pagina dell'amico a 360 px: niente scorrimento di lato
  await B.evaluate(() => window.NLAmici.friend('uA')); await wait(700);
  t = await B.body(); assert(/Ti ha regalato «Il nome della rosa»/.test(t) && /Guarda la sua libreria/.test(t), 'prestiti e regali con Anna, visti da B');
  const side = await B.evaluate(() => { const si = document.querySelector('#friSheet .sheet-in'); return si.scrollWidth - si.clientWidth; });
  assert(side <= 0, 'la pagina dell\'amico non esce di lato (' + side + ')');
  assert.deepStrictEqual(errors, []);
  console.log('e2e103 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
