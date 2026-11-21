const CFG = require('./_config');
const H = require('./_harness');
// e2e140 (20/11/2026, tela «Leggilo gratis», scelte di Piero in claude/idee-dati-pubblici.md): modulo gratis.js (si salta senza il file).
// Rete finta (Wikidata, Wikisource, Open Library). Controlla: riga «Leggilo gratis» solo per i libri di pubblico dominio con il testo
// trovato; finestra con «In italiano», lingua originale, «Da ascoltare», «Cerca anche su»; Indietro la chiude; segno «Gratis» nei Desideri;
// riga in Per te e finestra «Classici da leggere gratis»; niente scorrimento di lato; nessuna richiesta fuori da quelle tre fonti.
// Con SCHERMATE=cartella fa le foto (390, 412 scuro, 360, 1280).
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path'), assert = require('assert');
if (!fs.existsSync(path.join(CFG.APP, 'gratis.js'))) { console.log('e2e140: modulo gratis.js assente, prova saltata'); process.exit(0); }
const OUT = process.env.SCHERMATE || ''; if (OUT) fs.mkdirSync(OUT, { recursive: true });
const PORT = CFG.port(8340);
const server = H.serve(PORT, CFG.APP);
const now = Date.now();
const B = (id, t, a, o) => Object.assign({ id, t, a, ts: now - Number(id.slice(1)) * 1000, e: 'Editore', y: '2010', pg: '300', rs: 'da' }, o || {});
const books = [B('k1', 'I Malavoglia', 'Giovanni Verga', { e: 'Mondadori', y: '2019' }), B('k2', 'Il barone rampante', 'Italo Calvino', { rs: 'in' }), B('k3', 'Canto di Natale', 'Charles Dickens', { e: 'Feltrinelli' }),
  B('k4', 'Il nome della rosa', 'Umberto Eco', { rs: 'ok' }), B('k5', 'La coscienza di Zeno', 'Italo Svevo', { rs: 'ok' }), B('k6', 'Lessico famigliare', 'Natalia Ginzburg'),
  B('w1', 'Mastro-don Gesualdo', 'Giovanni Verga', { w: true }), B('w2', 'Orgoglio e pregiudizio', 'Jane Austen', { w: true }), B('w3', 'Il deserto dei Tartari', 'Dino Buzzati', { w: true }),
  B('w4', 'Una vita', 'Italo Svevo', { w: true }), B('w5', 'Cecità', 'José Saramago', { w: true }), B('w6', 'Delitto e castigo', 'Fëdor Dostoevskij', { w: true })];
const Q = { 'Giovanni Verga': 'Q271814', 'Italo Calvino': 'Q173481', 'Charles Dickens': 'Q5686', 'Umberto Eco': 'Q12807', 'Italo Svevo': 'Q311145', 'Natalia Ginzburg': 'Q236631', 'Jane Austen': 'Q36322', 'Dino Buzzati': 'Q327016', 'José Saramago': 'Q34460', 'Fëdor Dostoevskij': 'Q991' };
const DIED = { Q271814: 1922, Q173481: 1985, Q5686: 1870, Q12807: 2016, Q311145: 1928, Q236631: 1991, Q36322: 1817, Q327016: 1972, Q34460: 2010, Q991: 1881 };
const r = (k, v, x) => Object.assign({ k: { value: k }, v: { value: v } }, x ? { x: { value: x } } : {});
const DET = {
  Q271814: [r('b', 'v/giovanni-verga'), r('m', '41870'), r('m', '1200'), r('l', '1924'), r('g', '39173'), r('c', 'it'), r('s', 'https://it.wikisource.org/wiki/Autore:Giovanni_Verga'), r('s', 'https://en.wikisource.org/wiki/Author:Giovanni_Verga'),
    r('w', 'I Malavoglia', 'I Malavoglia'), r('w', 'Mastro Don Gesualdo', 'Mastro-don Gesualdo'), r('w', 'Vita dei campi', 'Vita dei campi'), r('w', 'Novelle rusticane', ''), r('w', 'Eva', ''), r('w', 'Storia di una capinera', ''), r('w', 'Rosso Malpelo', ''), r('e', 'L\'amante di Gramigna', '37979')],
  Q5686: [r('l', '87'), r('g', '37'), r('c', 'en'), r('s', 'https://en.wikisource.org/wiki/Author:Charles_Dickens'), r('s', 'https://it.wikisource.org/wiki/Autore:Charles_Dickens'),
    r('w', 'Canto di Natale', 'A Christmas Carol'), r('w', 'Oliver Twist', 'Oliver Twist'), r('w', 'David Copperfield', 'David Copperfield'), r('w', 'Grandi speranze', 'Great Expectations'), r('e', 'Canto di Natale', '46')],
  Q311145: [r('g', '4433'), r('c', 'it'), r('s', 'https://it.wikisource.org/wiki/Autore:Italo_Svevo'), r('w', 'La coscienza di Zeno', 'La coscienza di Zeno'), r('w', 'Una vita', 'Una vita'), r('w', 'Senilità', 'Senilità'), r('e', 'Senilità', '22283')],
  Q36322: [r('l', '139'), r('g', '68'), r('c', 'en'), r('s', 'https://en.wikisource.org/wiki/Author:Jane_Austen'), r('w', 'Orgoglio e pregiudizio', 'Pride and Prejudice'), r('w', 'Emma', 'Emma'), r('w', 'Ragione e sentimento', 'Sense and Sensibility'), r('e', 'Orgoglio e pregiudizio', '1342')],
  Q991: [r('l', '6'), r('c', 'ru'), r('s', 'https://ru.wikisource.org/wiki/Автор:Фёдор_Михайлович_Достоевский'), r('w', 'Delitto e castigo', 'Преступление и наказание'), r('w', 'I fratelli Karamazov', 'Братья Карамазовы')]
};
const WS = {
  'it|Autore:Giovanni Verga': ['I Malavoglia', 'Mastro-don Gesualdo', 'Opera:Vita dei campi', 'Novelle rusticane', 'Eva (1873)', 'Storia di una capinera', 'Giovanni Verga colpito da paralisi'],
  'it|Autore:Charles Dickens': ['Il circolo Pickwick'],
  'en|Author:Charles Dickens': ['A Christmas Carol', 'Oliver Twist', 'Great Expectations'],
  'it|Autore:Italo Svevo': ['La coscienza di Zeno', 'Una vita', 'Senilità'],
  'en|Author:Jane Austen': ['Pride and Prejudice', 'Emma', 'Sense and Sensibility']
};
const OL = { 'Giovanni Verga': [{ key: '/works/OL1W', title: 'I Malavoglia', language: ['ita', 'eng'] }, { key: '/works/OL2W', title: 'Mastro-don Gesualdo', language: ['ita'] }],
  'Charles Dickens': [{ key: '/works/OL3W', title: 'A Christmas Carol', language: ['eng', 'ita'] }], 'Jane Austen': [{ key: '/works/OL4W', title: 'Pride and Prejudice', language: ['eng'] }], 'Italo Svevo': [] };
const stat = { wd: 0, ws: 0, ol: 0, ll: 0, rai: 0, other: [] };
// Liber Liber (ricerca delle pagine) e RaiPlay Sound (elenco degli audiolibri e scheda di ognuno)
const LL = { 'I Malavoglia': [{ title: 'I Malavoglia', url: 'https://liberliber.it/autori/autori-v/giovanni-verga/i-malavoglia/' }, { title: 'I Malavoglia', url: 'https://liberliber.it/autori/autori-x/altro/i-malavoglia/' }] };
const RAI = { '/audiolibri/delittoecastigo': 'Di Fëdor Dostoevskji', '/audiolibri/ilbaronerampante': 'Di Italo Calvino', '/audiolibri/cecita': 'Di Giovanni Rossi', '/audiolibri/imalavoglia': 'Di Giovanni Verga' };
function fake(u) {
  const url = new URL(u);
  if (url.host === 'query.wikidata.org') {
    stat.wd++; const q = url.searchParams.get('query');
    if (/P570/.test(q)) { const ids = q.match(/wd:Q\d+/g).map(x => x.slice(3)); return { results: { bindings: ids.map(i => Object.assign({ a: { value: 'http://www.wikidata.org/entity/' + i } }, DIED[i] ? { d: { value: DIED[i] + '-05-01T00:00:00Z' } } : {})) } }; }
    const i = /wd:(Q\d+) wdt:P1899/.exec(q)[1]; return { results: { bindings: DET[i] || [] } };
  }
  if (/wikisource\.org$/.test(url.host)) { stat.ws++; const t = url.searchParams.get('titles').replace(/_/g, ' '), k = url.host.split('.')[0] + '|' + t; return { query: { pages: { 1: { title: t, links: (WS[k] || []).map(x => ({ ns: 0, title: x })) } } } }; }
  if (url.host === 'openlibrary.org') { stat.ol++; return { docs: OL[url.searchParams.get('author')] || [] }; }
  if (url.host === 'liberliber.it' && url.pathname === '/wp-json/wp/v2/search') { stat.ll++; return (LL[url.searchParams.get('search')] || []).map(x => Object.assign({ subtype: 'page' }, x)); }
  if (url.host === 'www.raiplaysound.it') {
    stat.rai++;
    if (url.pathname === '/programmi/adaltavoce/audiolibri.json') return { block: { cards: [['Delitto e castigo', '/audiolibri/delittoecastigo'], ['Il barone rampante', '/audiolibri/ilbaronerampante'], ['Cecità', '/audiolibri/cecita'], ['I Malavoglia', '/audiolibri/imalavoglia']].map(x => ({ title: x[0], path_id: x[1] + '.json' })) } };
    const k = url.pathname.replace(/\.json$/, ''); if (RAI[k]) return { podcast_info: { title: 'x', author: RAI[k] } };
  }
  return null;
}
(async () => {
  const br = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [];
  const open = async (w, h, dark) => {
    const p = await br.newPage(); await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: w < 700, hasTouch: w < 700 });
    p.on('pageerror', e => errors.push(e.message));
    await p.setRequestInterception(true);
    p.on('request', rq => { const u = rq.url(); if (/^(http:\/\/localhost|data:|blob:)/.test(u)) return rq.continue(); const j = fake(u); if (j) return rq.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(j) }); stat.other.push(u.slice(0, 80)); rq.respond({ status: 404, body: '' }); });
    await p.goto('http://localhost:' + PORT + '/', { waitUntil: 'load' });
    await p.evaluate((b, Q, dark) => {
      localStorage.clear();
      localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: Date.now() }));
      localStorage.setItem('catalogo-libri-set', JSON.stringify({ swiped: true, name: 'Piero', lastBackup: Date.now(), donUntil: Date.now() + 9e9, instSnooze: Date.now(), theme: dark ? 'dark' : 'light', themeV2: true }));
      localStorage.setItem('catalogo-libri-guida', JSON.stringify({ v: 99, seen: 1, path: 0 }));
      const wd = { '~v': 3 }; Object.keys(Q).forEach(n => { wd[n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')] = { t: Date.now(), q: Q[n], c: ['IT'] }; });
      localStorage.setItem('catalogo-libri-auwd', JSON.stringify(wd));
      const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/^catalogo-libri-(v2|set|guida)$/.test(k)) return; return o.call(this, k, v); };
    }, books, Q, !!dark);
    await p.reload({ waitUntil: 'load' }); await H.wait(800);
    await p.evaluate(() => { if (window.NLGuida && window.NLGuida.close) window.NLGuida.close(); document.querySelectorAll('.sheet:not([hidden])').forEach(x => { x.hidden = true; }); }); await H.wait(300);
    await p.evaluate(() => window.NLGratis.run()); await H.wait(600);
    return p;
  };
  const shot = (p, n) => OUT ? p.screenshot({ path: OUT + '/' + n + '.png' }) : null;
  const p = await open(390, 844);
  const d = await p.evaluate(() => { const a = NLGratis.data().a; return Object.keys(a).map(k => k + ':' + a[k].pd + (a[k].ok ? 'ok' : '')).join(' '); });
  console.log('dati', d, JSON.stringify(stat));
  const av = await p.evaluate(() => NL.books().map(b => b.t + ' → ' + JSON.stringify(NLGratis.avail(b))).join('\n'));
  console.log(av);
  // nomi un po' diversi: titolo senza articolo, cognome traslitterato in un altro modo
  const k7 = await p.evaluate(() => JSON.stringify(NLGratis.avail({ id: 'x', t: 'Malavoglia', a: 'Giovanni Verga' })));
  assert(/it\.wikisource\.org\/wiki\/I_Malavoglia/.test(k7), '«Malavoglia» trova «I Malavoglia»: ' + k7);
  const w6 = await p.evaluate(() => { const v = NLGratis.avail(NL.get('w6')); return v && !v.pd && v.au[0].u; });
  assert.strictEqual(w6, 'https://www.raiplaysound.it/audiolibri/delittoecastigo', '«Dostoevskji» = «Dostoevskij» per «Ad alta voce»');
  // 1) pagina del libro
  await p.evaluate(() => NL.openCard('k1')); await H.wait(900);
  assert(await p.$('.cv-page .gr-row'), 'riga «Leggilo gratis» nella pagina del libro');
  await shot(p, '1-pagina-malavoglia');
  await p.evaluate(() => document.querySelector('.cv-page .gr-row').click()); await H.wait(500);
  assert(await p.evaluate(() => !document.getElementById('grSheet').hidden && document.querySelector('#grBody').textContent.includes('In italiano') && document.querySelector('#grBody').textContent.includes('Altre fonti')), 'finestra aperta');
  await H.wait(600);   // Liber Liber: l'opera precisa arriva dopo e ridisegna la finestra
  const links = await p.evaluate(() => [...document.querySelectorAll('#grBody a')].map(a => a.href));
  console.log('link', links);
  assert(links.includes('https://liberliber.it/autori/autori-v/giovanni-verga/i-malavoglia/'), 'Liber Liber: l\'opera precisa, dell\'autore giusto');
  assert(links.includes('https://biblioteche.medialibrary.it/search?idcrea=1200&c=open'), 'MLOL: risorse libere dell\'autore (codice più vecchio)');
  assert(links.includes('https://www.raiplaysound.it/audiolibri/imalavoglia'), '«Ad alta voce» tra gli audiolibri');
  assert(!links.some(u => /bibliotecaitaliana|www\.medialibrary\.it\/$|programmi\/adaltavoce$|\?s=/.test(u)), 'niente link generici');
  await shot(p, '2-finestra-malavoglia');
  await p.evaluate(() => document.querySelector('#grSheet .sheet-in').scrollTo(0, 9999)); await H.wait(200); await shot(p, '2b-finestra-malavoglia-fondo');
  await p.goBack(); await H.wait(500);
  assert(await p.evaluate(() => document.getElementById('grSheet').hidden), 'Indietro chiude la finestra');
  // un libro non di pubblico dominio: niente riga
  await p.evaluate(() => { document.querySelector('.row.open .chev-btn') && document.querySelector('.row.open .chev-btn').click(); }); await H.wait(500);
  await p.evaluate(() => NL.openCard('k2')); await H.wait(800);
  assert.strictEqual(await p.evaluate(() => { const r = document.querySelector('.cv-page .gr-row'); return r && r.querySelector('b').textContent; }), 'Ascoltalo gratis', 'Calvino (moderno): «Ascoltalo gratis» da «Ad alta voce»');
  await p.evaluate(() => document.querySelector('.cv-page .gr-row').click()); await H.wait(500);
  assert(await p.evaluate(() => document.getElementById('grH').textContent === 'Ascoltalo gratis' && !document.querySelector('#grBody').textContent.includes('Altre fonti')), 'finestra solo da ascoltare');
  await shot(p, '1c-ascoltalo-calvino');
  await p.goBack(); await H.wait(400);
  await p.evaluate(() => { document.querySelector('.row.open .chev-btn') && document.querySelector('.row.open .chev-btn').click(); }); await H.wait(500);
  await p.evaluate(() => NL.openCard('k3')); await H.wait(800);
  await p.evaluate(() => document.querySelector('.cv-page .gr-row').click()); await H.wait(500);
  await shot(p, '3-finestra-dickens');
  await p.goBack(); await H.wait(400);
  await p.evaluate(() => { document.querySelector('.row.open .chev-btn') && document.querySelector('.row.open .chev-btn').click(); }); await H.wait(500);
  // 4) Desideri
  await p.evaluate(() => { NL.setTab('wish'); window.scrollTo(0, 0); }); await H.wait(900);
  const tags = await p.evaluate(() => [...document.querySelectorAll('#list .cover .gr-tag')].map(t => t.closest('.cover').querySelector('.cap').textContent));
  console.log('Gratis su', tags);
  assert(!(await p.evaluate(() => { NL.openCard('w5'); return new Promise(ok => setTimeout(() => ok(!!document.querySelector('.cv-page .gr-row')), 800)); })), 'Cecità: titolo uguale ma autore diverso, niente riga');
  await p.evaluate(() => { document.querySelector('.cv-back') && document.querySelector('.cv-back').click(); }); await H.wait(600); assert.deepStrictEqual(tags.sort(), ['Delitto e castigo', 'Mastro-don Gesualdo', 'Orgoglio e pregiudizio', 'Una vita'].sort().filter(t => t !== 'Delitto e castigo'));
  await shot(p, '4-desideri');
  // 5) Per te
  await p.evaluate(() => document.querySelector('#gTabs [data-g="you"]').click()); await H.wait(900);
  assert(await p.$('#layYouList .gr-you'), 'riga in Per te');
  await shot(p, '5-per-te');
  await p.click('#layYouList .gr-you'); await H.wait(600);
  await shot(p, '6-classici');
  await p.evaluate(() => document.querySelector('#grSheet .sheet-in').scrollTo(0, 9999)); await H.wait(200); await shot(p, '6b-classici-fondo');
  const side = await p.evaluate(() => document.scrollingElement.scrollWidth - innerWidth); assert(side <= 0, 'niente scorrimento di lato');
  // 7) scuro a 412 e telefono stretto 360
  const q = await open(412, 915, true);
  await q.evaluate(() => NL.openCard('k3')); await H.wait(900); await q.click('.cv-page .gr-row'); await H.wait(500); await shot(q, '7-scuro-dickens');
  const s = await open(360, 740);
  await s.evaluate(() => NL.openCard('k1')); await H.wait(900); await shot(s, '8-360-pagina');
  await s.click('.cv-page .gr-row'); await H.wait(500); await shot(s, '8b-360-finestra');
  const t = await open(1280, 800);
  await t.evaluate(() => NL.openCard('k1')); await H.wait(900); await t.click('.cv-page .gr-row'); await H.wait(500); await shot(t, '9-pc-finestra');
  console.log('errori', errors, 'altre richieste', [...new Set(stat.other)].slice(0, 8));
  assert.deepStrictEqual(errors, []); assert.deepStrictEqual(stat.other, []);
  console.log('e2e140 OK');
  await br.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
