const CFG = require("./_config");
// copia social, modulo «Account e sincronizzazione» (social.js) con un Supabase finto sullo stesso server:
// voce nel Menu, accesso con email e codice (codice sbagliato → messaggio), copia di sicurezza prima della prima sincronizzazione,
// due telefoni con lo stesso account (libri che passano da uno all'altro, modifiche, cancellazioni «morbide» che lasciano i dati online),
// email spenta (CFG.email falso, come nell'app vera): solo Google, oppure un messaggio se Google è spento,
// «Entra con Google» solo se acceso in Supabase: pulsante ufficiale di Google con il Client ID (token alla pagina, nonce), altrimenti riserva via Supabase (ritorno con i token), accesso dal link dell'email (token dopo il #, poi tolti dall'indirizzo; link scaduto → messaggio), nessun caricamento inutile quando non cambia niente, conflitto (vince il telefono che ha modificato), uscita, ripristino della copia
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.gz': 'application/gzip', '.wasm': 'application/wasm' };
// ---- Supabase finto: utenti per email, righe per (utente, id), ora del server sempre crescente ----
const DB = { users: {}, rows: {}, posts: 0, otp: 0 }; let clock = Date.parse('2026-11-16T10:00:00Z');
const now = () => new Date(clock += 1000).toISOString();
const uidOf = (req) => { const m = /Bearer AT-(\w+)/.exec(req.headers.authorization || ''); return m ? m[1] : null; };
function fake(req, res, body, url) {
  const send = (st, j) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(j === undefined ? '' : JSON.stringify(j)); };
  const p = url.pathname.replace(/^\/finto/, ''), q = url.searchParams;
  if (p === '/auth/v1/authorize') {                                   // Google finto: crea l'utente e torna all'app con i token dopo il #
    if (q.get('provider') !== 'google' || !DB.google) return send(400, { msg: 'Unsupported provider: provider is not enabled' });
    const em = 'amica@gmail.example', id = DB.users[em] || (DB.users[em] = 'u' + Object.keys(DB.users).length); DB.gUser = id;
    res.writeHead(302, { Location: q.get('redirect_to') + '#access_token=AT-' + id + '&expires_in=3600&provider_token=pt&refresh_token=RT-' + id + '&token_type=bearer' }); return res.end();
  }
  if (req.headers.apikey !== 'chiave-finta') return send(401, { message: 'no api key' });
  if (p === '/auth/v1/settings') return send(200, { external: { google: !!DB.google, email: true }, mailer_autoconfirm: false });
  if (p === '/auth/v1/otp') { DB.otp++; DB.redirect = q.get('redirect_to'); return send(200, {}); }
  if (p === '/auth/v1/verify') {
    if (body.token !== '123456') return send(403, { msg: 'Token has expired or is invalid' });
    const id = DB.users[body.email] || (DB.users[body.email] = 'u' + Object.keys(DB.users).length);
    return send(200, { access_token: 'AT-' + id, refresh_token: 'RT-' + id, expires_in: 3600, user: { id, email: body.email } });
  }
  if (p === '/auth/v1/token' && q.get('grant_type') === 'id_token') {      // token del pulsante ufficiale di Google: «IDT-email.impronta del nonce»
    const m = /^IDT-([^.]+@[^.]+\.[a-z]+)\.([0-9a-f]{64})$/.exec(body.id_token || '');
    if (body.provider !== 'google' || !m) return send(400, { msg: 'Bad ID token' });
    if (crypto.createHash('sha256').update(String(body.nonce || '')).digest('hex') !== m[2]) return send(400, { msg: 'Nonces mismatch' });
    const id = DB.users[m[1]] || (DB.users[m[1]] = 'u' + Object.keys(DB.users).length); DB.gisUser = id;
    return send(200, { access_token: 'AT-' + id, refresh_token: 'RT-' + id, expires_in: 3600, user: { id, email: m[1], user_metadata: { full_name: 'Bruno Verdi' } } });
  }
  if (p === '/auth/v1/token') { const id = String(body.refresh_token || '').slice(3); return send(200, { access_token: 'AT-' + id, refresh_token: 'RT-' + id, expires_in: 3600, user: { id } }); }
  if (p === '/auth/v1/logout') return send(204);
  const uid = uidOf(req); if (!uid) return send(401, { message: 'JWT' });
  if (p === '/auth/v1/user') return send(200, { id: uid, email: Object.keys(DB.users).find(e => DB.users[e] === uid), user_metadata: uid === DB.gUser ? { full_name: 'Anna Rossi' } : {} });
  if (p === '/rest/v1/profili' && req.method === 'GET') return send(200, [{ utente: null, nome: (DB.prof || {})[uid] || '' }]);   // letto da amici.js
  if (p === '/rest/v1/profili') { DB.prof = DB.prof || {}; DB.prof[uid] = body.nome; return send(201); }
  if (p.startsWith('/rest/v1/rpc/')) return send(200, []);
  if (p === '/rest/v1/rpc/elimina_account') { Object.keys(DB.rows).filter(k => k.startsWith(uid + '|')).forEach(k => delete DB.rows[k]); return send(204); }
  if (p === '/rest/v1/libri' && req.method === 'GET') {
    const gt = (q.get('aggiornato') || '').replace(/^gt\./, '');
    let r = Object.values(DB.rows).filter(x => x.utente === uid && (!gt || x.aggiornato > gt)).sort((a, b) => a.aggiornato < b.aggiornato ? -1 : a.aggiornato > b.aggiornato ? 1 : a.id < b.id ? -1 : 1);
    const off = +q.get('offset') || 0, lim = +q.get('limit') || 1000;
    return send(200, r.slice(off, off + lim).map(x => ({ id: x.id, dati: x.dati, cancellato: x.cancellato, aggiornato: x.aggiornato })));
  }
  if (p === '/rest/v1/libri' && req.method === 'POST') {
    DB.posts++;
    for (const x of body) {
      if (x.utente !== uid) return send(403, { message: 'new row violates row-level security policy' });
      const k = uid + '|' + x.id, old = DB.rows[k] || { utente: uid, id: x.id, dati: {}, cancellato: false };
      DB.rows[k] = Object.assign({}, old, x, { aggiornato: now() });
    }
    return send(201);
  }
  if (p === '/rest/v1/libri' && req.method === 'DELETE') { Object.keys(DB.rows).filter(k => k.startsWith(uid + '|')).forEach(k => delete DB.rows[k]); return send(204); }
  send(404, { message: 'finto: ' + p });
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/finto/')) { let b = ''; req.on('data', c => b += c); req.on('end', () => { let j = {}; try { j = b ? JSON.parse(b) : {}; } catch (e) {} fake(req, res, j, url); }); return; }
  const p = decodeURIComponent(url.pathname), m = p.match(/^\/next-libris-social(\/.*)?$/);
  if (!m) { res.writeHead(404); return res.end(); }
  if (!m[1]) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
  const f = path.join(ROOT, m[1] === '/' ? '/index.html' : m[1]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
}).listen(CFG.port(8300));
const base = 'http://localhost:' + CFG.port(8300);
const rows = (email) => Object.values(DB.rows).filter(x => x.utente === DB.users[email]);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const GIS = "window.google={accounts:{id:{initialize:function(o){window.__gis=o;},renderButton:function(el,opt){window.__gisOpt=opt;var b=document.createElement('button');b.type='button';b.id='gisFinto';b.textContent='Accedi con Google';b.onclick=function(){window.__gis.callback({credential:'IDT-bruno@esempio.it.'+window.__gis.nonce});};el.appendChild(b);}}}};";
  async function phone(name, gClient, gisFail, noEmail) {                              // un «telefono»: contesto separato, memoria tutta sua
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    await page.evaluateOnNewDocument((u, g, em) => { window.NL_SOCIAL = { url: u, key: 'chiave-finta', gClient: g || '', email: em }; }, base + '/finto', gClient || '', !noEmail);   // l'email nell'app vera e' spenta (CFG.email); qui si accende per provare il codice che resta
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith('https://accounts.google.com/gsi/client') ? r.respond(gisFail ? { status: 404, body: '' } : { status: 200, contentType: 'text/javascript', body: GIS }) : r.url().startsWith(base) ? r.continue() : r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"totalItems":0}' }));
    await page.goto(base + '/next-libris-social/?vista=elenco', { waitUntil: 'load' }); await wait(800);
    page.books = () => page.evaluate(() => window.__app.state.books.map(b => b.i || b.t).sort());
    page.add = async (...l) => { await page.evaluate((x) => { window.__app.settings.price = false; x.forEach(i => window.__app.addIsbn(i)); }, l); await wait(900); };
    page.sync = () => page.evaluate(() => window.NLSocial.run(false));
    page.st = () => page.evaluate(() => window.NLSocial.state());
    return page;
  }
  async function login(page, email, code) {
    await page.evaluate(() => { window.__app.openDrawer('opt'); const s = document.getElementById('setList'); if (s && s.hidden) document.getElementById('goSettings').click(); }); await wait(400);
    const t = await page.$eval('#goAcc', e => e.innerText); assert(/Account e sincronizzazione/.test(t) && /Salva i libri online/.test(t), 'voce nel Menu');
    await page.click('#goAcc'); await wait(400);
    assert(await page.$eval('#accSheet', e => !e.hidden));
    assert(!(await page.$('[data-acc="google"]')), 'Google spento in Supabase: niente pulsante');
    await page.type('#accMail', email); await page.click('#accSend'); await wait(500);
    await page.type('#accCode', code); await page.click('#accGo'); await wait(700);
  }
  // ---- telefono A: due libri, poi l'accesso (prima con il codice sbagliato) ----
  const A = await phone('A');
  await A.add('9788806219352', '9788804668015');
  await login(A, 'Lettore@Esempio.it', '000000');
  let e = await A.$eval('#accErr', x => x.hidden ? '' : x.textContent); console.log('[codice sbagliato]', e);
  assert(/Codice sbagliato o scaduto/.test(e));
  await A.$eval('#accCode', x => { x.value = ''; }); await A.type('#accCode', '123456'); await A.click('#accGo'); await wait(1500);
  let s = await A.st(); assert(s.auth && s.auth.email === 'lettore@esempio.it' && !s.err, 'entrato');
  assert.strictEqual(rows('lettore@esempio.it').length, 2, 'i due libri sono online');
  const txt = await A.$eval('#accBody', x => x.textContent.replace(/\s+/g, ' ')); console.log('[finestra]', txt.slice(0, 200));
  assert(/Sei entrato come lettore@esempio\.it/.test(txt) && /2 libri online/.test(txt) && /Ripristina la copia del .*\(2 libri\)/.test(txt), 'stato e copia di sicurezza');
  await A.screenshot({ path: CFG.OUT + '/account-dentro.png' });
  await A.keyboard.press('Escape'); await wait(200); assert(await A.$eval('#accSheet', x => x.hidden), 'Indietro/Esc chiude');
  // nessuna modifica: nessun caricamento
  let p0 = DB.posts; await A.sync(); assert.strictEqual(DB.posts, p0, 'niente da caricare');
  // modifica su A: si carica solo quel libro (anche da sola, dopo il salvataggio)
  await A.evaluate(() => { const b = window.__app.state.books.find(x => x.i === '9788806219352'); b.rt = 4; b.n = 'nota da A'; window.NL.save(); }); await wait(5500);
  let r1 = rows('lettore@esempio.it').find(x => x.id && x.dati.i === '9788806219352'); assert(r1.dati.rt === 4 && r1.dati.n === 'nota da A', 'modifica caricata da sola');
  assert.strictEqual(DB.posts, p0 + 1, 'un solo caricamento');
  // ---- telefono B: un suo libro, poi lo stesso account ----
  const B = await phone('B');
  await B.add('9788845292613');
  await login(B, 'lettore@esempio.it', '123456'); await wait(1200);
  console.log('[B dopo l\'accesso]', JSON.stringify(await B.books()));
  assert.deepStrictEqual(await B.books(), ['9788804668015', '9788806219352', '9788845292613']);
  assert(await B.evaluate(() => { const b = window.__app.state.books.find(x => x.i === '9788806219352'); return b.rt === 4 && b.n === 'nota da A'; }), 'B riceve anche la modifica');
  assert.strictEqual(rows('lettore@esempio.it').length, 3);
  await A.sync(); assert.deepStrictEqual(await A.books(), ['9788804668015', '9788806219352', '9788845292613'], 'A riceve il libro di B');
  // cancellazione su B: online resta con «cancellato» e i dati; A lo perde
  const gone = await B.evaluate(() => window.__app.state.books.find(x => x.i === '9788804668015').id);
  await B.evaluate((id) => { const L = window.__app.state.books; L.splice(L.findIndex(x => x.id === id), 1); window.NL.save(); window.NL.refresh(); }, gone);
  await B.sync();
  const rg = rows('lettore@esempio.it').find(x => x.id === gone); assert(rg.cancellato === true && rg.dati.i === '9788804668015', 'cancellazione morbida: i dati restano online');
  await A.sync(); assert.deepStrictEqual(await A.books(), ['9788806219352', '9788845292613'], 'A perde il libro cancellato');
  // conflitto: A e B cambiano lo stesso libro senza sincronizzare; sincronizza prima A, poi B (vince chi ha modificato: B), poi A riceve
  await A.evaluate(() => { const b = window.__app.state.books.find(x => x.i === '9788845292613'); b.sh = 'Scaffale A'; window.NL.save(); });
  await B.evaluate(() => { const b = window.__app.state.books.find(x => x.i === '9788845292613'); b.sh = 'Scaffale B'; window.NL.save(); });
  await A.sync(); await B.sync(); await A.sync();
  const shA = await A.evaluate(() => window.__app.state.books.find(x => x.i === '9788845292613').sh), shB = await B.evaluate(() => window.__app.state.books.find(x => x.i === '9788845292613').sh);
  console.log('[conflitto]', shA, '|', shB); assert(shA === 'Scaffale B' && shB === 'Scaffale B', 'alla fine uguali');
  // telefoni a posto: un altro giro non carica niente
  p0 = DB.posts; await A.sync(); await B.sync(); assert.strictEqual(DB.posts, p0, 'nessun caricamento a vuoto');
  // ---- telefono C: entra dal link dell'email (il servizio gratuito di Supabase manda il link, non il codice) ----
  assert.strictEqual(DB.redirect, base + '/next-libris-social/', 'il link dell\'email torna alla copia social');
  const C = await phone('C');
  await C.goto('about:blank');                                       // link scaduto: pagina aperta da zero; link buono: nella stessa scheda (hashchange)
  await C.goto(base + '/next-libris-social/?vista=elenco#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired', { waitUntil: 'load' }); await wait(1200);
  let tx = await C.evaluate(() => document.querySelector('.toast') ? document.querySelector('.toast').textContent : document.body.innerText);
  console.log('[toast]', tx); assert(/link dell.email è scaduto/.test(tx), 'link scaduto: messaggio'); assert(!/error_code/.test(await C.evaluate(() => location.href)), 'indirizzo pulito');
  await C.goto(base + '/next-libris-social/?vista=elenco#access_token=AT-' + DB.users['lettore@esempio.it'] + '&expires_at=9999999999&expires_in=3600&refresh_token=RT-' + DB.users['lettore@esempio.it'] + '&token_type=bearer&type=magiclink', { waitUntil: 'load' }); await wait(1800);
  const cs = await C.st(); console.log('[C dal link]', JSON.stringify({ email: cs.auth && cs.auth.email, n: (await C.books()).length, url: await C.evaluate(() => location.href) }));
  assert(cs.auth && cs.auth.email === 'lettore@esempio.it' && !cs.err, 'C entrato dal link');
  assert.deepStrictEqual(await C.books(), ['9788806219352', '9788845292613'], 'C riceve i libri');
  assert(!/access_token/.test(await C.evaluate(() => location.href)), 'i token non restano nell\'indirizzo');
  assert(/Sei entrato come lettore@esempio\.it/.test(await C.$eval('#accBody', x => x.textContent)), 'finestra aperta da sola');
  // ---- telefono D: Google acceso, ma lo script di Google non arriva: pulsante di riserva (passa da Supabase e torna con i token) ----
  DB.google = true;
  const D = await phone('D', 'client-finto.apps.googleusercontent.com', true);
  await D.add('9788807900891');
  await D.evaluate(() => { window.__app.openDrawer('opt'); const s = document.getElementById('setList'); if (s && s.hidden) document.getElementById('goSettings').click(); }); await wait(400); await D.click('#goAcc'); await wait(600);
  const gb = await D.$eval('[data-acc="google"]', x => x.textContent); assert.strictEqual(gb, 'Entra con Google');
  assert(/oppure con la tua email/.test(await D.$eval('#accBody', x => x.textContent)));
  await Promise.all([D.waitForNavigation({ waitUntil: 'load' }), D.click('[data-acc="google"]')]); await wait(1800);
  const ds = await D.st(); console.log('[D con Google]', JSON.stringify({ email: ds.auth && ds.auth.email, url: await D.evaluate(() => location.href), nome: DB.prof && DB.prof[DB.gUser] }));
  assert(ds.auth && ds.auth.email === 'amica@gmail.example' && !ds.err, 'D entrato con Google');
  assert(!/access_token|provider_token/.test(await D.evaluate(() => location.href)), 'token tolti dall\'indirizzo');
  assert.strictEqual(DB.prof[DB.gUser], 'Anna', 'nome dal profilo Google');
  assert.deepStrictEqual(rows('amica@gmail.example').map(r => r.dati.i), ['9788807900891'], 'i libri di D online, separati da quelli di A e B');
  // ---- telefono E: pulsante ufficiale di Google (con il Client ID): token consegnato alla pagina, scambiato con Supabase col nonce ----
  const E = await phone('E', 'client-finto.apps.googleusercontent.com');
  await E.evaluate(() => { window.__app.openDrawer('opt'); const s = document.getElementById('setList'); if (s && s.hidden) document.getElementById('goSettings').click(); }); await wait(400); await E.click('#goAcc'); await wait(900);
  await E.screenshot({ path: CFG.OUT + '/account-fuori.png' });
  assert(await E.$('#accG #gisFinto'), 'pulsante ufficiale di Google nella finestra');
  assert(!(await E.$('[data-acc="google"]')), 'niente pulsante di riserva');
  const gi = await E.evaluate(() => ({ c: window.__gis.client_id, n: window.__gis.nonce, ux: window.__gis.ux_mode, loc: window.__gisOpt.locale }));
  console.log('[pulsante Google]', JSON.stringify(gi));
  assert(gi.c === 'client-finto.apps.googleusercontent.com' && /^[0-9a-f]{64}$/.test(gi.n) && gi.ux === 'popup' && gi.loc === 'it');
  await E.click('#gisFinto'); await wait(1500);
  const es = await E.st(); console.log('[E con il pulsante]', JSON.stringify({ email: es.auth && es.auth.email, nome: DB.prof && DB.prof[DB.gisUser], url: await E.evaluate(() => location.href) }));
  assert(es.auth && es.auth.email === 'bruno@esempio.it' && !es.err, 'E entrato con il pulsante ufficiale (nonce giusto)');
  assert.strictEqual(DB.prof[DB.gisUser], 'Bruno', 'nome dal profilo Google');
  assert(/Sei entrato come bruno@esempio\.it/.test(await E.$eval('#accBody', x => x.textContent)), 'finestra aggiornata');
  // ---- telefono F: email spenta (come nell'app vera dal 16/11/2026): solo «Accedi con Google», niente campo email ----
  const F = await phone('F', 'client-finto.apps.googleusercontent.com', false, true);
  await F.evaluate(() => { window.__app.openDrawer('opt'); const s = document.getElementById('setList'); if (s && s.hidden) document.getElementById('goSettings').click(); }); await wait(400); await F.click('#goAcc'); await wait(900);
  let ft = await F.$eval('#accBody', x => x.textContent); await F.screenshot({ path: CFG.OUT + '/account-solo-google.png' });
  assert(await F.$('#accG #gisFinto'), 'F: pulsante di Google'); assert(!(await F.$('#accMail')) && !(await F.$('#accSend')), 'F: niente campo email');
  assert(!/oppure con la tua email/.test(ft), 'F: niente «oppure con la tua email»');
  // ---- telefono G: email spenta e Google spento in Supabase: messaggio, nessun pulsante ----
  DB.google = false;
  const G = await phone('G', 'client-finto.apps.googleusercontent.com', false, true);
  await G.evaluate(() => { window.__app.openDrawer('opt'); const s = document.getElementById('setList'); if (s && s.hidden) document.getElementById('goSettings').click(); }); await wait(400); await G.click('#goAcc'); await wait(900);
  assert(/L.accesso per ora non è attivo/.test(await G.$eval('#accBody', x => x.textContent)) && !(await G.$('#accMail')) && !(await G.$('#accG')), 'G: messaggio, niente pulsanti');
  DB.google = true;
  // ripristino della copia di sicurezza su A (i due libri di prima)
  await A.evaluate(() => window.NLSocial.open()); await wait(400);
  await A.click('#accSheet summary'); await wait(150); await A.click('[data-acc="restore"]'); await wait(200);
  assert(/Rimetto i libri come erano/.test(await A.$eval('.acc-conf', x => x.innerText)));
  await A.click('[data-acc="yes"]'); await wait(800);
  console.log('[A dopo il ripristino]', JSON.stringify(await A.books()));
  assert.deepStrictEqual(await A.books(), ['9788804668015', '9788806219352']);
  // uscita: i libri restano sul telefono, la voce del Menu torna «Salva i libri online»
  await A.click('#accSheet summary'); await A.click('[data-acc="logout"]'); await wait(150); await A.click('[data-acc="yes"]'); await wait(500);
  s = await A.st(); assert(!s.auth, 'uscito'); assert.strictEqual((await A.books()).length, 2, 'i libri restano');
  assert(/La tua email/.test(await A.$eval('#accBody', x => x.innerText)));
  const keys = await A.evaluate(() => Object.keys(localStorage)); assert(keys.every(k => /^social:/.test(k)), 'solo chiavi della copia social');
  assert.deepStrictEqual(errors, []);
  console.log('e2e100 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
