# Next Libris — libreria, pagina del libro, Desideri, numeri e backup

**Aggiornato il 20/11/2026, vera 111.** Funzionamento e scelte; l'aspetto sta in `claude/stile-base.md` (`STILE.md`), la ricerca dei dati dei libri in `claude/ricerca-libri.md` (`RICERCA.md`). Copia uguale: progetto Claude `claude/libreria-e-libro.md`, ramo `prove` `LIBRERIA_LIBRO.md`.

Tutte le scelte qui sotto sono di Piero e **già chieste: non richiedere**.

## Scopo e sostegno
- Scopo dell'app: **far venire voglia di leggere e di scambiarsi i libri con gli amici** (non far tornare i libri prestati).
- **Sostieni** (il boccale è importante): donazioni PayPal `PieroRagusa907` (2, 3, 5 €, Altro). Testo della finestra (approvato): «Next Libris è gratis, senza pubblicità e senza abbonamenti: è fatta per far venire voglia di leggere e di scambiarsi i libri con gli amici. Se ti piace, offrimi una birra!». Riga dopo 5 accessi, riquadro ogni 50 libri.
- **Posizione: DA RIVEDERE.** Oggi nell'Indice è la fascia dorata in fondo; la scelta del 18/11 diceva «sempre al centro del Menu, sopra Amici». Piero (20/11/2026): «torneremo sull'argomento dopo, va messo meglio in evidenza» (IN_SOSPESO 41).

## Aggiungere i libri
- **«+ Aggiungi»** (in basso): In Libreria / Nei Desideri; **Scansiona** (pieno), **Fotografa**, **Digita** (titolo o ISBN); **Per autore** (tutte le opere di uno scrittore); **Ce l'ho già?** (in negozio).
- Fotocamera posteriore. Dopo ogni libro la **domanda del prezzo** (scritto a mano), se l'opzione è accesa.
- **Libri che nessuna banca dati conosce** (per esempio i 979-8 di KDP): avviso con «Fotografa la copertina». Quelli scritti a mano con ISBN, titolo e autore vengono **proposti all'archivio comune**, ma entrano **solo dopo il controllo dell'amministratore** (029; 30 proposte al giorno e 200 in tutto a testa).
- Per la proprietaria resta la ricerca automatica all'apertura dei libri senza titolo.

## Libreria e Desideri
- Vista a **copertine** o a **elenco**. Copertine: **3 per riga di partenza**, da 2 a 5 con due dita (anche in Indice › Aspetto). La **scritta sotto le copertine resta sempre** (autori e libri, nome e «N libri»); la scritta *sulla* copertina disegnata si rimpicciolisce fino a entrare.
- **Ricerca sempre visibile**; la × cancella **solo il testo**, non i filtri. Un tasto per **ordine e gruppi**, poi Filtri e copertine/elenco.
- Raggruppa per autore, genere, **paese** (con le bandiere: piccole immagini dentro l'app, `vendor/flags`, solo quelle che servono)… Serie e copie dello stesso libro stanno insieme.
- I libri **non più in libreria** (venduti, regalati, smarriti) si contano solo in Statistiche (dal 20/11/2026 non c'è più il riepilogo in testata).
- «In lettura» in cima, con l'orecchia sulla copertina. Una frase sotto il titolo con i dati veri («Stai leggendo *X*; 5 sono in prestito», il link apre i prestiti).
- **Desideri**: i libri che vorresti; gli amici possono vederli e seguirli (`claude/amici-chat-avvisi.md`).

## Pagina del libro
- **Uguale per tutti i libri** (anche senza titolo e quelli degli amici: niente modulo «Da completare»). Senza titolo: «Senza titolo» in grigio corsivo e «?» sulla copertina disegnata.
- Ordine: copertina, titolo, **autore con bandiera e paese** (per ogni autore; niente se non si conosce), pillole dei dati, tasti tondi (stella = «Lo consiglio», desideri, condividi, matita, elimina), poi Lettura, Descrizione, Dal libro, Citazioni, Prestito, Nota, Vedi tutti i libri di. «Cerca sul web» e «Cerca di nuovo» nel ⋯.
- **Matita = modifica nel posto**: i dati diventano scrivibili dove stanno; di nuovo la matita = fatto. La vecchia scheda a campi **non esiste più**: dal 20/11/2026 è tolta anche dal codice (`schede.js` non ha più la «Classica» né la scelta tra le due) e le prove automatiche girano tutte con la pagina del libro. I dati incerti hanno **«da verificare»** piccolo accanto (il tocco conferma solo quel dato, con Annulla). Vuoti come «+ Genere», «+ Scaffale», «+ Serie», «+ Nota», «+ Costo» (corretto il 20/11/2026: in un libro senza nessuno di questi dati il campo appena aperto spariva).
- **Lettura**: Da leggere / In lettura / Letto, voto a **libricini** con la parola, «Letto il».
- **Descrizione a richiesta**: si cerca aprendo il riquadro (una sola ricerca Google); se c'è resta nel libro e va nell'archivio comune; altrimenti «Descrizione non disponibile» o «Riprova».
- **Dal libro**: film e serie tratti dal libro (🎬 film, anno, regia; 📺 serie), il tocco apre Wikipedia, niente locandine. **Film omonimi**: se Wikidata non ha il legame («tratto da»), l'app arriva da sola ai film con lo stesso titolo, confermati con la voce dell'autore su it.wikipedia; mai correzioni a mano degli utenti; nessuna rilettura periodica dei dati degli autori.
- **Citazioni**: la prima in vista, «Tutte ›» e «+ Aggiungi»; la puntina mette in evidenza nel profilo (al massimo 3).
- Una pagina alla volta; Indietro la chiude.

## Prestiti
- Segni a chi hai prestato un libro e chi l'ha prestato a te. «Restituiscilo» quando ridai un libro, «È tornato» quando torna il tuo. «Presta, vendi o regala ›» nel riquadro Prestito.

## Prezzi
Restano **solo**: il campo «Costo» nella pagina del libro, la domanda dopo ogni libro, la sua opzione, «Cerca il prezzo sul web» e il CSV. Tolti: lettura del prezzo dalle foto, prezzi nel catalogo stampabile, nelle condivisioni e nei link, statistiche «valore di copertina» e «prezzo medio», somma in euro.

## Per te, numeri e «stagione in libri»
- **Per te**: in cima la scheda colorata della stagione in libri, poi Suggerimenti, Dai tuoi libri al cinema, Citazioni, Statistiche, Backup.
- **Dai tuoi libri al cinema**: riquadri regolari (titolo al massimo su 2 righe), 6 libri e poi «Mostra tutti (N)»; 2 film per libro e poi «Altri N ›».
- **Numeri del profilo**: in cima la tessera grande dell'anno (con obiettivo e scaffale), poi **Pagine dell'anno** e **Autore dell'anno** affiancate; **Paesi dell'anno** con il solo bordo («9 paesi visitati leggendo» e bandiere); **«Da sempre» in elenco** (Libri in libreria, Pagine lette, Autore più letto, Genere più letto, Ultimo letto, Il più lungo, Paesi degli autori, Prestati adesso). Colori delle stagioni in `claude/stile-base.md`. I numeri salgono all'apertura (niente con «riduci movimento»).
- **Immagine da condividere**: dal profilo l'anno fino a oggi («Il mio 2026 in libri»), dalla stagione in libri la stagione mostrata. Formati **Storia** (1080×1920) e **Quadrata** (1080×1080), con **anteprima** (Condividi e Salva). Copertine «più amate» (al massimo 4): prima «Lo consiglio», poi il voto. Nell'immagine il link scritto «nextlibris.github.io»; il link d'invito va nel testo del messaggio. Resta a tessere su fondo scuro.

## Backup
- Promemoria **ogni 45 giorni o dopo 40 libri nuovi** (anche senza account); «Fai il backup» lo manda con un tocco su Drive, WhatsApp o email, foto comprese.
- Si manda **solo come .txt** (Chrome su Android rifiuta il .json); oltre **45 MB** niente condivisione, con «Invia senza le foto».
- **Salvataggio non riuscito** (Piero, 20/11/2026): niente più riga fissa «Salvato su questo telefono» né la sua opzione. Solo se il salvataggio sul telefono non riesce compare in cima alla libreria l'avviso (testo approvato da Piero il 20/11/2026): «Non riesco a salvare le ultime modifiche: lo spazio dell'app su questo telefono è pieno. Fai subito il backup per non perderle.» con «Fai il backup». Torna a ogni salvataggio non riuscito e sparisce da solo quando il salvataggio riesce.
- In sospeso: backup automatico su Drive, copia del database per Piero (IN_SOSPESO 7).

## Scelte vecchie da non disfare senza chiedere
Toast brevi (4 s con «Annulla»); conferma prima di eliminare; due volte Indietro per uscire; una pagina del libro aperta alla volta; numeri coerenti tra le finestre.

## Tecnica
- App: `app.js` + `app-*.js` (avvio, aggiungi, scheda, vista, finestre, strumenti, wiki…), moduli `schede.js` (pagina del libro, `doD`, `editPage`), `layout.js` (+, Per te), `profilo.js`, `wrap.js` (stagione in libri e immagine), `ricerche.js` (archivio comune), `app-wiki.js` (Wikidata, film omonimi `wdSameQuery`).
- Dati: `localStorage` (`catalogo-libri…`, prova con `prova:`), copertine e foto in IndexedDB. Max 5.000 libri e 50 KB per libro online.
