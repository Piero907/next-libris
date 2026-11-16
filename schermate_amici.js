// Schermate del modulo «Amici» da guardare prima di pubblicare (non è una prova automatica: fa solo fotografie).
// uso: APP_DIR=… node schermate_amici.js   → PNG in <PROVE_OUT>/schermate-amici/
// Telefono stretto (360), telefono (412), PC (1280); chiaro e scuro; nomi lunghi; tutti gli stati della finestra.
const CFG = require('./_config');
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const OUT = path.join(CFG.OUT, 'schermate-amici'); fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
let ME = { utente: null, nome: '' }, LIST = [], FOUND = [], WISH = { visibili: true, libri: [] }, SWAPS = [];
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/finto/')) {
    const p = u.pathname.replace('/finto', ''); let b = ''; req.on('data', c => b += c);
    return req.on('end', () => {
      res.writeHead(p === '/rest/v1/profili' && req.method === 'POST' && /Piero"/.test(b) ? 409 : 200, { 'Content-Type': 'application/json' });
      if (p === '/auth/v1/settings') return res.end('{"external":{"google":true}}');
      if (p === '/rest/v1/profili' && req.method === 'GET') return res.end(JSON.stringify([ME]));
      if (p === '/rest/v1/profili') return res.end(/Piero"/.test(b) ? '{"code":"23505","message":"duplicate key"}' : '');
      if (p === '/rest/v1/rpc/miei_amici') return res.end(JSON.stringify(LIST));
      if (p === '/rest/v1/rpc/cerca_utenti') return res.end(JSON.stringify(FOUND));
      if (p === '/rest/v1/rpc/desideri_di') return res.end(JSON.stringify(WISH));
      if (p === '/rest/v1/rpc/miei_scambi') return res.end(JSON.stringify(SWAPS));
      res.end('[]');
    });
  }
  const m = u.pathname.match(/^\/next-libris-prova(\/.*)?$/); if (!m) { res.writeHead(404); return res.end(); }
  const f = path.join(CFG.APP, !m[1] || m[1] === '/' ? '/index.html' : m[1]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(CFG.port(8392));
const base = 'http://localhost:' + CFG.port(8392);
const R = (id, utente, stato, verso) => ({ id, utente, nome: utente, stato, verso });
(async () => {
  const b = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function page(w, h, theme) {
    const p = await b.newPage(); await p.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 700, hasTouch: w < 700 });
    p.on('pageerror', e => console.log('ERRORE', e.message));
    await p.evaluateOnNewDocument((u, th) => { window.NL_SOCIAL = { url: u, key: 'k', gClient: 'c' }; localStorage.setItem('prova:catalogo-libri-social-auth', JSON.stringify({ at: 'AT-u1', rt: 'RT', exp: Date.now() + 3e6, uid: 'u1', email: 'x@y.z' }));
    }, base + '/finto', theme || '');
    await p.setRequestInterception(true); p.on('request', r => r.url().startsWith(base) ? r.continue() : r.respond({ status: 200, body: '{}' }));
    await p.goto(base + '/next-libris-prova/?vista=elenco', { waitUntil: 'load' }); await wait(700);
    await p.evaluate((th) => { window.NLLayout.set('A'); if (th) document.documentElement.setAttribute('data-theme', th); }, theme || ''); await wait(2200);
    return p;
  }
  const shot = async (p, n) => { await p.screenshot({ path: path.join(OUT, n + '.png') }); console.log(n); };
  for (const [w, h, th] of [[360, 1300, ''], [412, 1300, 'dark'], [1280, 900, '']]) {
    const tag = w + (th ? '-' + th : '');
    // 1) primo nome: modulo; poi nome già preso
    ME = { utente: null, nome: '' }; LIST = [];
    let p = await page(w, h, th);
    await p.evaluate(() => window.NLAmici.open()); await wait(600); await shot(p, tag + '-1-nome');
    await p.$eval('#friU', x => { x.value = 'Piero'; }); await p.click('#friSaveU'); await wait(500); await shot(p, tag + '-2-nome-preso');
    await p.close();
    // 2) con amici, richieste, ricerca, invito, nomi lunghi; in testata il numero; avviso in cima
    ME = { utente: 'Piero R.', nome: 'Piero R.' };
    LIST = [R('a', 'Anna Maria Rossetti', 'attesa', 'ricevuta'), R('b', 'Bruno', 'attesa', 'ricevuta'), R('c', 'Carla', 'amici', 'inviata'), R('d', 'Dario Esposito_lungo', 'amici', 'ricevuta'), R('e', 'Elena', 'attesa', 'inviata')];
    FOUND = [{ id: 'f', utente: 'Francesca De Luca', nome: 'x', rel: '' }, { id: 'c', utente: 'Carla', nome: 'x', rel: 'amici' }, { id: 'e', utente: 'Elena', nome: 'x', rel: 'inviata' }];
    p = await page(w, h, th);
    await shot(p, tag + '-3-pagina-avviso');
    await p.evaluate(() => window.__app.openDrawer('opt')); await wait(500); await shot(p, tag + '-4-menu');
    await p.evaluate(() => window.__app.closeDrawer()); await wait(300);
    await p.click('#btnFri'); await wait(700);
    await p.type('#friQ', 'fra'); await p.click('#friFormQ .btn'); await wait(500);
    await shot(p, tag + '-5-finestra');
    await p.click('[data-f="friend"][data-id="c"]'); await wait(600); await p.click('[data-f="ask-drop"]'); await wait(200);
    const el = await p.$('#friSheet .sheet-in'); await p.evaluate(e => { e.scrollTop = e.scrollHeight; }, el); await wait(200); await shot(p, tag + '-6-togli');
    await p.click('[data-f="cancel"]'); await p.click('[data-f="back"]'); await wait(200); await p.click('[data-f="name"]'); await wait(300); await shot(p, tag + '-7-cambia-nome');
    await p.close();
    // 3) pagina di un amico (desideri con titoli lunghi e prenotazioni), «presta» con gli amici, «restituito?», avviso di un prestito ricevuto
    ME = { utente: 'Piero R.', nome: 'Piero R.', desideri: true };
    LIST = [R('d', 'Dario Esposito_lungo', 'amici', 'ricevuta'), R('c', 'Carla', 'amici', 'inviata')];
    WISH = { visibili: true, libri: [
      { id: 'w1', t: 'Cent\'anni di solitudine: edizione speciale con un titolo molto lungo', a: 'Gabriel García Márquez', img: '', prenotato: '' },
      { id: 'w2', t: 'Il nome della rosa', a: 'Umberto Eco', prenotato: 'io' },
      { id: 'w3', t: 'Lessico famigliare', a: 'Natalia Ginzburg', prenotato: 'Carla' } ] };
    SWAPS = [{ id: '11111111-1111-1111-1111-111111111111', da: 'd', a: 'u1', nome_da: 'Dario Esposito_lungo', nome_a: 'Piero R.', tipo: 'prestito', libro: { t: 'La coscienza di Zeno', a: 'Italo Svevo' }, stato: 'aperto', visto: false, creato: '2026-11-16T10:00:00Z' },
             { id: '33333333-3333-3333-3333-333333333333', da: 'u1', a: 'd', nome_da: 'Piero R.', nome_a: 'Dario Esposito_lungo', tipo: 'prestito', libro: { t: 'Il sentiero dei nidi di ragno' }, stato: 'reso', visto: true, creato: '2026-11-14T10:00:00Z' },
             { id: '22222222-2222-2222-2222-222222222222', da: 'u1', a: 'd', nome_da: 'Piero R.', nome_a: 'Dario Esposito_lungo', tipo: 'regalo', libro: { t: 'Se una notte d\'inverno un viaggiatore' }, stato: 'aperto', visto: true, creato: '2026-11-15T10:00:00Z' }];
    p = await page(w, h, th);
    await shot(p, tag + '-8-avviso-prestito');
    await p.evaluate(() => window.NLLayoutSwipe.next()); await wait(700); await shot(p, tag + '-8b-avviso-reso');
    await p.click('#btnFri'); await wait(600); await shot(p, tag + '-9-amici-interruttore');
    await p.click('[data-f="friend"][data-id="d"]'); await wait(700); await shot(p, tag + '-10-pagina-amico');
    await p.click('[data-f="back"]'); await wait(200); await p.keyboard.press('Escape'); await wait(200);
    await p.evaluate(() => { const b = window.NL.books().find(x => x.sk === 'p'); if (b) window.__app.openLoan(window.NL.books()[1] ? window.NL.books()[1].id : b.id); });
    await p.evaluate(() => { const bk = window.NL.clean({ t: 'Il barone rampante', a: 'Italo Calvino' }); window.NL.books().push(bk); window.NL.refresh(); window.__app.openLoan(bk.id); }); await wait(500);
    await p.click('#loanFri [data-u="Carla"]'); await wait(300); await shot(p, tag + '-11-presta-amico');
    await p.keyboard.press('Escape'); await wait(300);
    await p.evaluate(() => { const b = window.NL.books().find(x => x.sk === 'p'); document.dispatchEvent(new Event('x')); if (b) document.querySelector('[data-id="' + b.id + '"] [data-act="recv"]') ? document.querySelector('[data-id="' + b.id + '"] [data-act="recv"]').click() : null; }); await wait(500);
    await shot(p, tag + '-12-restituito');
    await p.close();
  }
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
