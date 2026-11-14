const CFG = require("./_config");
const assert = require('assert');
const L = require(require('path').join(CFG.APP, 'lib.js'));
// formato reale dei record SBN (briefRecords + scheda completa)
const rosa = { briefRecords: [{ codiceIdentificativo: 'IT\\ICCU\\RAV\\2002745', autorePrincipale: 'Eco, Umberto <1932-2016>', titolo: 'Il *nome della rosa / Umberto Eco ; [postille dell\'autore]', pubblicazione: 'Milano : Bompiani, 2012', tipo: 'Testo a stampa' }],
  full: { descrizioneFisica: 'XII, 623 p. ; 20 cm', classificazioneDewey: ['853.914 NARRATIVA ITALIANA, 1945-1999'], collezione: 'Tascabili Bompiani ; 123' } };
let r = L.parseSbn(rosa, '9788806219352');
console.log(r);
assert.deepStrictEqual([r.t, r.a, r.e, r.y, r.pg, r.gen], ['Il nome della rosa', 'Umberto Eco', 'Bompiani', '2012', '623', 'Narrativa italiana, 1945-1999']);
// copyright, stampa, sottotitolo, volume, nessun autore principale, più editori
r = L.parseSbn({ briefRecords: [{ titolo: '3: Il caso Bellwether : romanzo / Benjamin Wood ; traduzione di M. Bartocci', autorePrincipale: 'Wood, Benjamin', pubblicazione: 'Milano : Ponte alle Grazie, c2015' }] }, '1');
assert.deepStrictEqual([r.t, r.a, r.e, r.y], ['Il caso Bellwether: romanzo', 'Benjamin Wood', 'Ponte alle Grazie', '2015']);
r = L.parseSbn({ briefRecords: [{ titolo: 'Antologia / a cura di Mario Rossi', pubblicazione: 'Roma : Newton Compton, stampa 2012 ; Milano : Altro, 2012' }] }, '1');
assert.deepStrictEqual([r.t, r.a, r.e, r.y], ['Antologia', 'Mario Rossi', 'Newton Compton', '2012']);
r = L.parseSbn({ briefRecords: [{ titolo: 'Senza editore', pubblicazione: '[S.l. : s.n.], 1999' }] }, '1');
assert.deepStrictEqual([r.e, r.y], ['', '1999']);
assert.strictEqual(L.parseSbn({ briefRecords: [] }, '1'), null);
assert.strictEqual(L.parseSbn({ numFound: 0 }, '1'), null);
assert.strictEqual(L.deweyGenre([{ descrizione: '823.7 NARRATIVA INGLESE' }]), 'Narrativa inglese');
assert.strictEqual(L.deweyGenre('523.8875 BUCHI NERI'), 'Buchi neri');
assert.strictEqual(L.sbnUrl('https://sbn-libri.pippo.workers.dev/', '978'), 'https://sbn-libri.pippo.workers.dev/?isbn=978');
assert.strictEqual(L.sbnUrl('http://x.dev', '978'), '');
assert.strictEqual(L.sbnUrl('non un indirizzo', '978'), '');

(async () => {
  // SBN in parallelo a Google e Open Library: riempie l'editore mancante e, per i libri italiani, vince su editore e anno
  const gNoPub = { items: [{ id: 'g1', volumeInfo: { title: 'Il nome della rosa', authors: ['Umberto Eco'], publishedDate: '2020', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9788806219352' }] } }] };
  const calls = [];
  const res = await L.lookupIsbn('9788806219352', { waits: [0, 0], sbnUrl: 'https://sbn.test.workers.dev', fetch: async (url) => {
    calls.push(url.split('?')[0]);
    if (url.includes('googleapis')) return { ok: true, status: 200, json: async () => gNoPub };
    if (url.includes('sbn.test')) { assert(url.includes('isbn=9788806219352')); return { ok: true, status: 200, json: async () => rosa }; }
    return { ok: true, status: 200, json: async () => ({}) }; } });
  console.log(res.src, res.e, res.y, res.pg, res.gen);
  assert.deepStrictEqual([res.t, res.a, res.e, res.y, res.pg, res.src], ['Il nome della rosa', 'Umberto Eco', 'Bompiani', '2012', '623', 'Google Libri + SBN']);
  assert(!calls.some(c => c.includes('crossref')));        // completo: Crossref non serve
  // SBN che non risponde: nessun errore, si va avanti con le altre fonti
  const r2 = await L.lookupIsbn('9788806219352', { waits: [0, 0], sbnUrl: 'https://sbn.test.workers.dev', fetch: async (url) => {
    if (url.includes('googleapis')) return { ok: true, status: 200, json: async () => gNoPub };
    if (url.includes('sbn.test')) throw new Error('rete');
    return { ok: true, status: 200, json: async () => ({}) }; } });
  assert.strictEqual(r2.src, 'Google Libri');
  // solo SBN conosce il libro (Google e OL vuoti)
  const r3 = await L.lookupIsbn('9788806219352', { waits: [0, 0], sbnUrl: 'https://sbn.test.workers.dev', fetch: async (url) => {
    if (url.includes('sbn.test')) return { ok: true, status: 200, json: async () => rosa };
    return { ok: true, status: 200, json: async () => ({}) }; } });
  assert.deepStrictEqual([r3.t, r3.src], ['Il nome della rosa', 'SBN']);
  // senza intermediario: SBN non viene interrogato
  const c4 = [];
  await L.lookupIsbn('9788806219352', { waits: [0, 0], fetch: async (url) => { c4.push(url); return { ok: true, status: 200, json: async () => gNoPub }; } });
  assert(!c4.some(u => /sbn\.test|workers\.dev/.test(u)));
  // diagnosi con SBN
  const d = await L.diagnose({ sbnUrl: 'https://sbn.test.workers.dev', fetch: async (url) => ({ ok: true, status: 200, json: async () => (url.includes('sbn.test') ? rosa : {}) }) });
  console.log(d.find(x => x.name === 'Catalogo SBN'));
  assert(d.find(x => x.name === 'Catalogo SBN').ok);

  // doppioni e unione
  const books = [
    { id: 'a', t: 'Il nome della rosa', a: 'Umberto Eco', e: '', i: '9788806219352', ts: 5, g: [], c: null, n: 'regalo' },
    { id: 'b', t: 'Il Nome della Rosa', a: 'Umberto Eco', e: 'Bompiani', i: '', ts: 2, g: [], c: 14, sh: 'Studio', n: 'prima edizione' },
    { id: 'c', t: 'Altro', a: 'X', i: '9788806219352', ts: 9, g: [], w: true },
    { id: 'd', t: 'Ancora', a: 'Y', i: '', ts: 1, g: [] },
  ];
  const gr = L.dupGroups(books);
  assert.deepStrictEqual(gr.map(g => g.map(b => b.id).sort()), [['a', 'b']]);   // 'c' è nei Desideri: non conta
  const m = L.mergeBooks(gr[0]);
  console.log(m);
  assert.deepStrictEqual(m.removed, ['a']); assert.strictEqual(m.keep.id, 'b');
  assert.deepStrictEqual([m.keep.i, m.keep.e, m.keep.c, m.keep.sh, m.keep.n], ['9788806219352', 'Bompiani', 14, 'Studio', 'prima edizione · regalo']);

  // lettura: colonne e statistiche
  const rb = [{ t: 'A', rs: 'ok', rt: 4, rd: '2025-03-02', pg: '300', g: [] }, { t: 'B', rs: 'in', rt: 0, rd: '', g: [] }, { t: 'C', rs: '', rt: 0, g: [] }];
  const rows = L.rowsFor(rb);
  assert.deepStrictEqual(rows[0].slice(-3), ['Lettura', 'Voto', 'Data lettura']);
  assert.deepStrictEqual(rows[1].slice(-3), ['Letto', '4', '02/03/2025']);
  assert.deepStrictEqual(rows[2].slice(-3), ['In lettura', '', '']);
  assert(!L.rowsFor([{ t: 'x', rt: 0, rs: '', g: [] }])[0].includes('Voto'));
  const st = L.computeStats(rb);
  assert.deepStrictEqual([st.read, st.reading, st.toRead, st.avgRating, st.pagesRead], [1, 1, 0, 4, 300]);
  assert.deepStrictEqual(st.byReadYear, [{ k: '2025', n: 1 }]);
  require('fs').writeFileSync(CFG.OUT + '/t_read.xlsx', L.buildXLSX(rb, 'Libreria'));
  console.log('sbn OK');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
