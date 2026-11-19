const CFG = require("./_config");
const H = require('./_harness');
// moduli: wrap, profilo   (senza questi file nell'app la prova si salta: vedi esegui.js)
// Giro 11C (19/11/2026, scelte di Piero): statistiche del profilo a «Tessere» con i colori della stagione (più tenui),
// numeri che salgono, «Condividi i tuoi numeri» (storia 1080×1920 o quadrata 1080×1080) con il link nel testo,
// copertine «più amate» (prima «Lo consiglio», poi il voto), copertine disegnate col titolo che entra tutto.
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
const T = s => Date.parse(s + 'T10:00:00');
const books = [
  { id: 'a', t: 'La forma dell\'acqua', a: 'Andrea Camilleri', rs: 'ok', rd: '2026-07-10', pg: '300', gen: 'Gialli', rt: 5, ts: T('2025-01-01') },
  { id: 'b', t: 'Il nome della rosa', a: 'Umberto Eco', rs: 'ok', rd: '2026-08-03', pg: '650', gen: 'Storia', rt: 3, lc: 1, ts: T('2025-01-01') },
  { id: 'c', t: 'Il cane di terracotta', a: 'Andrea Camilleri', rs: 'ok', rd: '2026-10-20', pg: '200', gen: 'Gialli', rt: 4, ts: T('2025-01-01') },
  { id: 'd', t: 'Precisazioni sull\'arte della lettura lenta nelle biblioteche di provincia', a: 'Autore Lungo', rs: 'ok', rd: '2026-11-02', pg: '120', lc: 1, ts: T('2025-01-01') },
  { id: 'e', t: 'Letto l\'anno scorso', a: 'X Y', rs: 'ok', rd: '2025-05-01', pg: '100', rt: 5, ts: T('2025-01-01') },
  { id: 'f', t: 'Senza voto', a: 'Q', rs: 'ok', rd: '2026-03-01', pg: '90', ts: T('2025-01-01') },
];
(async () => {
  server.listen(CFG.port(8197));
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.evaluateOnNewDocument(() => {      // 19 novembre 2026: autunno
    const off = Date.parse('2026-11-19T10:00:00') - Date.now(), RD = Date;
    class FD extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }
    window.Date = FD;
  });
  const wait = H.wait;
  try {
    await page.evaluateOnNewDocument(b => { if (sessionStorage.getItem('seme')) return; sessionStorage.setItem('seme', '1'); localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: Date.now() })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'Piero', selTip: 1, lastBackup: Date.now() })); localStorage.setItem('catalogo-libri-guida', JSON.stringify({ seen: 1, v: 99 })); }, books);
    await page.goto('http://localhost:' + CFG.port(8197) + '/?vista=elenco', { waitUntil: 'load' }); await wait(800);

    // 1) colori delle stagioni (più tenui) e testo leggibile
    const pal = await page.evaluate(() => [1, 2, 3, 4].map(q => { const p = NLWrap.palette(q); return p.name + ' ' + p.bg + ' ' + p.t.join(',') + ' ' + p.ink.join(','); }));
    console.log('[1 colori]', pal.join(' | '));
    assert.deepStrictEqual(pal.map(x => x.split(' ').slice(0, 3).join(' ')), ['inverno #0E1626 #3A4F73,#9DBCCB,#A797BF', 'primavera #16241A #6B9A68,#D597AA,#D9CC7A', 'estate #0F2230 #3F86A3,#DDB46A,#CF7584', 'autunno #2A1A12 #A8664A,#C99A62,#8A9160']);
    assert(/#FFFFFF,#1B1B1B/.test(pal[3]), 'autunno: bianco sul ruggine, scuro sulla zucca');
    assert.strictEqual(await page.evaluate(() => NLWrap.palette().name), 'autunno', 'di partenza la stagione di oggi');

    // 2) più amati: prima «Lo consiglio» (tra loro per voto), poi il voto, poi i più recenti
    const lov = await page.evaluate(() => NLWrap.loved(NL.books().filter(b => b.rs === 'ok' && /^2026/.test(b.rd)), 4).map(b => b.id).join());
    assert.strictEqual(lov, 'b,d,a,c', 'ordine dei più amati: ' + lov);

    // 3) profilo: tessere sul fondo dell'autunno, numeri che salgono fino al valore giusto
    await page.evaluate(() => NLProfilo.open()); await wait(150);
    const mid = await page.$eval('#profBody .pf-big .pf-cnt', e => e.textContent);
    await wait(1300);
    const st = await page.evaluate(() => { const b = document.querySelector('#profBody .pf-board'); return { bg: b.style.getPropertyValue('--pf-bg'), big: document.querySelector('.pf-big .pf-cnt').textContent, txt: b.innerText.replace(/\s+/g, ' '), font: getComputedStyle(document.querySelector('.pf-big')).fontFamily, tiles: b.querySelectorAll('.pf-t').length }; });
    console.log('[3 profilo]', mid, '→', st.big, st.bg, st.tiles, 'tessere ·', st.txt.slice(0, 260));
    assert.strictEqual(st.bg, '#2A1A12'); assert.strictEqual(st.big, '5'); assert(/Bricolage/.test(st.font));
    assert(/Nel 2026 hai letto 5 libri/.test(st.txt) && /Pagine dell'anno 1\.360/.test(st.txt) && /Il tuo autore dell'anno Andrea Camilleri 2 libri/.test(st.txt) && /Da sempre 6 libri in libreria/.test(st.txt), st.txt);
    // le copertine disegnate: il titolo lungo entra tutto (si rimpicciolisce, non si taglia)
    const fit = await page.$$eval('#profBody .pf-bk.noimg .pf-cvt', l => l.map(e => [e.textContent.slice(0, 20), e.scrollHeight <= e.clientHeight + 1, e.style.fontSize]));
    console.log('  copertine:', JSON.stringify(fit)); assert(fit.length && fit.every(x => x[1]), 'titoli interi');
    await page.screenshot({ path: path.join(CFG.OUT, 'e2e134-profilo.png') });

    // 4) Condividi i tuoi numeri: storia e quadrata; il link è nel testo
    await page.evaluate(() => { navigator.canShare = () => true; navigator.share = async d => { const f = d.files[0], bm = await createImageBitmap(f); window.__sh = (window.__sh || []).concat([{ n: f.name, w: bm.width, h: bm.height, text: d.text, title: d.title }]); }; });
    await page.evaluate(() => document.querySelector('#profBody [data-p="share"]').scrollIntoView({ block: 'center' }));
    const tap = s => page.click(s);   // tocco vero: niente deve coprire i tasti
    await tap('#profBody [data-p="share"]'); await wait(200);
    assert.strictEqual(await page.$$eval('#profBody .pf-share .btn', l => l.map(b => b.textContent).join()), 'Storia,Quadrata');
    await page.screenshot({ path: path.join(CFG.OUT, 'e2e134-condividi.png') });
    await tap('#profBody [data-p="shs"]'); await wait(1500);
    await tap('#profBody [data-p="share"]'); await wait(200); await tap('#profBody [data-p="shq"]'); await wait(1500);
    const sh = await page.evaluate(() => window.__sh || []);
    console.log('[4 condividi]', JSON.stringify(sh));
    assert(sh.length === 2 && sh[0].w === 1080 && sh[0].h === 1920 && sh[1].w === 1080 && sh[1].h === 1080);
    assert(/^Il mio 2026 in libri su Next Libris/.test(sh[0].text) && /https?:\/\/\S+/.test(sh[0].text), sh[0].text);
    if (process.env.SCHERMATE) {
      const u = await page.evaluate(async () => { const W = NLWrap, d = W.quarters().filter(x => x.Q.key === '2026-S4')[0] || W.quarters()[0]; const a = await W.card(W.cardFromWrap(d), 'story'); return a.toDataURL(); });
      fs.writeFileSync(path.join(process.env.SCHERMATE, 'e2e134-autunno-storia.png'), Buffer.from(u.split(',')[1], 'base64'));
    }
    assert.deepStrictEqual(errors, [], 'errori: ' + errors.join(' | '));
    console.log('e2e134 OK');
  } catch (e) { console.log('FAIL', e); process.exitCode = 1; }
  await browser.close(); server.close();
})();
