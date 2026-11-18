# uso: python3 pubblica_prova.py "nota" ["altra nota" ...]   (ogni nota diventa una riga del registro della prova)
# Copia l'app (APP_DIR, altrimenti ../next-libris) nel repository della copia di prova (PROVA_DIR, altrimenti ../next-libris-prova),
# con il manifest da «prova» (nome, nome breve, colore), poi commit e push. La versione vera (Piero907/next-libris) non cambia.
# Nel codice la copia di prova si riconosce dall'indirizzo (…/next-libris-prova/): dati, foto e copie offline con nomi suoi.
import os, sys, json, shutil, subprocess
here = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.environ.get('APP_DIR') or os.path.join(here, '..', 'next-libris'))
DST = os.path.abspath(os.environ.get('PROVA_DIR') or os.path.join(here, '..', 'next-libris-prova'))
note = [a.strip() for a in sys.argv[1:] if a.strip()] or ['aggiornamento']
nota = note[0]
FILES = ['index.html', 'app.js', 'app-aggiungi.js', 'app-vista.js', 'app-scheda.js', 'app-per-te.js', 'app-elenco.js', 'app-finestre.js', 'app-filtri.js', 'app-strumenti.js', 'app-wiki.js', 'app-avvio.js', 'lib.js', 'style.css', 'sw.js', 'manifest.json', 'version.json', 'REGISTRO_MODIFICHE.md', 'LEGGIMI.txt', '.nojekyll', 'cloudflare-sbn-worker.js', 'privacy.html', 'indirizzo.js', 'avvio.js', 'trasloco.html', 'trasloco.js']
DIRS = ['icons', 'vendor']
assert os.path.isdir(os.path.join(DST, '.git')), 'manca il repository della copia di prova: ' + DST
MODULES = ['wrap.js', 'wrap.css', 'layout.js', 'layout.css', 'schede.js', 'schede.css', 'social.js', 'social.css', 'profilo.js', 'profilo.css', 'amici.js', 'amici.css', 'notifiche.js', 'notifiche.css', 'ricerche.js', 'ricerche.css', 'push.js', 'push.css', 'guida.js', 'guida.css']        # moduli che si possono togliere (togli_modulo.py): se non ci sono piu' nell'app, spariscono anche qui
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
# registro della copia di prova (REGISTRO_PROVA.md, solo nel repository della prova): numero «versione.n» che avanza a ogni pubblicazione
import re
ver = json.load(open(os.path.join(APP, 'version.json'), encoding='utf-8')).get('v')
rp = os.path.join(DST, 'REGISTRO_PROVA.md')
reg = open(rp, encoding='utf-8').read() if os.path.exists(rp) else ("# Registro della copia di prova\n\nLe modifiche pubblicate nella copia di prova, dalla piu' recente. "
    "Quando vanno bene passano nella versione vera e finiscono nel suo registro (REGISTRO_MODIFICHE.md).\n")
last = re.search(r"^## Prova (\d+)\.(\d+)", reg, re.M)
n = int(last.group(2)) + 1 if last and int(last.group(1)) == int(ver) else 1
num = '%s.%d' % (ver, n)
when = '%s/%s/%s %s' % (stamp[8:10], stamp[5:7], stamp[0:4], stamp[11:16])
entry = '## Prova %s · %s\n' % (num, when) + ''.join('- %s\n' % x for x in note) + '\n'
i = reg.find('\n## ')
reg = reg.rstrip('\n') + '\n\n' + entry if i < 0 else reg[:i + 1] + entry + reg[i + 1:]
open(rp, 'w', encoding='utf-8').write(reg)
# nota breve per il Menu: senza ** e `, fino ai due punti se la nota comincia con la novita' in grassetto
breve = re.sub(r'\*\*|`', '', nota.split(':')[0] if nota.startswith('**') and ':' in nota else nota).strip()[:90]
a = open(os.path.join(DST, 'app.js'), encoding='utf-8').read()
ph = "var BUILD = { t: '', n: '', note: '' };"
assert ph in a, 'manca var BUILD in app.js'
open(os.path.join(DST, 'app.js'), 'w', encoding='utf-8').write(a.replace(ph, 'var BUILD = ' + json.dumps({'t': stamp, 'n': num, 'note': breve}, ensure_ascii=False) + ';', 1))
vj = json.load(open(os.path.join(DST, 'version.json'), encoding='utf-8')); vj['build'] = stamp; vj['prova'] = num
json.dump(vj, open(os.path.join(DST, 'version.json'), 'w', encoding='utf-8'), ensure_ascii=False)
m = json.load(open(os.path.join(APP, 'manifest.json'), encoding='utf-8'))
m.update({'name': 'Next Libris (prova)', 'short_name': 'NL prova', 'description': 'Copia di prova di Next Libris: dati separati da quelli della versione vera.', 'theme_color': '#7A3B26', 'background_color': '#7A3B26'})
json.dump(m, open(os.path.join(DST, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
open(os.path.join(DST, 'LEGGIMI-PROVA.txt'), 'w', encoding='utf-8').write('Copia di PROVA di Next Libris, per provare le novita\' prima di portarle nella versione vera\n(https://piero907.github.io/next-libris/). Ha dati tutti suoi: i libri messi qui non compaiono nella versione vera.\n')
v = json.load(open(os.path.join(APP, 'version.json'), encoding='utf-8'))
msg = 'Prova %s: %s' % (num, '; '.join(note))
att = os.environ.get('ATTRIBUZIONE', '')
subprocess.run(['git', '-C', DST, 'add', '-A'], check=True)
if subprocess.run(['git', '-C', DST, 'diff', '--cached', '--quiet']).returncode == 0: print('niente da pubblicare'); sys.exit(0)
subprocess.run(['git', '-C', DST, 'commit', '-q', '-m', msg + ('\n\n' + att if att else '')], check=True)
subprocess.run(['git', '-C', DST, 'push', '-q', 'origin', 'HEAD:main'], check=True)
print('pubblicata:', msg)
