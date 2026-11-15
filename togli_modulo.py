# uso: APP_DIR=/home/claude/libri-app python3 togli_modulo.py wrap
# Toglie un modulo aggiuntivo dall'app (i moduli stanno in file loro e si agganciano a window.NL in app.js):
# cancella NOME.js e NOME.css, le loro righe in index.html e i loro nomi nella lista SHELL di sw.js.
# L'app funziona uguale anche senza: l'attacco dei moduli in app.js resta e non fa nulla.
# Dopo: togliere a mano la sezione del modulo da LEGGIMI.txt, togliere o adattare le prove del modulo, far girare tutte le prove.
import os, re, sys
here = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.environ.get('APP_DIR') or os.path.join(here, '..', 'next-libris'))
if len(sys.argv) < 2 or not re.match(r'^[a-z0-9_-]+$', sys.argv[1]): sys.exit('uso: python3 togli_modulo.py NOME (per esempio wrap)')
n = sys.argv[1]
for ext in ('js', 'css'):
    f = os.path.join(APP, n + '.' + ext)
    if os.path.exists(f): os.remove(f); print('tolto', n + '.' + ext)
p = os.path.join(APP, 'index.html'); s = open(p, encoding='utf-8').read()
s2 = '\n'.join(l for l in s.split('\n') if ('src="%s.js"' % n) not in l and ('href="%s.css"' % n) not in l)
if s2 != s: open(p, 'w', encoding='utf-8').write(s2); print('index.html: righe tolte')
p = os.path.join(APP, 'sw.js'); s = open(p, encoding='utf-8').read()
# lista SHELL: ogni modulo sta su una riga sua («'NOME.js', 'NOME.css',   // modulo: …»). Tolgo le righe del modulo
# e risistemo la fine di ogni riga (virgola, oppure «];» sull'ultima), tenendo i commenti.
m = re.search(r"const SHELL = \[(.*?)\];[^\n]*", s, re.S)
if m:
    block = m.group(0)
    lines = block.split('\n')
    gone = {"'%s.js'" % n, "'%s.css'" % n}
    keep = []
    for l in lines:
        items = re.findall(r"'[^']*'", l.split('//')[0])
        if items and all(i in gone for i in items): continue
        for g in gone: l = re.sub(r",?\s*" + re.escape(g), '', l)
        keep.append(l)
    out = []
    for i, l in enumerate(keep):
        code, sep, com = l.partition('//')
        code = code.rstrip()
        code = re.sub(r"(\];|,)$", '', code).rstrip()
        code += '];' if i == len(keep) - 1 else ','
        out.append(code + ('   //' + com if sep else ''))
    nb = '\n'.join(out)
    if nb != block: s = s.replace(block, nb); open(p, 'w', encoding='utf-8').write(s); print('sw.js: tolto dalla lista SHELL')
print('Fatto. Ricorda: sezione in LEGGIMI.txt, prove del modulo, poi tutte le prove.')
