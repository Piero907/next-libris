// Esegue le prove: prima quelle veloci della libreria (test_*.js), poi quelle nel browser (e2e*.js), una dopo l'altra.
//   node esegui.js                  tutte
//   node esegui.js e2e53 e2e52      solo quelle indicate
//   node esegui.js --solo-unita     solo le prove della libreria (pochi secondi)
// Ogni prova scrive il suo resoconto in <PROVE_OUT>/log/<nome>.log; alla fine l'elenco di quelle fallite.
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const CFG = require('./_config');
const args = process.argv.slice(2), onlyUnit = args.includes('--solo-unita');
const want = args.filter(a => !a.startsWith('--')).map(a => a.replace(/\.m?js$/, ''));
const num = f => { const m = f.match(/^e2e(\d*)/); return m ? Number(m[1] || 1) : 0; };
let files = fs.readdirSync(__dirname).filter(f => /^test_.*\.(m?js)$/.test(f) || (!onlyUnit && /^e2e\d*\.js$/.test(f)));
files.sort((a, b) => (a.startsWith('test_') ? -1 : 0) - (b.startsWith('test_') ? -1 : 0) || num(a) - num(b) || a.localeCompare(b));
if (want.length) files = files.filter(f => want.includes(f.replace(/\.m?js$/, '')));
if (!CFG.CHROME && files.some(f => f.startsWith('e2e'))) { console.error('Chrome non trovato: indica il percorso con CHROME=...'); process.exit(2); }
const logDir = path.join(CFG.OUT, 'log'); fs.mkdirSync(logDir, { recursive: true });
console.log('App:', CFG.APP, '\nResoconti:', logDir, '\n');
const failed = []; const t0 = Date.now();
for (const f of files) {
  const t = Date.now();
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { cwd: __dirname, encoding: 'utf8', timeout: 400000, env: process.env });
  fs.writeFileSync(path.join(logDir, f + '.log'), (r.stdout || '') + (r.stderr || ''));
  const ok = r.status === 0;
  if (!ok) failed.push(f);
  console.log((ok ? 'OK   ' : 'FAIL ') + f.padEnd(16) + ((Date.now() - t) / 1000).toFixed(0).padStart(4) + ' s');
}
console.log('\n' + (files.length - failed.length) + '/' + files.length + ' superate in ' + Math.round((Date.now() - t0) / 60000) + ' min' + (failed.length ? '. Fallite: ' + failed.join(', ') + ' (alcune dipendono dai tempi: riprova da sole prima di cercare un errore)' : ''));
process.exit(failed.length ? 1 : 0);
