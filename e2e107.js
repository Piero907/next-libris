const CFG = require("./_config");
const H = require('./_harness');
// moduli: amici   (senza questi file nell'app la prova si salta: vedi esegui.js)
// 16/11/2026, prova 99.5.
// 1) API PRESTATA da un amico (il worker non si presta più: 031; quello rimasto sul telefono sparisce): si usa per cercare, ma non si vedono in Impostazioni › Ricerca (al posto del campo:
//    «Usi l’API Google di Anna…»), non finiscono tra i «salvati», né nel backup, né nella condivisione con il link;
//    la tua API tenuta da parte resta la tua (backup e link usano quella).
// 2) Menu › «Info e condivisione» (chiusa all'inizio): Condivisione, Installazione, Privacy, Contatti;
//    Contatti: indirizzo, «Copia», «Scrivici» (mailto con oggetto, versione e telefono in fondo).
// Schermate a 360, 412 scuro e 1280; niente scorrimento di lato.
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname), m = p.match(/^\/next-libris-prova(\/.*)?$/);
  if (!m) { res.writeHead(404); return res.end(); }
  if (!m[1]) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
  const f = path.join(ROOT, m[1] === '/' ? '/index.html' : m[1]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
}).listen(CFG.port(8307));
const base = 'http://localhost:' + CFG.port(8307);
const OUT = path.join(CFG.OUT, 'e2e107'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const wait = H.wait;   // attesa «finché» (_harness.js)
  async function phone(w, h, dark) {
    const page = await (await browser.createBrowserContext()).newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 700, hasTouch: w < 700 });
    page.on('pageerror', e => errors.push(w + ': ' + e.message));
    // prima di partire: la mia API da parte, quella di Anna in uso (come fa amici.js con «Usala»)
    await page.evaluateOnNewDocument(() => {
      if (localStorage.getItem('prova:e2e107')) return; localStorage.setItem('prova:e2e107', '1');
      localStorage.setItem('prova:catalogo-libri-saved', JSON.stringify({ sbn: [], key: ['AIzaDiAnna0000000000', 'AIzaMiaVecchia000000'] }));   // finita tra i salvati prima della correzione
      localStorage.setItem('prova:catalogo-libri-amici-chiavi-mie', JSON.stringify({ gb: 'AIzaMiaVecchia000000', sbn: '' }));
      localStorage.setItem('prova:catalogo-libri-amici-chiave-in-uso', JSON.stringify({ da: 'uA', nome: 'Anna', gb: 'AIzaDiAnna0000000000', sbn: 'https://sbn-anna.workers.dev' }));
    });
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith(base) ? r.continue() : r.respond({ status: 200, contentType: 'application/json', body: '{"totalItems":0}' }));
    await page.goto(base + '/next-libris-prova/?vista=elenco', { waitUntil: 'load' }); await wait(1500);
    await page.evaluate((d) => {
      window.NL.settings.gbKey = 'AIzaDiAnna0000000000'; window.NL.settings.sbnUrl = 'https://sbn-anna.workers.dev'; window.NL.saveSettings();
      if (d) document.documentElement.setAttribute('data-theme', 'dark');
    }, dark); await wait(300);
    return page;
  }
  const side = (page) => page.evaluate(() => [...document.querySelectorAll('.sheet:not([hidden]) .sheet-in, .drawer, #optSheet .sheet-in')].map(s => s.scrollWidth - s.clientWidth).concat([document.documentElement.scrollWidth - document.documentElement.clientWidth]).every(x => x <= 0));
  for (const [w, h, dark] of [[360, 780, false], [412, 900, true], [1280, 860, false]]) {
    const tag = w + (dark ? '-scuro' : ''), P = await phone(w, h, dark);
    const shot = (n) => P.screenshot({ path: path.join(OUT, tag + '-' + n + '.png') });
    // ---- l’API di Anna si usa ma non si vede ----
    assert.strictEqual(await P.evaluate(() => window.NL.settings.gbKey), 'AIzaDiAnna0000000000', 'in uso per cercare');
    await P.evaluate(() => { window.NL.openOptions('search'); window.NL.svcFold('key', true); }); await wait(500);   // sezione richiudibile (giro 5)
    const sr = await P.evaluate(() => ({
      gb: document.getElementById('gbKey').value, sbn: !!document.getElementById('sbnUrl'),
      rowGb: document.querySelector('#svcKey .svc-row').hidden, sbnSt: document.getElementById('sbnSt').textContent,
      txt: document.querySelector('[data-sec="search"]').innerText, saved: document.getElementById('gbSaved').innerText,
      st: document.getElementById('gbSt').textContent, clear: document.getElementById('gbClear').hidden }));
    assert.strictEqual(sr.gb, '', 'campo dell’API vuoto'); assert(!sr.sbn && sr.sbnSt === 'Incluso', 'niente campo del worker: SBN incluso');
    assert(sr.rowGb, 'campo nascosto');
    assert(/Usi l’API Google di Anna: non si vede e non si può prestare/.test(sr.txt) && !/worker/i.test(sr.txt), 'al posto del campo');
    assert(!/AIzaDiAnna|sbn-anna/.test(sr.txt), 'nessuna traccia dell’API o del worker');
    assert(/AIzaMi/.test(sr.saved) && !/AIzaDi/.test(sr.saved), 'tra le salvate solo la mia: ' + sr.saved);
    assert.strictEqual(sr.st, 'Prestata da Anna'); assert(sr.clear, 'niente «Cancella»');
    assert(await side(P), 'niente scorrimento di lato (ricerca)');
    await shot('1-ricerca');
    const saved = await P.evaluate(() => localStorage.getItem('prova:catalogo-libri-saved'));
    assert(!/AIzaDiAnna/.test(saved), 'tolta dai salvati');
    // backup e condivisione con il link: solo le mie
    const cfg = await P.evaluate(() => window.NL.backupCfg());
    assert.strictEqual(cfg.gbKey, 'AIzaMiaVecchia000000', 'nel backup la mia API'); assert(!cfg.sbnUrl, 'nel backup nessun worker');
    assert(!JSON.stringify(cfg).includes('AIzaDiAnna') && !JSON.stringify(cfg).includes('sbn-anna'), 'nel backup niente di Anna');
    await P.evaluate(() => window.NL.openOptions('search')); await wait(400);   // chiave e worker in Ricerca dei libri (17/11/2026)
    assert((await P.$$eval('#svcBox [data-svc]', e => e.map(x => x.dataset.svc))).includes('lend'), 'la mia API si può ancora prestare');
    await P.click('#svcBox [data-svc="lend"]'); await wait(500);
    assert.strictEqual(await P.$$eval('#kwBody [data-kw="link"]', a => a.length), 0, 'niente «Manda con un link» (giro 8)');
    await P.keyboard.press('Escape'); await wait(300);
    // ---- menu: «Info e condivisione» ----
    await P.evaluate(() => window.__app.openDrawer('opt')); await wait(400);
    assert(await P.$eval('#infoList', x => x.hidden), 'chiusa all\'inizio');
    assert(/Info e aiuto/i.test(await P.$eval('#drawerOpts', x => x.innerText)));   // restyle pezzo 3: etichetta in maiuscolo
    assert(!(await P.$('#setList [data-sec="share"]')) && !(await P.$('#setList [data-sec="app"]')), 'tolte da Impostazioni');
    await P.evaluate(() => document.getElementById('goInfo').click()); await wait(400);
    const items = await P.$$eval('#infoList .dopt b', xs => xs.map(x => x.textContent));
    assert.deepStrictEqual(items, ['Come si usa', 'Guarda una libreria di esempio', 'Condivisione', 'Installazione sul telefono', 'Privacy', 'Contatti']);
    assert.strictEqual(await P.$eval('#goPrivacy', x => x.dataset.sec), 'privacy');   // dal 17/11/2026 pomeriggio: finestra dentro l'app (e2e115)
    assert(await side(P), 'niente scorrimento di lato (menu)');
    await P.evaluate(() => { const l = document.getElementById('infoList'); l.scrollIntoView({ block: 'end' }); }); await wait(200);
    await shot('2-menu');
    await P.click('#infoList [data-sec="contact"]'); await wait(500);
    const ct = await P.evaluate(() => document.querySelector('[data-sec="contact"].opt-sec').innerText);
    assert(/nextlibris\.app@gmail\.com/.test(ct) && /Copia/.test(ct) && /Scrivici/.test(ct), 'contatti');
    assert(await side(P), 'niente scorrimento di lato (contatti)');
    await shot('3-contatti');
    const mail = await P.evaluate(() => window.NL.contactURL());
    assert(/^mailto:nextlibris\.app@gmail\.com\?subject=Next%20Libris&body=/.test(mail), 'mailto: ' + mail.slice(0, 80));
    const body = decodeURIComponent(mail.split('&body=')[1]); assert(/Versione \d+/.test(body) && /copia di prova/.test(body) && / · /.test(body), 'versione e telefono: ' + body);
    if (w === 360) console.log('[email]', JSON.stringify(body));
    await P.close();
  }
  assert.deepStrictEqual(errors, []);
  console.log('e2e107 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
