# Next Libris · simulazione: quanti utenti reggono i piani gratuiti con UNA chiave Google e UN worker SBN «della casa».
# 16/11/2026. Misure dal codice (app.js, lib.js, social.js, amici.js) e dal database (riga vera, risposte simulate nella prova).
# Uso: python3 simulazione_utenti.py   (cambiare le ipotesi qui sotto e rifare i conti)

# ---- limiti dei piani gratuiti (verificati il 16/11/2026) ----
GOOGLE_DAY = 950            # chiave Google Libri: 1.000 al giorno per progetto; l'app si ferma a 950 (G_STOP)
CF_DAY = 100_000            # Cloudflare Workers Free: richieste al giorno
SB_DB_MB = 500 - 12         # Supabase: 500 MB, 12 MB già usati dal sistema (misurato sulla vera)
SB_EGRESS_MB = 5_000        # Supabase: 5 GB di traffico in uscita al mese
SB_MAU = 50_000             # Supabase: utenti attivi al mese
GH_MB = 100_000             # GitHub Pages: 100 GB al mese (limite «morbido»)

# ---- misure ----
G_PER_BOOK = 1.1 + 0.85 + 0.7 + 0.1   # ricerca per ISBN (+ritentativi) · copertina grande · descrizione mancante (~35%: 2 ricerche) · copertina cercata
SBN_PER_BOOK = 1                      # una chiamata al worker per libro (il worker ne fa 2 al catalogo SBN)
KB_PER_BOOK = 2.5                     # riga vera 840-1.100 B + pagina, indice, TOAST e versioni vecchie (tabella vera: 384 kB per 125 libri)
KB_PER_USER_OTHER = 10                # profilo, amicizie, scambi, notifiche (30 giorni)
KB_LOAD = 10                          # un giro «amici»: 8 richieste, 3,6 kB di dati misurati + ~0,6 kB di intestazioni ciascuna
KB_SYNC = 2                           # sincronizzazione a ogni apertura (lettura delle novità + invio delle modifiche)
KB_TOKEN = 2                          # rinnovo dell'accesso (ogni ora d'uso)
KB_FRIEND_LIB = 17                    # libreria di un amico con 50 libri (misurato: 16,6 kB)
KB_FRIEND_WISH = 2                    # desideri di un amico (misurato: 1,6 kB)
MB_GH_MONTH = 1.8                     # app da GitHub Pages: ~4 versioni al mese da ~0,4 MB compressi + foto/OCR la prima volta, spalmato
START_BOOKS = 50

# ---- profili (al mese) ----
P = {
  'Poco':    dict(sessions=6,  loads=1,   new_books=0.5, sugg_runs=4,  sugg_manual=0,  news_runs=2,  news_manual=0, title_searches=0,  friend_libs=1,  friend_wish=1),
  'Normale': dict(sessions=30, loads=2,   new_books=2.5, sugg_runs=4.3, sugg_manual=4, news_runs=2.1, news_manual=0, title_searches=2,  friend_libs=4,  friend_wish=4),
  'Molto':   dict(sessions=90, loads=4.3, new_books=8,   sugg_runs=4.3, sugg_manual=12, news_runs=2.1, news_manual=4, title_searches=10, friend_libs=15, friend_wish=15),
}
SUGG_CALLS, NEWS_CALLS = 6, 8         # «Da scoprire»: fino a 4 autori + 2 generi; «Novità dei tuoi autori»: fino a 8 autori

def per_user(p):
  g_month = p['new_books'] * G_PER_BOOK + (p['sugg_runs'] + p['sugg_manual']) * SUGG_CALLS + (p['news_runs'] + p['news_manual']) * NEWS_CALLS + p['title_searches']
  egress_kb = p['sessions'] * (p['loads'] * KB_LOAD + KB_SYNC + KB_TOKEN) + p['friend_libs'] * KB_FRIEND_LIB + p['friend_wish'] * KB_FRIEND_WISH
  books_year = START_BOOKS + 12 * p['new_books']
  return dict(g_day=g_month / 30, egress_mb=egress_kb / 1000, sbn_day=p['new_books'] * SBN_PER_BOOK / 30,
              db_kb_start=START_BOOKS * KB_PER_BOOK + KB_PER_USER_OTHER, db_kb_year=books_year * KB_PER_BOOK + KB_PER_USER_OTHER)

onboard_g = START_BOOKS * G_PER_BOOK
print(f'Google per libro: {G_PER_BOOK:.2f} · per caricare 50 libri: {onboard_g:.0f} · nuovi utenti al giorno (se nessun altro usa Google): {GOOGLE_DAY / onboard_g:.1f}')
print(f'Cloudflare: nuovi utenti al giorno: {CF_DAY / (START_BOOKS * SBN_PER_BOOK):,.0f}')
rows = {}
for name, p in P.items():
  u = per_user(p); rows[name] = u
  print(f"\n{name}: Google {u['g_day']:.2f}/giorno · Supabase {u['egress_mb']:.2f} MB/mese · DB {u['db_kb_start']:.0f} kB all'inizio, {u['db_kb_year']:.0f} kB dopo un anno")
  print(f"  utenti: Google {GOOGLE_DAY / u['g_day']:,.0f} · traffico Supabase {SB_EGRESS_MB / u['egress_mb']:,.0f} · DB all'inizio {SB_DB_MB * 1000 / u['db_kb_start']:,.0f} · DB dopo un anno {SB_DB_MB * 1000 / u['db_kb_year']:,.0f}"
        f" · Cloudflare {CF_DAY / max(u['sbn_day'], 1e-9):,.0f} · GitHub Pages {GH_MB / MB_GH_MONTH:,.0f}")

mix = {'Poco': 0.6, 'Normale': 0.3, 'Molto': 0.1}
avg = {k: sum(mix[n] * rows[n][k] for n in mix) for k in rows['Poco']}
print(f"\nMisto 60/30/10: Google {avg['g_day']:.2f}/giorno → {GOOGLE_DAY / avg['g_day']:,.0f} utenti · traffico {avg['egress_mb']:.2f} MB → {SB_EGRESS_MB / avg['egress_mb']:,.0f}"
      f" · DB dopo un anno {avg['db_kb_year']:.0f} kB → {SB_DB_MB * 1000 / avg['db_kb_year']:,.0f}")
for new in (1, 3, 5):
  left = GOOGLE_DAY - new * onboard_g
  print(f'  con {new} nuovi al giorno restano {left:.0f} ricerche Google → {max(left, 0) / avg["g_day"]:,.0f} utenti attivi')
# proposte: ricerche Google per libro e cache condivisa
for label, gpb, hit in (('oggi', G_PER_BOOK, 0), ('meno ricerche per libro', 1.3, 0), ('meno ricerche + cache 40%', 1.3, 0.4)):
  ob = START_BOOKS * gpb * (1 - hit)
  print(f'{label}: 50 libri = {ob:.0f} ricerche · nuovi al giorno {GOOGLE_DAY / ob:.1f}')
