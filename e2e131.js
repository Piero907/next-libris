const CFG = require("./_config");
const H = require('./_harness');
// moduli: social, chat, admin   (senza questi file nell'app la prova si salta: vedi esegui.js)
// Giro 9e (Piero, 18/11/2026): pannello Amministrazione. Database finto con le risposte di supabase/023_chat.sql (admin_*).
// Bruno (non amministratore): admin.js non si carica, niente voce nel Menu, nessuna funzione chiamata.
// Piero (amministratore): Menu › Amministrazione con 5 schede; segnalazione con i messaggi prima (testo pulito), Sospendi con conferma,
// «Va tutto bene» subito, Chiuse; Sospesi › Riattiva; Avviso con anteprima e conferma; Numeri; Archivio (cerca, correggi, togli);
// Indietro del telefono; tocco sull'avviso apre il caso; «non autorizzato» dal server chiude il pannello. SCHERMATE=cartella (360).
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm', '.webp': 'image/webp' };

const UA = '00000000-0000-0000-0000-0000000000a1', UB = '00000000-0000-0000-0000-0000000000b2', UC = '00000000-0000-0000-0000-0000000000c3';
const DB = { prof: { [UA]: { utente: 'Piero R.' }, [UB]: { utente: 'Bruno' }, [UC]: { utente: 'Carla' } }, admin: [UA], calls: [], avvisi: [],
  seg: [{ id: 's1', creata: new Date(Date.now() - 7200e3).toISOString(), stato: 'aperta', motivo: 'Offese o molestie: mi insulta', messaggio: 12, da_id: UB, da_nome: 'Bruno', su_id: UC, su_nome: 'Carla', persone: 3, fermo: 'fermo', chiusa_il: null,
           copia: [{ id: 10, da: UB, nome: 'Bruno', tipo: 'testo', testo: 'Ciao, me lo presti?', creato: '2026-11-18T10:00:00Z', el: false }, { id: 11, da: UC, nome: 'Carla', tipo: 'testo', testo: '', creato: '2026-11-18T10:01:00Z', el: true }, { id: 12, da: UC, nome: 'Carla', tipo: 'testo', testo: '<img src=x onerror=alert(1)>brutta parola', creato: '2026-11-18T10:02:00Z', el: false }] },
         { id: 's2', creata: new Date(Date.now() - 90000e3).toISOString(), stato: 'aperta', motivo: 'Spam o pubblicità', messaggio: 20, da_id: UA, da_nome: 'Piero R.', su_id: UB, su_nome: 'Bruno', persone: 1, fermo: '', chiusa_il: null, copia: [{ id: 20, da: UB, nome: 'Bruno', tipo: 'libro', testo: 'compralo!', libro: 'Il Gattopardo', creato: '2026-11-17T10:00:00Z', el: false }] }],
  sosp: [{ id: UC, nome: 'Carla', tipo: 'fermo', dal: '2026-11-18T10:05:00Z', automatico: true }],
  ar: [{ isbn: '9788807900341', dati: { t: 'Il Gattopardo', a: 'Tomasi di Lampedusa', e: 'Feltrinelli', y: '1958', img: 'https://covers.openlibrary.org/b/id/1-M.jpg', imgL: 'https://covers.openlibrary.org/b/id/1-L.jpg', ds: 'Romanzo.', pg: '330' }, aggiornato: '2026-11-17T10:00:00Z' }] };
const nome = id => (DB.prof[id] || {}).utente || '';
const uidOf = (req) => { const m = /Bearer AT-([\w-]+)/.exec(req.headers.authorization || ''); return m ? m[1] : null; };
function fake(req, res, body, url) {
  const send = (st, j) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(j === undefined ? '' : JSON.stringify(j)); };
  const err = (m, st) => send(st || 400, { code: 'P0001', message: m });
  const p = url.pathname.replace(/^\/finto/, '');
  if (req.headers.apikey !== 'chiave-finta') return send(401, { message: 'no api key' });
  if (p === '/auth/v1/settings') return send(200, { external: { google: true } });
  if (p === '/auth/v1/token') { const id = String(body.refresh_token || '').slice(3); return send(200, { access_token: 'AT-' + id, refresh_token: 'RT-' + id, expires_in: 3600, user: { id } }); }
  const me = uidOf(req); if (!me) return send(401, { message: 'JWT' });
  const R = (n) => p === '/rest/v1/rpc/' + n;
  if (p === '/rest/v1/libri' && req.method === 'GET') return send(200, []);
  if (p === '/rest/v1/libri') return send(201);
  if (p === '/rest/v1/profili' && req.method === 'GET') return send(200, [{ utente: nome(me), nome: nome(me), desideri: true, libreria: true, amici: true, regali: true, creato: '2026-11-01T10:00:00Z', foto: null, scrivermi: 'amici_amici' }]);
  if (p === '/rest/v1/profili') return send(201);
  if (R('admin_sono')) return send(200, DB.admin.includes(me));
  if (p.startsWith('/rest/v1/rpc/admin_')) {
    DB.calls.push(me + ':' + p.slice(13));
    if (!DB.admin.includes(me)) return send(403, { code: '42501', message: 'non autorizzato' });   // come admin_controllo()
    if (R('admin_numeri')) return send(200, { utenti: 3, attivi_mese: 2, libri: 1240, archivio: 57, spazio: 12.5 * 1048576, spazio_max: 524288000, ricerche_oggi: 230, ricerche_chiave_max: 180, chat: 4, messaggi: 88, messaggi_spazio: 65536, segnalazioni: DB.seg.filter(x => x.stato === 'aperta').length, sospesi: DB.sosp.length });
    if (R('admin_segnalazioni')) return send(200, DB.seg.filter(x => (body.stato === 'aperta') === (x.stato === 'aperta')));
    if (R('admin_decidi')) { const g = DB.seg.find(x => x.id === body.id); if (!g) return err('segnalazione non trovata');
      g.stato = { bene: 'bene', ferma: 'ferma', sospendi: 'sospesa' }[body.esito]; g.chiusa_il = new Date().toISOString();
      if (body.esito === 'bene') DB.sosp = DB.sosp.filter(x => x.id !== g.su_id);
      if (body.esito === 'sospendi') { DB.sosp = DB.sosp.filter(x => x.id !== g.su_id); DB.sosp.push({ id: g.su_id, nome: g.su_nome, tipo: 'sospeso', dal: new Date().toISOString(), automatico: false }); }
      return send(204); }
    if (R('admin_sospesi')) return send(200, DB.sosp);
    if (R('admin_riattiva')) { DB.sosp = DB.sosp.filter(x => x.id !== body.utente); return send(204); }
    if (R('admin_cerca')) return send(200, [{ id: 'uM', utente: 'Marta R.' }, { id: 'uB', utente: 'Bruno T.' }]);
    if (R('admin_avviso')) { DB.avvisi.push(body); return send(200, body.persone ? body.persone.length : 3); }
    if (R('admin_archivio_cerca')) { const q = String(body.q).toLowerCase(); return send(200, DB.ar.filter(r => r.isbn === q || (r.dati.t + ' ' + r.dati.a).toLowerCase().includes(q))); }
    if (R('admin_archivio_salva')) { const r = DB.ar.find(x => x.isbn === body.isbn); if (!r) return err('libro non trovato'); r.dati = body.dati; return send(204); }
    if (R('admin_archivio_togli')) { DB.ar = DB.ar.filter(x => x.isbn !== body.isbn); return send(204); }
  }
  if (R('miei_amici')) return send(200, []);
  if (R('chat_numeri')) return send(200, { nuovi: 0, richieste: 0 });
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
}).listen(CFG.port(8331));
const base = 'http://localhost:' + CFG.port(8331);

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
    return page;
  }

  async function noGuide(pg) { await pg.evaluate(() => { document.querySelectorAll('.sheet:not([hidden])').forEach(s => { if (s.id !== 'adSheet') s.hidden = true; }); document.documentElement.classList.remove('guida-aperta'); }); }
  const st = pg => pg.evaluate(() => window.NLAdmin.state());

  // ============ Bruno non è amministratore: niente admin.js, niente voce nel Menu ============
  const B = await phone('B', UB); await noGuide(B); await wait(1200);
  assert(!(await B.evaluate(() => !!window.NLAdmin || !!document.getElementById('adminJs') || !!document.getElementById('goAdmin'))), 'admin.js solo per gli amministratori');
  assert(!DB.calls.some(c => c.startsWith(UB)), 'nessuna funzione admin chiamata da Bruno');
  await B.browserContext().close();

  // ============ Piero è amministratore ============
  const A = await phone('A', UA); await noGuide(A); await wait(1500);
  assert(await A.evaluate(() => !!window.NLAdmin && !!document.getElementById('goAdmin')), 'admin.js caricato e voce nel Menu');
  await A.evaluate(() => window.NL.openMenu()); await wait(400);
  assert(/Amministrazione/.test(await A.txt('#goAdmin')) && /2/.test(await A.txt('#goAdminN')), 'voce con il numero delle aperte');
  await A.shot('131-0-menu');
  await A.click$('#goAdmin'); await wait(900);
  assert(await A.vis('#adSheet'));
  const tabs = await A.$$eval('#adTabs .ad-tab', a => a.map(x => x.textContent.trim())); console.log('[schede]', tabs);
  assert.deepStrictEqual(tabs.map(t => t.replace(/\s*\d+$/, '')), ['Segnalazioni', 'Sospesi', 'Avviso', 'Numeri', 'Archivio']);
  assert(/Bruno su Carla/.test(await A.txt('#adBody')) && /Offese o molestie · 3 persone/.test(await A.txt('#adBody')) && /Fermo/.test(await A.txt('#adBody')));
  assert(await A.wide() <= 0, 'niente scorrimento orizzontale');
  await A.shot('131-1-segnalazioni');
  // apri la prima: messaggio segnalato e i prima, testo «pulito»
  await A.click$('#adBody [data-a="seg"][data-id="s1"]'); await wait(400);
  let b = await A.txt('#adBody'); console.log('[seg]', b.slice(0, 300));
  assert(/mi insulta/.test(b) && /Messaggio eliminato/.test(b) && /i 2 messaggi prima/.test(b));
  assert(await A.evaluate(() => /onerror/.test(document.querySelector('.ad-hit').textContent) && !document.querySelector('.ad-hit img')), 'testo segnalato mostrato come testo');
  await A.shot('131-2-dettaglio');
  // Indietro del telefono: dal dettaglio all'elenco
  await A.goBack(); await wait(400);
  assert.strictEqual((await st(A)).det, null); assert(await A.vis('#adSheet'));
  // Sospendi con conferma
  await A.click$('#adBody [data-a="seg"][data-id="s1"]'); await wait(300);
  await A.click$('#adFoot [data-a="sospendi"]'); await wait(200);
  assert(/Sospendere Carla\?/.test(await A.txt('#chMenu')) && /non potrà più scrivere a nessuno/.test(await A.txt('#chMenu')));
  await A.shot('131-3-sospendi');
  await A.click$('#chMenu [data-i="x"]'); await wait(150);
  assert.strictEqual(DB.seg[0].stato, 'aperta', 'Annulla non sospende');
  await A.click$('#adFoot [data-a="sospendi"]'); await wait(150);
  await A.click$('#chMenu [data-i="ok"]'); await wait(900);
  assert.strictEqual(DB.seg[0].stato, 'sospesa'); assert.strictEqual((await st(A)).det, null, 'torna all\'elenco');
  assert(!/Bruno su Carla/.test(await A.txt('#adBody')));
  // «Va tutto bene» subito, senza conferma
  await A.click$('#adBody [data-a="seg"][data-id="s2"]'); await wait(300);
  assert(/Il Gattopardo/.test(await A.txt('#adBody')));
  await A.click$('#adFoot [data-a="bene"]'); await wait(900);
  assert.strictEqual(DB.seg[1].stato, 'bene'); assert(!(await A.$('#chMenu')));
  assert(/Nessuna segnalazione aperta/.test(await A.txt('#adBody')));
  await A.click$('#adBody [data-a="closed"]'); await wait(500);
  assert(/Sospesa/.test(await A.txt('#adBody')) && /Va tutto bene/.test(await A.txt('#adBody')), 'chiuse con l\'esito');
  // Sospesi › Riattiva
  await A.click$('#adTabs [data-t="sosp"]'); await wait(500);
  assert(/Carla/.test(await A.txt('#adBody')) && /Sospeso/.test(await A.txt('#adBody')));
  await A.click$('#adBody [data-a="riattiva"]'); await wait(500);
  assert(!DB.sosp.length && /Nessuna persona/.test(await A.txt('#adBody')));
  // Avviso: anteprima e conferma
  await A.click$('#adTabs [data-t="av"]'); await wait(400);
  assert(await A.evaluate(() => document.getElementById('adAvGo').disabled), 'senza testo il tasto è spento');
  await A.type('#adAvT', 'Novità: la chat!'); await A.type('#adAvX', 'Da oggi puoi scrivere ai tuoi amici.'); await wait(200);
  assert(/Novità: la chat! Da oggi puoi scrivere/.test(await A.txt('#adAvP')), 'anteprima');
  assert(/Manda a 3 persone/.test(await A.txt('#adAvGo')));
  await A.shot('131-4-avviso');
  await A.click$('#adAvGo'); await wait(200);
  assert(/Lo mando a 3 persone\?/.test(await A.txt('#chMenu')) && /Non si può ritirare/.test(await A.txt('#chMenu')));
  await A.click$('#chMenu [data-i="ok"]'); await wait(700);
  assert.deepStrictEqual(DB.avvisi, [{ titolo: 'Novità: la chat!', testo: 'Da oggi puoi scrivere ai tuoi amici.', persone: null }]);
  // giro 10: a persone scelte
  await A.click$('#adTabs [data-t="av"]'); await wait(300);
  await A.click$('[data-a="avmode"][data-m="scelte"]'); await wait(200);
  await A.type('#adAvT', 'Prova'); await A.type('#adAvX', 'Solo a te.');
  assert(await A.evaluate(() => document.getElementById('adAvGo').disabled), 'senza persone non si manda');
  await A.type('#adAvQ', 'ar'); await wait(700);
  await A.click$('#adAvR [data-a="avadd"][data-id="uM"]'); await wait(200);
  assert(/Manda a 1 persona/.test(await A.txt('#adAvGo')) && /Marta R\./.test(await A.txt('#adAvS')));
  await A.shot('131-4b-avviso-persone');
  await A.click$('#adAvGo'); await wait(200);
  assert(/Lo mando a Marta R\.\?/.test(await A.txt('#chMenu')));
  await A.click$('#chMenu [data-i="ok"]'); await wait(700);
  assert.deepStrictEqual(DB.avvisi[1], { titolo: 'Prova', testo: 'Solo a te.', persone: ['uM'] });
  // Numeri
  await A.click$('#adTabs [data-t="num"]'); await wait(500);
  b = await A.txt('#adBody'); console.log('[numeri]', b);
  assert(/3 utenti/.test(b) && /1\.240 libri/.test(b) && /12,5 MB su 500 MB/.test(b) && /230 ricerche Google oggi/.test(b) && /180 su 1\.000/.test(b));
  await A.shot('131-5-numeri');
  // Archivio: cerca, correggi, togli
  await A.click$('#adTabs [data-t="ar"]'); await wait(300);
  await A.type('#adArQ', 'gatto'); await A.click$('#adArF button'); await wait(500);
  assert(/Il Gattopardo/.test(await A.txt('#adBody')));
  await A.click$('#adBody [data-a="ared"]'); await wait(300);
  await A.shot('131-6-libro');
  await A.evaluate(() => { const y = document.getElementById('adAr_y'); y.value = '1957'; const i = document.getElementById('adAr_img'); i.value = 'https://covers.openlibrary.org/b/id/2-M.jpg'; });
  await A.click$('#adFoot [data-a="arsalva"]'); await wait(700);
  assert.strictEqual(DB.ar[0].dati.y, '1957'); assert.strictEqual(DB.ar[0].dati.pg, '330', 'gli altri dati restano');
  assert(!DB.ar[0].dati.imgL, 'copertina cambiata: via la grande vecchia');
  assert.strictEqual((await st(A)).arEd, null, 'dopo Salva si torna ai risultati');
  await A.click$('#adBody [data-a="ared"]'); await wait(300);
  await A.click$('#adFoot [data-a="artogli"]'); await wait(200);
  await A.click$('#chMenu [data-i="ok"]'); await wait(700);
  assert(!DB.ar.length && /Nessun libro trovato/.test(await A.txt('#adBody')));
  // il tocco sull'avviso «segnalazione» apre il caso
  DB.seg.push({ id: 's3', creata: new Date().toISOString(), stato: 'aperta', motivo: 'Altro', messaggio: 30, da_id: UB, da_nome: 'Bruno', su_id: UC, su_nome: 'Carla', persone: 1, fermo: '', copia: [{ id: 30, da: UC, nome: 'Carla', tipo: 'testo', testo: 'ciao', creato: '2026-11-18T11:00:00Z', el: false }] });
  await A.goBack(); await wait(400);
  assert(!(await A.vis('#adSheet')), 'Indietro dall\'elenco: si chiude');
  await A.evaluate(() => window.NLAdmin.open('s3')); await wait(900);
  assert.strictEqual((await st(A)).det && (await st(A)).det.id, 's3');
  // un non amministratore che prova a chiamare le funzioni: il server risponde «non autorizzato» e il pannello si chiude
  DB.admin = [];
  await A.goBack(); await wait(300);
  await A.click$('#adTabs [data-t="sosp"]'); await wait(700);
  assert(!(await A.vis('#adSheet')), 'non autorizzato: si chiude');

  assert.deepStrictEqual(errors, [], 'nessun errore JavaScript');
  console.log('e2e131 OK');
  await browser.close(); server.close();
})().catch(async e => { console.error('e2e131 FALLITA:', e && e.stack || e); process.exit(1); });
