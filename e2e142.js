const CFG = require("./_config");
const H = require('./_harness');
// moduli: guida
// Installazione obbligatoria sui telefoni (Piero, 20/11/2026): nel browser di un telefono c'è solo la schermata d'installazione
// (grafica verde delle schede), senza «Continua nel browser»; tablet, PC e app installata no. Android: tasto «Installa» del browser,
// poi «Fatto!». iPhone: passi di Safari; con il link d'invito il nome di chi ha invitato; con libri nel browser «Fai il backup».
// Le schede di benvenuto aspettano l'app installata. Passo 2 del percorso: «Chiedila a un amico» solo se un amico ha un'API sua.
const puppeteer = require('puppeteer-core');
const assert = require('assert');
const server = H.serve(CFG.port(8342), CFG.APP);
const APP = 'http://localhost:' + CFG.port(8342);
const wait = H.wait;
const UA = { android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1' };
const BOOKS = { books: [{ id: 'b1', t: 'Il barone rampante', a: 'Italo Calvino', g: [], ts: 1 }, { id: 'b2', t: 'Lessico famigliare', a: 'Natalia Ginzburg', g: [], ts: 2 }], updated: 5 };
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  async function page(o) {
    const ctx = await browser.createBrowserContext(); const p = await ctx.newPage();
    if (o.ua) await p.setUserAgent(UA[o.ua]);
    await p.setViewport({ width: o.w || 390, height: o.h || 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    p.on('pageerror', e => errors.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', r => { const u = r.url(); if (u.startsWith('http://localhost') || u.startsWith('data:')) return r.continue(); r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }); });
    if (o.seed) await p.evaluateOnNewDocument((s) => { localStorage.setItem('catalogo-libri-v2', s); }, JSON.stringify(o.seed));
    if (o.app) await p.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); });
    await p.goto(APP + '/' + (o.q || '?guida=1'), { waitUntil: 'load' }); await wait(1800);
    return p;
  }
  const gate = (p) => p.evaluate(() => { const g = document.getElementById('iosGate'); return g && !g.hidden ? { h: g.querySelector('h2').textContent, t: g.innerText, web: !!g.querySelector('[data-ig="web"]'), inst: !!g.querySelector('[data-ig="inst"]'), bk: !!g.querySelector('[data-ig="backup"]'), wide: document.documentElement.scrollWidth - document.documentElement.clientWidth } : null; });
  const guida = (p) => p.evaluate(() => { const g = document.getElementById('guida'); return !!g && !g.hidden; });

  // 1) Android nel browser: solo la schermata, niente «Continua nel browser», le schede aspettano
  let p = await page({ ua: 'android' });
  let g = await gate(p);
  assert(g && g.h === 'Installa Next Libris' && !g.web && !g.inst && g.wide <= 0, 'Android senza il tasto del browser: passi del menu: ' + JSON.stringify(g));
  assert(/Installa app/.test(g.t), 'passi del menu di Chrome');
  assert(!(await guida(p)), 'le schede aspettano l’app installata');
  await p.evaluate(() => { window.__pr = 0; const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__pr++; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); }); await wait(300);
  g = await gate(p); assert(g.inst && /Tocca Installa qui sotto/.test(g.t), 'con il tasto del browser: «Installa»');
  await p.click('#iosGate [data-ig="inst"]'); await wait(300);
  assert.strictEqual(await p.evaluate(() => window.__pr), 1, 'si apre la richiesta del browser');
  await p.evaluate(() => window.dispatchEvent(new Event('appinstalled'))); await wait(300);
  g = await gate(p); assert(g && g.h === 'Fatto!' && /dall'icona/.test(g.t), 'dopo l’installazione: «Fatto!»');
  await p.browserContext().close();

  // 2) iPhone con il link d'invito: passi di Safari e il nome da cercare
  p = await page({ ua: 'ios', q: '?amico=Anna%20R.&guida=1' });
  g = await gate(p);
  assert(g && g.h === 'Mettila sul tuo iPhone' && !g.web && /Aggiungi alla schermata Home/.test(g.t), 'iPhone: ' + JSON.stringify(g));
  assert(/Ti ha invitato Anna R\. Nell'app installata cerca «Anna R\.» in Amici/.test(g.t.replace(/\s+/g, ' ')), 'invito su iPhone: ' + g.t);
  assert(!g.bk, 'senza libri niente backup');
  await p.browserContext().close();

  // 3) iPhone con libri nel browser: «Fai il backup»
  p = await page({ ua: 'ios', seed: BOOKS });
  g = await gate(p); assert(g && g.bk && /Hai 2 libri in questo browser/.test(g.t), 'iPhone con libri: ' + g.t);
  await p.browserContext().close();

  // 4) telefono basso: tutto nello schermo
  p = await page({ ua: 'android', w: 360, h: 640 });
  g = await gate(p); assert(g && g.wide <= 0, 'a 360x640 niente scorrimento di lato');
  await p.browserContext().close();

  // 5) tablet, PC e app installata: niente schermata, le schede si aprono
  for (const o of [{ ua: 'android', w: 800, h: 1100 }, { w: 1280, h: 800 }, { ua: 'ios', app: true }]) {
    p = await page(o);
    assert(!(await gate(p)) && await guida(p), 'niente schermata e schede aperte: ' + JSON.stringify(o));
    if (o.app) {   // passo 2 del percorso senza amici con un'API: niente «Chiedila a un amico»
      for (let i = 0; i < 3; i++) { await p.click('#gdFoot .gd-next'); await wait(250); }
      await p.evaluate(() => document.querySelector('#gdFoot [data-gd="later"]').click()); await wait(1800);
      const pt = await p.evaluate(() => { const e = document.getElementById('percorso'); return e && !e.hidden ? { n: document.getElementById('ptN').textContent, b: [...e.querySelectorAll('.gd-try')].map(x => x.textContent), wc: e.classList.contains('wc') } : null; });
      assert(pt && pt.n === 'Passo 2 di 3' && pt.wc && pt.b.join() === 'Crea la tua (gratis)', 'passo 2 con la grafica delle schede e senza amico: ' + JSON.stringify(pt));
    }
    await p.browserContext().close();
  }

  assert.deepStrictEqual(errors, []);
  console.log('e2e142 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
