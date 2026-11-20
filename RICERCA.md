# Next Libris — come funziona la ricerca dei libri

**Aggiornato il 20/11/2026, vera 111.** Copia uguale nel progetto Claude: `claude/ricerca-libri.md`. API e worker (prestito, limiti): `claude/api-e-worker.md` (`API_WORKER.md`). Qui c'è il **funzionamento**; l'aspetto delle finestre sta in `STILE.md` / `claude/stile-base.md`.

## Regola di fondo
Poche chiamate a Google Libri. Prima si usano le fonti libere e gratuite (archivio comune, Open Library, catalogo SBN, Wikipedia/Wikidata); Google si usa solo quando serve.

## Ricerca per ISBN (scansione del codice a barre, codici scritti)
1. **Archivio comune** dei libri già cercati da altri (senza Google).
2. **Open Library e catalogo SBN** insieme (SBN tramite il worker). Open Library ha 2,5 secondi.
3. **Google Libri solo se manca il libro o la copertina** (giro 11B).
4. Crossref se manca ancora qualcosa; ultimo tentativo con Google per codice semplice e ISBN-10.
- La **descrizione** si cerca a richiesta, dalla pagina del libro.
- **Messaggi se non si trova**:
  - **Senza API** Google Libri: «Non lo trovo nelle banche dati libere e senza un'API Google Libri Google non risponde: riprovo da solo tra …». Dopo gli ultimi tentativi l'app indica Indice › Ricerca dei libri e suggerisce di fotografare la copertina.
  - **API prestata tolta** da chi la prestava: il server risponde 403 e l'app dice che l'API che ti avevano prestato non c'è più.
  - **«Google Libri è al limite di richieste»** solo a chi ha un'API valida e ha finito le ricerche del giorno.

## Ricerca per titolo (finestra «Titolo o ISBN»)
- **Ordine delle fonti**: prima Google Libri (prima le edizioni italiane, poi le altre). Se Google non risponde o non trova niente, **Open Library** (`search.json`, `lang=it`: per ogni opera l'edizione italiana se c'è). Se con tutte le parole Open Library non trova niente, si riprova senza l'ultima (per esempio l'editore).
- **Anno scritto accanto al titolo** («l'isola del tesoro 1996»): si toglie dalla ricerca e serve solo per l'ordine.
- **Ordine dei risultati**, fino a 10:
  1. prima i titoli più vicini a quello scritto;
  2. poi quelli con l'editore o l'anno scritti accanto;
  3. poi le edizioni italiane;
  4. poi quelle con ISBN e copertina;
  5. infine dalla più recente.
- **Messaggio sopra i risultati**, con il motivo vero:
  - senza API: «Senza un'API Google Libri cerco in Open Library: ecco cosa trova»;
  - API prestata tolta: «L'API Google Libri che ti avevano prestato non è più disponibile…»;
  - API valida ma Google non risponde: «Google Libri non ha risposto…»;
  - Google risponde ma non trova niente: «Google Libri non ha trovato niente…».
- Senza API compare il tasto «Come avere l'API, gratis ›», che apre la guida. «Aggiungi solo il titolo» c'è sempre.
- **Scelta rimandata (Piero, 20/11/2026)**: quando ci sarà il worker SBN fisso per tutti, SBN e Open Library partiranno insieme e Google servirà solo se mancano edizioni italiane.

## Altre ricerche Google (Per te)
- **Novità dei tuoi autori**: gli autori a gruppi di 4 in una sola ricerca (`inauthor:"A" OR …`, maxResults 40): al massimo **2 ricerche invece di 8**, ogni 14 giorni. Da guardare sul telefono: se i risultati sono poveri si torna al sistema di prima senza richiedere.
- **Da scoprire**: fino a 6 ricerche (4 autori + 2 generi) una volta a settimana.
- Wikipedia, Wikidata e Commons (gratis) per autori, paesi, foto e film tratti dai libri.

## Codice
- `lib.js`: `lookupIsbn` (con `nokey` per il 403), `searchText` (Google, poi `OL_SEARCH` / `parseOlSearch`, con `via: 'ol'` e `gErr`).
- `app-finestre.js`: `qParts`, `rankCands`, `olWhy`, tasto `#isbnKey`.
- `app-aggiungi.js`: messaggi della scansione e nuovi tentativi.
- `app.js`: `apiFetch` e `lentFetch` (API prestata attraverso il server `libri`).
