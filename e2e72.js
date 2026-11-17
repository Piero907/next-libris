const CFG = require("./_config");
// moduli: amici   (senza questi file nell'app la prova si salta: vedi esegui.js)
// Menu laterale riordinato (16/11/2026): «La tua libreria» (Sistema l'elenco, Backup con la data dell'ultimo),
// «Impostazioni» chiuse finche' non le apri (Aspetto, Ricerca, Aggiunta dei libri, Condivisione, Installazione sul telefono), Sostieni e versione dove erano.
// L'ingranaggio in alto apre il menu con le impostazioni gia' aperte; tornando da una voce restano aperte.
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8192));
const books = [{ id: 'm1', t: 'Il nome della rosa', a: 'Umberto Eco', ts: 2, rs: 'ok' }, { id: 'm2', t: 'Baudolino', a: 'Umberto Eco', ts: 1 }];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => r.url().startsWith('http://localhost:' + CFG.port(8192)) ? r.continue() : r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await page.goto('http://localhost:' + CFG.port(8192) + '/', { waitUntil: 'load' });
  await page.evaluate(b => { const o = Storage.prototype.setItem; localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: Date.now() })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'P', selTip: 1, lastBackup: new Date(2026, 10, 15).getTime(), donUntil: Date.now() + 9e9, instSnooze: Date.now() + 9e9 })); localStorage.setItem('catalogo-libri-layout', JSON.stringify({ v: 'a' })); Storage.prototype.setItem = function (k, v) { if (/^catalogo-libri-v2$/.test(k)) return; return o.call(this, k, v); }; }, books);
  await page.reload({ waitUntil: 'load' }); await wait(800);
  const vis = s => page.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }, s);
  const menu = () => page.evaluate(() => {
    const o = document.querySelector('#drawerOpts'), shown = e => e.getClientRects().length > 0;
    return {
      heads: [...o.querySelectorAll('h3')].filter(shown).map(h => h.textContent),
      rows: [...o.querySelectorAll('.dopt')].filter(shown).map(b => b.dataset.sec || b.id),
      setOpen: !document.querySelector('#setList').hidden, exp: document.querySelector('#goSettings').getAttribute('aria-expanded'),
      bk: document.querySelector('[data-sec="export"]').innerText.replace(/\s+/g, ' ')
    };
  });
  // dal Menu (barra in basso): impostazioni chiuse
  await page.click('#layNav [data-l="menu"]'); await wait(450);
  let m = await menu(); console.log('[1 menu]', JSON.stringify(m));
  assert.deepStrictEqual(m.heads, ['Amici', 'La tua libreria']);   // parte «Amici» (amici.js) dal 16/11/2026, subito sotto Filtri/Statistiche
  assert(m.rows.indexOf('goFri') >= 0 && m.rows.indexOf('goInv') < 0 && m.rows.indexOf('goFri') < m.rows.indexOf('fix') && m.rows.indexOf('export') < m.rows.indexOf('goSettings'), 'ordine: amici, libreria (con account), impostazioni');
  assert(!m.setOpen && m.exp === 'false', 'impostazioni chiuse');
  for (const k of ['look', 'search', 'cards', 'share', 'app']) assert(!m.rows.includes(k), k + ' nascosta');
  assert(m.rows.includes('fix') && m.rows.includes('export') && m.rows.includes('goSettings') && m.rows.includes('donMenu'));
  assert(m.rows.indexOf('export') < m.rows.indexOf('donMenu') && m.rows.indexOf('donMenu') < m.rows.indexOf('goSettings'), 'ordine: libreria, sostieni, impostazioni (17/11/2026)');
  assert(/Ultimo backup: 15\/11\/2026/.test(m.bk), 'data del backup dentro la voce Backup');
  assert(await vis('#verBox'), 'versione in fondo');
  assert(await page.evaluate(() => document.querySelector('#donMenu').compareDocumentPosition(document.querySelector('#verBox')) & Node.DOCUMENT_POSITION_FOLLOWING), 'Sostieni sopra la versione');
  await page.screenshot({ path: CFG.OUT + '/menu_chiuso.png' });
  // apro «Impostazioni»
  await page.click('#goSettings'); await wait(400);
  m = await menu(); console.log('[2 aperte]', m.rows.join(' '));
  assert(m.setOpen && m.exp === 'true');
  assert.deepStrictEqual(m.rows.filter(k => ['look', 'search', 'cards', 'share', 'app'].includes(k)), ['search', 'cards', 'look']);   // ordine d'uso; condivisione e installazione in «Info e aiuto» (17/11/2026, e2e112)
  assert(m.rows.indexOf('donMenu') < m.rows.indexOf('goSettings') && m.rows.indexOf('goSettings') < m.rows.indexOf('goInfo'), 'Sostieni, poi Impostazioni, poi Info e aiuto');
  await page.screenshot({ path: CFG.OUT + '/menu_impostazioni.png' });
  // entro in Aspetto e torno indietro con la freccetta: restano aperte
  await page.click('#drawerOpts [data-sec="look"]'); await wait(400);
  assert(await vis('#optSheet'));
  await page.click('#optBack'); await wait(450);
  m = await menu(); assert(m.setOpen, 'tornando dalla voce restano aperte');
  // chiudo e riapro il Menu: di nuovo chiuse
  await page.evaluate(() => window.__app.closeDrawer()); await wait(400);
  await page.click('#layNav [data-l="menu"]'); await wait(450);
  assert(!(await menu()).setOpen, 'riaprendo il Menu sono chiuse');
  await page.evaluate(() => window.__app.closeDrawer()); await wait(400);
  // l'ingranaggio in alto: dritto alle impostazioni
  await page.evaluate(() => window.scrollTo(0, 0)); await page.click('#btnOpts'); await wait(450);
  m = await menu(); assert(m.setOpen, 'ingranaggio: impostazioni aperte');
  // si richiudono toccando di nuovo
  await page.click('#goSettings'); await wait(300);
  assert(!(await menu()).setOpen);
  await page.evaluate(() => window.__app.closeDrawer()); await wait(400);
  // Aspetto: tema vicino a colori e caratteri; poi all'apertura e riepilogo (16/11/2026)
  await page.evaluate(() => window.__app.openOptions('look')); await wait(350);
  const legs = await page.$$eval('#optSheet .opt-sec[data-sec="look"] legend', e => e.map(x => x.textContent)); console.log('[aspetto]', legs.join(' | '));
  assert.deepStrictEqual(legs, ['Tema', 'Colori', 'Carattere dei titoli', 'Carattere del testo', 'All\'apertura mostra', 'Riepilogo in alto']);
  assert(await page.evaluate(() => !document.querySelector('.opt-sec[data-sec="look"] #optSound')), 'Suoni non piu\' in Aspetto');
  await page.screenshot({ path: CFG.OUT + '/opzioni_aspetto.png' });
  await page.evaluate(() => window.__app.closeOptions()); await wait(300);
  // Aggiunta dei libri: solo prezzo, suoni, fotocamera del telefono e la prova della luce; le altre opzioni tolte
  await page.evaluate(() => window.__app.openOptions('cards')); await wait(350);
  const add = await page.evaluate(() => { const c = document.querySelector('.opt-sec[data-sec="cards"]'); return { h: document.querySelector('#optH').textContent, ids: [...c.querySelectorAll('input[type=checkbox]')].map(x => x.id), light: !!c.querySelector('#lightRun'), gone: ['optOpenAll', 'optExtra', 'optQuoteOcr'].filter(k => document.getElementById(k)) }; });
  console.log('[aggiunta]', JSON.stringify(add));
  assert.strictEqual(add.h, 'Aggiunta dei libri'); assert.deepStrictEqual(add.ids, ['optPrice', 'optSound', 'optCamNative']); assert(add.light); assert.deepStrictEqual(add.gone, []);
  assert(await page.evaluate(() => window.__app.settings.extra === true && window.__app.settings.quoteOcrAuto === false));
  await page.screenshot({ path: CFG.OUT + '/opzioni_aggiunta.png' });
  await page.evaluate(() => window.__app.closeOptions()); await wait(300);
  // Installazione sul telefono: si capisce a cosa serve
  await page.evaluate(() => window.__app.openOptions('app')); await wait(350);
  assert.strictEqual(await page.$eval('#optH', e => e.textContent), 'Installazione sul telefono');
  assert(/icona tra le app del telefono/.test(await page.$eval('.opt-sec[data-sec="app"]', e => e.innerText)));
  await page.screenshot({ path: CFG.OUT + '/opzioni_installazione.png' });
  assert.deepStrictEqual(errors, []);
  console.log('e2e72 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
