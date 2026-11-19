const CFG = require("./_config");
const H = require('./_harness');
// moduli: social, amici, notifiche, ricerche   (senza questi file nell'app la prova si salta: vedi esegui.js)
// Giro 8 (Piero, 18/11/2026): l’API Google prestata resta sul server.
// Anna presta l’API a Bruno. Bruno ha sul telefono solo il segno «prestata:<id di Anna>»: le ricerche passano dalla funzione
// «libri» (qui finta), nessuna richiesta va a Google dal suo telefono, l’API vera non compare mai. 300 al giorno per amico
// (x-nl-stop: mio) = avviso e stop fino a domani; prestito tolto (x-nl-stop: no) = torna alle sue impostazioni.
// Anna: guida con «solo Books API, fatturazione già spenta» (R3); «La mia API è finita in giro» (R4) aggiorna l’API anche
// per gli amici (chiavi_aggiorna). Campanella: avviso importante di Next Libris (titolo e testo, il tocco non porta altrove).
// SCHERMATE=cartella per le fotografie (360).
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm', '.webp': 'image/webp' };
const UA = '00000000-0000-0000-0000-0000000000a1', UB = '00000000-0000-0000-0000-0000000000b2';
const KEY = 'AIzaANNA0123456789abcdefghijklmnopq', KEY2 = 'AIzaNUOVA9876543210zyxwvutsrqponmlk';
const DB = { prof: { [UA]: { utente: 'Anna', nome: 'Anna' }, [UB]: { utente: 'Bruno', nome: 'Bruno' } },
  keys: [{ da: UA, a: UB, gb_key: KEY, sbn: '' }], libri: [], mode: '', tot: 40, mio: 0, aggiorna: [], avvisi: [], conta: [] };
const uidOf = (req) => { const m = /Bearer AT-([\w-]+)/.exec(req.headers.authorization || ''); return m ? m[1] : null; };
function fake(req, res, body, url) {
  const send = (st, j, h) => { res.writeHead(st, Object.assign({ 'Content-Type': 'application/json' }, h || {})); res.end(j === undefined ? '' : JSON.stringify(j)); };
  const p = url.pathname.replace(/^\/finto/, ''), q = url.searchParams;
  if (req.headers.apikey !== 'chiave-finta') return send(401, { message: 'no api key' });
  if (p === '/auth/v1/settings') return send(200, { external: { google: true } });
  if (p === '/auth/v1/token') { const id = String(body.refresh_token || '').slice(3); return send(200, { access_token: 'AT-' + id, refresh_token: 'RT-' + id, expires_in: 3600, user: { id } }); }
  const me = uidOf(req); if (!me) return send(401, { message: 'JWT' });
  // la funzione «libri»: come supabase/funzioni/libri/index.ts
  if (p === '/functions/v1/libri') {
    const da = q.get('da'), u = q.get('u') || '';
    DB.libri.push({ me, da, u });
    if (!/^\/books\/v1\/volumes\?/.test(u)) return send(400, { error: { code: 400 } });
    const k = DB.keys.find(x => x.da === da && x.a === me && x.gb_key);
    if (!k) return send(403, { error: { code: 403, message: 'chiave non prestata' } }, { 'x-nl-stop': 'no' });
    if (DB.mode === 'mio') return send(429, { error: { code: 429 } }, { 'x-nl-stop': 'mio', 'x-nl-tot': String(DB.tot), 'x-nl-mio': '300' });
    DB.tot++; DB.mio++;
    return send(200, { totalItems: 1, items: [{ id: 'g1', volumeInfo: { title: 'Il nome della rosa', authors: ['Umberto Eco'], publisher: 'Bompiani', publishedDate: '1980', language: 'it', pageCount: 503,
      industryIdentifiers: [{ type: 'ISBN_13', identifier: '9788845278655' }] } }] }, { 'x-nl-tot': String(DB.tot), 'x-nl-mio': String(DB.mio) });
  }
  if (p === '/rest/v1/libri' && req.method === 'GET') return send(200, []);
  if (p === '/rest/v1/libri') return send(201);
  if (p === '/rest/v1/profili' && req.method === 'GET') { const pr = DB.prof[me]; return send(200, [{ utente: pr.utente, nome: pr.nome, desideri: false, libreria: true }]); }
  if (p === '/rest/v1/profili') return send(201);
  if (p === '/rest/v1/rpc/miei_amici') { const o = me === UA ? UB : UA; return send(200, [{ id: o, utente: DB.prof[o].utente, nome: DB.prof[o].nome, stato: 'amici', verso: 'inviata', creato: '2026-11-16T10:00:00Z' }]); }
  if (p === '/rest/v1/rpc/chiavi_mie') return send(200, DB.keys.filter(k => k.da === me).map(k => ({ da: k.da, a: k.a, nome: DB.prof[k.a].utente, gb_key: k.gb_key ? 'si' : '', sbn: k.sbn ? 'si' : '' }))
    .concat(DB.keys.filter(k => k.a === me).map(k => ({ da: k.da, a: k.a, nome: DB.prof[k.da].utente, gb_key: k.gb_key ? 'prestata:' + k.da : '', sbn: k.sbn }))));
  if (p === '/rest/v1/rpc/chiavi_aggiorna') { DB.aggiorna.push({ me, k: body.gb_key }); let n = 0; DB.keys.forEach(k => { if (k.da === me && k.gb_key && k.gb_key !== body.gb_key) { k.gb_key = body.gb_key; n++; } }); return send(200, n); }
  if (p === '/rest/v1/rpc/conta_ricerche') { DB.conta.push({ me, chiave: body.chiave, n: body.n }); return send(200, 0); }
  if (p === '/rest/v1/rpc/mie_notifiche') return send(200, me === UB ? DB.avvisi : []);
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
}).listen(CFG.port(8327));
const base = 'http://localhost:' + CFG.port(8327);

(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [], fuori = [];
  const wait = H.wait;
  const SHOTS = process.env.SCHERMATE;
  async function phone(name, uid) {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setViewport({ width: 360, height: 800, deviceScaleFactor: SHOTS ? 1 : 2, isMobile: true, hasTouch: true });
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    await page.evaluateOnNewDocument((u, id) => {
      window.NL_SOCIAL = { url: u, key: 'chiave-finta', gClient: 'client-finto' };
      if (!localStorage.getItem('prova:catalogo-libri-social-auth')) localStorage.setItem('prova:catalogo-libri-social-auth', JSON.stringify({ at: 'AT-' + id, rt: 'RT-' + id, exp: Date.now() + 3e6, uid: id, email: 'x@esempio.it' }));
      if (!localStorage.getItem('prova:catalogo-libri-layout')) { localStorage.setItem('prova:catalogo-libri-layout', JSON.stringify({ v: 'a' })); localStorage.setItem('prova:catalogo-libri-card', JSON.stringify({ v: 'd' })); }
    }, base + '/finto', uid);
    await page.setRequestInterception(true);
    page.on('request', r => { if (r.url().startsWith(base)) return r.continue(); fuori.push(name + ' ' + r.url()); r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"totalItems":0}' }); });
    await page.goto(base + '/next-libris-prova/?vista=elenco', { waitUntil: 'load' }); await wait(2000);
    page.click$ = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error('manca ' + s); e.click(); }, sel);
    page.vis = sel => page.evaluate(s => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, sel);
    page.txt = sel => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
    page.shot = async (n) => { if (SHOTS) { await wait(250); await page.screenshot({ path: path.join(SHOTS, n + '.png') }); } };
    page.wide = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    return page;
  }
  const G = 'https://www.googleapis.com/books/v1/volumes?q=isbn:9788845278655&maxResults=5&printType=books';

  // ================= Anna: la sua API =================
  const A = await phone('A', UA);
  await A.evaluate((k) => { const s = window.NL.settings; s.gbKey = k; s.name = 'Anna'; window.NL.saveSettings(); }, KEY);
  await A.evaluate(() => window.NLAmici.load(true)); await wait(800);
  await A.evaluate(() => { window.__app.openOptions('search'); window.NL.svcFold('key', true); }); await wait(500);
  // R3: guida (in Ricerca dei libri e nella finestra «Crea la tua API»)
  const how = await A.$eval('#svcKey .svc-how', e => e.textContent.replace(/\s+/g, ' '));
  assert(/scegli solo Books API/.test(how) && /di partenza è già spenta, non devi fare niente/.test(how) && /non si paga mai niente/.test(how), 'R3 in Ricerca: ' + how);
  await A.evaluate(() => window.NLRicerche.guide()); await wait(300);
  const steps = await A.$$eval('#kgSheet .kg-steps li', a => a.map(x => x.innerText.replace(/\s+/g, ' ')));
  assert.strictEqual(steps.length, 5, 'cinque passi'); assert(/Limita l’API: in «Restrizioni API» scegli solo Books API\. La fatturazione non va attivata \(di partenza è già spenta, non devi fare niente\): così non si paga mai niente, qualunque cosa succeda\./.test(steps[3]), steps[3]);
  assert.strictEqual(await A.wide(), 0); await A.shot('127-1-guida-chiave');
  await A.click$('#kgClose'); await wait(200);
  // R4: «La mia API è finita in giro»
  assert(await A.vis('#gbLeak'), 'il tasto c\'è per chi ha la sua API');
  await A.shot('127-2-ricerca-anna');
  await A.click$('#gbLeak'); await wait(300);
  assert(await A.vis('#klSheet'));
  const kl = await A.txt('#klSheet'); console.log('[finita in giro]', kl);
  assert(/Niente paura\. Un’API Google Libri fa solo ricerche di libri e non costa niente/.test(kl) && /Rigenera chiave/.test(kl) && /Gli amici a cui la presti continuano a cercare senza fare niente/.test(kl));
  assert.strictEqual(await A.wide(), 0); await A.shot('127-3-finita-in-giro');
  await A.$eval('#klKey', (e, k) => { e.value = k; }, KEY); await A.click$('#klSave'); await wait(200);
  assert(/chiave di prima/.test(await A.txt('#klErr')), 'la stessa API non va bene');
  await A.$eval('#klKey', e => { e.value = 'ciao'; }); await A.click$('#klSave'); await wait(200);
  assert(/Non sembra un’API Google/.test(await A.txt('#klErr')));
  await A.$eval('#klKey', (e, k) => { e.value = ' ' + k + ' '; }, KEY2); await A.click$('#klSave'); await wait(900);
  assert(!(await A.vis('#klSheet')), 'chiusa');
  assert.strictEqual(await A.evaluate(() => window.NL.settings.gbKey), KEY2, 'chiave nuova in uso');
  assert.deepStrictEqual(DB.aggiorna, [{ me: UA, k: KEY2 }], 'aggiornata sul server per gli amici');
  assert.strictEqual(DB.keys[0].gb_key, KEY2);
  console.log('[dopo]', await A.$eval('#toastTxt', e => e.textContent));
  await A.browserContext().close();

  // ================= Bruno: usa l’API di Anna =================
  const B = await phone('B', UB);
  await B.evaluate(() => window.NLAmici.load(true)); await wait(800);
  await B.evaluate(() => window.NLAmici.keys()); await wait(500);
  assert(!/link/i.test(await B.txt('#kwBody')), 'niente link');
  await B.click$('#kwBody [data-f="keyuse"]'); await wait(700);
  await B.click$('#kwClose'); await wait(300);
  assert.strictEqual(await B.evaluate(() => window.NL.settings.gbKey), 'prestata:' + UA, 'sul telefono solo il segno');
  assert(await B.evaluate(() => !document.getElementById('gbLeak') || document.getElementById('gbLeak').hidden), 'niente «finita in giro» per chi non ha un’API sua');
  // una ricerca: passa dalla funzione, non da Google
  let r = await B.evaluate(async (g) => { const x = await apiFetch(g + '&key=' + encodeURIComponent(settings.gbKey)); const j = await x.json(); return { st: x.status, n: (j.items || []).length, used: gUsed() }; }, G);
  assert.deepStrictEqual(r, { st: 200, n: 1, used: 41 }, 'risposta di Google dal server e totale condiviso: ' + JSON.stringify(r));
  assert.strictEqual(DB.libri.length, 1); assert.deepStrictEqual([DB.libri[0].me, DB.libri[0].da], [UB, UA]);
  assert.strictEqual(DB.libri[0].u, '/books/v1/volumes?q=isbn:9788845278655&maxResults=5&printType=books', 'domanda senza API: ' + DB.libri[0].u);
  // ricerca vera dell'app per ISBN
  const libro = await B.evaluate(async () => JSON.stringify(await findIsbn('9788845278655')));
  console.log('[findIsbn]', libro.slice(0, 160));
  assert(/Il nome della rosa/.test(libro), 'dati arrivati con l’API prestata');
  assert(DB.libri.length >= 2 && DB.libri.every(x => !/key=/.test(x.u)));
  await wait(3500);   // il contatore del telefono non conta l’API prestata (lo fa il server)
  assert.strictEqual(DB.conta.filter(x => /^g:/.test(x.chiave) && x.n > 0).length, 0, 'nessun conta_ricerche per l’API prestata');
  assert.strictEqual(fuori.filter(u => /googleapis\.com/.test(u)).length, 0, 'nessuna richiesta a Google dal telefono: ' + fuori.filter(u => /googleapis/.test(u)).join(' '));
  const tutto = await B.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(window.NL.backupCfg()));
  assert(!tutto.includes(KEY) && !tutto.includes(KEY2), 'l’API vera non è mai nel telefono di Bruno');
  assert(!/prestata:/.test(await B.evaluate(() => JSON.stringify(window.NL.backupCfg()))), 'nel backup niente segno');
  // 300 al giorno: avviso e stop fino a domani
  DB.mode = 'mio'; const prima = DB.libri.length;
  r = await B.evaluate(async (g) => { const x = await apiFetch(g + '&key=' + encodeURIComponent(settings.gbKey)); return { st: x.status, left: googleLeft(false), toast: document.getElementById('toastTxt').textContent }; }, G);
  console.log('[300]', r.toast);
  assert.strictEqual(r.st, 429); assert.strictEqual(r.left, false); assert(/Per oggi hai finito le ricerche con l’API di Anna/.test(r.toast));
  r = await B.evaluate(async (g) => { const x = await apiFetch(g + '&key=' + encodeURIComponent(settings.gbKey)); return { st: x.status, local: !!x.local }; }, G);
  assert.deepStrictEqual(r, { st: 429, local: true }, 'dopo lo stop non si chiama più il server'); assert.strictEqual(DB.libri.length, prima + 1);
  // prestito tolto: il server dice no, il telefono torna alle sue impostazioni
  DB.mode = ''; DB.keys = [];
  await B.evaluate(() => { localStorage.removeItem('prova:catalogo-libri-prestata-stop'); }); await B.reload({ waitUntil: 'load' }); await wait(600);
  await B.evaluate(() => { const s = window.NL.settings; if (!s.gbKey) throw new Error('già tolta prima della ricerca'); });
  r = await B.evaluate(async (g) => { const x = await apiFetch(g + '&key=' + encodeURIComponent(settings.gbKey)); return x.status; }, G).catch(e => String(e));
  await wait(1500);
  assert.strictEqual(await B.evaluate(() => window.NL.settings.gbKey || ''), '', 'API prestata tolta dopo il no del server (stato ' + r + ')');

  // ================= campanella: avviso importante =================
  DB.avvisi = [{ id: 'av1', da: null, nome: null, tipo: 'avviso', rif: 'Aggiornamento importante', titolo: 'Apri Next Libris e tocca «Aggiorna»: la versione nuova sistema la ricerca dei libri.', creata: new Date().toISOString(), letta: false }];
  await B.evaluate(() => window.NLNotifiche.load()); await wait(600);
  assert.strictEqual(await B.txt('#btnBellN'), '1');
  await B.evaluate(() => window.NLNotifiche.open()); await wait(400);
  const nt = await B.txt('#ntBody'); console.log('[avviso]', nt);
  assert(/Aggiornamento importante Apri Next Libris e tocca «Aggiorna»/.test(nt));
  assert.strictEqual(await B.txt('#ntBody .nt-ico'), 'NL'); assert.strictEqual(await B.wide(), 0);
  await B.shot('127-4-avviso');
  await B.click$('#ntBody [data-n="av1"]'); await wait(300);
  assert(await B.vis('#ntSheet'), 'il tocco sull\'avviso non porta altrove');
  if (errors.length) { console.log(errors); throw new Error('errori nella pagina'); }
  console.log('e2e127 OK');
  await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
