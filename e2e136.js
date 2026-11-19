const CFG = require("./_config");
const H = require('./_harness');
// moduli: social, amici, notifiche, ricerche, guida   (senza questi file nell'app la prova si salta: vedi esegui.js)
// Giro 12 (Piero, 19/11/2026), Supabase finto.
// 1) Bruno (account, niente chiave): il telefono dice al server «non ho un’API» (chiavi_dichiara); in «API Google e worker» c'è
//    «Chiedila a un amico» con Anna (ha un’API sua) e non con Carla (non ce l'ha); «Chiedimela» → chiedi_chiavi, poi «Richiesta mandata».
// 2) Anna (API sua): dichiara sì; nella campanella «Bruno ti chiede in prestito l’API Google Libri» con «Prestala» → «Presta a Bruno».
// 3) Chi installa da zero: guida, poi il percorso a schermo intero (Passo 1 di 3 Accedi · 2 chiave · 3 primo libro); «Più tardi» salta;
//    «Crea la tua» apre la guida dell’API e, chiusa, il percorso riprende; «Aggiungi un libro» apre il + e il percorso finisce.
// 4) Percorso con l'account: il passo 1 si salta da solo, al passo 2 c'è anche «Chiedila a un amico».
// SCHERMATE=cartella per le fotografie (360).
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm', '.webp': 'image/webp' };
const UA = '00000000-0000-0000-0000-0000000000a1', UB = '00000000-0000-0000-0000-0000000000b2', UC = '00000000-0000-0000-0000-0000000000c3';
const KEY = 'AIzaANNA0123456789abcdefghijklmnopq';
const DB = { prof: { [UA]: 'Anna', [UB]: 'Bruno', [UC]: 'Carla Lunghissimo N.' }, ho: { [UA]: { gb: true, sbn: false } }, dette: [], chieste: [], avvisi: {}, keys: [] };
const uidOf = (req) => { const m = /Bearer AT-([\w-]+)/.exec(req.headers.authorization || ''); return m ? m[1] : null; };
function fake(req, res, body, url) {
  const send = (st, j) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(j === undefined ? '' : JSON.stringify(j)); };
  const p = url.pathname.replace(/^\/finto/, '');
  if (req.headers.apikey !== 'chiave-finta') return send(401, { message: 'no api key' });
  if (p === '/auth/v1/settings') return send(200, { external: { google: true } });
  if (p === '/auth/v1/token') { const id = String(body.refresh_token || '').slice(3); return send(200, { access_token: 'AT-' + id, refresh_token: 'RT-' + id, expires_in: 3600, user: { id } }); }
  const me = uidOf(req); if (!me) return send(401, { message: 'JWT' });
  if (p === '/rest/v1/libri' && req.method === 'GET') return send(200, []);
  if (p === '/rest/v1/libri') return send(201);
  if (p === '/rest/v1/profili' && req.method === 'GET') return send(200, [{ utente: DB.prof[me], nome: DB.prof[me], desideri: true, libreria: true }]);
  if (p === '/rest/v1/profili') return send(201);
  if (p === '/rest/v1/rpc/miei_amici') return send(200, Object.keys(DB.prof).filter(id => id !== me).map(id => ({ id, utente: DB.prof[id], nome: DB.prof[id], stato: 'amici', verso: 'inviata', creato: '2026-11-16T10:00:00Z' })));
  if (p === '/rest/v1/rpc/chiavi_mie') return send(200, DB.keys.filter(k => k.da === me).map(k => ({ da: k.da, a: k.a, nome: DB.prof[k.a], gb_key: 'si', sbn: '' })));
  if (p === '/rest/v1/rpc/chiavi_dichiara') { DB.dette.push({ me, gb: body.gb, sbn: body.sbn }); DB.ho[me] = { gb: body.gb, sbn: body.sbn }; return send(204); }
  if (p === '/rest/v1/rpc/amici_chiavi') return send(200, Object.keys(DB.prof).filter(id => id !== me).map(id => ({ id, gb: !!(DB.ho[id] || {}).gb, sbn: !!(DB.ho[id] || {}).sbn, chiesta: (DB.chieste.find(x => x.da === me && x.a === id) || {}).il || null })));
  if (p === '/rest/v1/rpc/chiedi_chiavi') {
    if (DB.chieste.find(x => x.da === me && x.a === body.a)) return send(200, 'presto');
    DB.chieste.push({ da: me, a: body.a, il: new Date().toISOString() });
    (DB.avvisi[body.a] = DB.avvisi[body.a] || []).push({ id: 'ck' + DB.chieste.length, da: me, nome: DB.prof[me], tipo: 'chiedi_chiavi', rif: '', titolo: '', creata: new Date().toISOString(), letta: false });
    return send(200, 'ok');
  }
  if (p === '/rest/v1/rpc/presta_chiavi') { DB.keys.push({ da: me, a: body.a, gb: body.gb_key }); return send(204); }
  if (p === '/rest/v1/rpc/mie_notifiche') return send(200, DB.avvisi[me] || []);
  if (p === '/rest/v1/rpc/notifiche_lette') return send(204);
  if (p === '/rest/v1/rpc/da_archivio') return send(200, null);
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
}).listen(CFG.port(8336));
const base = 'http://localhost:' + CFG.port(8336);

(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const wait = H.wait;
  const SHOTS = process.env.SCHERMATE;
  // opts: uid (account già dentro), nuovo (prima apertura in assoluto: né libri né impostazioni), dark
  async function phone(name, o) {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: 360, height: 800, deviceScaleFactor: SHOTS ? 1 : 2, isMobile: true, hasTouch: true });
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    await page.evaluateOnNewDocument((u, o) => {
      window.NL_SOCIAL = { url: u, key: 'chiave-finta', gClient: 'client-finto' };
      const P = 'prova:';
      if (o.uid && !localStorage.getItem(P + 'catalogo-libri-social-auth')) localStorage.setItem(P + 'catalogo-libri-social-auth', JSON.stringify({ at: 'AT-' + o.uid, rt: 'RT-' + o.uid, exp: Date.now() + 3e6, uid: o.uid, email: 'x@esempio.it' }));
      if (!localStorage.getItem(P + 'catalogo-libri-layout')) { localStorage.setItem(P + 'catalogo-libri-layout', JSON.stringify({ v: 'a' })); localStorage.setItem(P + 'catalogo-libri-card', JSON.stringify({ v: 'd' })); }
    }, base + '/finto', o);
    await page.setRequestInterception(true);
    page.on('request', r => { if (r.url().startsWith(base)) return r.continue(); if (/gsi\/client/.test(r.url())) return r.respond({ status: 200, contentType: 'text/javascript', body: '' });   // il pulsante di Google: script vuoto
      r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"totalItems":0}' }); });
    await page.goto(base + '/next-libris-prova/' + (o.nuovo ? '?guida=1' : ''), { waitUntil: 'load' });   // ?guida=1: la guida si apre da sola (vedi _harness.js) await wait(2000);
    page.click$ = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error('manca ' + s); e.click(); }, sel);
    page.vis = sel => page.evaluate(s => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, sel);
    page.txt = sel => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
    page.shot = async (n) => { if (SHOTS) { await wait(250); await page.screenshot({ path: path.join(SHOTS, n + '.png') }); } };
    page.wide = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    page.pt = () => page.evaluate(() => { const e = document.getElementById('percorso'); return e && !e.hidden ? { n: document.getElementById('ptN').textContent, h: e.querySelector('.gd-h').textContent, b: [...e.querySelectorAll('.gd-try')].map(x => x.textContent) } : null; });
    return page;
  }

  // ================= 1) Bruno: niente chiave, la chiede ad Anna =================
  const B = await phone('B', { uid: UB });
  await B.evaluate(() => window.NLAmici.load(true)); await wait(900);
  assert.deepStrictEqual(DB.dette, [{ me: UB, gb: false, sbn: false }], 'Bruno dice al server solo «no, no»: ' + JSON.stringify(DB.dette));
  await B.evaluate(() => window.NLAmici.load(true)); await wait(600);
  assert.strictEqual(DB.dette.length, 1, 'il sì/no si manda una volta sola finché non cambia');
  await B.evaluate(() => window.NLAmici.keys()); await wait(500);
  let kw = await B.txt('#kwBody'); console.log('[Bruno, chiave]', kw.slice(-260));
  assert(/Crea la tua API Google/.test(kw) && /Chiedila a un amico/.test(kw), 'crea oppure chiedi');
  assert.deepStrictEqual(await B.$$eval('#kwBody .kw-ask .fr-who', a => a.map(x => x.textContent)), ['Anna'], 'solo chi ha un’API sua (non Carla)');
  assert.strictEqual(await B.txt('#kwBody [data-f="keyask"]'), 'Chiedimela');
  assert.strictEqual(await B.wide(), 0); await B.shot('136-1-chiedila');
  await B.click$('#kwBody [data-f="keyask"]'); await wait(600);
  assert.deepStrictEqual(DB.chieste.map(x => [x.da, x.a]), [[UB, UA]], 'richiesta arrivata al server');
  assert(/Richiesta mandata a Anna/.test(await B.$eval('#toastTxt', e => e.textContent)));
  assert(!(await B.$('#kwBody [data-f="keyask"]')) && /Richiesta mandata/.test(await B.txt('#kwBody .kw-ask')), 'al posto del tasto: «Richiesta mandata»');
  await B.shot('136-2-mandata');
  await B.reload({ waitUntil: 'load' }); await wait(1500);
  await B.evaluate(() => window.NLAmici.load(true)); await wait(600);
  await B.evaluate(() => window.NLAmici.keys()); await wait(500);
  assert(!(await B.$('#kwBody [data-f="keyask"]')) && /Richiesta mandata/.test(await B.txt('#kwBody .kw-ask')), 'resta «Richiesta mandata» anche dopo la riapertura');
  // «Chiedimela» anche nel profilo dell'amico (Piero, 19/11/2026): Anna sì (già chiesta), Carla no (niente chiave)
  await B.evaluate(() => { const s = document.getElementById('kwSheet'); if (s) s.hidden = true; }); await wait(200);
  await B.evaluate((id) => window.NLProfilo.open(id), UA); await wait(900);
  assert(/Anna ha un’API Google Libri sua/.test(await B.txt('#profBody .pf-ask')) && /Richiesta mandata/.test(await B.txt('#profBody .pf-ask')) && !(await B.$('#profBody [data-p="ask"]')), 'profilo di Anna: già chiesta');
  await B.shot('136-2b-profilo');
  await B.evaluate(() => window.NLProfilo.close()); await wait(300);
  await B.evaluate((id) => window.NLProfilo.open(id), UC); await wait(900);
  assert(!(await B.$('#profBody .pf-ask')), 'profilo di Carla: niente «Chiedimela»');
  await B.evaluate(() => window.NLProfilo.close()); await wait(300);
  await B.browserContext().close();

  // ================= 2) Anna: ha l’API, riceve la richiesta =================
  const A = await phone('A', { uid: UA });
  await A.evaluate((k) => { const s = window.NL.settings; s.gbKey = k; window.NL.saveSettings(); }, KEY);
  await A.evaluate(() => window.NLAmici.load(true)); await wait(900);
  assert.deepStrictEqual(DB.dette.filter(x => x.me === UA).pop(), { me: UA, gb: true, sbn: false }, 'Anna dice «sì» (mai l’API)');
  assert(!JSON.stringify(DB.dette).includes(KEY), 'l’API non viaggia');
  await A.evaluate(() => window.NLAmici.keys()); await wait(400);
  assert(!/Chiedila a un amico/.test(await A.txt('#kwBody')), 'chi ha la sua API non vede «Chiedila a un amico»');
  await A.click$('#kwClose'); await wait(200);
  await A.evaluate(() => window.NLNotifiche.load()); await wait(600);
  await A.evaluate(() => window.NLNotifiche.open()); await wait(400);
  const nt = await A.txt('#ntBody'); console.log('[Anna, campanella]', nt);
  assert(/Bruno ti chiede in prestito l’API Google Libri/.test(nt) && /Prestala/.test(nt));
  assert.strictEqual(await A.wide(), 0); await A.shot('136-3-prestala');
  await A.click$('#ntBody [data-lendkey]'); await wait(600);
  assert(await A.vis('#keySheet') && !(await A.vis('#ntSheet')), 'si apre «Presta a …»');
  assert.strictEqual(await A.txt('#keyH'), 'Presta a Bruno');
  await A.click$('#keyGo'); await wait(700);
  assert.deepStrictEqual(DB.keys.map(k => [k.da, k.a]), [[UA, UB]], 'prestata');
  await A.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); }); await wait(200);
  await A.evaluate(() => window.NLNotifiche.open()); await wait(400);
  assert(/Gliela presti ✓/.test(await A.txt('#ntBody')) && !(await A.$('#ntBody [data-lendkey]')), 'dopo il prestito: «Gliela presti ✓»');
  await A.browserContext().close();

  // ================= 3) chi installa da zero: guida, poi il percorso =================
  const N = await phone('N', { nuovo: true }); await H.sleep(1200);
  assert(await N.evaluate(() => { const g = document.getElementById('guida'); return !!g && !g.hidden; }), 'prima la guida');
  assert.strictEqual(await N.pt(), null, 'il percorso aspetta la guida');
  await N.click$('.gd-skip'); await H.sleep(1300);
  let s = await N.pt(); console.log('[percorso]', JSON.stringify(s));
  assert.deepStrictEqual(s, { n: 'Passo 1 di 3', h: 'Accedi con Google', b: ['Accedi con Google'] });
  assert.strictEqual(await N.wide(), 0); await N.shot('136-4-passo1');
  // «Accedi con Google» apre la finestra dell'account; chiusa senza entrare, il passo torna
  await N.click$('#percorso [data-pt="login"]'); await wait(700);
  assert(await N.vis('#accSheet') && (await N.pt()) === null, 'finestra dell\'account sopra, percorso nascosto');
  await N.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); }); await H.sleep(1500);
  assert.strictEqual((await N.pt()).n, 'Passo 1 di 3', 'chiusa senza entrare: di nuovo il passo 1');
  await N.click$('#percorso [data-pt="later"]'); await wait(400);
  s = await N.pt();
  assert.deepStrictEqual(s, { n: 'Passo 2 di 3', h: 'Trova più libri', b: ['Crea la tua (gratis)'] }, 'senza account niente «Chiedila a un amico»: ' + JSON.stringify(s));
  await N.click$('#percorso [data-pt="make"]'); await wait(700);
  assert(await N.vis('#kgSheet') && (await N.pt()) === null, 'guida dell’API');
  await N.click$('#kgClose'); await H.sleep(1500);
  assert.strictEqual((await N.pt()).n, 'Passo 2 di 3', 'chiusa senza API: di nuovo il passo 2');
  // riapertura a metà: il percorso riprende dal passo 2, la guida non torna
  await N.reload({ waitUntil: 'load' }); await H.sleep(3200);
  assert(await N.evaluate(() => { const g = document.getElementById('guida'); return !g || g.hidden; }), 'la guida non torna');
  assert.strictEqual((await N.pt()).n, 'Passo 2 di 3', 'riprende dal passo 2');
  await N.click$('#percorso [data-pt="later"]'); await wait(400);
  s = await N.pt();
  assert.deepStrictEqual(s, { n: 'Passo 3 di 3', h: 'Aggiungi il primo libro', b: ['Aggiungi un libro'] });
  await N.shot('136-5-passo3');
  await N.click$('#percorso [data-pt="add"]'); await wait(600);
  assert(await N.vis('#layAdd') && (await N.pt()) === null, 'si apre il +');
  assert.strictEqual(await N.evaluate(() => window.NLGuida.path()), 0, 'percorso finito');
  await N.reload({ waitUntil: 'load' }); await H.sleep(3200);
  assert.strictEqual(await N.pt(), null, 'non torna più');
  await N.browserContext().close();

  // ================= 4) percorso con l'account (Carla): passo 1 saltato, «Chiedila a un amico» =================
  const C = await phone('C', { uid: UC, nuovo: true }); await H.sleep(1200);
  await C.click$('.gd-skip'); await H.sleep(1500);
  s = await C.pt(); console.log('[percorso con account]', JSON.stringify(s));
  assert.deepStrictEqual(s, { n: 'Passo 2 di 3', h: 'Trova più libri', b: ['Crea la tua (gratis)', 'Chiedila a un amico'] });
  assert.strictEqual(await C.wide(), 0); await C.shot('136-6-passo2');
  await C.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); }); await C.shot('136-7-passo2-scuro');
  await C.click$('#percorso [data-pt="askf"]'); await wait(900);
  assert(await C.vis('#kwSheet') && /Chiedila a un amico/.test(await C.txt('#kwBody')) && (await C.pt()) === null, 'finestra dell’API con «Chiedila a un amico»');
  await C.click$('#kwClose'); await H.sleep(600);
  await C.evaluate((id) => window.NLProfilo.open(id), UA); await wait(900);   // «Chiedimela» dal profilo di Anna
  assert.strictEqual(await C.txt('#profBody [data-p="ask"]'), 'Chiedimela');
  await C.click$('#profBody [data-p="ask"]'); await wait(700);
  assert(DB.chieste.some(x => x.da === UC && x.a === UA), 'richiesta dal profilo arrivata al server');
  assert(/Richiesta mandata/.test(await C.txt('#profBody .pf-ask')) && !(await C.$('#profBody [data-p="ask"]')), 'nel profilo: «Richiesta mandata»');
  await C.evaluate(() => window.NLProfilo.close()); await wait(300);
  await C.evaluate(() => window.NLAmici.keys()); await wait(500);
  await C.click$('#kwClose'); await H.sleep(1500);
  assert.strictEqual((await C.pt()).n, 'Passo 2 di 3');
  // un’API arriva (qui: messa a mano): il passo 2 si salta da solo
  await C.evaluate((k) => { const st = window.NL.settings; st.gbKey = k; window.NL.saveSettings(); window.NLGuida.pathShow(); }, KEY); await wait(400);
  assert.strictEqual((await C.pt()).n, 'Passo 3 di 3', 'con l’API si passa al primo libro');

  if (errors.length) { console.log(errors); throw new Error('errori nella pagina'); }
  console.log('e2e136 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
