const CFG = require("./_config");
const H = require('./_harness');
// Bonifiche della verifica del 17/11/2026 (pagina e codice):
// - caratteri Bricolage Grotesque e IBM Plex Sans dall'app (vendor/fonts), nessuna richiesta a Google Fonts;
// - Content-Security-Policy nel <meta>: nessuno script scritto nella pagina, uno script aggiunto da fuori non parte;
// - l'app dentro la cornice di un altro sito si ferma e mostra solo il link «apri Next Libris»;
// - immagini con data-rm spariscono se non si caricano (prima onerror nell'HTML);
// - registro degli errori: gli ultimi errori finiscono in fondo alla mail di Contatti.
const puppeteer = require('puppeteer-core');
const assert = require('assert');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8314), ROOT);
const http = require('http');
const other = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><title>altro sito</title><iframe id="f" src="http://localhost:' + CFG.port(8314) + '/" width="400" height="600"></iframe>'); }).listen(CFG.port(8315));
const APP = 'http://localhost:' + CFG.port(8314);
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const wait = H.wait;
  const fuori = [];
  await page.setRequestInterception(true);
  page.on('request', r => { const u = r.url(); if (u.startsWith('http://localhost')) return r.continue(); fuori.push(u); r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }); });
  await page.goto(APP + '/?vista=elenco', { waitUntil: 'load' }); await wait(1200);

  // 1) caratteri dall'app
  assert(!fuori.some(u => /fonts\.(googleapis|gstatic)\.com/.test(u)), 'nessuna richiesta a Google Fonts: ' + fuori.join(' '));
  const f = await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([document.fonts.load('600 24px "Bricolage Grotesque"', 'Libri'), document.fonts.load('400 16px "IBM Plex Sans"', 'Libri'), document.fonts.load('600 16px "IBM Plex Sans"', 'Libri')]);
    const ok = (fam) => [...document.fonts].filter(x => x.family.replace(/"/g, '') === fam && x.status === 'loaded').length;
    return { bri: ok('Bricolage Grotesque'), plex: ok('IBM Plex Sans'), links: [...document.querySelectorAll('link[href*="fonts.g"]')].length };
  });
  console.log('[caratteri]', JSON.stringify(f));
  assert(f.bri >= 1 && f.plex >= 2 && f.links === 0, 'caratteri locali caricati');

  // 2) CSP: c'è, niente script nella pagina, uno script aggiunto da fuori non parte
  const c = await page.evaluate(() => ({ csp: (document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || '',
    inline: [...document.querySelectorAll('script:not([src])')].length, attr: [...document.querySelectorAll('*')].filter(e => [...e.attributes].some(a => /^on/.test(a.name))).map(e => e.tagName) }));
  console.log('[csp]', c.csp.slice(0, 90) + '…', '| script nella pagina:', c.inline, '| gestori nell\'HTML:', c.attr.join(','));
  assert(/script-src 'self'/.test(c.csp) && /object-src 'none'/.test(c.csp) && !/unsafe-eval'/.test(c.csp.replace("'wasm-unsafe-eval'", '')), 'CSP giusta');
  assert.strictEqual(c.inline, 0, 'nessuno script scritto nella pagina'); assert.deepStrictEqual(c.attr, [], 'nessun onload/onerror/onclick nell\'HTML');
  const pwn = await page.evaluate(() => { const s = document.createElement('script'); s.textContent = 'window.__pwn = 1'; document.head.appendChild(s);
    const d = document.createElement('div'); d.innerHTML = '<img src="x" onerror="window.__pwn2 = 1">'; document.body.appendChild(d);
    return new Promise(r => setTimeout(() => r([typeof window.__pwn, typeof window.__pwn2]), 300)); });
  assert.deepStrictEqual(pwn, ['undefined', 'undefined'], 'script e onerror aggiunti da fuori bloccati');
  await H.sleep(300); H.csp.splice(0, H.csp.length);   // quei due blocchi erano voluti

  // 3) data-rm: l'immagine che non si carica sparisce
  const rm = await page.evaluate(() => new Promise(r => { const i = document.createElement('img'); i.setAttribute('data-rm', ''); i.id = 'rmProva'; i.src = '/non-c-e.png'; document.body.appendChild(i); setTimeout(() => r(!!document.getElementById('rmProva')), 600); }));
  assert.strictEqual(rm, false, 'immagine rotta tolta');

  // 4) registro degli errori nella mail di Contatti
  const mail = await page.evaluate(() => { window.nlErr(new Error('errore di prova')); window.nlErr(new Error('errore di prova')); window.dispatchEvent(new ErrorEvent('error', { error: new Error('errore non preso'), message: 'errore non preso' })); window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', { promise: Promise.resolve(), reason: new Error('promessa rifiutata') }));
    return new Promise(r => setTimeout(() => r(decodeURIComponent(window.NL.contactURL())), 100)); });
  console.log('[mail]', mail.split('---')[1].replace(/\n/g, ' | ').slice(0, 260));
  assert(/Ultimi errori:/.test(mail) && /errore di prova \(×2\)/.test(mail) && /errore non preso/.test(mail) && /promessa rifiutata/.test(mail), 'errori in fondo alla mail');

  // 5) dentro la cornice di un altro sito: solo il link
  const p2 = await browser.newPage();
  await p2.goto('http://localhost:' + CFG.port(8315) + '/', { waitUntil: 'load' }); await H.sleep(800);
  const fr = p2.frames().find(x => x.url().startsWith(APP));
  const inside = await fr.evaluate(() => ({ txt: document.body ? document.body.innerText : '', link: (document.querySelector('a[target="_top"]') || {}).href || '', app: !!document.getElementById('btnScan') && !document.getElementById('btnScan').closest('[hidden]') && document.getElementById('btnScan').offsetParent !== null, nl: !!window.NL }));
  console.log('[cornice]', JSON.stringify(inside));
  assert(/apri Next Libris/.test(inside.txt) && inside.link.startsWith(APP) && !inside.app && !inside.nl, 'l\'app non parte dentro un altro sito');
  await p2.close();

  assert.deepStrictEqual(errors, []);
  console.log('e2e114 OK'); await browser.close(); server.close(); other.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
