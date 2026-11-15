# uso: python3 pubblica_prova.py "nota"
# Copia l'app (APP_DIR, altrimenti ../next-libris) nel repository della copia di prova (PROVA_DIR, altrimenti ../next-libris-prova),
# con il manifest da «prova» (nome, nome breve, colore), poi commit e push. La versione vera (Piero907/next-libris) non cambia.
# Nel codice la copia di prova si riconosce dall'indirizzo (…/next-libris-prova/): dati, foto e copie offline con nomi suoi.
import os, sys, json, shutil, subprocess
here = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.environ.get('APP_DIR') or os.path.join(here, '..', 'next-libris'))
DST = os.path.abspath(os.environ.get('PROVA_DIR') or os.path.join(here, '..', 'next-libris-prova'))
nota = sys.argv[1] if len(sys.argv) > 1 else 'aggiornamento'
FILES = ['index.html', 'app.js', 'lib.js', 'style.css', 'sw.js', 'manifest.json', 'version.json', 'REGISTRO_MODIFICHE.md', 'LEGGIMI.txt', '.nojekyll', 'cloudflare-sbn-worker.js']
DIRS = ['icons', 'vendor']
assert os.path.isdir(os.path.join(DST, '.git')), 'manca il repository della copia di prova: ' + DST
MODULES = ['wrap.js', 'wrap.css', 'layout.js', 'layout.css', 'avvisi-prova.js', 'avvisi-prova.css']        # moduli che si possono togliere (togli_modulo.py): se non ci sono piu' nell'app, spariscono anche qui
for f in FILES + MODULES:
    if os.path.exists(os.path.join(APP, f)): shutil.copy2(os.path.join(APP, f), os.path.join(DST, f))
    elif f in MODULES and os.path.exists(os.path.join(DST, f)): os.remove(os.path.join(DST, f))
for d in DIRS:
    if os.path.isdir(os.path.join(APP, d)):
        shutil.rmtree(os.path.join(DST, d), ignore_errors=True); shutil.copytree(os.path.join(APP, d), os.path.join(DST, d))
# timbro della pubblicazione: l'app di prova lo confronta con version.json e propone «Aggiorna adesso» anche a parita' di versione
import datetime
try:
    from zoneinfo import ZoneInfo
    stamp = datetime.datetime.now(ZoneInfo('Europe/Rome')).strftime('%Y-%m-%d %H:%M')
except Exception:
    stamp = datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M')
a = open(os.path.join(DST, 'app.js'), encoding='utf-8').read()
assert "var BUILD = '';" in a, 'manca var BUILD in app.js'
open(os.path.join(DST, 'app.js'), 'w', encoding='utf-8').write(a.replace("var BUILD = '';", "var BUILD = '%s';" % stamp, 1))
vj = json.load(open(os.path.join(DST, 'version.json'), encoding='utf-8')); vj['build'] = stamp
json.dump(vj, open(os.path.join(DST, 'version.json'), 'w', encoding='utf-8'), ensure_ascii=False)
m = json.load(open(os.path.join(APP, 'manifest.json'), encoding='utf-8'))
m.update({'name': 'Next Libris (prova)', 'short_name': 'NL prova', 'description': 'Copia di prova di Next Libris: dati separati da quelli della versione vera.', 'theme_color': '#7A3B26', 'background_color': '#7A3B26'})
json.dump(m, open(os.path.join(DST, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
open(os.path.join(DST, 'LEGGIMI-PROVA.txt'), 'w', encoding='utf-8').write('Copia di PROVA di Next Libris, per provare le novita\' prima di portarle nella versione vera\n(https://piero907.github.io/next-libris/). Ha dati tutti suoi: i libri messi qui non compaiono nella versione vera.\n')
v = json.load(open(os.path.join(APP, 'version.json'), encoding='utf-8'))
msg = 'Prova: versione %s, %s' % (v.get('v') or v.get('version') or '?', nota)
att = os.environ.get('ATTRIBUZIONE', '')
subprocess.run(['git', '-C', DST, 'add', '-A'], check=True)
if subprocess.run(['git', '-C', DST, 'diff', '--cached', '--quiet']).returncode == 0: print('niente da pubblicare'); sys.exit(0)
subprocess.run(['git', '-C', DST, 'commit', '-q', '-m', msg + ('\n\n' + att if att else '')], check=True)
subprocess.run(['git', '-C', DST, 'push', '-q', 'origin', 'HEAD:main'], check=True)
print('pubblicata:', msg)
