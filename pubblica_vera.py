# uso: APP_DIR=… SITO_DIR=… ATTRIBUZIONE="…" python3 pubblica_vera.py "nota"
# Dalla versione 100 (17/11/2026) la versione vera sta su https://nextlibris.github.io/ (repository nextlibris/nextlibris.github.io).
# Il codice resta in Piero907/next-libris (ramo main, servito ancora al vecchio indirizzo, dove indirizzo.js mostra solo il trasloco):
# questo script copia l'app (APP_DIR, altrimenti ../next-libris) nel sito (SITO_DIR, altrimenti ../nextlibris.github.io), poi commit e push.
# Toglie dal sito i file dell'app che non ci sono piu' (moduli tolti), lascia stare README.md, .nojekyll e .git.
import os, sys, shutil, subprocess, json
here = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.environ.get('APP_DIR') or os.path.join(here, '..', 'next-libris'))
DST = os.path.abspath(os.environ.get('SITO_DIR') or os.path.join(here, '..', 'nextlibris.github.io'))
nota = ' '.join(a.strip() for a in sys.argv[1:] if a.strip()) or 'aggiornamento'
assert os.path.isdir(os.path.join(DST, '.git')), 'manca il repository del sito: ' + DST
FILES = ['index.html', 'app.js', 'lib.js', 'style.css', 'sw.js', 'manifest.json', 'version.json', 'REGISTRO_MODIFICHE.md', 'LEGGIMI.txt',
         'cloudflare-sbn-worker.js', 'privacy.html', 'indirizzo.js', 'avvio.js', 'trasloco.html', 'trasloco.js']
MODULES = ['wrap', 'layout', 'schede', 'social', 'amici', 'notifiche', 'ricerche', 'push']   # .js e .css, se ci sono nell'app
DIRS = ['icons', 'vendor']
TENERE = {'.git', '.nojekyll', 'README.md'}
copia = [f for f in FILES if os.path.exists(os.path.join(APP, f))]
copia += [m + e for m in MODULES for e in ('.js', '.css') if os.path.exists(os.path.join(APP, m + e))]
for x in os.listdir(DST):   # via quello che non c'e' piu'
    if x in TENERE or x in copia or x in DIRS: continue
    p = os.path.join(DST, x)
    shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
for f in copia: shutil.copy2(os.path.join(APP, f), os.path.join(DST, f))
for d in DIRS:
    shutil.rmtree(os.path.join(DST, d), ignore_errors=True); shutil.copytree(os.path.join(APP, d), os.path.join(DST, d))
open(os.path.join(DST, '.nojekyll'), 'a').close()
v = json.load(open(os.path.join(APP, 'version.json'), encoding='utf-8')).get('v')
msg = 'Versione %s: %s' % (v, nota)
att = os.environ.get('ATTRIBUZIONE', '')
subprocess.run(['git', '-C', DST, 'add', '-A'], check=True)
if subprocess.run(['git', '-C', DST, 'diff', '--cached', '--quiet']).returncode == 0: print('niente da pubblicare'); sys.exit(0)
subprocess.run(['git', '-C', DST, 'commit', '-q', '-m', msg + ('\n\n' + att if att else '')], check=True)
subprocess.run(['git', '-C', DST, '-c', 'push.negotiate=true', 'push', '-q', 'origin', 'HEAD:main'], check=True)
print('pubblicata:', msg)
