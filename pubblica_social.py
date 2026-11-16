# uso: python3 pubblica_social.py "nota" ["altra nota" ...]   (ogni nota diventa una riga di REGISTRO_SOCIAL.md)
# Copia l'app del ramo «social» (SOCIAL_SRC, altrimenti ../next-libris-ramo-social: una worktree del ramo social di Piero907/next-libris)
# nel repository della copia social (SOCIAL_DIR, altrimenti ../next-libris-social), con il manifest da «social» (nome, nome breve, colore),
# poi commit e push. La versione vera e la copia di prova non cambiano.
# Nel codice la copia social si riconosce dall'indirizzo (…/next-libris-social/): dati, foto e copie offline con il prefisso «social».
# Il ramo social si prepara una volta sola:  git -C ../next-libris worktree add ../next-libris-ramo-social social
import os, sys, json, shutil, subprocess, re, datetime
here = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.environ.get('SOCIAL_SRC') or os.path.join(here, '..', 'next-libris-ramo-social'))
DST = os.path.abspath(os.environ.get('SOCIAL_DIR') or os.path.join(here, '..', 'next-libris-social'))
note = [a.strip() for a in sys.argv[1:] if a.strip()] or ['aggiornamento']
assert os.path.isdir(os.path.join(DST, '.git')), 'manca il repository della copia social: ' + DST
ramo = subprocess.run(['git', '-C', APP, 'rev-parse', '--abbrev-ref', 'HEAD'], capture_output=True, text=True).stdout.strip()
assert ramo == 'social', 'in ' + APP + ' deve esserci il ramo «social», non «' + ramo + '»'
FILES = ['index.html', 'app.js', 'lib.js', 'style.css', 'sw.js', 'manifest.json', 'version.json', 'REGISTRO_MODIFICHE.md', 'LEGGIMI.txt', '.nojekyll', 'cloudflare-sbn-worker.js', 'privacy.html']
DIRS = ['icons', 'vendor']
MODULES = ['wrap.js', 'wrap.css', 'layout.js', 'layout.css', 'schede.js', 'schede.css', 'social.js', 'social.css']   # moduli: se non ci sono piu' nel ramo, spariscono anche qui
for f in FILES + MODULES:
    if os.path.exists(os.path.join(APP, f)): shutil.copy2(os.path.join(APP, f), os.path.join(DST, f))
    elif f in MODULES and os.path.exists(os.path.join(DST, f)): os.remove(os.path.join(DST, f))
for d in DIRS:
    if os.path.isdir(os.path.join(APP, d)):
        shutil.rmtree(os.path.join(DST, d), ignore_errors=True); shutil.copytree(os.path.join(APP, d), os.path.join(DST, d))
try:
    from zoneinfo import ZoneInfo
    stamp = datetime.datetime.now(ZoneInfo('Europe/Rome')).strftime('%Y-%m-%d %H:%M')
except Exception:
    stamp = datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M')
# registro della copia social (REGISTRO_SOCIAL.md, solo nel repository della social): «Social V.n», n riparte da 1 a ogni versione vera
ver = json.load(open(os.path.join(APP, 'version.json'), encoding='utf-8')).get('v')
rp = os.path.join(DST, 'REGISTRO_SOCIAL.md')
reg = open(rp, encoding='utf-8').read() if os.path.exists(rp) else ("# Registro della copia social\n\nLe modifiche pubblicate nella copia social (account e amicizie), dalla piu' recente. "
    "Quando vanno bene passano nella versione vera e finiscono nel suo registro (REGISTRO_MODIFICHE.md).\n")
last = re.search(r"^## Social (\d+)\.(\d+)", reg, re.M)
n = int(last.group(2)) + 1 if last and int(last.group(1)) == int(ver) else 1
num = '%s.%d' % (ver, n)
when = '%s/%s/%s %s' % (stamp[8:10], stamp[5:7], stamp[0:4], stamp[11:16])
entry = '## Social %s · %s\n' % (num, when) + ''.join('- %s\n' % x for x in note) + '\n'
i = reg.find('\n## ')
reg = reg.rstrip('\n') + '\n\n' + entry if i < 0 else reg[:i + 1] + entry + reg[i + 1:]
open(rp, 'w', encoding='utf-8').write(reg)
m = json.load(open(os.path.join(APP, 'manifest.json'), encoding='utf-8'))
m.update({'name': 'Next Libris (social)', 'short_name': 'NL social', 'description': 'Copia social di Next Libris (account e amicizie): dati separati da quelli della versione vera.', 'theme_color': '#2E5E8C', 'background_color': '#2E5E8C'})
json.dump(m, open(os.path.join(DST, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
open(os.path.join(DST, 'LEGGIMI-SOCIAL.txt'), 'w', encoding='utf-8').write('Copia SOCIAL di Next Libris, per costruire e provare account e amicizie prima di portarli nella versione vera\n'
    '(https://piero907.github.io/next-libris/). Il codice sta nel ramo «social» di Piero907/next-libris. Ha dati tutti suoi: i libri messi qui non compaiono\n'
    'ne\' nella versione vera ne\' nella copia di prova.\n')
msg = 'Social %s: %s' % (num, '; '.join(note))
att = os.environ.get('ATTRIBUZIONE', '')
subprocess.run(['git', '-C', DST, 'add', '-A'], check=True)
if subprocess.run(['git', '-C', DST, 'diff', '--cached', '--quiet']).returncode == 0: print('niente da pubblicare'); sys.exit(0)
subprocess.run(['git', '-C', DST, 'commit', '-q', '-m', msg + ('\n\n' + att if att else '')], check=True)
subprocess.run(['git', '-C', DST, 'push', '-q', 'origin', 'HEAD:main'], check=True)
print('pubblicata:', msg)
