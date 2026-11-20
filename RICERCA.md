# Next Libris — come funziona la ricerca dei libri

**Aggiornato il 21/11/2026, prova 115.2** (ricerca per titolo con SBN). Copia uguale nel progetto Claude: `claude/ricerca-libri.md`. API e worker (prestito, limiti): `claude/api-e-worker.md` (`API_WORKER.md`). Qui c'è il **funzionamento**; l'aspetto delle finestre sta in `STILE.md` / `claude/stile-base.md`.

## Regola di fondo
Poche chiamate a Google Libri. Prima si usano le fonti libere e gratuite (archivio comune, Open Library, catalogo SBN, Wikipedia/Wikidata); Google si usa solo quando serve.

## Ricerca per ISBN (scansione del codice a barre, codici scritti)
1. **Archivio comune** dei libri già cercati da altri (senza Google).
2. **Open Library e catalogo SBN** insieme. Open Library ha 2,5 secondi. **Catalogo SBN della casa (vera 112):** SBN è incluso per tutti e passa dalla funzione `libri` di Supabase; 500 ricerche al giorno con l'account, 50 per telefono senza account e 3.000 in tutto per chi non ha l'account (`claude/api-e-worker.md`). Al limite si salta SBN e si va avanti con le altre fonti, con l'avviso approvato una volta al giorno.
3. **Google Libri solo se manca il libro o la copertina** (giro 11B).
4. Crossref se manca ancora qualcosa; ultimo tentativo con Google per codice semplice e ISBN-10.
- La **descrizione** si cerca a richiesta, dalla pagina del libro.
- **Messaggi se non si trova**:
  - **Senza API** Google Libri: «Non lo trovo nelle banche dati libere e senza un'API Google Libri Google non risponde: riprovo da solo tra …». Dopo gli ultimi tentativi l'app indica Indice › Ricerca dei libri e suggerisce di fotografare la copertina.
  - **API prestata tolta** da chi la prestava: il server risponde 403 e l'app dice che l'API che ti avevano prestato non c'è più.
  - **«Google Libri è al limite di richieste»** solo a chi ha un'API valida e ha finito le ricerche del giorno.

## Ricerca per titolo (finestra «Titolo o ISBN»)
- **Ordine delle fonti (21/11/2026, prova 115.2)**: **catalogo SBN e Open Library insieme**; **Google Libri solo se tra i risultati manca un'edizione italiana con l'ISBN** (prima le edizioni italiane, poi le altre), e i risultati si sommano. SBN passa dal server (`?t=`) con lo **stesso conto dell'ISBN** (500 al giorno con l'account, 50 per telefono e 3.000 in tutto senza); al limite si cerca senza SBN. Open Library: `search.json`, `lang=it`; se con tutte le parole non trova niente, si riprova senza l'ultima (per esempio l'editore).
- **Catalogo SBN per titolo** (scelte di Piero del 21/11/2026): ricerca `any=` con il testo scritto, 40 risultati; il worker tiene **solo i libri a stampa** (niente audiolibri, braille, manoscritti, spogli) e ne rimanda al massimo 25. Una riga per ISBN (SBN e Open Library con lo stesso ISBN = una riga); senza ISBN una per titolo, editore e anno. Copertina da Open Library per ISBN (se manca, il riquadro resta vuoto). Lingua italiana solo con un ISBN italiano (978-88, 979-12).
- **Edizioni senza ISBN** (Piero, 21/11/2026): restano nei risultati, **dopo tutte le altre** (di qualunque fonte); si aggiungono con titolo, autore, editore e anno.
- **Anno scritto accanto al titolo** («l'isola del tesoro 1996»): si toglie dalla ricerca e serve solo per l'ordine.
- **Ordine dei risultati**, fino a 10:
  1. prima i titoli più vicini a quello scritto;
  2. poi quelli con l'editore o l'anno scritti accanto;
  3. poi le edizioni italiane;
  4. poi quelle con ISBN e copertina;
  5. infine dalla più recente.
- **Messaggio sopra i risultati**, con il motivo vero:
  - Google non serviva (c'era un'edizione italiana con l'ISBN): nessun messaggio, solo «Tocca il libro giusto…»;
  - Google serviva ma senza API non ha dato niente: «Senza un'API Google Libri cerco solo nel catalogo delle biblioteche (SBN) e in Open Library: ecco cosa trovano.»;
  - API prestata tolta: «L'API Google Libri che ti avevano prestato non è più disponibile: questi li trovano il catalogo delle biblioteche (SBN) e Open Library.»;
  - API valida ma Google non risponde: «Google Libri non ha risposto: questi li trovano il catalogo delle biblioteche (SBN) e Open Library.»
- Il tasto «Come avere l'API, gratis ›» compare solo quando Google serviva e manca un'API. «Aggiungi solo il titolo» c'è sempre.
- Vale anche per la **copertina fotografata** (le frasi lette diventano ricerche per titolo).

## Altre ricerche Google (Per te)
- **Novità dei tuoi autori**: gli autori a gruppi di 4 in una sola ricerca (`inauthor:"A" OR …`, maxResults 40): al massimo **2 ricerche invece di 8**, ogni 14 giorni. Da guardare sul telefono: se i risultati sono poveri si torna al sistema di prima senza richiedere.
- **Da scoprire**: fino a 6 ricerche (4 autori + 2 generi) una volta a settimana.
- Wikipedia, Wikidata e Commons (gratis) per autori, paesi, foto e film tratti dai libri.

## Codice
- `lib.js`: `lookupIsbn` (con `nokey` per il 403), `searchText` (SBN `sbnTextUrl`/`parseSbnList` e `OL_SEARCH`/`parseOlSearch` insieme, poi Google; `via: 'free'`, `gSkip`, `gErr`), `sbnRec` (una scheda SBN, comune a ISBN e titolo).
- `app-finestre.js`: `qParts`, `rankCands` (poi le edizioni senza ISBN in fondo), `olWhy`, tasto `#isbnKey`. Prove: e2e143 (SBN per titolo), e2e21.
- `app-aggiungi.js`: messaggi della scansione e nuovi tentativi.
- `app.js`: `apiFetch`, `lentFetch` (API prestata attraverso il server `libri`) e `casaFetch` (catalogo SBN attraverso il server `libri`, `isbn=` o `t=`).
