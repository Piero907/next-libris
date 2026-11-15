const CFG = require("./_config");
// dopo un aggiornamento: «Aggiornato in questa versione» con le righe del registro delle versioni nuove, prima quelle in grassetto;
// una volta sola; alla prima apertura dell'app no; «Tutte le novità» apre il registro
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };
const V = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).v;
const REG = '# Registro\n\nIntro.\n\n## Versione ' + V + ' · oggi\n- Correzione piccola.\n- **Novità grande**: descritta.\n  - **Sotto-novità** importante.\n- Ritocco.\n\n## Versione ' + (V - 1) + ' · ieri\n- **Novità di ieri**.\n\n## Versione ' + (V - 2) + ' · prima\n- Vecchia.\n';
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; if (p === '/REGISTRO_MODIFICHE.md') { res.writeHead(200, { 'Content-Type': MIME['.md'] }); return res.end(REG); } const f = path.join(ROOT, p); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }).listen(CFG.port(8190));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const shown = () => page.evaluate(() => !document.querySelector('#wnSheet').hidden);
  // 1) prima apertura: niente pagina, ma si ricorda la versione
  await page.goto('http://localhost:' + CFG.port(8190) + '/?vista=elenco', { waitUntil: 'load' }); await wait(1800);
  assert(!(await shown()), 'prima apertura: niente');
  assert.strictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')).seenV), V);
  // 2) arrivo dalla versione V-2: le novità di V e V-1, prima quelle in grassetto
  await page.evaluate(v => { const s = JSON.parse(localStorage.getItem('catalogo-libri-set')); s.seenV = v; const o = Storage.prototype.setItem; o.call(localStorage, 'catalogo-libri-set', JSON.stringify(s)); Storage.prototype.setItem = function (k, x) { if (k === 'catalogo-libri-set' && !window.__ok) return; return o.call(this, k, x); }; }, V - 2);
  await page.reload({ waitUntil: 'load' }); await wait(1800);
  assert(await shown(), 'pagina delle novità');
  const w = await page.evaluate(() => ({ h: document.querySelector('#wnH').textContent, sub: document.querySelector('#wnSub').textContent, li: [...document.querySelectorAll('#wnList li')].map(x => x.textContent) }));
  console.log('[2]', JSON.stringify(w));
  assert.strictEqual(w.h, 'Aggiornato in questa versione'); assert(new RegExp('^Versione ' + V + ' · 5 novità$').test(w.sub));
  assert.deepStrictEqual(w.li, ['Novità grande: descritta.', 'Sotto-novità importante.', 'Novità di ieri.', 'Correzione piccola.', 'Ritocco.'], 'prima le novità in grassetto; niente della versione già vista');
  assert(await page.evaluate(() => !!document.querySelector('#wnList li b')), 'grassetto');
  await page.screenshot({ path: CFG.OUT + '/novita_versione.png' });
  // «Tutte le novità» apre il registro
  await page.click('#wnAll'); await wait(600);
  assert(!(await shown()) && await page.evaluate(() => !document.querySelector('#logSheet').hidden));
  await page.evaluate(() => document.querySelector('#logClose').click()); await wait(300);
  // 3) una volta sola: riaprendo non ricompare
  await page.evaluate(() => { window.__ok = 1; window.__app.settings.seenV && localStorage.setItem('catalogo-libri-set', JSON.stringify(window.__app.settings)); });
  await page.reload({ waitUntil: 'load' }); await wait(1800);
  assert(!(await shown()), 'una volta sola');
  assert.deepStrictEqual(errors, []);
  console.log('e2e70 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
