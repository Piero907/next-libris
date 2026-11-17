const CFG = require("./_config");
const H = require('./_harness');
// autore: nome da toccare (profilo da Wikipedia), matita per modificare, ricerca sul web, i suoi libri
const puppeteer = require('puppeteer-core');
const http = require('http'), fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8168), ROOT);
const json = o => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
const B = (o) => Object.assign({ t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 1, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: 'da', rt: 0, rd: '' }, o);
const books = [B({ id: 'm1', t: 'La casa di Araucaíma', a: 'Álvaro Mutis', ts: 3 }), B({ id: 'm2', t: 'Ilona arriva con la pioggia', a: 'Álvaro Mutis', ts: 2 }), B({ id: 'x', t: 'Due autori', a: 'Mario Rossi, Anna Bianchi', ts: 1 }), B({ id: 'v', t: 'Senza autore', ts: 0 }), B({ id: 'sg', t: 'Africa', a: 'Sebastião Salgado', ts: -1 }), B({ id: 'pr', t: 'I filosofi e le macchine', a: 'Paolo Rossi', ts: -2 })];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
let hits = [];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', r => { const u = decodeURIComponent(r.url());
    if (u.startsWith('http://localhost')) return r.continue();
    if (u.includes('wikipedia.org')) hits.push(u.replace('https://it.wikipedia.org', ''));
    if (u.includes('/page/summary/Álvaro_Mutis')) return r.respond(json({ type: 'standard', title: 'Álvaro Mutis', description: 'scrittore e poeta colombiano', extract: 'Álvaro Mutis Jaramillo è stato uno scrittore e poeta colombiano, noto per i romanzi con il marinaio Maqroll il Gabbiere.', content_urls: { mobile: { page: 'https://it.m.wikipedia.org/wiki/%C3%81lvaro_Mutis' } } }));
    if (u.includes('list=search') && u.includes('Mario Rossi')) return r.respond(json({ query: { search: [{ title: 'Mario Rossi (calciatore)' }, { title: 'Mario Rossi (scrittore)' }] } }));
    if (u.includes('/page/summary/Mario_Rossi_(scrittore)')) return r.respond(json({ type: 'standard', title: 'Mario Rossi (scrittore)', description: 'scrittore italiano', extract: 'Mario Rossi è uno scrittore italiano di romanzi gialli.' }));
    if (u.includes('/page/summary/Mario_Rossi_(calciatore)')) return r.respond(json({ type: 'standard', title: 'Mario Rossi (calciatore)', description: 'calciatore italiano', extract: 'Calciatore.' }));
    if (u.includes('/page/summary/Mario_Rossi?')) return r.respond(json({ type: 'disambiguation', title: 'Mario Rossi', extract: 'Mario Rossi può riferirsi a...' }));
    // fotografo (non «scrittore»): prima non veniva trovato; ora si', con la foto (16/11/2026)
    if (u.includes('/page/summary/Sebastião_Salgado')) return r.respond(json({ type: 'standard', title: 'Sebastião Salgado', description: 'fotografo brasiliano', extract: 'Sebastião Ribeiro Salgado Júnior è stato un fotografo e fotoreporter brasiliano.', thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/commons/thumb/x/xx/Salgado.jpg/320px-Salgado.jpg' } }));
    if (u.includes('list=search') && u.includes('Sebastião Salgado')) return r.respond(json({ query: { search: [{ title: 'Sebastião Salgado' }] } }));
    if (u.startsWith('https://upload.wikimedia.org/')) return r.respond({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG });
    // omonimo: la voce col nome e' un calciatore, ma c'e' il filosofo che scrive: vince lui
    if (u.includes('/page/summary/Paolo_Rossi?')) return r.respond(json({ type: 'standard', title: 'Paolo Rossi', description: 'calciatore italiano', extract: 'Paolo Rossi è stato un calciatore italiano.' }));
    if (u.includes('list=search') && u.includes('Paolo Rossi')) return r.respond(json({ query: { search: [{ title: 'Paolo Rossi (filosofo)' }] } }));
    if (u.includes('/page/summary/Paolo_Rossi_(filosofo)')) return r.respond(json({ type: 'standard', title: 'Paolo Rossi (filosofo)', description: 'filosofo e storico della scienza italiano', extract: 'Paolo Rossi è stato un filosofo e storico della scienza.' }));
    if (u.includes('wikipedia.org')) return r.respond({ status: 404, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: '{}' });
    r.abort(); });
  await page.evaluateOnNewDocument((b) => { window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true); window.__opened = []; window.open = u => { window.__opened.push(u); return null; };
    if (!sessionStorage.seeded) { localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 })); localStorage.setItem('catalogo-libri-set', JSON.stringify({ extra: true, lastBackup: Date.now(), installed: true, instScope: '/', swiped: true, name: 'Piero', selTip: 1 })); sessionStorage.seeded = 1; } }, books);
  await page.goto('http://localhost:' + CFG.port(8168) + '/?vista=elenco', { waitUntil: 'load' });
  const wait = H.wait;   // attesa «finché» (_harness.js)
  await wait(1200);
  const click = sel => page.evaluate(s => document.querySelector(s).click(), sel);
  const open = async id => { await page.evaluate(i => document.querySelector('.row[data-id="' + i + '"] [data-act="toggle"]').click(), id); await wait(250); };
  // 1) autore compilato: nome toccabile + matita, nessun campo di testo
  await open('m1');
  assert(await page.$('.row[data-id="m1"] .au-name') && await page.$('.row[data-id="m1"] .au-edit')); assert(!(await page.$('.row[data-id="m1"] textarea[data-k="a"]')));
  await page.screenshot({ path: CFG.OUT + '/au_card.png' });
  // 2) tocco sul nome: profilo da Wikipedia
  await click('.row[data-id="m1"] .au-name');
  await page.waitForFunction(() => /Maqroll/.test(document.querySelector('#auTxt').textContent), { timeout: 8000 });
  console.log('[profilo]', await page.$eval('#auDesc', e => e.textContent), '|', await page.$eval('#auTxt', e => e.textContent.slice(0, 60)));
  assert.strictEqual(await page.$eval('#auMine', e => e.textContent), 'I suoi libri nella tua libreria (2)');
  assert(!(await page.$eval('#auWiki', e => e.hidden)) && (await page.$eval('#auWiki', e => e.href)).includes('wikipedia.org'));
  await page.screenshot({ path: CFG.OUT + '/au_sheet.png' });
  await click('#auWeb'); assert((await page.evaluate(() => window.__opened[0])).includes('google.com/search?q=%C3%81lvaro%20Mutis%20scrittore'));
  // i suoi libri: filtro per autore
  await click('#auMine'); await wait(300);
  assert(await page.$eval('#auSheet', e => e.hidden)); assert.deepStrictEqual((await page.$$eval('#list .row', e => e.map(r => r.dataset.id))).sort(), ['m1', 'm2']);
  await page.evaluate(() => window.__app && document.querySelector('#activeFlt .chip') && document.querySelector('#activeFlt .chip').click()); await wait(200);
  // 3) matita: diventa modificabile, scrivo, uscendo torna il nome
  await open('m1');
  await click('.row[data-id="m1"] .au-edit'); await wait(150);
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.dataset.k); assert.strictEqual(focused, 'a', 'cursore nel campo');
  await page.keyboard.type(' Jaramillo'); await page.evaluate(() => document.activeElement.blur()); await wait(400);
  const a = await page.evaluate(() => window.__app.state.books.find(b => b.id === 'm1').a); assert.strictEqual(a, 'Álvaro Mutis Jaramillo');
  assert(await page.$('.row[data-id="m1"] .au-name'), 'torna il nome da toccare'); assert.strictEqual(await page.$eval('.row[data-id="m1"] .au-name', e => e.textContent), 'Álvaro Mutis Jaramillo');
  // 4) due autori: ognuno si tocca; nome ambiguo -> voce dello scrittore
  await open('x');
  assert.deepStrictEqual(await page.$$eval('.row[data-id="x"] .au-name', e => e.map(x => x.textContent)), ['Mario Rossi', 'Anna Bianchi']);
  hits = []; await click('.row[data-id="x"] .au-name[data-n="Mario Rossi"]');
  await page.waitForFunction(() => /gialli/.test(document.querySelector('#auTxt').textContent), { timeout: 8000 }); console.log('[ambiguo]', hits.join(' | '));
  await click('#auClose');
  // sconosciuto: messaggio e Cerca sul web
  await click('.row[data-id="x"] .au-name[data-n="Anna Bianchi"]');
  await page.waitForFunction(() => /Non ho trovato/.test(document.querySelector('#auTxt').textContent), { timeout: 8000 });
  assert(await page.$eval('#auWiki', e => e.hidden));
  await page.evaluate(() => history.back()); await wait(300); assert(await page.$eval('#auSheet', e => e.hidden), 'Indietro chiude');
  assert(await page.$('.row.open[data-id="x"]'), 'la scheda resta aperta');
  await page.evaluate(() => history.back()); await wait(300); assert(!(await page.$('.row.open[data-id="x"]')), 'poi Indietro chiude la scheda');
  // 4b) fotografo: trovato, con la foto accanto al nome; toccandola si ingrandisce
  await open('sg');
  await click('.row[data-id="sg"] .au-name');
  await page.waitForFunction(() => /fotoreporter/.test(document.querySelector('#auTxt').textContent), { timeout: 8000 });
  await page.waitForFunction(() => !document.querySelector('#auPic').hidden, { timeout: 5000 });
  console.log('[fotografo]', await page.$eval('#auDesc', e => e.textContent), '| foto:', await page.$eval('#auPic img', e => e.src.slice(-20)));
  assert.strictEqual(await page.$eval('#auDesc', e => e.textContent), 'Fotografo brasiliano');
  await click('#auPic'); await wait(150); assert(await page.$eval('#auPic', e => e.classList.contains('big')));
  await page.screenshot({ path: CFG.OUT + '/au_foto.png' });
  await click('#auClose'); await wait(200);
  // senza foto (Mutis): nessun riquadro vuoto
  await open('m2'); await click('.row[data-id="m2"] .au-name');
  await page.waitForFunction(() => /Maqroll/.test(document.querySelector('#auTxt').textContent), { timeout: 8000 });
  assert(await page.$eval('#auPic', e => e.hidden), 'senza foto niente riquadro');
  await click('#auClose'); await wait(200);
  // 4c) omonimo: vince chi scrive
  await open('pr');
  await click('.row[data-id="pr"] .au-name');
  await page.waitForFunction(() => /storico della scienza/.test(document.querySelector('#auTxt').textContent), { timeout: 8000 });
  await click('#auClose'); await wait(200);
  // 5) autore vuoto: campo normale
  await open('v'); assert(await page.$('.row[data-id="v"] textarea[data-k="a"]'));
  assert.deepStrictEqual(errors, []);
  console.log('e2e49 OK'); await browser.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
