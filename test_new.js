const CFG = require("./_config");
const assert = require('assert');
const fs = require('fs');
const L = require(require('path').join(CFG.APP, 'lib.js'));
// genere e pagine
const g = L.parseGoogle({ items: [{ id: 'a', volumeInfo: { title: 'T', categories: ['Fiction / Thrillers'], pageCount: 412, industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780306406157' }] } }] });
assert.deepStrictEqual([g[0].gen, g[0].pg], ['Narrativa', '412']);
assert.strictEqual(L.genreIt(['Italian literature']), 'Italian literature');
assert.strictEqual(L.parseOpenLibrary({ 'ISBN:1': { title: 'X', number_of_pages: 230 } }, '1')[0].pg, '230');
// colonne facoltative
const base = [{ t: 'A', a: 'B', e: 'C', y: '2000', c: 9.5, i: '9780306406157' }];
assert.deepStrictEqual(L.rowsFor(base)[0], ['Titolo', 'Autore', 'Casa editrice', 'Anno', 'Costo', 'ISBN']);
const full = [{ t: 'Il nome della rosa', a: 'Umberto Eco', e: 'Bompiani', y: '2012', c: 14, i: '9788806219352', sh: 'Soggiorno 2', gen: 'Narrativa', pg: '503', n: 'Regalo & dedica <papà>', p: 'Marco', pd: '2026-11-12' },
  { t: 'Senza prezzo', a: '', e: '', y: '', c: null, i: '', sh: '', gen: '', pg: '', n: '', p: '', pd: '' }];
const rows = L.rowsFor(full);
assert.deepStrictEqual(rows[0], ['Titolo', 'Autore', 'Casa editrice', 'Anno', 'Costo', 'ISBN', 'Scaffale', 'Genere', 'Pagine', 'Note', 'Prestato a', 'Data prestito']);
assert.strictEqual(rows[1][11], '12/11/2026'); assert.strictEqual(rows[1][4], '14,00');
assert(L.buildCSV(full).includes('Prestato a'));
// crc32 noto
assert.strictEqual(L.crc32(new TextEncoder().encode('123456789')).toString(16), 'cbf43926');
// xlsx
fs.writeFileSync(CFG.OUT + '/t.xlsx', L.buildXLSX(full, 'Libreria'));
fs.writeFileSync(CFG.OUT + '/t_base.xlsx', L.buildXLSX(base, 'Desideri'));
// case editrici
const pubs = [
  { e: 'TEA', i: '9788850262359' }, { e: 'TEA', i: '' }, { e: 'Tea Tascabili', i: '' },
  { e: 'Mondadori', i: '' }, { e: 'Mondadori', i: '' }, { e: 'Arnoldo Mondadori Editore', i: '' },
  { e: 'E/O', i: '' }, { e: 'Edizioni E/O', i: '' }, { e: 'Einaudi', i: '' }, { e: 'Adelphi', i: '' }, { e: 'adelphi', i: '' },
  { e: 'Garzanti', i: '' }, { e: 'Il Mulino', i: '' }
];
const gr = L.publisherGroups(pubs);
const names = gr.map(x => x.names.map(n => n.name).sort().join(' | '));
console.log(names, gr.map(x => x.suggested));
assert(names.includes('TEA | Tea Tascabili'));
assert(names.includes('Arnoldo Mondadori Editore | Mondadori'));
assert(names.includes('E/O | Edizioni E/O'));
assert(names.includes('Adelphi | adelphi'));
assert(!names.some(n => n.includes('Einaudi') || n.includes('Garzanti') || n.includes('Mulino')));
assert.strictEqual(gr.find(x => x.names.some(n => n.name === 'Mondadori')).suggested, 'Mondadori');
// stesso codice editore nell'ISBN: nomi diversi raggruppati
const mk = (body12) => { let sum = 0; for (let i = 0; i < 12; i++) sum += (+body12[i]) * (i % 2 ? 3 : 1); return body12 + ((10 - sum % 10) % 10); };
const gr2 = L.publisherGroups([{ e: 'Bur', i: mk('978881700001') }, { e: 'Rizzoli', i: mk('978881700002') }, { e: 'Rizzoli', i: mk('978881700003') }]);
assert.deepStrictEqual(gr2.map(x => x.suggested), ['Rizzoli']);
// statistiche
const st = L.computeStats([
  { id: '1', t: 'A', a: 'Umberto Eco', e: 'Bompiani', y: '1980', c: 10, pg: '500', gen: 'Narrativa', sh: 'S1', g: [] },
  { id: '2', t: 'B', a: 'Umberto Eco, Altro', e: 'Bompiani', y: '1988', c: null, pg: '', gen: 'Narrativa', sh: '', g: ['e'], p: 'Marco', pd: '2026-10-01' },
  { id: '3', t: 'C', a: 'Calvino', e: 'Einaudi', y: '2001', c: 20, pg: '100', gen: '', sh: 'S1', g: [] }]);
assert.deepStrictEqual([st.n, st.total, st.priced, st.avg, st.pages, st.guess, st.noPrice, st.loans.length], [3, 30, 2, 15, 600, 1, 1, 1]);
assert.deepStrictEqual(st.topAuthors[0], { k: 'Umberto Eco', n: 2 });
assert.deepStrictEqual(st.byDecade.map(d => d.k), ['1980–1989', '2000–2009']);
// tempi
const now = Date.UTC(2026, 10, 12);
assert.strictEqual(L.agoText(0, now), 'mai');
assert.strictEqual(L.agoText(now - 3 * 86400000, now), '3 giorni fa');
assert.strictEqual(L.agoText(now - 21 * 86400000, now), '3 settimane fa');
// cosa leggere dopo
{
  const D = 864e5, n0 = Date.UTC(2026, 10, 15);
  const B = [
    { id: 'r1', t: 'Uno', a: 'Rossi', rs: 'ok', rt: 5, rd: '2026-11-14', gen: 'Gialli', se: 'Saga', sn: '1', pg: '700' },
    { id: 'r2', t: 'Altro letto', a: 'Rossi', rs: 'ok', rt: 4, rd: '2026-01-01', gen: 'Gialli' },
    { id: 'c3', t: 'Tre', a: 'Rossi', rs: 'da', se: 'Saga', sn: '3', ts: n0 - 10 * D },
    { id: 'c2', t: 'Due', a: 'Rossi', rs: 'da', se: 'Saga', sn: '2', ts: n0 - 10 * D },
    { id: 'cb', t: 'Breve', a: 'Bianchi', rs: 'da', pg: '120', ts: n0 - 3 * 365 * D },
    { id: 'cp', t: 'Prestato', a: 'Rossi', rs: 'da', p: 'Anna' },
    { id: 'cx', t: 'Regalato', a: 'Rossi', rs: 'da', xs: 'regalato' },
    { id: 'cw', t: 'Desiderio', a: 'Rossi', w: true },
  ];
  const r = L.nextReads(B, n0);
  assert.deepStrictEqual(r.map(x => x.id).slice(0, 1), ['c2']);
  assert(r.findIndex(x => x.id === 'c3') > r.findIndex(x => x.id === 'cb'), 'il vol. 3 non prima del 2');
  assert(!r.some(x => /cp|cx|cw|r1/.test(x.id)));
  assert(/seguito/.test(r[0].why[0]));
  const cb = r.find(x => x.id === 'cb');
  assert(cb.why.some(w => /da 3 anni/.test(w)) && cb.why.some(w => /breve \(120 pagine\)/.test(w)));
  assert(L.nextReads([{ id: 'z', t: 'Solo', rs: 'da', ts: 0 }], n0)[0].why[0] === 'È tra i tuoi libri da leggere.');
  assert.strictEqual(L.genreSubject('Storia'), 'history');
  assert.strictEqual(L.genreSubject('Gialli'), 'mystery');
  assert.strictEqual(L.genreSubject('Misteri vari'), 'Misteri vari');
  // pickNews: senza autore (generi) e in tutte le lingue
  const J = { items: [{ volumeInfo: { title: 'Nuovo', authors: ['X'], publishedDate: '2026', language: 'en' } }, { volumeInfo: { title: 'Nuovissimo', authors: ['Y'], publishedDate: '2026', language: 'it' } }] };
  assert.deepStrictEqual(L.pickNews(J, '', {}, 2025, 2027).map(x => x.t), ['Nuovissimo']);
  assert.deepStrictEqual(L.pickNews(J, '', {}, 2025, 2027, '').map(x => x.t).sort(), ['Nuovissimo', 'Nuovo']);
}
console.log('new OK');
