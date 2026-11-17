// Esegue le prove: prima quelle veloci della libreria (test_*.js), poi quelle nel browser (e2e*.js).
//   node esegui.js                    tutte (prima della versione vera: sempre tutte)
//   node esegui.js --veloce e2e65     prima della copia di prova: libreria + gruppo di controllo (FUMO) + quelle indicate
//   node esegui.js e2e53 e2e52        solo quelle indicate
//   node esegui.js --solo-unita       solo le prove della libreria (pochi secondi)
//   --paralleli=N                     quante prove nel browser insieme (predefinito 2; 1 = una alla volta)
// Le prove che dipendono dai tempi (DA_SOLE) girano da sole alla fine. Una prova fallita viene ripetuta una volta, da sola:
// se passa la seconda volta, conta come superata (e lo si dice). Resoconti in <PROVE_OUT>/log/<nome>.log.
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const CFG = require('./_config');
const args = process.argv.slice(2), onlyUnit = args.includes('--solo-unita'), quick = args.includes('--veloce');
const par = Math.max(1, Number((args.find(a => a.startsWith('--paralleli=')) || '').split('=')[1] || process.env.PROVE_PARALLELE || 2));
const want = args.filter(a => !a.startsWith('--')).map(a => a.replace(/\.m?js$/, ''));
// gruppo di controllo per --veloce: aggiunta dei libri, schede, prestiti ed esportazione, menu e opzioni, copia di prova (circa un minuto e mezzo)
const FUMO = ['e2e', 'e2e5', 'e2e6', 'e2e7', 'e2e10', 'e2e15', 'e2e56', 'e2e62'];
const DA_SOLE = ['e2e8', 'e2e30', 'e2e35', 'e2e37', 'e2e40', 'e2e42', 'e2e43', 'e2e55'];   // sensibili ai tempi: con un'altra prova accanto a volte non ce la fanno
const num = f => { const m = f.match(/^e2e(\d*)/); return m ? Number(m[1] || 1) : 0; };
const base = f => f.replace(/\.m?js$/, '');
let files = fs.readdirSync(__dirname).filter(f => /^test_.*\.(m?js)$/.test(f) || (!onlyUnit && /^e2e\d*\.js$/.test(f)));
files.sort((a, b) => (a.startsWith('test_') ? -1 : 0) - (b.startsWith('test_') ? -1 : 0) || num(a) - num(b) || a.localeCompare(b));
// prove dei moduli: chi dichiara «// moduli: amici, notifiche» nelle prime righe si salta se l'app non ha quei file (es. sulla vera
// mancano notifiche.js, ricerche.js, push.js). Una prova può anche saltarsi da sola uscendo con il codice 77 (es. e2e27 senza le foto vere).
const needs = f => { const m = fs.readFileSync(path.join(__dirname, f), 'utf8').split('\n').slice(0, 5).join('\n').match(/^\/\/ moduli: ([a-z, ]+)/m); return m ? m[1].split(/[, ]+/).filter(Boolean) : []; };
const missing = f => needs(f).filter(m => !fs.existsSync(path.join(CFG.APP, m + '.js')));
const skipMod = files.filter(f => missing(f).length && !want.includes(base(f)));
if (skipMod.length) console.log('Salto (moduli che questa app non ha): ' + skipMod.map(f => base(f) + ' (' + missing(f).join(', ') + ')').join(', '));
files = files.filter(f => !skipMod.includes(f));
if (quick) files = files.filter(f => f.startsWith('test_') || FUMO.includes(base(f)) || want.includes(base(f)));
else if (want.length) files = files.filter(f => want.includes(base(f)));
if (!CFG.CHROME && files.some(f => f.startsWith('e2e'))) { console.error('Chrome non trovato: indica il percorso con CHROME=...'); process.exit(2); }
const logDir = path.join(CFG.OUT, 'log'); fs.mkdirSync(logDir, { recursive: true });
console.log('App:', CFG.APP, '\nResoconti:', logDir, '\nInsieme:', par, quick ? '· veloce (libreria + controllo + indicate)' : '', '\n');

function run(f, slot) {
  return new Promise(res => {
    const t = Date.now(); let out = '';
    const c = spawn(process.execPath, [path.join(__dirname, f)], { cwd: __dirname, env: Object.assign({}, process.env, { PROVE_SLOT: String(slot) }) });
    const kill = setTimeout(() => { out += '\n[tempo scaduto]'; c.kill('SIGKILL'); }, 400000);
    c.stdout.on('data', d => out += d); c.stderr.on('data', d => out += d);
    c.on('close', code => { clearTimeout(kill); fs.writeFileSync(path.join(logDir, f + '.log'), out); res({ f, ok: code === 0 || code === 77, skip: code === 77, s: (Date.now() - t) / 1000 }); });
  });
}
const line = r => console.log((r.skip ? 'SALTA ' : r.ok ? 'OK    ' : 'FAIL  ') + r.f.padEnd(16) + r.s.toFixed(0).padStart(4) + ' s' + (r.again ? '  (passata alla seconda, da sola)' : ''));
(async () => {
  const t0 = Date.now(), results = {};
  const unit = files.filter(f => f.startsWith('test_'));
  const alone = files.filter(f => DA_SOLE.includes(base(f)));
  const shared = files.filter(f => !f.startsWith('test_') && !DA_SOLE.includes(base(f)));
  for (const f of unit) { const r = await run(f, 0); results[f] = r; line(r); }
  const queue = shared.slice();
  await Promise.all(Array.from({ length: Math.min(par, queue.length) }, async (_, slot) => {
    while (queue.length) { const f = queue.shift(); const r = await run(f, slot); results[f] = r; line(r); }
  }));
  for (const f of alone) { const r = await run(f, 0); results[f] = r; line(r); }
  const retry = files.filter(f => !results[f].ok);
  if (retry.length) console.log('\nRipeto da sole: ' + retry.join(', '));
  for (const f of retry) { const r = await run(f, 0); if (r.ok) { r.again = true; results[f] = r; } line(r); }
  const failed = files.filter(f => !results[f].ok), again = files.filter(f => results[f].again), skipped = files.filter(f => results[f].skip);
  const secs = Math.round((Date.now() - t0) / 1000);
  console.log('\n' + (files.length - failed.length - skipped.length) + '/' + (files.length - skipped.length) + ' superate in ' + Math.floor(secs / 60) + ' min ' + (secs % 60) + ' s' +
    (skipped.length ? '. Saltate: ' + skipped.join(', ') : '') + (again.length ? '. Passate alla seconda: ' + again.join(', ') : '') + (failed.length ? '. Fallite: ' + failed.join(', ') : ''));
  process.exit(failed.length ? 1 : 0);
})();
