const CFG = require("./_config");
const H = require('./_harness');
// moduli: social, amici, notifiche, chat   (senza questi file nell'app la prova si salta: vedi esegui.js)
// Giro 9b (Piero, 18/11/2026): chat a due e richieste. Database finto qui sotto, con le stesse risposte di supabase/023_chat.sql.
// Anna e Bruno sono amici; Carla no (è amica di Bruno: amica di un amico). Anna: fumetto in testata, «+ Nuova» › Bruno, primo messaggio, tenuto premuto › «Elimina per tutti»;
// «Possono scrivermi» e «Persone bloccate» in Amici e privacy; «Scrivi» nel profilo di Bruno. Bruno: numero sul fumetto, chat letta, risposta,
// tasto Indietro del telefono (chat › elenco › fuori). Carla scrive ad Anna: richiesta; Anna la vede a parte, la segnala con «Blocca anche».
// Campanella: testo del riassunto «messaggi», il tocco apre la chat. SCHERMATE=cartella per le fotografie (360).
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm', '.webp': 'image/webp' };
const UA = '00000000-0000-0000-0000-0000000000a1', UB = '00000000-0000-0000-0000-0000000000b2', UC = '00000000-0000-0000-0000-0000000000c3';
const DB = { prof: { [UA]: { utente: 'Anna', scrivermi: 'amici_amici' }, [UB]: { utente: 'Bruno', scrivermi: 'amici_amici' }, [UC]: { utente: 'Carla', scrivermi: 'tutti' } },
  amici: [[UA, UB], [UB, UC]], chat: [], msg: [], blocchi: [], segn: [], notifiche: [], post: [], n: 100 };
const amici = (x, y) => DB.amici.some(p => (p[0] === x && p[1] === y) || (p[0] === y && p[1] === x));
const bloccati = (x, y) => DB.blocchi.some(b => (b.chi === x && b.altro === y) || (b.chi === y && b.altro === x));
const other = (c, me) => c.a === me ? c.b : c.a;
const stato = (c, me) => (c.stato === 'richiesta' || c.stato === 'rifiutata') && c.rich === me ? 'attesa' : c.stato;
function permesso(me, altro) {
  if (bloccati(me, altro)) return 'no';
  if (amici(me, altro)) return 'si';
  const c = DB.chat.find(x => [x.a, x.b].includes(me) && [x.a, x.b].includes(altro));
  if (c && c.stato === 'attiva') return 'si';
  if (c && c.stato === 'richiesta') return c.rich === me ? 'attesa' : 'si';
  const sc = DB.prof[altro].scrivermi, aa = Object.keys(DB.prof).some(z => amici(me, z) && amici(z, altro));
  return sc === 'tutti' || (sc === 'amici_amici' && aa) ? 'richiesta' : 'no';
}
function mem(c, me) { return c.m[me] || (c.m[me] = { letto: 0, da: 0, sil: false }); }
function scrivi(me, c, testo) {
  const t = String(testo || '').trim(); if (!t) throw 'messaggio vuoto'; if (t.length > 1000) throw 'messaggio troppo lungo';
  const m = { id: ++DB.n, chat: c.id, da: me, tipo: 'testo', testo: t, creato: new Date().toISOString(), el: false }; DB.msg.push(m);
  mem(c, me).letto = m.id; return m.id;
}
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
  try {
    if (p === '/rest/v1/libri' && req.method === 'GET') return send(200, []);
    if (p === '/rest/v1/libri') return send(201);
    if (p === '/rest/v1/profili' && req.method === 'GET') { const pr = DB.prof[me]; return send(200, [{ utente: pr.utente, nome: pr.utente, desideri: true, libreria: true, amici: true, regali: true, creato: '2026-11-01T10:00:00Z', foto: null, cit: null, p_cit: true, p_stat: true, p_cits: false, p_let: true, p_pref: true, p_cons: true, scrivermi: pr.scrivermi }]); }
    if (p === '/rest/v1/profili') { DB.post.push({ me, body }); if (body.scrivermi) DB.prof[me].scrivermi = body.scrivermi; return send(201); }
    if (R('miei_amici')) return send(200, DB.amici.filter(x => x.includes(me)).map(x => { const o = x[0] === me ? x[1] : x[0]; return { id: o, utente: DB.prof[o].utente, nome: DB.prof[o].utente, stato: 'amici', verso: 'inviata', creato: '2026-11-16T10:00:00Z' }; }));
    if (R('mie_notifiche')) return send(200, DB.notifiche.filter(n => n.utente === me));
    if (R('cerca_utenti')) return send(200, Object.keys(DB.prof).filter(id => id !== me && !bloccati(me, id) && DB.prof[id].utente.toLowerCase().includes(String(body.q).toLowerCase())).map(id => ({ id, utente: DB.prof[id].utente, rel: amici(me, id) ? 'amici' : '' })));
    // ---- chat ----
    if (R('chat_posso')) return send(200, permesso(me, body.altro));
    if (R('chat_scrivi_a')) {
      const pm = permesso(me, body.a); if (pm === 'attesa') return err('in attesa'); if (pm === 'no') return err('non disponibile');
      let c = DB.chat.find(x => [x.a, x.b].includes(me) && [x.a, x.b].includes(body.a));
      if (!c) { c = { id: 'c' + (DB.chat.length + 1), a: me, b: body.a, stato: pm === 'richiesta' ? 'richiesta' : 'attiva', rich: pm === 'richiesta' ? me : null, m: {} }; DB.chat.push(c); mem(c, me); mem(c, body.a); }
      else if (c.stato === 'richiesta' && c.rich !== me) c.stato = 'attiva';
      const id = scrivi(me, c, body.testo); return send(200, { chat: c.id, id, stato: pm === 'richiesta' ? 'attesa' : 'attiva' });
    }
    if (R('chat_scrivi')) {
      const c = DB.chat.find(x => x.id === body.chat); const pm = permesso(me, other(c, me));
      if (pm === 'attesa') return err('in attesa'); if (pm !== 'si') return err('non disponibile');
      if (c.stato === 'richiesta' && c.rich !== me) c.stato = 'attiva';
      return send(200, { chat: c.id, id: scrivi(me, c, body.testo), stato: 'attiva' });
    }
    if (R('chat_mie')) return send(200, DB.chat.filter(c => c.m[me] && !(c.stato === 'rifiutata' && c.rich !== me)).map(c => {
      const mm = mem(c, me), ms = DB.msg.filter(y => y.chat === c.id && y.id > mm.da), u = ms[ms.length - 1], o = other(c, me);
      return { c, mm, u, o, ms };
    }).filter(x => x.u).map(({ c, mm, u, o, ms }) => ({ id: c.id, tipo: 'due', nome: DB.prof[o].utente, altro: o, stato: stato(c, me), silenziata: mm.sil, membri: null, nl: false, bloccato: bloccati(me, o),
      nuovi: ms.filter(y => y.id > mm.letto && y.da !== me).length,
      ultimo: { id: u.id, da: u.da, nome: DB.prof[u.da].utente, tipo: u.tipo, testo: u.testo.slice(0, 80), libro: null, su: null, creato: u.creato, el: u.el } })).reverse());
    if (R('chat_numeri')) {
      let nuovi = 0, richieste = 0;
      DB.chat.filter(c => c.m[me]).forEach(c => { const mm = mem(c, me); const n = DB.msg.some(y => y.chat === c.id && y.id > Math.max(mm.letto, mm.da) && y.da !== me);
        if (c.stato === 'richiesta' && c.rich !== me) { if (n) richieste++; } else if (c.stato === 'attiva' && n) nuovi++; });
      return send(200, { nuovi, richieste });
    }
    if (R('chat_leggi')) {
      const c = DB.chat.find(x => x.id === body.chat); if (!c || !c.m[me]) return err('non disponibile');
      const mm = mem(c, me);
      let ms = DB.msg.filter(y => y.chat === c.id && y.id > mm.da && y.id > (body.dopo || 0) && (body.prima == null || y.id < body.prima));
      const altri = ms.length > 50; ms = ms.slice(-50);
      if (body.prima == null) { const top = Math.max(0, ...DB.msg.filter(y => y.chat === c.id).map(y => y.id)); mm.letto = Math.max(mm.letto, top); }
      return send(200, { chat: c.id, tipo: 'due', stato: stato(c, me), scrivibile: permesso(me, other(c, me)) === 'si', altri,
        messaggi: ms.map(y => ({ id: y.id, da: y.da, nome: DB.prof[y.da].utente, tipo: y.tipo, creato: y.creato, el: y.el, su: null, su_nome: '', nl: false, nasc: false, testo: y.testo, libro: null })) });
    }
    if (R('chat_rispondi')) { const c = DB.chat.find(x => x.id === body.chat); if (!c || c.stato !== 'richiesta' || c.rich === me) return err('richiesta non trovata'); c.stato = body.accetta ? 'attiva' : 'rifiutata'; return send(204); }
    if (R('chat_elimina_messaggio')) { const y = DB.msg.find(x => x.id === body.id); if (!y || y.da !== me || Date.now() - new Date(y.creato) > 3600000) return err('non si può più eliminare'); y.el = true; y.testo = ''; return send(204); }
    if (R('chat_elimina')) { const c = DB.chat.find(x => x.id === body.chat); mem(c, me).da = DB.n; return send(204); }
    if (R('chat_silenzia')) { const c = DB.chat.find(x => x.id === body.chat); mem(c, me).sil = !!body.si; return send(204); }
    if (R('blocca')) { DB.blocchi = DB.blocchi.filter(b => !(b.chi === me && b.altro === body.altro)); if (body.si !== false) { DB.blocchi.push({ chi: me, altro: body.altro }); DB.amici = DB.amici.filter(x => !(x.includes(me) && x.includes(body.altro))); } return send(204); }
    if (R('bloccati_miei')) return send(200, DB.blocchi.filter(b => b.chi === me).map(b => ({ id: b.altro, utente: DB.prof[b.altro].utente, creato: '2026-11-18T10:00:00Z' })));
    if (R('segnala')) { const y = DB.msg.find(x => x.id === body.messaggio); if (!y || y.da === me) return err('non disponibile'); DB.segn.push({ da: me, su: y.da, motivo: body.motivo, blocca: body.blocca });
      if (body.blocca) DB.blocchi.push({ chi: me, altro: y.da }); return send(204); }
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
}).listen(CFG.port(8328));
const base = 'http://localhost:' + CFG.port(8328);

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

  // ================= Anna scrive a Bruno =================
  const A = await phone('A', UA); await noGuide(A);
  await A.evaluate(() => window.NLAmici.load(true)); await wait(600);
  assert(await A.vis('#btnChat'), 'fumetto in testata');
  const pos = await A.evaluate(() => ['btnBell', 'btnChat', 'btnOpts'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; }));
  console.log('[testata]', JSON.stringify(pos));
  for (let i = 0; i < 2; i++) assert((pos[i + 1][0] + pos[i + 1][1]) / 2 - (pos[i][0] + pos[i][1]) / 2 >= 34, 'campanella, chat, amici, ingranaggio in fila, stesso passo delle icone di prima');
  const h1 = await A.evaluate(() => { const h = document.querySelector('header.top h1').getBoundingClientRect(), b = document.getElementById('btnBell').getBoundingClientRect(); return [h.right, b.left]; });
  assert(h1[0] <= h1[1] + 1, 'il titolo non tocca la campanella: ' + h1);
  assert.strictEqual(await A.wide(), 0); await A.shot('128-1-testata');
  await A.click$('#btnChat'); await wait(500);
  assert(await A.vis('#chSheet'));
  assert(/Nessuna chat per ora/.test(await A.txt('#chBody')));
  await A.click$('#chSheet [data-c="new"]'); await wait(200);
  assert.deepStrictEqual(await A.$$eval('#chMenu .ch-mi', a => a.map(x => x.textContent)), ['✉ Scrivi a un amico', '👥 Nuovo gruppo', 'Annulla'], '«+ Nuova»: amico o gruppo (giro 9c)');
  await A.click$('#chMenu [data-i="one"]'); await wait(300);
  assert(/Bruno/.test(await A.txt('#chBody')) && !/Carla/.test(await A.txt('#chBody')), 'solo gli amici');
  await A.click$('#chSheet [data-c="to"]'); await wait(600);
  let s = await A.st(); assert.strictEqual(s.view, 'conv'); assert.strictEqual(s.draftTo.id, UB);
  assert(/Scrivi il primo messaggio a Bruno/.test(await A.txt('#chBody')));
  await A.type('#chTxt', 'Ciao Bruno! Hai finito il Gattopardo?'); await A.click$('#chForm .ch-send'); await wait(700);
  assert.strictEqual(DB.msg.length, 1); assert.strictEqual(DB.msg[0].testo, 'Ciao Bruno! Hai finito il Gattopardo?');
  s = await A.st(); assert.strictEqual(s.cur, 'c1'); assert.strictEqual(s.msgs.length, 1);
  assert(await A.vis('#chBody .ch-msg.me'), 'mio messaggio a destra');
  const side = await A.evaluate(() => { const m = document.querySelector('#chBody .ch-msg.me').getBoundingClientRect(), b = document.getElementById('chBody').getBoundingClientRect(); return b.right - m.right; });
  assert(side < 30, 'a destra: ' + side);
  await A.type('#chTxt', 'Questo lo cancello'); await A.click$('#chForm .ch-send'); await wait(600);
  assert.strictEqual(await A.$$eval('#chBody .ch-msg', a => a.length), 2);
  assert.strictEqual(await A.wide(), 0); await A.shot('128-2-chat-anna');
  // tenuto premuto: Copia · Elimina per tutti (niente Segnala sui miei)
  const last = await A.$('#chBody .ch-msg.me:last-of-type');
  const bb = await last.boundingBox();
  await A.touchscreen.touchStart(bb.x + 20, bb.y + 10); await new Promise(r => setTimeout(r, 650)); await A.touchscreen.touchEnd(); await A.evaluate(() => { const m = document.querySelector('#chMenu'); if (m) m.click(); }); await wait(200);   // il clic che segue il dito alzato non chiude il menu
  assert(await A.vis('#chMenu'), 'menu con il dito tenuto premuto');
  const voci = await A.$$eval('#chMenu .ch-mi', a => a.map(x => x.textContent));
  assert.deepStrictEqual(voci, ['Copia', 'Elimina per tutti', 'Annulla']);
  await A.shot('128-3-menu-messaggio');
  await A.click$('#chMenu [data-i="del"]'); await wait(500);
  assert(DB.msg[1].el, 'eliminato sul server');
  assert(/Messaggio eliminato/.test(await A.txt('#chBody')));
  // ⋮: Silenzia, Profilo, Blocca, Elimina chat
  await A.click$('#chSheet [data-c="menu"]'); await wait(200);
  assert.deepStrictEqual(await A.$$eval('#chMenu .ch-mi', a => a.map(x => x.textContent)), ['Silenzia', 'Profilo di Bruno', 'Blocca Bruno', 'Elimina chat', 'Annulla']);
  await A.click$('#chMenu [data-i="mute"]'); await wait(400);
  assert(DB.chat[0].m[UA].sil, 'silenziata');
  // Indietro del telefono: chat › elenco
  await A.goBack(); await wait(400);
  s = await A.st(); assert.strictEqual(s.view, 'list', 'Indietro torna all\'elenco'); assert(await A.vis('#chSheet'));
  const row = await A.txt('#chBody .ch-row'); console.log('[riga]', row);
  assert(/Bruno/.test(row) && /Tu: Messaggio eliminato|Messaggio eliminato/.test(row) && /🔕/.test(row));
  await A.shot('128-4-elenco-anna');
  await A.goBack(); await wait(400);
  assert(!(await A.vis('#chSheet')), 'Indietro ancora: si chiude');

  // ================= Bruno legge e risponde =================
  const B = await phone('B', UB); await noGuide(B);
  await B.evaluate(() => window.NLChat.load()); await wait(500);
  assert.strictEqual(await B.txt('#btnChatN'), '1', 'numero sul fumetto');
  await B.click$('#btnChat'); await wait(600);
  assert(await B.vis('#chBody .ch-row.ch-unread .ch-dot'), 'pallino dei nuovi');
  await B.click$('#chBody .ch-row'); await wait(700);
  assert(/Ciao Bruno! Hai finito il Gattopardo\?/.test(await B.txt('#chBody')));
  assert(await B.vis('#chBody .ch-msg.it'), 'messaggio di Anna a sinistra');
  assert(/Messaggio eliminato/.test(await B.txt('#chBody')), 'anche Bruno vede «eliminato»');
  await B.type('#chTxt', 'Sì, ieri sera 📚'); await B.click$('#chForm .ch-send'); await wait(600);
  assert.strictEqual(DB.msg[2].da, UB);
  assert.strictEqual(await B.evaluate(() => document.getElementById('btnChatN').hidden), true, 'letto: niente numero');
  // il messaggio di Anna: Copia · Segnala (niente Elimina)
  await B.evaluate(() => document.querySelector('#chBody .ch-msg.it').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))); await wait(200);
  assert.deepStrictEqual(await B.$$eval('#chMenu .ch-mi', a => a.map(x => x.textContent)), ['Copia', 'Segnala', 'Annulla']);
  await B.click$('#chMenu [data-i="x"]'); await wait(150);
  assert.strictEqual(await B.wide(), 0); await B.shot('128-5-chat-bruno');
  // il giro ogni 15 secondi porta il messaggio nuovo di Anna (qui chiamato a mano)
  DB.msg.push({ id: ++DB.n, chat: 'c1', da: UA, tipo: 'testo', testo: 'Me lo presti?', creato: new Date().toISOString(), el: false });
  await B.evaluate(async () => { await new Promise(r => setTimeout(r, 0)); }); await B.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await wait(600);
  assert(/Me lo presti\?/.test(await B.txt('#chBody')), 'arrivato il messaggio nuovo');
  await B.browserContext().close();

  // ================= Carla (non amica) scrive ad Anna: richiesta =================
  const C = await phone('C', UC); await noGuide(C);
  await C.evaluate((id) => window.NLChat.to(id, 'Anna'), UA); await wait(700);
  assert(/arriva a Anna come richiesta/.test(await C.txt('#chBody')), 'avviso della richiesta');
  await C.shot('128-6-carla-richiesta');
  await C.type('#chTxt', 'Ciao, ho visto che hai Pinocchio: lo scambi?'); await C.click$('#chForm .ch-send'); await wait(700);
  assert.strictEqual(DB.chat[1].stato, 'richiesta');
  assert(/Richiesta mandata: potrai scrivere ancora quando Anna risponde/.test(await C.txt('#chFoot')), 'dopo il primo messaggio aspetta');
  await C.evaluate((id) => window.NLChat.to(id, 'Anna'), UA); await wait(400);
  await C.browserContext().close();

  const A2 = await phone('A2', UA); await noGuide(A2);
  await A2.evaluate(() => window.NLAmici.load(true)); await wait(500);
  await A2.evaluate(() => window.NLChat.load()); await wait(400);
  assert.strictEqual(await A2.txt('#btnChatN'), '2', 'la risposta di Bruno e la richiesta di Carla');
  await A2.click$('#btnChat'); await wait(600);
  assert(/Richieste di messaggio 1/.test(await A2.txt('#chBody .ch-reqs')));
  assert.strictEqual(await A2.$$eval('#chBody .ch-list .ch-row', a => a.length), 1, 'la richiesta non sta tra le chat');
  await A2.click$('#chBody .ch-reqs'); await wait(300);
  await A2.shot('128-7-richieste');
  await A2.click$('#chBody .ch-row'); await wait(700);
  const foot = await A2.txt('#chFoot'); console.log('[richiesta]', foot);
  assert(/Carla non è tra i tuoi amici e vuole scriverti/.test(foot) && /Rifiuta/.test(foot) && /Accetta/.test(foot) && /Blocca/.test(foot) && /Segnala/.test(foot));
  assert(!(await A2.$('#chTxt')), 'niente casella prima di rispondere');
  assert.strictEqual(await A2.wide(), 0); await A2.shot('128-8-richiesta-aperta');
  await A2.click$('#chFoot [data-c="reportlast"]'); await wait(300);
  assert(await A2.vis('.ch-rep'));
  assert.deepStrictEqual(await A2.$$eval('.ch-rep input[name="chWhy"] + span', a => a.map(x => x.textContent)), ['Offese o molestie', 'Spam o pubblicità', 'Contenuti non adatti', 'Altro']);
  assert(await A2.$eval('#chRepB', e => e.checked), '«Blocca anche» già spuntata');
  await A2.shot('128-9-segnala');
  await A2.click$('.ch-rep input[value="1"]'); await A2.type('#chWhyT', 'vende libri');
  await A2.click$('.ch-rep [data-r="ok"]'); await wait(700);
  assert.deepStrictEqual(DB.segn, [{ da: UA, su: UC, motivo: 'Spam o pubblicità: vende libri', blocca: true }]);
  assert(DB.blocchi.some(b => b.chi === UA && b.altro === UC), 'bloccata');
  assert(/Hai bloccato Carla/.test(await A2.txt('#chFoot')) || /Non puoi|Rifiuta/.test(await A2.txt('#chFoot')), 'dopo il blocco non si scrive: ' + await A2.txt('#chFoot'));
  await A2.evaluate(() => { const e = document.getElementById('chSheet'); e.dispatchEvent(new MouseEvent('click', { bubbles: true })); });   // tocco fuori dalla finestra await wait(300);

  // ================= Amici e privacy: Possono scrivermi, Persone bloccate =================
  await A2.evaluate(() => window.NLAmici.open(true)); await wait(600);
  const priv = await A2.txt('#friBody'); assert(/Possono scrivermi/.test(priv) && /Gli amici dei miei amici/.test(priv) && /Persone bloccate/.test(priv));
  assert(await A2.$eval('input[name="friScr"][value="amici_amici"]', e => e.checked), 'di partenza amici degli amici');
  await A2.click$('input[name="friScr"][value="amici"]'); await wait(500);
  assert.strictEqual(DB.prof[UA].scrivermi, 'amici'); assert.deepStrictEqual(DB.post.pop().body, { id: UA, scrivermi: 'amici' });
  await A2.evaluate(() => { const r = [...document.querySelectorAll('#friBody .fr-h')].find(h => /Chat/.test(h.textContent)); r.scrollIntoView(); }); await A2.shot('128-10-privacy');
  await A2.click$('#friBody [data-f="blocked"]'); await wait(500);
  assert(/Carla/.test(await A2.txt('.ch-blk')));
  await A2.shot('128-11-bloccati');
  await A2.click$('.ch-blk [data-b="un"]'); await wait(500);
  assert(!DB.blocchi.some(b => b.chi === UA && b.altro === UC), 'sbloccata');
  assert(/Non hai bloccato nessuno/.test(await A2.txt('.ch-blk')));
  await A2.click$('.ch-blk [data-b="x"]'); await wait(200);
  // «Scrivi» nell'elenco degli amici e nel profilo
  await A2.click$('#friBody [data-f="optsback"]'); await wait(300);
  assert(await A2.vis('#friBody .ch-to[data-id="' + UB + '"]'), 'fumetto accanto a Bruno');
  await A2.shot('128-12-amici');
  await A2.click$('#friBody .ch-to[data-id="' + UB + '"]'); await wait(800);
  s = await A2.st(); assert.strictEqual(s.cur, 'c1', 'apre la chat che c\'è già');
  await A2.evaluate(() => { const e = document.getElementById('chSheet'); e.dispatchEvent(new MouseEvent('click', { bubbles: true })); });   // tocco fuori dalla finestra await wait(300);
  await A2.evaluate((id) => window.NLProfilo.open(id), UB); await wait(800);
  assert(await A2.vis('#profBody [data-p="chat"]'), '«Scrivi» nel profilo');
  assert.strictEqual(await A2.wide(), 0); await A2.shot('128-13-profilo');
  await A2.click$('#profBody [data-p="chat"]'); await wait(800);
  assert.strictEqual((await A2.st()).cur, 'c1');
  await A2.evaluate(() => { const e = document.getElementById('chSheet'); e.dispatchEvent(new MouseEvent('click', { bubbles: true })); });   // tocco fuori dalla finestra await wait(300);

  // ================= campanella: riassunto «messaggi» =================
  DB.notifiche = [{ utente: UA, id: 'n1', da: UB, nome: 'Bruno', tipo: 'messaggi', rif: '3:1:0', titolo: 'Bruno', creata: new Date().toISOString(), letta: false },
    { utente: UA, id: 'n2', da: null, nome: null, tipo: 'messaggi', rif: '4:2:2', titolo: 'Carla, Dario', creata: new Date().toISOString(), letta: false }];
  await A2.evaluate(() => window.NLNotifiche.load()); await wait(400);
  await A2.evaluate(() => window.NLNotifiche.open()); await wait(400);
  const nt = await A2.$$eval('#ntBody .nt-txt', a => a.map(x => x.textContent)); console.log('[campanella]', nt);
  assert.deepStrictEqual(nt, ['3 messaggi nuovi da Bruno', 'Carla, Dario vogliono scriverti: hai 2 richieste di messaggio']);
  await A2.click$('#ntBody [data-n="n1"]'); await wait(700);
  assert(await A2.vis('#chSheet'), 'il tocco apre la chat');

  assert.deepStrictEqual(errors, [], 'nessun errore JavaScript');
  console.log('e2e128 OK');
  await browser.close(); server.close();
})().catch(async e => { console.error('e2e128 FALLITA:', e && e.stack || e); console.error(require('util').inspect(DB, { depth: 3 }).slice(0, 2500)); process.exit(1); });
