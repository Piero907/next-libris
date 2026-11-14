# uso: python3 nuova_versione.py NUMERO "novita'"  -> aggiorna insieme app.js, version.json e sw.js
# (cartella dell'app: APP_DIR, altrimenti ../next-libris)
import sys, re, json, datetime, os
R=os.path.join(os.environ.get('APP_DIR') or os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'next-libris'), '')
v=int(sys.argv[1]); note=sys.argv[2]; date=datetime.date.today().isoformat()
a=open(R+'app.js',encoding='utf-8').read()
a,n=re.subn(r"var APP_VERSION = \{ v: \d+, date: '[^']*', note: '(?:[^'\\]|\\.)*' \};", "var APP_VERSION = { v: %d, date: '%s', note: '%s' };"%(v,date,note.replace("\\","\\\\").replace("'","\\'")), a)
assert n==1
open(R+'app.js','w',encoding='utf-8').write(a)
open(R+'version.json','w',encoding='utf-8').write(json.dumps({'v':v,'date':date,'note':note},ensure_ascii=False)+'\n')
s=open(R+'sw.js',encoding='utf-8').read(); s=re.sub(r"catalogo-libri-v\d+","catalogo-libri-v%d"%v,s); open(R+'sw.js','w',encoding='utf-8').write(s)
print('versione', v, date)
