const CFG = require("./_config");
const H = require('./_harness');
// moduli: social, amici   (senza questi file nell'app la prova si salta: vedi esegui.js)
// Desideri e libreria di un amico (17/11/2026, richiesta di Piero; Supabase finto). A (Anna), B (Bruno), C (Carla) amici.
// «Aggiungi ai miei desideri» è un'icona in alto nella scheda (come «Libreria» nei propri Desideri), anche nella sua libreria;
// accesa se il libro è già nei tuoi desideri (tocco = lo togli, con «Annulla»); niente icona se ce l'hai. «Desiderio di Bruno».
// Impostazioni › Amici e privacy: «Gli amici vedono i regali che prenoto», accesa di partenza; se chi regala la spegne, gli altri
// vedono solo «Regalo prenotato». Niente scorrimento di lato a 360 e 1280. SCHERMATE=cartella per le fotografie.
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm' };
let clock = Date.parse('2026-11-16T10:00:00Z'); const now = () => new Date(clock += 1000).toISOString();
const DB = { prof: { uA: { utente: 'Anna', nome: 'Anna', desideri: false, libreria: false }, uB: { utente: 'Bruno', nome: 'Bruno', desideri: false, libreria: false }, uC: { utente: 'Carla', nome: 'Carla', desideri: false, libreria: false } },
  am: [{ da: 'uA', a: 'uB', stato: 'amici', creato: now() }, { da: 'uC', a: 'uB', stato: 'amici', creato: now() }, { da: 'uA', a: 'uC', stato: 'amici', creato: now() }], rows: {}, sw: [], pren: {}, n: 0 };
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
  if (p === '/rest/v1/profili' && req.method === 'GET') { const pr = DB.prof[me]; return send(200, [{ utente: pr.utente, nome: pr.nome, desideri: pr.desideri, libreria: pr.libreria, regali: pr.regali !== false }]); }
  if (p === '/rest/v1/profili') { ['desideri', 'libreria', 'regali'].forEach(k => { if (body[k] !== undefined) DB.prof[me][k] = body[k]; }); if (body.utente) Object.assign(DB.prof[me], { utente: body.utente, nome: body.utente }); return send(201); }
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
      const pr = DB.pren[o + '|' + x.id]; return { id: x.id, t: x.dati.t, a: x.dati.a, i: x.dati.i, prenotato: !pr ? '' : pr === me ? 'io' : DB.prof[pr].regali === false ? '' : DB.prof[pr].utente, preso: !!pr }; }) });
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
}).listen(CFG.port(8311));
const base = 'http://localhost:' + CFG.port(8311);
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
  const SHOTS = process.env.SCHERMATE;
  // ---- A: nei desideri di Bruno, icona «Desideri» in alto, «Desiderio di Bruno», regalo prenotato con o senza nome ----
  const A = await phone('A', 'uA');
  await A.evaluate(() => window.NLCard && window.NLCard.set('d')); await wait(500);   // la scheda che vede Piero sul telefono: «Pagina del libro»
  const rosa = Object.values(DB.rows).find(r => r.dati.i === '9788845292613').id;
  const lessico = Object.values(DB.rows).find(r => r.dati.t === 'Lessico famigliare').id;
  DB.pren['uB|' + lessico] = 'uC';                       // Carla ha già prenotato «Lessico famigliare» (nome visibile, di partenza)
  await A.evaluate(() => window.NLAmici.open(true)); await wait(700);
  assert(await A.$eval('#friRegali', x => x.checked), '«Gli amici vedono i regali che prenoto» accesa di partenza');
  if (SHOTS) await A.screenshot({ path: SHOTS + '/regali-impostazioni-412.png', fullPage: false });
  await A.keyboard.press('Escape'); await wait(200);
  await A.evaluate(() => window.NLAmici.guest('uB')); await wait(900);
  assert.strictEqual(await A.evaluate(() => window.NL.guest()), 'Bruno');
  await A.evaluate(() => window.__app.setTab('wish')); await wait(400);
  await A.openRow(rosa); await wait(500);
  const sel = '[data-id="' + rosa + '"]';
  let t = await A.$eval(sel + ' .cv-guest', x => x.innerText.replace(/\s+/g, ' ')); console.log('[scheda]', t);
  assert(/^Desiderio di Bruno/.test(t), '«Desiderio di Bruno»'); assert(!/Aggiungi ai miei desideri/.test(t), 'il pulsante grande non c\'è più');
  assert(/gli altri amici vedono il tuo nome/.test(t), 'testo con la scelta accesa');
  const vis = (s) => A.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; }, s);
  assert(await vis(sel + ' .acts-main .g-wish'), 'icona «Desideri» in alto');
  assert(!(await vis(sel + ' .acts-main [data-act="del"]')) && !(await vis(sel + ' .acts-main [data-act="tolib"]')), 'le altre azioni restano nascoste');
  assert(await A.$eval(sel + ' .g-wish', x => !!x.closest('.cv-page > .acts-main')), 'tra i tasti tondi sotto il titolo');   // restyle pezzo 2: pagina intera
  if (SHOTS) await A.screenshot({ path: SHOTS + '/regali-scheda-412.png' });
  // tocco: nei miei desideri; icona accesa; tocco di nuovo: tolto (con «Annulla»)
  await A.click(sel + ' .g-wish'); await wait(500);
  assert.strictEqual(await A.evaluate(() => window.NL.myBooks().filter(b => b.w && b.t === 'Il nome della rosa').length), 1, 'aggiunto ai miei desideri');
  assert(await A.$eval(sel + ' .g-wish', x => x.classList.contains('on') && x.getAttribute('aria-pressed') === 'true'), 'icona accesa');
  await A.click(sel + ' .g-wish'); await wait(500);
  assert.strictEqual(await A.evaluate(() => window.NL.myBooks().filter(b => b.w && b.t === 'Il nome della rosa').length), 0, 'tolto dai miei desideri');
  assert(!(await A.$eval(sel + ' .g-wish', x => x.classList.contains('on'))), 'icona spenta');
  assert(/Tolto dai tuoi desideri/.test(await A.evaluate(() => document.body.innerText)), 'avviso con Annulla');
  await A.evaluate(() => { const b = [...document.querySelectorAll('.toast button, #toast button')].find(x => /Annulla/.test(x.textContent)); b && b.click(); }); await wait(500);
  assert.strictEqual(await A.evaluate(() => window.NL.myBooks().filter(b => b.w && b.t === 'Il nome della rosa').length), 1, '«Annulla» lo rimette');
  // «Te lo regalo io»
  await A.click(sel + ' .cv-guest [data-g="gift"]'); await wait(700);
  assert.strictEqual(DB.pren['uB|' + rosa], 'uA'); assert(/Lo regali tu/.test(await A.$eval(sel + ' .cv-guest', x => x.innerText)));
  // «Lessico famigliare», prenotato da Carla: col nome se Carla lo permette, altrimenti «Regalo prenotato»
  await A.openRow(lessico); await wait(500);
  t = await A.$eval('[data-id="' + lessico + '"] .cv-guest', x => x.innerText.replace(/\s+/g, ' '));
  assert(/Lo regala Carla/.test(t) && !/non vede chi/.test(t), 'prenotato da Carla, nome visibile: ' + t);
  DB.prof.uC.regali = false;
  await A.evaluate(() => window.NLAmici.guest('uB')); await wait(900); await A.evaluate(() => window.__app.setTab('wish')); await wait(400);
  await A.openRow(lessico); await wait(500);
  t = await A.$eval('[data-id="' + lessico + '"] .cv-guest', x => x.innerText.replace(/\s+/g, ' '));
  assert(/Regalo prenotato/.test(t) && !/Carla/.test(t) && !(await A.$('[data-id="' + lessico + '"] [data-g="gift"]')), 'Carla nascosta: ' + t);
  if (SHOTS) await A.screenshot({ path: SHOTS + '/regali-prenotato-412.png' });
  // nella libreria di Bruno: «Di Bruno» e la stessa icona; «Ce l'hai anche tu» senza icona
  await A.evaluate(() => window.__app.setTab('lib')); await wait(400);
  const tart = Object.values(DB.rows).find(r => r.utente === 'uB' && r.dati.t === 'Il deserto dei Tartari').id;
  await A.openRow(tart); await wait(500);
  t = await A.$eval('[data-id="' + tart + '"] .cv-guest', x => x.innerText.replace(/\s+/g, ' '));
  assert(/^Di Bruno/.test(t), '«Di Bruno» nella libreria'); assert(await vis('[data-id="' + tart + '"] .g-wish'), 'icona anche nella libreria');
  await A.evaluate(() => window.NL.guestExit()); await wait(500);
  await A.add({ t: 'Il deserto dei Tartari', a: 'Dino Buzzati', i: '9788804668015' });
  await A.evaluate(() => window.NLAmici.guest('uB')); await wait(900);
  await A.openRow(tart); await wait(500);
  assert(/Ce l.hai anche tu/.test(await A.$eval('[data-id="' + tart + '"] .cv-guest', x => x.innerText)) && !(await A.$('[data-id="' + tart + '"] .g-wish')), 'ce l\'ha: niente icona');
  await A.evaluate(() => window.NL.guestExit()); await wait(500);
  // A spegne la scelta: salvata; il testo cambia
  await A.evaluate(() => window.NLAmici.open(true)); await wait(700);
  await A.click('#friRegali'); await wait(500);
  assert.strictEqual(DB.prof.uA.regali, false, 'A spegne «Gli amici vedono i regali che prenoto»');
  await A.keyboard.press('Escape'); await wait(200);
  await A.evaluate(() => window.NLAmici.guest('uB')); await wait(900); await A.evaluate(() => window.__app.setTab('wish')); await wait(400);
  await A.openRow(rosa); await wait(500);
  assert(/gli altri amici vedono solo «Regalo prenotato»/.test(await A.$eval(sel + ' .cv-guest', x => x.innerText.replace(/\s+/g, ' '))), 'testo con la scelta spenta');
  // a 360 px e su PC: niente scorrimento di lato
  for (const w of [360, 1280]) {
    await A.setViewport({ width: w, height: 900, deviceScaleFactor: 1, isMobile: true, hasTouch: true }); await wait(400);
    const side = await A.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(side <= 0, 'niente scorrimento di lato a ' + w + ' (' + side + ')');
    if (SHOTS) { await A.evaluate((s) => { const e = document.querySelector(s); if (e) e.scrollIntoView({ block: 'start' }); }, sel); await wait(200); await A.screenshot({ path: SHOTS + '/regali-scheda-' + w + '.png' }); }
  }
  assert.deepStrictEqual(errors, []);
  console.log('e2e111 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
