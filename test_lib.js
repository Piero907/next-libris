const CFG = require("./_config");
const assert = require('assert');
const L = require(require('path').join(CFG.APP, 'lib.js'));

// ISBN
assert.strictEqual(L.toIsbn13('978-0-306-40615-7'), '9780306406157');
assert.strictEqual(L.toIsbn13('0306406152'), '9780306406157');          // ISBN-10 -> 13
assert.strictEqual(L.toIsbn13('080442957X'), '9780804429573');          // con X
assert.strictEqual(L.toIsbn13('9780306406158'), '');
assert.strictEqual(L.isbn13to10('9780306406157'), '0306406152');
assert.strictEqual(L.isbn13to10('9780804429573'), '080442957X');
assert.deepStrictEqual(L.extractIsbns('ISBN 978-88-04-66528-9 Prezzo € 12,00 ... 9780306406157'), ['9788804665289', '9780306406157'].filter(x=>L.toIsbn13(x)));
const ex = L.extractIsbns('ISBN 978-0-306-40615-7  € 14,00');
assert.deepStrictEqual(ex, ['9780306406157']);
const pl = L.parseIsbnList('978-0-306-40615-7\n0306406152, 9780306406158;\n978 0 306 40615 7');
assert.deepStrictEqual(pl.valid, ['9780306406157']);
assert(pl.invalid.length >= 1);
const pl2 = L.parseIsbnList('9780306406157 9780804429573 abc');
assert.deepStrictEqual(pl2.valid, ['9780306406157', '9780804429573']);

// parse Google
const g = L.parseGoogle({ items: [
  { id: 'x1', volumeInfo: { title: "L'amica geniale", subtitle: 'Infanzia', authors: ['Elena Ferrante'], publisher: 'E/O', publishedDate: '2011-11', language: 'it',
    industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780306406157' }, { type: 'ISBN_10', identifier: '0306406152' }], imageLinks: { thumbnail: 'http://books.google.com/x.jpg' } } },
  { id: 'x2', volumeInfo: { authors: ['Nessuno'] } } ] });
assert.strictEqual(g.length, 1);
assert.deepStrictEqual([g[0].t, g[0].a, g[0].e, g[0].y, g[0].i, g[0].img], ["L'amica geniale: Infanzia", 'Elena Ferrante', 'E/O', '2011', '9780306406157', 'https://books.google.com/x.jpg']);

// parse Open Library
const o = L.parseOpenLibrary({ 'ISBN:9780306406157': { title: 'Foo', authors: [{ name: 'A B' }], publishers: [{ name: 'Pub' }], publish_date: 'October 2011', cover: { medium: 'http://c/x.jpg' } } }, '9780306406157');
assert.deepStrictEqual([o[0].t, o[0].a, o[0].e, o[0].y, o[0].img], ['Foo', 'A B', 'Pub', '2011', 'https://c/x.jpg']);

(async () => {
  const mk = (map) => async (url) => {
    for (const k of Object.keys(map)) if (url.includes(k)) { const v = map[k]; if (v instanceof Error) throw v; return { ok: v.ok !== false, status: v.status || 200, json: async () => v.json }; }
    throw new Error('no route ' + url);
  };
  // 1) Google ha tutto
  let r = await L.lookupIsbn('9780306406157', { waits: [0, 0], fetch: mk({
    'googleapis.com/books/v1/volumes?q=isbn%3A': { json: { items: [{ id: 'a', volumeInfo: { title: 'Titolo', authors: ['Aut'], publisher: 'Edi', publishedDate: '2015', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780306406157' }] } }] } },
    'openlibrary.org': { json: {} } }) });
  assert.deepStrictEqual([r.t, r.a, r.e, r.y, r.i, r.src], ['Titolo', 'Aut', 'Edi', '2015', '9780306406157', 'Google Libri']);
  // 2) Google senza editore, Open Library lo completa
  r = await L.lookupIsbn('9780306406157', { waits: [0, 0], fetch: mk({
    'googleapis.com': { json: { items: [{ id: 'a', volumeInfo: { title: 'Titolo', authors: ['Aut'], industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780306406157' }] } }] } },
    'openlibrary.org': { json: { 'ISBN:9780306406157': { title: 'Titolo', publishers: [{ name: 'Mondadori' }], publish_date: '2001' } } } }) });
  assert.deepStrictEqual([r.e, r.y, r.src], ['Mondadori', '2001', 'Google Libri + Open Library']);
  // 3) Google in errore 429, Open Library risponde
  r = await L.lookupIsbn('9780306406157', { waits: [0, 0], fetch: mk({ 'googleapis.com': { ok: false, status: 429, json: {} },
    'openlibrary.org': { json: { 'ISBN:9780306406157': { title: 'Solo OL', authors: [{ name: 'X Y' }] } } } }) });
  assert.strictEqual(r.t, 'Solo OL'); assert.strictEqual(r.src, 'Open Library');
  // 4) non trovato
  r = await L.lookupIsbn('9780306406157', { waits: [0, 0], fetch: mk({ 'googleapis.com': { json: { totalItems: 0 } }, 'openlibrary.org': { json: {} } }) });
  assert.strictEqual(r, null);
  // 5) rete assente
  await assert.rejects(L.lookupIsbn('9780306406157', { waits: [0, 0], fetch: mk({ 'googleapis.com': new Error('x'), 'openlibrary.org': new Error('y') }) }), (e) => e.code === 'network');

  // 6) Google 429 e Open Library non conosce il libro: NON deve dire "non trovato" ma chiedere di riprovare
  await assert.rejects(L.lookupIsbn('9780306406157', { waits: [0, 0], fetch: mk({ 'googleapis.com': { ok: false, status: 429, json: {} }, 'openlibrary.org': { json: {} } }) }),
    (e) => e.code === 'rate' && e.detail.some(d => d.includes('Google') && d.includes('429')));
  // 7) Google: "isbn:" non trova niente, la ricerca semplice sì
  const gItem = { items: [{ id: 'a', volumeInfo: { title: 'Trovato col codice semplice', authors: ['Aut'], publisher: 'Edi', publishedDate: '2015', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780306406157' }] } }] };
  let urls = [];
  const fx7 = async (url) => { urls.push(url); if (url.includes('q=isbn%3A')) return { ok: true, status: 200, json: async () => ({ totalItems: 0 }) };
    if (url.includes('googleapis')) return { ok: true, status: 200, json: async () => gItem }; return { ok: true, status: 200, json: async () => ({}) }; };
  r = await L.lookupIsbn('9780306406157', { waits: [0, 0], fetch: fx7 });
  assert.strictEqual(r.t, 'Trovato col codice semplice');
  // 7b) fallback con risultato di un altro libro (ISBN diverso): va scartato
  const other = { items: [{ id: 'z', volumeInfo: { title: 'Libro sbagliato', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780804429573' }] } }] };
  r = await L.lookupIsbn('9780306406157', { waits: [0, 0], fetch: async (url) => url.includes('q=isbn%3A') ? { ok: true, status: 200, json: async () => ({ totalItems: 0 }) } : (url.includes('googleapis') ? { ok: true, status: 200, json: async () => other } : { ok: true, status: 200, json: async () => ({}) }) });
  assert.strictEqual(r, null);
  // 8) Open Library: api/books vuoto, search.json trova
  const fx8 = async (url) => { if (url.includes('googleapis')) return { ok: true, status: 200, json: async () => ({ totalItems: 0 }) };
    if (url.includes('api/books')) return { ok: true, status: 200, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ docs: [{ key: '/works/OL1W', title: 'Da ricerca OL', author_name: ['Mario Rossi'], publisher: ['Einaudi', 'Altro'] }] }) }; };
  r = await L.lookupIsbn('9780306406157', { waits: [0, 0], fetch: fx8 });
  assert.deepStrictEqual([r.t, r.a, r.e, r.src], ['Da ricerca OL', 'Mario Rossi', '', 'Open Library']);   // l'editore della ricerca riguarda tutte le edizioni: resta vuoto
  // 9) 429 una volta, poi risposta valida: il nuovo tentativo funziona
  let calls = 0;
  const fx9 = async (url) => { if (url.includes('googleapis')) { calls++; if (calls === 1) return { ok: false, status: 429, json: async () => ({}) }; return { ok: true, status: 200, json: async () => gItem }; }
    return { ok: true, status: 200, json: async () => ({}) }; };
  r = await L.lookupIsbn('9780306406157', { waits: [0, 0], fetch: fx9 });
  assert.strictEqual(r.t, 'Trovato col codice semplice'); assert(calls >= 2);
  // 10) libro davvero sconosciuto: tutte le fonti rispondono vuote -> null
  r = await L.lookupIsbn('9780306406157', { waits: [0, 0], fetch: async () => ({ ok: true, status: 200, json: async () => ({ totalItems: 0 }) }) });
  assert.strictEqual(r, null);
  // 11) diagnosi
  const d = await L.diagnose({ fetch: async (url) => url.includes('googleapis') ? { ok: false, status: 429, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ 'ISBN:9780140328721': { title: 'Fantastic Mr Fox' } }) } });
  const dg = d.find(x => x.name === 'Google Libri'), dop = d.find(x => x.name === 'Open Library');
  assert.strictEqual(dg.ok, false); assert(dg.msg.includes('429')); assert.strictEqual(dop.ok, true); assert.strictEqual(d.length, 3); assert(!d.some(x => /sbn/i.test(x.name)));

  // 16) Google e Open Library partono INSIEME e i dati si sommano: Google ha la precedenza, l'editore mancante arriva da Open Library
  const gNoPub = { items: [{ id: 'g1', volumeInfo: { title: 'Titolo Google', authors: ['Aut G'], publishedDate: '2021', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780306406157' }] } }] };
  const olPub = { 'ISBN:9780306406157': { title: 'Titolo OL', authors: [{ name: 'Aut OL' }], publishers: [{ name: 'TEA' }], publish_date: '2020' } };
  const order16 = [];
  r = await L.lookupIsbn('9780306406157', { waits: [0, 0], fetch: async (url) => {
    if (url.includes('googleapis')) { order16.push('g'); return { ok: true, status: 200, json: async () => gNoPub }; }
    if (url.includes('openlibrary.org/api/books')) { order16.push('o'); return { ok: true, status: 200, json: async () => olPub }; }
    throw new Error('no route ' + url); } });
  assert.deepStrictEqual([r.t, r.a, r.e, r.y, r.src], ['Titolo Google', 'Aut G', 'TEA', '2021', 'Google Libri + Open Library']);
  assert.deepStrictEqual(order16, ['g', 'o']);                 // Google per primo
  // 16b) Google non risponde (429) ma Open Library si': si usa Open Library, senza errore
  r = await L.lookupIsbn('9780306406157', { waits: [0, 0], fetch: async (url) => {
    if (url.includes('googleapis')) return { ok: false, status: 429, json: async () => ({}) };
    if (url.includes('openlibrary.org/api/books')) return { ok: true, status: 200, json: async () => olPub };
    return { ok: true, status: 200, json: async () => ({}) }; } });
  assert.deepStrictEqual([r.t, r.e, r.src], ['Titolo OL', 'TEA', 'Open Library']);
  // 16c) tutto completo da Google: Crossref non viene interrogato; se manca ancora l'editore, interviene Crossref
  let crCalls = 0;
  const gFull = { items: [{ id: 'g2', volumeInfo: { title: 'T', authors: ['A'], publisher: 'P', publishedDate: '2000', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780306406157' }] } }] };
  await L.lookupIsbn('9780306406157', { waits: [0, 0], fetch: async (url) => { if (url.includes('crossref')) { crCalls++; return { ok: true, status: 200, json: async () => ({}) }; }
    if (url.includes('googleapis')) return { ok: true, status: 200, json: async () => gFull }; return { ok: true, status: 200, json: async () => ({}) }; } });
  assert.strictEqual(crCalls, 0);
  r = await L.lookupIsbn('9780306406157', { waits: [0, 0], fetch: async (url) => {
    if (url.includes('crossref')) { crCalls++; return { ok: true, status: 200, json: async () => ({ message: { items: [{ type: 'book', title: ['T'], publisher: 'Pub Crossref' }] } }) }; }
    if (url.includes('googleapis')) return { ok: true, status: 200, json: async () => gNoPub }; return { ok: true, status: 200, json: async () => ({}) }; } });
  assert.strictEqual(crCalls, 1); assert.deepStrictEqual([r.t, r.e, r.src], ['Titolo Google', 'Pub Crossref', 'Google Libri + Crossref']);
  // 17) Crossref: parse e uso come fonte
  const cr = L.parseCrossref({ message: { items: [
    { type: 'book-chapter', title: ['Capitolo'], publisher: 'X' },
    { type: 'book', title: ['Introduction'], subtitle: ['to Things'], author: [{ given: 'Anna', family: 'Rossi' }, { name: 'Org Ltd' }], publisher: 'Il Mulino', issued: { 'date-parts': [[2019, 5]] } } ] } }, '9780306406157');
  assert.deepStrictEqual([cr.length, cr[0].t, cr[0].a, cr[0].e, cr[0].y], [1, 'Introduction: to Things', 'Anna Rossi, Org Ltd', 'Il Mulino', '2019']);
  r = await L.lookupIsbn('9780306406157', { waits: [0, 0], fetch: async (url) => {
    if (url.includes('api.crossref.org')) return { ok: true, status: 200, json: async () => ({ message: { items: [{ type: 'book', title: ['Da Crossref'], author: [{ given: 'A', family: 'B' }], publisher: 'Pub', issued: { 'date-parts': [[2001]] } }] } }) };
    return { ok: true, status: 200, json: async () => ({ totalItems: 0 }) }; } });
  assert.deepStrictEqual([r.t, r.e, r.y, r.src], ['Da Crossref', 'Pub', '2001', 'Crossref']);
  // 18) casa editrice dedotta dal prefisso dell'ISBN (solo gruppo italiano 88)
  assert.strictEqual(L.isbnPrefix('9788850262359'), '88-502');
  assert.strictEqual(L.isbnPrefix('9780306406157'), '');                       // non italiano
  assert.strictEqual(L.isbnPrefix('9788850262350'), '');                       // cifra di controllo errata
  assert.strictEqual(L.guessPublisher('9788850262359', []).name, 'TEA');       // dalla tabellina di editori noti
  assert.strictEqual(L.guessPublisher('9788850262359', []).learned, false);
  assert.strictEqual(L.guessPublisher('9780306406157', []), null);
  // impara dai libri gia' in elenco (ISBN VALIDI con lo stesso prefisso 88-502), ignorando le ipotesi gia' segnate "da verificare"
  const mkIsbn = (body12) => { let sum = 0; for (let i = 0; i < 12; i++) sum += (+body12[i]) * (i % 2 ? 3 : 1); return body12 + ((10 - sum % 10) % 10); };
  const vA = mkIsbn('978885026001'), vB = mkIsbn('978885026002'), vC = mkIsbn('978885026003');
  assert(L.toIsbn13(vA) && L.toIsbn13(vB) && L.toIsbn13(vC));
  let gp = L.guessPublisher('9788850262359', [{ i: vA, e: 'Tea Tascabili', g: [] }, { i: vB, e: 'Tea Tascabili', g: [] }, { i: vC, e: 'Sbagliato', g: ['e'] }]);
  assert.deepStrictEqual([gp.name, gp.learned], ['Tea Tascabili', true]);
  gp = L.guessPublisher('9788850262359', [{ i: vC, e: 'Sbagliato', g: ['e'] }]);      // un'ipotesi non fa scuola: si torna alla tabellina
  assert.deepStrictEqual([gp.name, gp.learned], ['TEA', false]);
  gp = L.guessPublisher('9788850262359', [{ i: vA, e: 'Tea Tascabili', g: [] }, { i: vB, e: 'Tea Tascabili', g: [] }]);
  assert.strictEqual(gp.sure, true);                                                    // i tuoi libri verificati sono d'accordo
  gp = L.guessPublisher('9788850262359', [{ i: vA, e: 'Tea Tascabili', g: [] }, { i: vB, e: 'TEA', g: [] }, { i: vC, e: 'Tea Tascabili', g: [] }]);
  assert.deepStrictEqual([gp.name, gp.sure], ['Tea Tascabili', false]);                 // nomi diversi con lo stesso codice: da verificare
  assert.strictEqual(L.guessPublisher('9788850262359', []).sure, false);               // tabellina generica: da verificare
  assert.strictEqual(L.guessPublisher(mkIsbn('978880099991'), []), null);              // editore sconosciuto
  assert.strictEqual(typeof L.parseSbn, 'function');                                   // SBN tramite intermediario
  // 21) Google dopo gli altri: se gli altri non trovano nulla ma Google si', e' Google a rispondere
  r = await L.lookupIsbn('9780306406157', { waits: [0, 0], fetch: async (url) => url.includes('googleapis') ? { ok: true, status: 200, json: async () => gItem } : { ok: true, status: 200, json: async () => ({}) } });
  assert.strictEqual(r.src, 'Google Libri');
  console.log('lookup tests ok');

  // OCR: righe simulate di una copertina
  const lines = [
    { text: 'ELENA FERRANTE', h: 80, conf: 90 },
    { text: "L'AMICA GENIALE", h: 120, conf: 88 },
    { text: 'Romanzo', h: 30, conf: 80 },
    { text: 'edizioni e/o', h: 22, conf: 70 },
    { text: '@@ ## !!', h: 40, conf: 20 },
  ];
  const q = L.buildQueries(lines);
  console.log('queries:', q);
  assert(q[0].includes('amica') && q[0].includes('ferrante'));
  const cands = [
    { id: '1', t: "L'amica geniale", a: 'Elena Ferrante', e: 'E/O', y: '2011', lang: 'it', i: '1', img: 'u' },
    { id: '2', t: "L'amica geniale", a: 'Elena Ferrante', e: 'Edizioni E/O', y: '2014', lang: 'it', i: '2', img: 'u' },
    { id: '3', t: 'Storia del nuovo cognome', a: 'Elena Ferrante', e: 'E/O', y: '2012', lang: 'it', i: '3' },
    { id: '4', t: 'Elena e la geografia', a: 'Mario Rossi', e: 'X', y: '1999', lang: 'it', i: '4' },
  ];
  const ranked = L.rankCandidates(cands, lines);
  console.log(ranked.map(c => [c.t, c.score.toFixed(2)]));
  assert.strictEqual(ranked[0].t, "L'amica geniale");
  assert.strictEqual(ranked.length, 3);                 // le due edizioni sono state raggruppate
  assert(L.strongMatch(ranked));
  // OCR sporco: errori di lettura
  const noisy = [{ text: 'ELENA FERRANIE', h: 80, conf: 70 }, { text: "L'AM1CA GENlALE", h: 120, conf: 65 }];
  const rn = L.rankCandidates(cands, noisy);
  assert.strictEqual(rn[0].t, "L'amica geniale");
  console.log('noisy top score', rn[0].score.toFixed(2), 'strong:', L.strongMatch(rn));
  // ambiguo: due libri dello stesso autore con titolo non visibile
  const amb = L.rankCandidates(cands, [{ text: 'ELENA FERRANTE', h: 90, conf: 90 }]);
  console.log('ambiguous strong:', L.strongMatch(amb), amb.map(c => c.score.toFixed(2)));
  assert(!L.strongMatch(amb));

  // prezzo: niente lettura dalle foto dal giro 7
  assert(!L.extractPrice && !L.findPrice, 'lettura del prezzo tolta');
  // csv
  const csv = L.buildCSV([{ t: 'A;B', a: '"x"', e: '', y: '2000', c: 9.5, i: '' }]);
  assert(csv.startsWith('﻿Titolo;Autore'));
  assert(csv.includes('"A;B";"""x""";;2000;9,50;'));
  console.log('lib OK');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
