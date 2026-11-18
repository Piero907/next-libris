const CFG = require("./_config");
const H = require('./_harness');
// moduli: social, amici, notifiche, chat   (senza questi file nell'app la prova si salta: vedi esegui.js)
// Giro 9d (Piero, 18/11/2026): libri nella chat e «Consiglia». Anna amica di Bruno e Carla; chat a due Anna-Bruno e gruppo «Lettori» (tutti e tre).
// Anna: 📚 nella chat › Libreria/Desideri, ricerca, due righe › Manda (tipo libro); Indietro dalla scelta torna alla chat.
// Anna: Condividi un libro › «Consiglialo» con amici e gruppi + due righe › messaggi «consiglio» in chat (a Carla e nel gruppo).
// Bruno: tocco sul libro › schedina › «Aggiungi ai Desideri»; la seconda volta «È già nei tuoi Desideri». Carla: «Ti consiglia» nel gruppo.
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm', '.webp': 'image/webp' };
const UA = '00000000-0000-0000-0000-0000000000a1', UB = '00000000-0000-0000-0000-0000000000b2', UC = '00000000-0000-0000-0000-0000000000c3';
const DB = { prof: { [UA]: { utente: 'Anna' }, [UB]: { utente: 'Bruno' }, [UC]: { utente: 'Carla' } }, amici: [[UA, UB], [UA, UC], [UB, UC]], chat: [], msg: [], n: 100 };
const amici = (x, y) => DB.amici.some(p => (p[0] === x && p[1] === y) || (p[0] === y && p[1] === x));
const nome = id => (DB.prof[id] || {}).utente || '';
function entra(c, u) { c.m[u] = { letto: DB.n, da: 0 }; }
const c1 = { id: 'c1', tipo: 'due', a: UA, b: UB, m: {} }; entra(c1, UA); entra(c1, UB);
const g1 = { id: 'g1', tipo: 'gruppo', nome: 'Lettori', m: {} }; [UA, UB, UC].forEach(u => entra(g1, u)); DB.chat.push(c1, g1);
const uidOf = (req) => { const m = /Bearer AT-([\w-]+)/.exec(req.headers.authorization || ''); return m ? m[1] : null; };
function put(c, me, body) {
  const t = String(body.testo || '').trim(), k = body.tipo || 'testo';
  if (k === 'testo' && !t) throw 'messaggio vuoto';
  if (k !== 'testo' && !(body.libro && body.libro.t)) throw 'libro non valido';
  DB.msg.push({ id: ++DB.n, chat: c.id, da: me, tipo: k, testo: t, libro: k === 'testo' ? null : body.libro, creato: new Date().toISOString(), el: false }); c.m[me].letto = DB.n;
  return { chat: c.id, id: DB.n, stato: 'attiva' };
}
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
  const other = c => c.tipo === 'due' ? (c.a === me ? c.b : c.a) : null;
  try {
    if (p === '/rest/v1/libri' && req.method === 'GET') return send(200, []);
    if (p === '/rest/v1/libri') return send(201);
    if (p === '/rest/v1/profili' && req.method === 'GET') return send(200, [{ utente: nome(me), nome: nome(me), desideri: true, libreria: true, amici: true, regali: true, creato: '2026-11-01T10:00:00Z', foto: null, cit: null, p_cit: true, p_stat: true, p_cits: false, p_let: true, p_pref: true, p_cons: true, scrivermi: 'amici_amici' }]);
    if (p === '/rest/v1/profili') return send(201);
    if (R('miei_amici')) return send(200, DB.amici.filter(x => x.includes(me)).map(x => { const o = x[0] === me ? x[1] : x[0]; return { id: o, utente: nome(o), nome: nome(o), stato: 'amici', verso: 'inviata', creato: '2026-11-16T10:00:00Z' }; }));
    if (R('chat_scrivi')) return send(200, put(G(), me, body));
    if (R('chat_scrivi_a')) {
      if (!amici(me, body.a)) return err('non disponibile');
      let c = DB.chat.find(x => x.tipo === 'due' && ((x.a === me && x.b === body.a) || (x.b === me && x.a === body.a)));
      if (!c) { c = { id: 'c' + (DB.chat.length + 1), tipo: 'due', a: me, b: body.a, m: {} }; entra(c, me); entra(c, body.a); DB.chat.push(c); }
      return send(200, put(c, me, body));
    }
    if (R('chat_mie')) return send(200, DB.chat.filter(c => c.m[me]).map(c => { const mm = c.m[me], ms = DB.msg.filter(y => y.chat === c.id), u = ms[ms.length - 1];
      return { id: c.id, tipo: c.tipo, nome: c.tipo === 'gruppo' ? c.nome : nome(other(c)), altro: other(c), stato: 'attiva', silenziata: false, membri: Object.keys(c.m).length, nl: false, bloccato: false,
        nuovi: ms.filter(y => y.id > mm.letto && y.da !== me).length,
        ultimo: u ? { id: u.id, da: u.da, nome: nome(u.da), tipo: u.tipo, testo: u.testo.slice(0, 80), libro: u.libro && u.libro.t, creato: u.creato, el: false } : null }; }));
    if (R('chat_numeri')) return send(200, { nuovi: 0, richieste: 0 });
    if (R('chat_leggi')) { const c = G(), mm = c.m[me];
      const ms = DB.msg.filter(y => y.chat === c.id && y.id > (body.dopo || 0)).slice(-50); mm.letto = DB.n;
      return send(200, { chat: c.id, tipo: c.tipo, stato: 'attiva', scrivibile: true, altri: false,
        messaggi: ms.map(y => ({ id: y.id, da: y.da, nome: nome(y.da), tipo: y.tipo, creato: y.creato, el: false, su: null, su_nome: '', nl: false, nasc: false, testo: y.testo, libro: y.libro })) }); }
    if (R('chat_posso')) return send(200, 'si');
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
}).listen(CFG.port(8330));
const base = 'http://localhost:' + CFG.port(8330);

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

  async function noGuide(pg) { await pg.evaluate(() => { document.querySelectorAll('.sheet:not([hidden])').forEach(s => { if (s.id !== 'chSheet') s.hidden = true; }); document.documentElement.classList.remove('guida-aperta'); }); }
  const items = pg => pg.$$eval('#chMenu .ch-mi', a => a.map(x => x.textContent));

  let s;
  // ================= Anna: 📚 nella chat con Bruno =================
  const A = await phone('A', UA); await noGuide(A);
  await A.evaluate(() => {
    window.NL.addMine({ t: 'Il nome della rosa', a: 'Umberto Eco', i: '9788845292613', e: 'Bompiani', y: '1980', pg: 503, img: 'https://books.google.com/books/content?id=x' });
    window.NL.addMine({ t: 'Lessico famigliare', a: 'Natalia Ginzburg' });
    window.NL.addMine({ t: 'Il Gattopardo', a: 'Giuseppe Tomasi di Lampedusa', w: true });
  });
  await A.evaluate(() => window.NLAmici.load(true)); await wait(600);
  await A.click$('#btnChat'); await wait(700);
  await A.click$('#chBody [data-c="chat"][data-id="c1"]'); await wait(700);
  assert(await A.vis('#chForm [data-c="bpick"]'), '📚 accanto al campo');
  await A.click$('#chForm [data-c="bpick"]'); await wait(300);
  s = await A.st(); assert.strictEqual(s.view, 'bpick');
  assert.deepStrictEqual(await A.$$eval('#chBL .ch-t b', a => a.map(x => x.textContent)), ['Il nome della rosa', 'Lessico famigliare'], 'Libreria in ordine');
  assert(/Tocca un libro/.test(await A.txt('#chFoot')));
  await A.click$('#chBody [data-c="btab"][data-t="wish"]'); await wait(200);
  assert.deepStrictEqual(await A.$$eval('#chBL .ch-t b', a => a.map(x => x.textContent)), ['Il Gattopardo'], 'Desideri');
  await A.click$('#chBody [data-c="btab"][data-t="lib"]'); await wait(200);
  await A.type('#chBQ', 'eco'); await wait(200);
  assert.deepStrictEqual(await A.$$eval('#chBL .ch-t b', a => a.map(x => x.textContent)), ['Il nome della rosa'], 'ricerca per autore');
  await A.click$('#chBL [data-c="bsel"]'); await wait(200);
  assert(await A.vis('#chBTxt') && await A.vis('#chBGo'), 'due righe e Manda');
  assert.strictEqual(await A.wide(), 0); await A.shot('130-1-scegli');
  await A.type('#chBTxt', 'Questo ti piacerà'); await A.click$('#chBGo'); await wait(900);
  let m = DB.msg[DB.msg.length - 1];
  assert.strictEqual(m.chat, 'c1'); assert.strictEqual(m.tipo, 'libro'); assert.strictEqual(m.testo, 'Questo ti piacerà');
  assert.strictEqual(m.libro.t, 'Il nome della rosa'); assert.strictEqual(m.libro.pg, '503'); assert(/^https:/.test(m.libro.img)); assert(!('id' in m.libro), 'solo i campi del libro');
  s = await A.st(); assert.strictEqual(s.view, 'conv', 'dopo Manda si torna alla chat');
  assert(/Il nome della rosa/.test(await A.txt('#chBody .ch-msg.me .ch-book')) && /Questo ti piacerà/.test(await A.txt('#chBody .ch-msg.me')));
  await A.shot('130-2-chat');
  // Indietro del telefono dalla scelta del libro
  await A.click$('#chForm [data-c="bpick"]'); await wait(300);
  await A.goBack(); await wait(500);
  s = await A.st(); assert.strictEqual(s.view, 'conv', 'Indietro torna alla chat');
  assert(await A.vis('#chTxt'), 'casella di nuovo al suo posto');
  await A.keyboard.press('Escape'); await wait(400);

  // ================= Anna: Condividi › Consiglialo (amici e gruppi) =================
  const rosa = await A.evaluate(() => window.NL.books().find(b => b.t === 'Il nome della rosa').id);
  await A.evaluate(id => window.__app.openShare([window.NL.get(id)], { kind: 'book' }), rosa); await wait(800);
  const box = await A.txt('#shareFriBox'); console.log('[condividi]', box);
  assert(/Consiglialo/.test(box) && /Amici/i.test(box) && /Gruppi/i.test(box) && /Lettori/.test(box), 'amici e gruppi');
  assert(await A.$('#shareFriBox [data-share="' + UC + '"]') && await A.$('#shareFriBox [data-shareg="g1"]'));
  assert(await A.$eval('#shareAppGo', b => b.disabled), 'spento senza scelte');
  await A.click$('#shareFriBox [data-share="' + UC + '"]'); await A.click$('#shareFriBox [data-shareg="g1"]'); await wait(100);
  assert.strictEqual(await A.txt('#shareAppGo'), 'Consiglia (2)');
  await A.type('#shareTipTxt', 'Il più bel giallo');
  assert.strictEqual(await A.wide(), 0); await A.shot('130-3-consiglialo');
  const before = DB.msg.length;
  await A.click$('#shareAppGo'); await wait(1000);
  const tips = DB.msg.slice(before);
  assert.strictEqual(tips.length, 2, 'due consigli');
  assert(tips.every(x => x.tipo === 'consiglio' && x.testo === 'Il più bel giallo' && x.libro.t === 'Il nome della rosa'));
  assert(tips.some(x => x.chat === 'g1'), 'nel gruppo');
  const cc = DB.chat.find(c => c.tipo === 'due' && c.m[UC]); assert(cc && tips.some(x => x.chat === cc.id), 'nella chat con Carla');
  assert(await A.evaluate(() => document.getElementById('shareSheet').hidden), 'finestra chiusa');
  await A.browserContext().close();

  // ================= Bruno: schedina del libro › Aggiungi ai Desideri =================
  const B = await phone('B', UB); await noGuide(B);
  await B.evaluate(() => window.NLAmici.load(true)); await wait(500);
  await B.click$('#btnChat'); await wait(700);
  await B.click$('#chBody [data-c="chat"][data-id="c1"]'); await wait(700);
  await B.click$('#chBody .ch-msg.it [data-c="bk"]'); await wait(300);
  let card = await B.txt('#chBk'); console.log('[schedina]', card);
  assert(/Il nome della rosa/.test(card) && /Umberto Eco/.test(card) && /Bompiani, 1980 · 503 pagine/.test(card) && /Aggiungi ai Desideri/.test(card));
  await B.shot('130-4-schedina');
  await B.click$('#chBk [data-i="wish"]'); await wait(300);
  assert(!(await B.$('#chBk')), 'schedina chiusa');
  const w = await B.evaluate(() => window.NL.myBooks().filter(b => b.w).map(b => [b.t, b.fr]));
  assert.deepStrictEqual(w, [['Il nome della rosa', 'Anna']], 'nei Desideri, da Anna');
  await B.click$('#chBody .ch-msg.it [data-c="bk"]'); await wait(300);
  card = await B.txt('#chBk'); assert(/È già nei tuoi Desideri/.test(card) && !/Aggiungi ai Desideri/.test(card));
  await B.goBack(); await wait(400);
  assert(!(await B.$('#chBk')), 'Indietro chiude la schedina'); s = await B.st(); assert.strictEqual(s.view, 'conv', 'e resta la chat');
  await B.browserContext().close();

  // ================= Carla: «Ti consiglia» nel gruppo =================
  const C = await phone('C', UC); await noGuide(C);
  await C.click$('#btnChat'); await wait(700);
  await C.click$('#chBody [data-c="chat"][data-id="g1"]'); await wait(700);
  const gm = await C.txt('#chBody .ch-msg.it'); console.log('[gruppo]', gm);
  assert(/Ti consiglia/.test(gm) && /Il nome della rosa/.test(gm) && /Il più bel giallo/.test(gm));
  await C.shot('130-5-gruppo');
  await C.browserContext().close();

  assert.deepStrictEqual(errors, [], 'nessun errore JavaScript');
  console.log('e2e130 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('e2e130 FALLITA:', e && e.stack || e); process.exit(1); });
