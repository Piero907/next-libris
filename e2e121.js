const CFG = require("./_config");
const H = require('./_harness');
// moduli: wrap, layout
// Giro 2 (18/11/2026), dati da Wikidata (parte app-wiki.js), scelte di Piero:
// 12) paese degli autori: UN SOLO paese (quello di oggi; solo stati scomparsi = paese di nascita), con il paese di nascita tra parentesi
//     quando è diverso; correggibile a mano in Info Autore; Raggruppa per Paese con la bandiera, filtro «Paese dell'autore»,
//     Statistiche («Paesi degli autori», italiani e stranieri, tocco = filtro), Stagione in libri («Hai viaggiato in N paesi»);
// 13) film E serie TV tratti dai libri: riga nella scheda («Al cinema:» / «Serie TV:») e «Dai tuoi libri al cinema» in «Per te»;
// 8) opere di un autore: «Le sue opere ›» in Info Autore (interruttore «In Libreria | Nei Desideri» che parte da Desideri, segnate quelle
//    che hai già; un tocco apre la solita ricerca delle edizioni) e «Per autore» nel +.
// 19/11/2026: film OMONIMI senza «tratto da» su Wikidata (Io speriamo che me la cavo): valgono solo se la loro voce di it.wikipedia
//    ha un collegamento alla voce dell'autore; si legge anche «opera derivata» (P4969) del libro.
// Wikipedia e Wikidata sono simulate. Con SCHERMATE=cartella fa le foto.
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path');
const assert = require('assert');
const ROOT = CFG.APP;
const server = H.serve(CFG.port(8321));
const base = 'http://localhost:' + CFG.port(8321);
const SHOTS = process.env.SCHERMATE ? path.resolve(process.env.SCHERMATE) : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const V = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).v;
const today = new Date().toISOString().slice(0, 10);
const B = o => Object.assign({ id: 'x', t: '', a: '', e: '', y: '', c: null, i: '', g: [], img: '', nf: false, ts: 1, sh: '', n: '', gen: '', pg: '', p: '', pd: '', w: false, rs: 'da', rt: 0, rd: '' }, o);
const books = [
  B({ id: 'r1', t: 'Il nome della rosa', a: 'Umberto Eco', e: 'Bompiani', ts: 20, rs: 'ok', rd: today }),
  B({ id: 'r2', t: 'Baudolino', a: 'Umberto Eco', ts: 19 }),
  B({ id: 'c1', t: 'Palomar', a: 'Italo Calvino', ts: 18, rs: 'ok', rd: today }),
  B({ id: 't1', t: 'Guerra e pace', a: 'Lev Tolstoj', ts: 17, rs: 'ok', rd: today }),
  B({ id: 'n1', t: 'Lolita', a: 'Vladimir Nabokov', ts: 16 }),
  B({ id: 'k1', t: 'Lo straniero', a: 'Albert Camus', ts: 15, rs: 'ok', rd: today }),
  B({ id: 'z1', t: 'Libro di nessuno', a: 'Tizio Sconosciuto', ts: 14 }),
  B({ id: 'w1', t: 'Il pendolo di Foucault', a: 'Umberto Eco', ts: 13, w: true }),
];
const WIKI = {   // voce di it.wikipedia: titolo → [Q, descrizione]
  'Umberto_Eco': ['Q12807', 'semiologo, filosofo e scrittore italiano'], 'Italo_Calvino': ['Q1001', 'scrittore italiano'], 'Lev_Tolstoj': ['Q7243', 'scrittore russo'],
  'Vladimir_Nabokov': ['Q36591', 'scrittore russo naturalizzato statunitense'], 'Albert_Camus': ['Q34670', 'scrittore francese']
};
const v = (o) => { const r = {}; Object.keys(o).forEach(k => { r[k] = { type: 'literal', value: String(o[k]) }; }); return r; };
const E = 'http://www.wikidata.org/entity/';
const INFO = {
  Q12807: [v({ k: 'c', iso: 'IT' }), v({ k: 'b', iso: 'IT' }),
    v({ k: 'f', f: E + 'Q1', fLabel: 'Il nome della rosa', d: '1986-10-16T00:00:00Z', dirLabel: 'Jean-Jacques Annaud', t: E + 'Q11424', w: E + 'Q172850', art: 'https://it.wikipedia.org/wiki/Il_nome_della_rosa_(film)' }),
    v({ k: 'f', f: E + 'Q2', fLabel: 'Il nome della rosa', d: '2019-03-04T00:00:00Z', dirLabel: 'Giacomo Battiato', t: E + 'Q1259759', w: E + 'Q172850' }),
    v({ k: 'f', f: E + 'Q4', fLabel: 'La Abadía del Crimen', d: '1987-01-01T00:00:00Z', t: E + 'Q7889', w: E + 'Q172850' }),      // videogioco: tipo da chiedere, non è un film
    v({ k: 'f', f: E + 'Q5', fLabel: 'Il nome della rosa a cartoni', d: '1999-01-01T00:00:00Z', t: E + 'Q777', w: E + 'Q172850' }),  // tipo nuovo che è un film
    v({ k: 'f', f: E + 'Q3', fLabel: 'Q3', t: E + 'Q11424', w: E + 'Q172850' }),                    // senza titolo: non si mostra
    v({ k: 'w', w: E + 'Q172850', wl: 'Il nome della rosa' }), v({ k: 'w', w: E + 'Q172850', wl: 'The Name of the Rose' })],
  Q1001: [v({ k: 'c', iso: 'IT' }), v({ k: 'b', iso: 'CU' })],                             // nato a Cuba: Italia (nascita: Cuba)
  Q7243: [v({ k: 'b', iso: 'RU' })],                                                       // solo Impero russo (scartato dalla domanda): paese di nascita
  Q36591: [v({ k: 'c', iso: 'US' }), v({ k: 'b', iso: 'RU' })],                            // Stati Uniti (nascita: Russia)
  Q34670: [v({ k: 'c', iso: 'FR', end: '1960-01-04T00:00:00Z' }), v({ k: 'c', iso: 'DZ', end: '1950-01-01T00:00:00Z' }), v({ k: 'c', iso: 'FR', pref: '1' }), v({ k: 'b', iso: 'DZ' })]
};
const WORKS = {
  Q12807: [v({ w: E + 'Q172850', wLabel: 'Il nome della rosa', it: 'Il nome della rosa', d: '1980-01-01T00:00:00Z', t: E + 'Q7725634' }),
    v({ w: E + 'Q500', wLabel: 'Il pendolo di Foucault', it: 'Il pendolo di Foucault', d: '1988-01-01T00:00:00Z', t: E + 'Q7725634' }),
    v({ w: E + 'Q501', wLabel: 'L\'isola del giorno prima', it: 'L\'isola del giorno prima', d: '1994-01-01T00:00:00Z', t: E + 'Q7725634' }),
    v({ w: E + 'Q502', wLabel: 'Q502', t: E + 'Q7725634' }),                                          // senza titolo: scartata
    v({ w: E + 'Q503', wLabel: 'The Prague Cemetery', d: '2010-01-01T00:00:00Z', t: E + 'Q7725634' })],  // senza titolo italiano: «titolo originale»
  Q1001: [v({ w: E + 'Q600', wLabel: 'Il barone rampante', it: 'Il barone rampante', d: '1957-01-01T00:00:00Z', t: E + 'Q7725634' }), v({ w: E + 'Q601', wLabel: 'Palomar', it: 'Palomar', d: '1983-01-01T00:00:00Z', t: E + 'Q7725634' })]
};
(async () => {
  const browser = await puppeteer.launch({ executablePath: CFG.CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors = [], asked = { info: 0, works: 0, types: [], same: 0, links: [] };
  const wait = H.wait;
  const p = await (await browser.createBrowserContext()).newPage();
  await p.setViewport({ width: 412, height: 915, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  p.on('pageerror', e => errors.push(e.message));
  await p.evaluateOnNewDocument((b, V) => {
    window.addEventListener('beforeinstallprompt', e => e.stopImmediatePropagation(), true);
    if (localStorage.getItem('e2e121')) return; localStorage.setItem('e2e121', '1');
    localStorage.setItem('catalogo-libri-v2', JSON.stringify({ books: b, updated: 1 }));
    localStorage.setItem('catalogo-libri-set', JSON.stringify({ lastBackup: Date.now(), price: false, name: 'Piero R.', welcomed: 1, donSeen: 1, viewDef: 'grid', look: 'nuovo', seenV: V, wn2: 1 }));
    localStorage.setItem('catalogo-libri-layout', JSON.stringify({ v: 'a' })); localStorage.setItem('catalogo-libri-card', JSON.stringify({ v: 'd' }));
  }, books, V);
  await p.setRequestInterception(true);
  const json = (r, o, st) => r.respond({ status: st || 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) });
  p.on('request', r => {
    const u = r.url();
    if (u.startsWith(base)) return r.continue();
    let m = /^https:\/\/it\.wikipedia\.org\/api\/rest_v1\/page\/summary\/([^?]+)/.exec(u);
    if (m) {
      const t = decodeURIComponent(m[1]), w = WIKI[t];
      if (!w) return json(r, {}, 404);
      return json(r, { type: 'standard', title: t.replace(/_/g, ' '), description: w[1], extract: t.replace(/_/g, ' ') + ' è stato uno scrittore.', wikibase_item: w[0], thumbnail: { source: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/' + t + '.jpg/330px-' + t + '.jpg' } });
    }
    if (u.startsWith('https://it.wikipedia.org/w/api.php') && u.indexOf('prop=links') > 0) {   // conferma dei film omonimi
      const qs = new URL(u).searchParams, ts = qs.get('titles').split('|');
      asked.links.push(qs.get('pltitles') + ':' + ts.join(','));
      return json(r, { query: { pages: ts.map(t => t === "L'isola del giorno prima (film)" ? { title: t, links: [{ ns: 0, title: qs.get('pltitles') }] } : { title: t }) } });
    }
    if (u.startsWith('https://query.wikidata.org/sparql') && decodeURIComponent(u).indexOf('wikibase:sitelinks') > 0) {   // film omonimi
      const q = decodeURIComponent(u.split('query=')[1] || ''), id = (/wd:(Q\d+)/.exec(q) || [])[1];
      asked.same++;
      return json(r, { results: { bindings: id !== 'Q12807' ? [] : [
        v({ f: E + 'Q9', fLabel: "L'isola del giorno prima", d: '2005-05-01T00:00:00Z', dirLabel: 'Mario Rossi', t: E + 'Q11424', w: E + 'Q501', wl: "L'isola del giorno prima", art: "https://it.wikipedia.org/wiki/L'isola_del_giorno_prima_(film)" }),
        v({ f: E + 'Q7', fLabel: 'Baudolino', d: '2004-01-01T00:00:00Z', t: E + 'Q11424', w: E + 'Q510', wl: 'Baudolino', art: 'https://it.wikipedia.org/wiki/Baudolino_(film)' }),   // non confermato: Baudolino resta senza film
        v({ f: E + 'Q8', fLabel: 'Il pendolo di Foucault', d: '1990-01-01T00:00:00Z', t: E + 'Q11424', w: E + 'Q500', wl: 'Il pendolo di Foucault', art: 'https://it.wikipedia.org/wiki/Il_pendolo_di_Foucault_(film)' })] } });
    }
    if (u.startsWith('https://query.wikidata.org/sparql')) {
      const q = decodeURIComponent(u.split('query=')[1] || ''), id = (/wd:(Q\d+)/.exec(q) || [])[1], works = q.indexOf('FILTER(?t IN') > 0;
      assert(/^SELECT /.test(q) && u.indexOf('format=json') > 0, 'domanda a Wikidata scritta male');
      assert(q.indexOf('wdt:P31/wdt:P279*') < 0, 'niente percorso P31/P279* (lentissimo sul servizio vero)');
      if (q.indexOf('wdt:P279*') > 0) {                                                      // tipi nuovi: film o serie TV?
        const ts = (q.match(/VALUES \?t \{([^}]*)\}/) || ['', ''])[1].trim().split(/\s+/).map(x => x.replace('wd:', ''));
        asked.types.push(ts.join());
        return json(r, { results: { bindings: ts.filter(t => t === 'Q777').map(t => v({ t: E + t, cls: E + 'Q11424' })) } });
      }
      if (id === 'Q7243' && !asked.fail) { asked.fail = 1; return json(r, {}, 502); }          // il servizio vero ogni tanto risponde 502: si riprova da solo
      asked[works ? 'works' : 'info']++;
      return json(r, { results: { bindings: (works ? WORKS : INFO)[id] || [] } });
    }
    json(r, {}, 404);
  });
  const hideAll = () => p.evaluate(() => { document.querySelectorAll('.sheet:not([hidden])').forEach(x => { x.hidden = true; }); ['#instCard', '#notice'].forEach(s => { const x = document.querySelector(s); if (x) x.hidden = true; }); });
  const noOverflow = async (sel, what) => { const d = await p.$eval(sel, e => e.scrollWidth - e.clientWidth); assert(d <= 0, what + ': il contenuto esce di ' + d + ' px'); };
  await p.goto(base + '/', { waitUntil: 'load' }); await wait(1500); await hideAll();

  // i dati degli autori si cercano da soli, uno alla volta, e si salvano sul telefono
  await p.waitForFunction(() => { try { const m = JSON.parse(localStorage.getItem('catalogo-libri-auwd') || '{}'); return Object.keys(m).filter(k => k[0] !== '~').length >= 6; } catch (e) { return false; } }, { polling: 300, timeout: 40000 });
  await wait(600);
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-auwd')));
  console.log('[salvati]', Object.keys(saved).filter(k => k[0] !== '~').map(k => k + '=' + (saved[k].c || '-') + (saved[k].b ? '(' + saved[k].b + ')' : '')).join(' · '));
  assert.strictEqual(saved['umberto eco'].c, 'IT'); assert(!saved['umberto eco'].b, 'nascita uguale: non si ripete');
  assert.strictEqual(saved['italo calvino'].c, 'IT'); assert.strictEqual(saved['italo calvino'].b, 'CU');
  assert.strictEqual(saved['lev tolstoj'].c, 'RU', 'solo stati scomparsi: vale il paese di nascita');
  assert.strictEqual(saved['vladimir nabokov'].c, 'US'); assert.strictEqual(saved['vladimir nabokov'].b, 'RU');
  assert.strictEqual(saved['albert camus'].c, 'FR', 'tra più paesi vince quello ancora valido'); assert.strictEqual(saved['albert camus'].b, 'DZ');
  assert(saved['tizio sconosciuto'] && !saved['tizio sconosciuto'].q, 'autore senza voce: segnato come non trovato');
  assert.deepStrictEqual(saved['umberto eco'].f.map(f => f.q + (f.s ? 's' : 'f')), ['Q1f', 'Q5f', 'Q9f', 'Q2s'], 'film e serie: via quello senza titolo e il videogioco, in ordine di anno; il film omonimo confermato sì, quello non confermato no');
  assert.deepStrictEqual(saved['umberto eco'].f.find(f => f.q === 'Q9').k, ['l isola del giorno prima'], 'il film omonimo si lega al libro con lo stesso titolo');
  assert.strictEqual(asked.same, 5, 'una domanda per i film omonimi per autore trovato');
  assert.deepStrictEqual(asked.links, ["Umberto Eco:L'isola del giorno prima (film),Baudolino (film),Il pendolo di Foucault (film)"], 'una sola conferma a Wikipedia, con la voce dell\'autore');
  assert.deepStrictEqual(asked.types, ['Q7889,Q777'], 'una sola domanda per i tipi nuovi (film e miniserie sono già noti)');
  assert.deepStrictEqual(saved['~ty'], { Q7889: '', Q777: 'f' }, 'i tipi chiesti restano salvati');
  assert.strictEqual(asked.info, 5, 'una sola domanda a Wikidata per autore');
  assert.strictEqual(asked.fail, 1, 'la risposta 502 è stata riprovata');

  // 12) Raggruppa per Paese: copertine con la bandiera, un solo paese per autore
  await p.evaluate(() => { const s = document.querySelector('#grp'); s.value = 'pae'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(400);
  let g = await p.evaluate(() => [...document.querySelectorAll('#list .gcard')].map(c => c.querySelector('.cap').textContent + '|' + c.querySelector('.gc-n').textContent + '|' + ((c.querySelector('.gc-flag img.flag') || {}).getAttribute ? c.querySelector('.gc-flag img.flag').getAttribute('src').replace('vendor/flags/', '') : '?')));
  console.log('[gruppi]', g.join(' · '));
  assert.deepStrictEqual(g, ['Francia|1|fr.webp', 'Italia|3|it.webp', 'Russia|1|ru.webp', 'Stati Uniti|1|us.webp', 'Paese non trovato|1|?']);   // bandiere come immagini dell'app (giro 5)
  assert(await p.evaluate(() => [...document.querySelectorAll('#list .gc-flag img.flag')].every(i => i.complete && i.naturalWidth > 0)), 'le bandiere si caricano');
  assert.strictEqual(await p.$eval('#sortBar', e => /Paese/.test(e.textContent)), true, 'la riga dice «Paese» (stile G: testo breve)');
  await noOverflow('#list', 'gruppi per paese');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'paesi-gruppi-412.png') });
  await p.click('#btnView'); await wait(400);
  assert.strictEqual(await p.$$eval('#list .grow .gc-flag', a => a.length), 4, 'elenco: righe dei paesi con la bandiera');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'paesi-elenco-412.png') });
  await p.click('#btnView'); await wait(300);
  await p.evaluate(() => { const s = document.querySelector('#grp'); s.value = ''; s.dispatchEvent(new Event('change', { bubbles: true })); }); await wait(300);

  // filtro «Paese dell'autore» nei Filtri
  await p.evaluate(() => { openDrawer(); }); await wait(500);
  let pills = await p.$$eval('#drawerFlt [data-g="pa"]', a => a.map(x => x.textContent));
  console.log('[filtri]', pills.join(' · '));
  assert.deepStrictEqual(pills, ['Italia3', 'Francia1', 'Russia1', 'Stati Uniti1', 'Non trovato1']);
  if (SHOTS) { await p.$eval('#drawerFlt [data-g="pa"]', e => e.scrollIntoView({ block: 'center' })); await wait(200); await p.screenshot({ path: path.join(SHOTS, 'paesi-filtri-412.png') }); }
  await p.$eval('#drawerFlt [data-g="pa"][data-v="IT"]', e => e.click()); await wait(300);
  await p.evaluate(() => { closeDrawer(); }); await wait(500);
  assert.strictEqual(await p.$$eval('#list .cover', a => a.length), 3, 'filtro Italia: 3 libri');
  assert.strictEqual(await p.$eval('#activeFlt', e => e.textContent.replace('×', '').trim()), 'Paese: Italia');
  await p.click('#activeFlt [data-clear="pa"]'); await wait(300);
  assert.strictEqual(await p.$$eval('#list .cover', a => a.length), 7, 'tolto il filtro tornano tutti');

  // Statistiche: «Paesi degli autori», italiani e stranieri, tocco = filtro
  await p.evaluate(() => { openStats(); }); await wait(500);
  const st = await p.$eval('#stPaesi', e => ({ bars: [...e.querySelectorAll('.bar-row')].map(b => b.querySelector('.bl').textContent + '=' + b.querySelector('.bv').textContent), note: e.querySelector('.st-pa-note').textContent }));
  console.log('[statistiche]', st.bars.join(' · '), '|', st.note);
  assert.deepStrictEqual(st.bars, ['Italia=3', 'Francia=1', 'Russia=1', 'Stati Uniti=1']);
  assert(/italiani: 3 libri · stranieri: 3 libri · paese non trovato: 1 libro/.test(st.note), 'italiani e stranieri');
  if (SHOTS) { await p.$eval('#stPaesi', e => e.scrollIntoView({ block: 'center' })); await wait(200); await p.screenshot({ path: path.join(SHOTS, 'paesi-statistiche-412.png') }); }
  await p.$eval('#stPaesi .bar-row[data-sv="RU"]', e => e.click()); await wait(500);
  assert.strictEqual(await p.$eval('#statsSheet', e => e.hidden), true);
  assert.strictEqual(await p.$$eval('#list .cover', a => a.map(c => c.dataset.id).join()), 't1', 'dalle statistiche: filtro Russia');
  await p.click('#activeFlt [data-clear="pa"]'); await wait(300); await hideAll();

  // Info Autore: paese con la nascita tra parentesi, correzione a mano, «Le sue opere»
  await p.evaluate(() => { openAuthor('c1', 'Italo Calvino'); }); await wait(700);
  let pa = await p.$eval('#auPa', e => e.hidden ? '' : e.textContent.replace(/\s+/g, ' ').trim());
  console.log('[autore]', pa);
  assert.strictEqual(pa, 'Paese: Italia (nascita: Cuba) Correggi');
  assert.strictEqual(await p.$eval('#auWorks', e => e.hidden), false, '«Le sue opere» c\'è');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'autore-paese-412.png') });
  await p.click('#auPa [data-aup="open"]'); await wait(300);
  await p.type('#auPaQ', 'cub'); await wait(200);
  assert.deepStrictEqual(await p.$$eval('#auPaList [data-aup]', a => a.map(x => x.dataset.aup)), ['CU'], 'la ricerca del paese trova Cuba');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'autore-paese-correggi-412.png') });
  await noOverflow('#auSheet .sheet-in', 'finestra dell\'autore');
  await p.click('#auPaList [data-aup="CU"]'); await wait(300);
  pa = await p.$eval('#auPa', e => e.textContent.replace(/\s+/g, ' ').trim());
  assert.strictEqual(pa, 'Paese: Cuba (corretto) Correggi', 'corretto a mano: niente nascita ripetuta');
  assert.strictEqual(await p.evaluate(() => wdBookCountry(get('c1'))), 'CU');
  assert.strictEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('catalogo-libri-set')).auPa['italo calvino']), 'CU', 'la correzione è salvata');
  await p.click('#auPa [data-aup="open"]'); await wait(200); await p.click('#auPa [data-aup="auto"]'); await wait(300);
  assert.strictEqual(await p.evaluate(() => wdBookCountry(get('c1'))), 'IT', 'tolta la correzione torna Wikipedia');
  await p.evaluate(() => { closeAuthor(); }); await hideAll();
  await p.evaluate(() => { openAuthor('n1', 'Vladimir Nabokov'); }); await wait(600);
  assert.strictEqual(await p.$eval('#auPa', e => e.textContent.replace(/\s+/g, ' ').trim()), 'Paese: Stati Uniti (nascita: Russia) Correggi');
  await p.evaluate(() => { closeAuthor(); });
  await p.evaluate(() => { openAuthor('z1', 'Tizio Sconosciuto'); }); await wait(600);
  assert.strictEqual(await p.$eval('#auPa', e => e.textContent.replace(/\s+/g, ' ').trim()), 'Paese: non trovato Scegli', 'senza voce: si può scegliere a mano');
  assert.strictEqual(await p.$eval('#auWorks', e => e.hidden), true, 'senza voce niente «Le sue opere»');
  await p.evaluate(() => { closeAuthor(); });

  // 13) film e serie TV nella scheda del libro
  await p.evaluate(() => { showBook('r1'); }); await wait(700);
  const fb = await p.$eval('#list .filmbox[data-film="r1"]', e => ({ hidden: e.hidden, txt: e.textContent.replace(/\s+/g, ' ').trim(), a: [...e.querySelectorAll('a')].map(x => x.getAttribute('href')), vis: e.getBoundingClientRect().height > 0 }));
  console.log('[film]', fb.txt);
  assert.strictEqual(fb.hidden, false); assert(fb.vis, 'la riga dei film si vede nella scheda');
  assert.strictEqual(fb.txt, 'Dal libro📺Il nome della rosa — serie TV, 2019 · regia di G. Battiato🎬Il nome della rosa a cartoni — film, 1999🎬Il nome della rosa — film, 1986 · regia di J.-J. Annaud›');   // sezione «Dal libro» (giro 5)
  assert.deepStrictEqual(fb.a, ['https://it.wikipedia.org/wiki/Il_nome_della_rosa_(film)'], 'link solo alla voce italiana');
  await noOverflow('#list', 'scheda con i film');
  if (SHOTS) { await p.$eval('#list .filmbox[data-film="r1"]', e => e.scrollIntoView({ block: 'center' })); await wait(200); await p.screenshot({ path: path.join(SHOTS, 'film-scheda-412.png') }); }
  await p.evaluate(() => { showBook('r2'); }); await wait(600);
  assert.strictEqual(await p.$eval('#list .filmbox[data-film="r2"]', e => e.hidden), true, 'libro senza film: niente riga');
  await p.evaluate(() => { Object.keys(openState).forEach(k => { openState[k] = false; }); if (gridRet) backToGrid(); else renderList(); }); await wait(400);

  // «Dai tuoi libri al cinema» in «Per te»
  await p.click('#gTabs [data-g="you"]'); await wait(400);
  const you = await p.$$eval('#layYouList [data-l]', a => a.map(x => x.dataset.l + ':' + x.querySelector('small').textContent));
  assert(you.some(x => x === 'films:3 film e serie tratti dai tuoi libri'), 'voce «Dai tuoi libri al cinema» in Per te: ' + you.join(' | '));
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'film-per-te-412.png') });
  await p.click('#layYouList [data-l="films"]'); await wait(500);
  const fl = await p.$eval('#filmBody', e => [...e.querySelectorAll('.fm-row')].map(r => r.querySelector('.fm-bt b').textContent + ': ' + [...r.querySelectorAll('.fm-films li')].map(l => l.textContent.replace(/\s+/g, ' ').trim()).join(' / ')));
  console.log('[cinema]', fl.join(' · '));
  assert.deepStrictEqual(fl, ['Il nome della rosa: Film Il nome della rosa (1986, Jean-Jacques Annaud) / Film Il nome della rosa a cartoni (1999) / Serie TV Il nome della rosa (2019, Giacomo Battiato)']);
  assert.strictEqual(await p.$eval('#filmSheet', e => !!e.querySelector('.sh-x')), true, 'la finestra ha la ×');
  await noOverflow('#filmSheet .sheet-in', 'finestra dei film');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'film-finestra-412.png') });
  await p.click('#filmBody .fm-bt'); await wait(700);
  assert.strictEqual(await p.$eval('#filmSheet', e => e.hidden), true);
  assert.strictEqual(await p.evaluate(() => !!openState.r1), true, 'dal film si apre il libro');
  await p.evaluate(() => { Object.keys(openState).forEach(k => { openState[k] = false; }); if (gridRet) backToGrid(); else renderList(); }); await wait(400);

  // 8) «Le sue opere» da Info Autore: parte da Desideri, segna quelle che hai, un tocco cerca le edizioni
  await p.evaluate(() => { openAuthor('r1', 'Umberto Eco'); }); await wait(600);
  await p.click('#auWorks'); await wait(600);
  let wo = await p.evaluate(() => ({ h: document.querySelector('#woH').textContent, find: document.querySelector('#woFind').hidden, dest: document.querySelector('#woDest [aria-selected="true"]').dataset.dest,
    rows: [...document.querySelectorAll('#woList .wo-row')].map(r => r.querySelector('b').textContent + '|' + (r.querySelector('small') || {}).textContent + '|' + ((r.querySelector('.tag') || {}).textContent || '+')) }));
  console.log('[opere]', wo.h, '·', wo.rows.join(' · '));
  assert.strictEqual(wo.h, 'Opere di Umberto Eco'); assert.strictEqual(wo.find, true); assert.strictEqual(wo.dest, 'wish', 'da Info Autore parte da Desideri');
  assert.deepStrictEqual(wo.rows, ['Il nome della rosa|1980|Ce l\'hai', 'Il pendolo di Foucault|1988|Nei Desideri', 'L\'isola del giorno prima|1994|+', 'The Prague Cemetery|2010 · titolo originale|+']);
  await noOverflow('#woSheet .sheet-in', 'finestra delle opere');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'opere-412.png') });
  await p.click('#woList [data-wo="2"]'); await wait(700);
  let s = await p.evaluate(() => ({ wo: document.querySelector('#woSheet').hidden, au: document.querySelector('#auSheet').hidden, isbn: document.querySelector('#isbnSheet').hidden, txt: document.querySelector('#isbnText').value, tab: NL.tab() }));
  assert.deepStrictEqual(s, { wo: true, au: true, isbn: false, txt: 'L\'isola del giorno prima Umberto Eco', tab: 'wish' }, 'si apre la ricerca delle edizioni, nei Desideri');
  await p.click('#isbnCancel'); await wait(400);
  assert.strictEqual(await p.$eval('#woSheet', e => e.hidden), false, 'chiusa la ricerca tornano le opere');
  await p.click('#woDest [data-dest="lib"]'); await wait(150);
  await p.click('#woList [data-wo="3"]'); await wait(600);
  assert.strictEqual(await p.evaluate(() => NL.tab()), 'lib', 'con l\'interruttore su Libreria si aggiunge alla Libreria');
  await p.$eval('#isbnAsIs', e => e.click()); await wait(500);                          // «Aggiungi solo…, senza cercare»: il libro entra
  assert.strictEqual(await p.evaluate(() => state.books.some(b => b.t === 'The Prague Cemetery' && b.a === 'Umberto Eco' && !b.w)), true, 'titolo e autore nei loro campi');
  assert.strictEqual(await p.$eval('#woList [data-wo="3"] .tag', e => e.textContent), 'Ce l\'hai', 'tornando alle opere il libro appena aggiunto è segnato');
  await p.keyboard.press('Escape'); await wait(300);
  assert.strictEqual(await p.$eval('#woSheet', e => e.hidden), true, 'Esc (o Indietro) chiude le opere');
  assert.strictEqual(asked.works, 1, 'una sola domanda per le opere');
  await hideAll();

  // «Per autore» nel +
  await p.click('#gAdd'); await wait(400);
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'piu-per-autore-412.png') });
  await noOverflow('#layAdd .sheet-in', 'finestra del +');
  await p.click('#layAdd [data-l="author"]'); await wait(400);
  assert.strictEqual(await p.evaluate(() => document.querySelector('#woH').textContent + '|' + document.querySelector('#woFind').hidden + '|' + document.querySelector('#layAdd').hidden), 'Cerca per autore|false|true');
  await p.type('#woQ', 'Italo Calvino'); await p.keyboard.press('Enter'); await wait(800);
  wo = await p.evaluate(() => ({ h: document.querySelector('#woH').textContent, dest: document.querySelector('#woDest [aria-selected="true"]').dataset.dest, rows: [...document.querySelectorAll('#woList .wo-row')].map(r => r.querySelector('b').textContent + '|' + ((r.querySelector('.tag') || {}).textContent || '+')) }));
  console.log('[per autore]', wo.h, '·', wo.rows.join(' · '));
  assert.strictEqual(wo.h, 'Opere di Italo Calvino'); assert.strictEqual(wo.dest, 'lib', 'dal + parte dalla scheda in cui sei');
  assert.deepStrictEqual(wo.rows, ['Il barone rampante|+', 'Palomar|Ce l\'hai']);
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'per-autore-412.png') });
  await p.$eval('#woQ', e => { e.value = ''; }); await p.type('#woQ', 'Nessuno Così'); await p.keyboard.press('Enter'); await wait(800);
  assert(/Non ho trovato «Nessuno Così» su Wikipedia/.test(await p.$eval('#woMsg', e => e.textContent)), 'autore non trovato: messaggio chiaro');
  await p.click('#woClose'); await wait(200);

  // Stagione in libri: «Hai viaggiato in N paesi»
  const wr = await p.evaluate(() => { const q = NLWrap.quarters()[0]; return q && q.countries ? q.countries.map(x => x.c + x.n).join() : ''; });
  console.log('[stagione]', wr);
  assert.strictEqual(wr.split(',').sort().join(), 'FR1,IT2,RU1', 'paesi dei libri letti nella stagione');
  await p.evaluate(() => { NLWrap.open(); }); await wait(600);
  let found = false;
  for (let i = 0; i < 8 && !found; i++) {
    found = await p.evaluate(() => { const e = document.querySelector('.w-flags'); return !!e && e.getBoundingClientRect().width > 0; });
    if (!found) { await p.keyboard.press('ArrowRight'); await wait(300); }
  }
  assert(found, 'pagina «Hai viaggiato in…» nella Stagione');
  const wtxt = await p.evaluate(() => document.querySelector('.w-flags').parentNode.textContent.replace(/\s+/g, ' '));
  assert(/Hai viaggiato in 3 paesi/.test(wtxt) && /Italia \(2\)/.test(wtxt), 'testo della pagina: ' + wtxt);
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'stagione-paesi-412.png') });
  await p.keyboard.press('Escape'); await wait(300);

  // tema scuro e schermo stretto: niente fuori dai bordi
  if (SHOTS) {
    await p.setViewport({ width: 360, height: 740, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await p.evaluate(() => { openAuthor('r1', 'Umberto Eco'); }); await wait(500); await p.click('#auWorks'); await wait(500);
    await noOverflow('#woSheet .sheet-in', 'opere a 360');
    await p.screenshot({ path: path.join(SHOTS, 'opere-360.png') });
    await p.evaluate(() => { closeWorks(); closeAuthor(); });
  }
  assert.deepStrictEqual(errors, [], 'errori JavaScript: ' + errors.join(' | '));
  console.log('OK e2e121');
  await browser.close(); server.close();
})().catch(e => { console.error('FALLITA e2e121:', e && e.message || e); process.exit(1); });
