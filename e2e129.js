const CFG = require("./_config");
const H = require('./_harness');
// moduli: social, amici, notifiche, chat   (senza questi file nell'app la prova si salta: vedi esegui.js)
// Giro 9c (Piero, 18/11/2026): gruppi della chat. Database finto qui sotto, con le stesse risposte di supabase/023_chat.sql.
// Anna è amica di Bruno, Carla e Dario. Anna: «+ Nuova» › Nuovo gruppo (nome + amici in una schermata, «Crea il gruppo (3)»),
// iniziali nell'elenco, «Info gruppo» dal nome in cima (N persone, «ha creato il gruppo», ✎, + Aggiungi amici, ⋮ Profilo · Scrivi · Togli,
// Silenzia, Esci), Indietro del telefono (aggiungi › info › chat › elenco). Carla: vede il gruppo, niente ✎ né «Togli», esce dal gruppo.
// SCHERMATE=cartella per le fotografie (360).
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm', '.webp': 'image/webp' };
const UA = '00000000-0000-0000-0000-0000000000a1', UB = '00000000-0000-0000-0000-0000000000b2', UC = '00000000-0000-0000-0000-0000000000c3', UD = '00000000-0000-0000-0000-0000000000d4';
const DB = { prof: { [UA]: { utente: 'Anna' }, [UB]: { utente: 'Bruno' }, [UC]: { utente: 'Carla' }, [UD]: { utente: 'Dario' } },
  amici: [[UA, UB], [UA, UC], [UA, UD], [UB, UC]], chat: [], msg: [], n: 100 };
const amici = (x, y) => DB.amici.some(p => (p[0] === x && p[1] === y) || (p[0] === y && p[1] === x));
const nome = id => (DB.prof[id] || {}).utente || '';
const capo = c => c.creatore || Object.keys(c.m).sort((x, y) => c.m[x].dal - c.m[y].dal)[0];
let dal = 0;
function sistema(c, chi, cosa, su) { DB.msg.push({ id: ++DB.n, chat: c.id, da: chi, tipo: 'sistema', testo: cosa, su: su || null, creato: new Date().toISOString(), el: false }); }
function entra(c, u) { c.m[u] = { letto: DB.n, da: DB.n, sil: false, dal: ++dal }; }
const uidOf = (req) => { const m = /Bearer AT-([\w-]+)/.exec(req.headers.authorization || ''); return m ? m[1] : null; };
function fake(req, res, body, url) {
  const send = (st, j) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(j === undefined ? '' : JSON.stringify(j)); };
  const err = (m) => send(400, { code: 'P0001', message: m });
  const p = url.pathname.replace(/^\/finto/, '');
  if (req.headers.apikey !== 'chiave-finta') return send(401, { message: 'no api key' });
  if (p === '/auth/v1/settings') return send(200, { external: { google: true } });
  if (p === '/auth/v1/token') { const id = String(body.refresh_token || '').slice(3); return send(200, { access_token: 'AT-' + id, refresh_token: 'RT-' + id, expires_in: 3600, user: { id } }); }
  const me = uidOf(req); if (!me) return send(401, { message: 'JWT' });
  const R = (n) => p === '/rest/v1/rpc/' + n;
  const G = () => { const c = DB.chat.find(x => x.id === body.chat); if (!c || !c.m[me]) throw 'non disponibile'; return c; };
  try {
    if (p === '/rest/v1/libri' && req.method === 'GET') return send(200, []);
    if (p === '/rest/v1/libri') return send(201);
    if (p === '/rest/v1/profili' && req.method === 'GET') return send(200, [{ utente: nome(me), nome: nome(me), desideri: true, libreria: true, amici: true, regali: true, creato: '2026-11-01T10:00:00Z', foto: null, cit: null, p_cit: true, p_stat: true, p_cits: false, p_let: true, p_pref: true, p_cons: true, scrivermi: 'amici_amici' }]);
    if (p === '/rest/v1/profili') return send(201);
    if (R('miei_amici')) return send(200, DB.amici.filter(x => x.includes(me)).map(x => { const o = x[0] === me ? x[1] : x[0]; return { id: o, utente: nome(o), nome: nome(o), stato: 'amici', verso: 'inviata', creato: '2026-11-16T10:00:00Z' }; }));
    if (R('gruppo_crea')) {
      const t = String(body.nome || '').replace(/\s+/g, ' ').trim(); if (!t || t.length > 40) return err('nome: da 1 a 40 caratteri');
      const ids = [...new Set(body.membri || [])].filter(x => x !== me); if (!ids.length) return err('scegli almeno un amico');
      if (ids.some(x => !amici(me, x))) return err('non amici');
      const c = { id: 'g' + (DB.chat.length + 1), nome: t, creatore: me, m: {} }; DB.chat.push(c); entra(c, me); ids.forEach(x => entra(c, x));
      sistema(c, me, 'creato'); return send(200, c.id);
    }
    if (R('gruppo_aggiungi')) { const c = G(); if (!amici(me, body.utente)) return err('non amici'); if (c.m[body.utente]) return send(204);
      if (Object.keys(c.m).length >= 30) return err('al massimo 30 persone'); entra(c, body.utente); sistema(c, me, 'aggiunto', body.utente); return send(204); }
    if (R('gruppo_togli')) { const c = G(); if (capo(c) !== me) return err('solo chi ha creato il gruppo'); delete c.m[body.utente]; sistema(c, me, 'tolto', body.utente); return send(204); }
    if (R('gruppo_esci')) { const c = G(); delete c.m[me]; if (c.creatore === me) c.creatore = null; sistema(c, me, 'uscito'); return send(204); }
    if (R('gruppo_nome')) { const c = G(); if (capo(c) !== me) return err('solo chi ha creato il gruppo'); c.nome = String(body.nome).trim(); sistema(c, me, 'nome'); return send(204); }
    if (R('gruppo_membri')) { const c = G(), k = capo(c); return send(200, Object.keys(c.m).sort((x, y) => (y === k) - (x === k) || nome(x).localeCompare(nome(y)))
      .map(id => ({ id, utente: nome(id), capo: id === k, amico: amici(me, id), nl: false, bloccato: false }))); }
    if (R('chat_scrivi')) { const c = G(); const t = String(body.testo || '').trim(); if (!t) return err('messaggio vuoto');
      DB.msg.push({ id: ++DB.n, chat: c.id, da: me, tipo: 'testo', testo: t, su: null, creato: new Date().toISOString(), el: false }); c.m[me].letto = DB.n; return send(200, { chat: c.id, id: DB.n, stato: 'attiva' }); }
    if (R('chat_mie')) return send(200, DB.chat.filter(c => c.m[me]).map(c => { const mm = c.m[me], ms = DB.msg.filter(y => y.chat === c.id && y.id > mm.da), u = ms[ms.length - 1];
      return { id: c.id, tipo: 'gruppo', nome: c.nome, altro: null, stato: 'attiva', silenziata: mm.sil, membri: Object.keys(c.m).length, nl: false, bloccato: false,
        nuovi: ms.filter(y => y.id > mm.letto && y.da !== me).length,
        ultimo: u ? { id: u.id, da: u.da, nome: nome(u.da), tipo: u.tipo, testo: u.testo.slice(0, 80), libro: null, su: u.su, creato: u.creato, el: u.el } : null }; }).reverse());
    if (R('chat_numeri')) return send(200, { nuovi: DB.chat.filter(c => c.m[me] && DB.msg.some(y => y.chat === c.id && y.id > c.m[me].letto && y.da !== me)).length, richieste: 0 });
    if (R('chat_leggi')) { const c = G(), mm = c.m[me];
      const ms = DB.msg.filter(y => y.chat === c.id && y.id > mm.da && y.id > (body.dopo || 0)).slice(-50); mm.letto = DB.n;
      return send(200, { chat: c.id, tipo: 'gruppo', stato: 'attiva', scrivibile: true, altri: false,
        messaggi: ms.map(y => ({ id: y.id, da: y.da, nome: nome(y.da), tipo: y.tipo, creato: y.creato, el: y.el, su: y.su, su_nome: nome(y.su), nl: false, nasc: false, testo: y.testo, libro: null })) }); }
    if (R('chat_silenzia')) { const c = G(); c.m[me].sil = !!body.si; return send(204); }
    if (R('chat_posso')) return send(200, amici(me, body.altro) ? 'si' : 'richiesta');
    if (p.startsWith('/rest/v1/rpc/')) return send(200, []);
  } catch (e) { return err(String(e)); }
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
}).listen(CFG.port(8329));
const base = 'http://localhost:' + CFG.port(8329);

(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const wait = H.wait;
  const SHOTS = process.env.SCHERMATE;
  async function phone(name, uid) {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: 360, height: 760, deviceScaleFactor: SHOTS ? 1 : 2, isMobile: true, hasTouch: true });
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    await page.evaluateOnNewDocument((u, id) => {
      window.NL_SOCIAL = { url: u, key: 'chiave-finta', gClient: 'client-finto' };
      if (!localStorage.getItem('prova:catalogo-libri-social-auth')) localStorage.setItem('prova:catalogo-libri-social-auth', JSON.stringify({ at: 'AT-' + id, rt: 'RT-' + id, exp: Date.now() + 3e6, uid: id, email: 'x@esempio.it' }));
      if (!localStorage.getItem('prova:catalogo-libri-layout')) { localStorage.setItem('prova:catalogo-libri-layout', JSON.stringify({ v: 'a' })); localStorage.setItem('prova:catalogo-libri-card', JSON.stringify({ v: 'd' })); }
      localStorage.setItem('prova:catalogo-libri-guida', JSON.stringify({ seen: 1, v: 99 }));
    }, base + '/finto', uid);
    await page.setRequestInterception(true);
    page.on('request', r => { if (r.url().startsWith(base)) return r.continue(); r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }); });
    await page.goto(base + '/next-libris-prova/?vista=elenco', { waitUntil: 'load' }); await wait(2000);
    await page.evaluate(() => { const g = document.getElementById('guSheet') || document.querySelector('.gu'); if (g && !g.hidden && window.NLGuida && window.NLGuida.close) window.NLGuida.close(); });
    page.click$ = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error('manca ' + s); e.click(); }, sel);
    page.vis = sel => page.evaluate(s => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none' && !e.closest('[hidden]'); }, sel);
    page.txt = sel => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
    page.shot = async (n) => { if (SHOTS) { await wait(250); await page.screenshot({ path: path.join(SHOTS, n + '.png') }); } };
    page.wide = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    page.st = () => page.evaluate(() => window.NLChat.state());
    return page;
  }
  async function noGuide(pg) { await pg.evaluate(() => { document.querySelectorAll('.sheet:not([hidden])').forEach(s => { if (!/^(chSheet)$/.test(s.id)) s.hidden = true; }); document.documentElement.classList.remove('guida-aperta'); }); }

  async function noGuide(pg) { await pg.evaluate(() => { document.querySelectorAll('.sheet:not([hidden])').forEach(s => { if (s.id !== 'chSheet') s.hidden = true; }); document.documentElement.classList.remove('guida-aperta'); }); }
  const items = pg => pg.$$eval('#chMenu .ch-mi', a => a.map(x => x.textContent));

  // ================= Anna crea il gruppo =================
  const A = await phone('A', UA); await noGuide(A);
  await A.evaluate(() => window.NLAmici.load(true)); await wait(600);
  await A.click$('#btnChat'); await wait(500);
  await A.click$('#chSheet [data-c="new"]'); await wait(200);
  await A.click$('#chMenu [data-i="grp"]'); await wait(300);
  let s = await A.st(); assert.strictEqual(s.view, 'grp');
  assert(/Nome del gruppo/.test(await A.txt('#chBody')) && /Scegli gli amici \(fino a 29\)/.test(await A.txt('#chBody')));
  assert.deepStrictEqual(await A.$$eval('#chNewL .ch-pick b', a => a.map(x => x.textContent)), ['Bruno', 'Carla', 'Dario'], 'solo gli amici, in ordine');
  assert.strictEqual(await A.txt('#chGOk'), 'Crea il gruppo (1)'); assert(await A.$eval('#chGOk', b => b.disabled), 'spento senza amici');
  await A.click$('#chNewL input[data-g="' + UB + '"]'); await A.click$('#chNewL input[data-g="' + UC + '"]'); await wait(100);
  assert.strictEqual(await A.txt('#chGOk'), 'Crea il gruppo (3)'); assert(await A.$eval('#chGOk', b => b.disabled), 'spento senza nome');
  await A.type('#chGName', 'Lettori di gialli'); await wait(100);
  assert(!(await A.$eval('#chGOk', b => b.disabled)), 'acceso con nome e amici');
  assert.strictEqual(await A.wide(), 0); await A.shot('129-1-nuovo-gruppo');
  await A.click$('#chGOk'); await wait(900);
  assert.strictEqual(DB.chat.length, 1); assert.deepStrictEqual(Object.keys(DB.chat[0].m).sort(), [UA, UB, UC].sort());
  s = await A.st(); assert.strictEqual(s.view, 'conv'); assert.strictEqual(s.cur, 'g1');
  assert(/Anna ha creato il gruppo/.test(await A.txt('#chBody')), 'messaggio di sistema');
  assert.strictEqual(await A.txt('#chHead .ch-gav'), 'LG', 'iniziali del gruppo');
  assert(/3 persone/.test(await A.txt('#chHead .ch-wn')));
  await A.type('#chTxt', 'Primo libro: Il nome della rosa?'); await A.click$('#chForm .ch-send'); await wait(600);
  assert.strictEqual(DB.msg[DB.msg.length - 1].testo, 'Primo libro: Il nome della rosa?');
  await A.shot('129-2-chat-gruppo');
  // ⋮ del gruppo
  await A.click$('#chSheet [data-c="menu"]'); await wait(200);
  assert.deepStrictEqual(await items(A), ['Info gruppo', 'Silenzia', 'Esci dal gruppo', 'Annulla']);
  await A.click$('#chMenu [data-i="x"]'); await wait(150);
  // Info gruppo dal nome in cima
  await A.click$('#chHead [data-c="ginfo"]'); await wait(500);
  s = await A.st(); assert.strictEqual(s.view, 'ginfo');
  let info = await A.txt('#chBody'); console.log('[info]', info);
  assert(/3 persone/.test(info) && /\+ Aggiungi amici/.test(info) && /Anna \(tu\)/.test(info) && /ha creato il gruppo/.test(info) && /Silenzia gli avvisi/.test(info) && /Esci dal gruppo/.test(info));
  assert(await A.vis('#chHead [data-c="gren"]'), '✎ per chi ha creato il gruppo');
  assert.strictEqual(await A.$$eval('#chBody [data-c="gmem"]', a => a.length), 2, '⋮ su tutti tranne me');
  assert.strictEqual(await A.wide(), 0); await A.shot('129-3-info');
  // + Aggiungi amici: solo Dario
  await A.click$('#chBody [data-c="gadd"]'); await wait(300);
  assert.deepStrictEqual(await A.$$eval('#chNewL .ch-pick b', a => a.map(x => x.textContent)), ['Dario'], 'solo chi non c\'è');
  await A.click$('#chNewL input[data-g="' + UD + '"]'); await wait(100);
  assert.strictEqual(await A.txt('#chGOk'), 'Aggiungi (1)');
  await A.shot('129-4-aggiungi');
  await A.click$('#chGOk'); await wait(900);
  assert(DB.chat[0].m[UD], 'Dario nel gruppo');
  s = await A.st(); assert.strictEqual(s.view, 'ginfo', 'si torna a Info gruppo');
  assert(/4 persone/.test(await A.txt('#chBody')));
  // ⋮ su Bruno: Profilo · Scrivi · Togli
  await A.click$('#chBody [data-c="gmem"][data-id="' + UB + '"]'); await wait(200);
  assert.deepStrictEqual(await items(A), ['Profilo', 'Scrivi', 'Togli dal gruppo', 'Annulla']);
  await A.shot('129-5-menu-membro');
  await A.click$('#chMenu [data-i="out"]'); await wait(200);
  assert(/Togliere Bruno dal gruppo\?/.test(await A.txt('#chMenu')));
  await A.click$('#chMenu [data-i="ok"]'); await wait(700);
  assert(!DB.chat[0].m[UB], 'Bruno tolto'); assert(/3 persone/.test(await A.txt('#chBody')));
  // ✎ nome
  await A.click$('#chHead [data-c="gren"]'); await wait(200);
  await A.evaluate(() => { document.getElementById('chRen').value = ''; }); await A.type('#chRen', 'Gialli e noir');
  await A.click$('#chMenu [data-r="ok"]'); await wait(600);
  assert.strictEqual(DB.chat[0].nome, 'Gialli e noir'); assert(/Gialli e noir/.test(await A.txt('#chHead')));
  // Silenzia da Info
  await A.click$('#chBody [data-c="gmute"]'); await wait(500);
  assert(DB.chat[0].m[UA].sil); assert(/Riattiva gli avvisi/.test(await A.txt('#chBody')));
  // Indietro del telefono: info › chat › elenco
  await A.goBack(); await wait(600);
  s = await A.st(); assert.strictEqual(s.view, 'conv', 'Indietro da Info torna alla chat');
  const sys = await A.$$eval('#chBody .ch-sys', a => a.map(x => x.textContent)); console.log('[sistema]', sys);
  assert(sys.includes('Anna ha aggiunto Dario') && sys.includes('Anna ha tolto Bruno') && sys.includes('Anna ha cambiato il nome del gruppo'));
  assert(/GN/.test(await A.txt('#chHead .ch-gav')));
  await A.goBack(); await wait(600);
  s = await A.st(); assert.strictEqual(s.view, 'list');
  const row = await A.txt('#chBody .ch-row'); console.log('[riga]', row);
  assert(/^GN Gialli e noir/.test(row) && /🔕/.test(row));
  await A.shot('129-6-elenco');
  await A.browserContext().close();

  // ================= Carla: niente ✎ né «Togli», esce =================
  const C = await phone('C', UC); await noGuide(C);
  await C.evaluate(() => window.NLAmici.load(true)); await wait(500);
  await C.click$('#btnChat'); await wait(700);
  assert(/Gialli e noir/.test(await C.txt('#chBody')));
  await C.click$('#chBody .ch-row'); await wait(700);
  assert(/Anna/.test(await C.txt('#chBody .ch-msg.it .ch-from')), 'nome di chi scrive nel gruppo');
  await C.click$('#chHead [data-c="ginfo"]'); await wait(500);
  assert(!(await C.$('#chHead [data-c="gren"]')), 'niente ✎');
  await C.click$('#chBody [data-c="gmem"][data-id="' + UD + '"]'); await wait(200);
  assert.deepStrictEqual(await items(C), ['Scrivi', 'Annulla'], 'Dario non è amico di Carla: niente Profilo, niente Togli');
  await C.click$('#chMenu [data-i="x"]'); await wait(150);
  await C.click$('#chBody [data-c="gexit"]'); await wait(200);
  assert(/Uscire da «Gialli e noir»\?/.test(await C.txt('#chMenu')));
  await C.shot('129-7-esci');
  await C.click$('#chMenu [data-i="ok"]'); await wait(1200);
  assert(!DB.chat[0].m[UC], 'Carla è uscita');
  s = await C.st(); assert.strictEqual(s.view, 'list'); assert(await C.vis('#chSheet'), 'resta l\'elenco');
  assert(!/Gialli e noir/.test(await C.txt('#chBody')), 'il gruppo non c\'è più nell\'elenco');
  await C.goBack(); await wait(400);
  assert(!(await C.vis('#chSheet')), 'Indietro dall\'elenco: si chiude');

  assert.deepStrictEqual(errors, [], 'nessun errore JavaScript');
  console.log('e2e129 OK');
  await browser.close(); server.close();
})().catch(async e => { console.error('e2e129 FALLITA:', e && e.stack || e); console.error(require('util').inspect(DB, { depth: 3 }).slice(0, 2000)); process.exit(1); });
