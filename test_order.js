const CFG = require("./_config");
const assert = require('assert');
const L = require(require('path').join(CFG.APP, 'lib.js'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ok = o => ({ ok: true, status: 200, json: async () => o });
const gFull = isbn => ({ items: [{ id: 'g', volumeInfo: { title: 'Titolo G', authors: ['Autore G'], publisher: 'Editore G', publishedDate: '2019', pageCount: 100, industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn }] } }] });
const sbnRec = { briefRecords: [{ titolo: 'Titolo SBN / Autore', autorePrincipale: 'Rossi, Mario', pubblicazione: 'Milano : Editore SBN, 2001' }], full: { descrizioneFisica: '250 p. ; 21 cm' } };
(async () => {
  // 1) libro straniero, Google completo, Open Library lentissima: non la aspetto oltre ~1,5 s
  let t0 = Date.now();
  let r = await L.lookupIsbn('9780306406157', { fetch: async (u) => { if (u.includes('googleapis')) return ok(gFull('9780306406157')); await sleep(6000); return ok({}); } });
  let ms = Date.now() - t0; console.log('[1] OL lenta:', ms, 'ms', r.src);
  assert(ms < 2500 && r.src === 'Google Libri');
  // 2) libro italiano con SBN: SBN vince su editore, anno e pagine; titolo e autore restano di Google
  r = await L.lookupIsbn('9788806219352', { sbnUrl: 'https://sbn.test.dev', fetch: async (u) => { if (u.includes('googleapis')) return ok(gFull('9788806219352')); if (u.includes('sbn.test')) { await sleep(300); return ok(sbnRec); } return ok({}); } });
  console.log('[2]', r.t, '|', r.a, '|', r.e, r.y, r.pg, '|', r.src);
  assert.deepStrictEqual([r.t, r.a, r.e, r.y, r.pg], ['Titolo G', 'Autore G', 'Editore SBN', '2001', '250']);
  // 3) italiano, SBN lento (5 s): dopo ~3 s si va avanti con Google
  t0 = Date.now();
  r = await L.lookupIsbn('9788806219352', { sbnUrl: 'https://sbn.test.dev', fetch: async (u) => { if (u.includes('googleapis')) return ok(gFull('9788806219352')); if (u.includes('sbn.test')) { await sleep(5000); return ok(sbnRec); } return ok({}); } });
  ms = Date.now() - t0; console.log('[3] SBN lento:', ms, 'ms', r.e);
  assert(ms >= 2900 && ms < 4000 && r.e === 'Editore G');
  // 4) Google incompleto (manca l'editore): aspetto le altre fonti
  r = await L.lookupIsbn('9780306406157', { fetch: async (u) => { if (u.includes('googleapis')) return ok({ items: [{ id: 'g', volumeInfo: { title: 'T', authors: ['A'], industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780306406157' }] } }] });
    if (u.includes('openlibrary.org/api/books')) { await sleep(2500); return ok({ 'ISBN:9780306406157': { title: 'T OL', publishers: [{ name: 'Pub OL' }], publish_date: '1999' } }); } return ok({}); } });
  console.log('[4]', r.e, r.src); assert.strictEqual(r.e, 'Pub OL');
  // 5) libro italiano con prefisso 979-12
  r = await L.lookupIsbn('9791254720057', { sbnUrl: 'https://sbn.test.dev', fetch: async (u) => { if (u.includes('googleapis')) return ok(gFull('9791254720057')); if (u.includes('sbn.test')) return ok(sbnRec); return ok({}); } });
  assert.strictEqual(r.e, 'Editore SBN');
  // copie e doppioni
  const B = [{ id: 'a', t: 'X', a: 'Y', i: '9780306406157', cp: true }, { id: 'b', t: 'X', a: 'Y', i: '9780306406157', cp: true }, { id: 'c', t: 'Z', a: 'W' }, { id: 'd', t: 'Z', a: 'W' }];
  assert.deepStrictEqual(L.analyzeDups(B), { a: 2, b: 2, c: 'dup', d: 'dup' });
  B.push({ id: 'e', t: 'X', a: 'Y', i: '9780306406157' });   // terza registrazione, non segnata
  assert.deepStrictEqual(L.analyzeDups(B), { a: 2, b: 2, c: 'dup', d: 'dup', e: 'dup' });
  assert.strictEqual(L.mergeBooks([B[0], B[4]]).keep.cp, true);    // la registrazione in più confluisce nella copia, che resta tale
  assert.strictEqual(L.mergeBooks([B[0], B[1], B[4]]).keep.cp, true);
  console.log('order OK');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
