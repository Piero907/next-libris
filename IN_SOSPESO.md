# Next Libris: cose in sospeso

Questo file sta nel ramo `prove`, separato dall'app. Raccoglie le idee e i problemi che Piero ha chiesto di **tenere in sospeso**, con quanto serve per ripartire anche in una sessione nuova.

**Regola:** nulla di questo elenco si costruisce finché Piero non lo chiede. Quando dice «riprendiamo …», si riparte dalla voce giusta: prima si rilegge, poi si fanno le domande ancora aperte, poi si costruisce. A lavoro finito la voce si toglie da qui (va in «Fatti», in fondo, con una riga) e la novità va nel registro dell'app.

**Numeri:** ogni voce tiene il suo numero di sempre (le note e STORIA.md li citano), anche se l'ordine qui è per argomento. Una voce nuova prende il primo numero libero: **37**.

Ultimo aggiornamento: **17/11/2026 sera**, vera **103**, prova **103.2**.

## Indice

- **A. In attesa di Piero**: portare nella vera la prova 103.2
- **B. Da verificare sul telefono**: foto di Flaiano (103.2)
- **C. Uso di tutti i giorni:** 8 libri in lettura · 9 copertine esplorabili · 17 filtro ISBN non trovati · 19 foto del codice scritto · 23 collane raggruppate nelle copertine
- **D. Wikipedia e Wikidata:** 10 opere dell'autore · 11 altri dati wiki · 12 nazionalità degli autori · 6 film dai libri
- **E. Statistiche e svago:** 3 traguardi, sfide e curiosità
- **F. Amici, prestiti, ex-libris:** 14 libri ricevuti in prestito · 15 ex-libris · 24 compleanni degli amici · 25 chat · 26 libri condivisi con un testo · 28 foto del profilo · 31 pagina del profilo · 32 premio per chi usa chiave e worker suoi · 33 avviso sui desideri di un amico
- **G. Guide:** 13 guida di primo avvio · 16 «Prova la chiave / Prova il worker»
- **H. Dati, backup, servizi:** 7 backup automatico · 5 quanti dispositivi · 18 proposte rimaste dalla simulazione · 21 dominio proprio ed email · 22 chiavi prestate davvero nascoste · 30 colori per daltonici · 34 copertine grandi «large» di Google · 35 Google per ultimo nella ricerca · 36 dividere app.js in moduli
- **Fatti** (tolti dall'elenco)

---

## A. In attesa di Piero

- **Portare nella vera la prova 103.2** (quando lo dice Piero): foto degli autori dal nuovo indirizzo `thumb.wikimedia.org` e titolare della privacy «Piero R., l'ideatore di Next Libris». Nessun cambio al database.

## B. Da verificare sul telefono

Il 17/11/2026 sera Piero ha confermato **tutto il resto** (vera 103 e 102, «Accedi con Google» con la CSP, notifiche push, foto degli autori, fotocamera posteriore, backup su Drive, luce del Galaxy A32 lasciata così).

- **Foto di Ennio Flaiano** (prova 103.2): non compariva perché Wikipedia ha cambiato l'indirizzo delle miniature (vedi CLAUDE.md). Da guardare nella prova, con la rete.

---

## C. Uso di tutti i giorni

### 8. Libri in lettura (chiesto il 15/11/2026; aggiunta del 16/11/2026)

**Richiesta di Piero:** lavorare sui libri «In lettura». Il 16/11/2026 ha aggiunto: **il libro o i libri in lettura dovrebbero avere un ruolo più centrale nell'app**, visibili subito aprendo l'app e non nascosti tra gli altri.

**Già fatto (vera 98):** segnalibro con l'avanzamento (pagina del libro, elenco, sotto l'autore nelle copertine) e «In lettura» in cima all'elenco, in sezioni.

**Prima di costruire:** chiedere a Piero che cosa non gli torna o cosa gli manca rispetto a quello che c'è già.

**Idee da proporre (nessuna costruita):**
- un riquadro «Stai leggendo» grande all'apertura (o in «Per te») con la copertina e un tocco per aprire la scheda;
- giorni da quando l'hai iniziato; data di inizio messa da sola quando passa a «In lettura»;
- «Finito!» con un tocco: segna Letto con la data e chiede il voto (si collega a «Cosa leggere dopo»);
- filtro rapido «In lettura» e ordine «iniziati di recente»;
- nelle statistiche e nel trimestre: tempo medio per finire un libro.

### 9. Copertine più esplorabili (chiesto il 16/11/2026)

**Richiesta di Piero:** una nuova organizzazione della vista Copertine, «più interattiva e organizzata, più facilmente esplorabile, non solo scrollabile». Quando la riprende: proporre (proponimi) e provarla prima nella copia di prova, magari come modulo staccabile.

**Idee da proporre (nessuna costruita):**
- **scaffali per gruppo:** file orizzontali scorrevoli col dito (per scaffale, genere, autore, serie o stato di lettura), ognuna col titolo e «Vedi tutti»; si sceglie con un tocco come raggruppare;
- **serie e collane impilate:** una pila sola con il numero dei volumi, che si apre a ventaglio toccandola;
- **barra delle lettere / anni** sul bordo destro per saltare (A–Z per titolo o autore, anni di acquisto), come nella rubrica del telefono;
- **zoom a pizzico:** copertine piccole (molte per riga) o grandi (2 per riga con titolo e voto);
- **anteprima veloce:** tenendo premuta una copertina compare una scheda piccola (titolo, autore, stato, preferito) senza aprire tutta la pagina del libro;
- **filtri in alto a chip** (Da leggere, In lettura, Preferiti, In prestito) che si combinano, con il numero dei libri;
- **«Pesca un libro»:** una copertina a caso dalla libreria o dai «Da leggere»;
- colori: sfondo della fila preso dal colore della copertina (c'è già `NL.hue`).

### 17. Filtro per gli ISBN non trovati (chiesto il 16/11/2026)

**Richiesta di Piero:** un filtro per vedere solo i libri con l'ISBN **non trovato** in nessuna banca dati (oggi hanno l'etichetta «Non trovato», campo `nf`, ma non c'è un filtro).

**Idea:** in Filtri › Libri, accanto a «Da verificare», la voce «Non trovati» (libri con `nf`), con la pillola e la × sotto la ricerca come gli altri filtri; magari anche toccando l'etichetta «Non trovato».

### 19. Foto del + anche per il codice scritto (chiesto il 16/11/2026)

**Richiesta di Piero:** dal **+**, la modalità Foto della copertina dovrebbe riconoscere anche l'**ISBN scritto** (le cifre stampate sopra o sotto il codice a barre); il tasto diventerebbe **«Foto della copertina o del codice a barre»**. Durante la lettura del codice scritto, vedere **cosa sta leggendo la fotocamera**, per capire se aspettare o scriverlo a mano.

**Idee da proporre (nessuna costruita):**
- nella foto, dopo la copertina, cercare anche una riga «ISBN 978…» o 13 cifre con la cifra di controllo giusta (il lettore del testo, Tesseract, c'è già);
- durante la lettura dal vivo, una striscia sotto l'inquadratura con le cifre lette man mano (grigie se incerte, verdi quando il codice è valido);
- un pulsante «Scrivilo a mano» sempre visibile, già riempito con quello che ha letto.

---

### 23. Collane raggruppate nella vista a copertine (chiesto il 17/11/2026)

**Richiesta di Piero:** nella visualizzazione a copertine, permettere di **raggruppare le collane** (serie). Nulla di costruito. **Prima di costruire, chiedere:** raggruppate sempre o con un interruttore; come si mostra il gruppo (una copertina sola con il numero dei volumi, o una pila che si apre); ordine dei volumi (numero del volume); vale anche nell'elenco o solo nelle copertine; libri della stessa collana con autori diversi.

## D. Wikipedia e Wikidata

Le quattro voci usano la stessa fonte: conviene farle insieme o almeno con la stessa base (una ricerca su Wikidata per autore e per opera, salvata una volta sola nel telefono). Wikidata **non** serve per cercare per ISBN: le edizioni italiane ci sono poco, e SBN, Google Libri e Open Library le coprono già meglio.

### 10. Dall'autore: le sue opere e «Suggerisci» (chiesto il 16/11/2026)

**Richiesta di Piero:** nella finestra dell'autore (il profilo di Wikipedia) poter **vedere le sue opere** o farsi **suggerire** cosa leggere di suo.

**Idee da proporre (nessuna costruita):**
- «Le sue opere»: elenco dei libri dell'autore (Open Library / Google Libri per autore, o Wikidata «autore di»), con segnati quelli che hai già (in libreria o nei Desideri) e un tocco per metterli nei Desideri;
- «Suggerisci»: dalla stessa lista, i più noti che non hai, in ordine di importanza (numero di edizioni, premi su Wikidata), come in «Cosa leggere dopo»;
- si collega ai Suggerimenti già esistenti (`nextReads`, `pickNews` in lib.js). Attenzione alle ricerche Google: usare prima Open Library e Wikidata (vedi la simulazione degli utenti).

### 11. Cos'altro prendere dall'«universo wiki» (chiesto il 16/11/2026)

**Richiesta di Piero:** capire quali altri dati interessanti si possono estrarre da Wikipedia / Wikidata / Wikimedia.

**Da studiare e proporre (nessuna costruita):**
- **sull'autore (Wikidata):** nascita e morte, nazionalità, lingua, movimento letterario, premi (Nobel, Strega…), altre opere; il ritratto c'è già (anteprima di Wikipedia);
- **sull'opera (Wikidata):** anno della prima pubblicazione, lingua e titolo originali, genere, ambientazione (luogo ed epoca), personaggi, serie e ordine, premi; film tratti (voce 6). Una riga nella scheda: «Prima edizione 1980 · titolo originale … · Premio Strega»;
- **Wikipedia:** trama o riassunto dell'opera, in italiano;
- **Wikimedia Commons:** copertine storiche di prime edizioni (solo libere), luoghi dell'ambientazione;
- **Wikiquote:** citazioni famose dal libro o dall'autore, da proporre in «Citazioni e appunti»;
- **Wikisource:** testo libero dei classici fuori diritti (link «Leggilo gratis»);
- usi: statistiche più ricche (secoli, nazionalità, lingue originali, premiati), mappa dei luoghi dei libri, linea del tempo.

### 12. Nazionalità degli autori (chiesto il 16/11/2026)

**Richiesta di Piero:** se abbiamo la nazionalità degli autori, usarla nelle **statistiche**, nel **trimestre** e nelle **visualizzazioni**.

**Da dove:** Wikidata (cittadinanza P27, luogo di nascita P19, lingua P1412), raggiungibile dalla voce di Wikipedia che l'app già trova (`auLookup`); da salvare una volta per autore, non a ogni apertura.

**Idee da proporre (nessuna costruita):**
- Statistiche: «Da quali paesi vengono i tuoi autori» (barre per paese, toccando si filtra), percentuale di italiani e stranieri, continenti;
- Trimestre: «Hai viaggiato in N paesi» con le bandierine dei paesi letti;
- Visualizzazioni: mappa del mondo con i paesi colorati per numero di libri; filtro «Paese dell'autore».

### 6. Film tratti dai libri (chiesto il 15/11/2026, «per dopo»)

**Domanda di Piero:** l'app può cercare i film ispirati o tratti dai libri in libreria o nei Desideri?

**Idea (da proporre quando la riprende):**
- **Fonte: Wikidata**, gratuita, senza chiave (query.wikidata.org). Ogni film ha «basato su» (P144) che punta all'opera letteraria.
- Collegare il libro all'opera: dall'ISBN (P212/P957) all'edizione, e da lì all'opera («edizione di», P629); senza ISBN, per titolo e autore (etichetta in italiano + P50). Poi: film e serie con P144 = quell'opera, con anno, regista, titolo italiano e pagina di Wikipedia.
- **Dove:** nella scheda del libro una riga «🎬 Ne hanno tratto un film: Il nome della rosa (1986, Jean-Jacques Annaud)»; in Suggerimenti una scheda «Dai tuoi libri al cinema», magari con «Visto» / «Da vedere».
- Ricerca a gruppi in sottofondo, una volta sola per libro, risultato salvato.
- **Limiti:** Wikidata è ricca per i classici e i libri famosi, povera per le edizioni minori. Alternativa con più film ma con chiave: TMDB.

---

## E. Statistiche e svago

### 3. Traguardi, sfide e curiosità (proposta del 14/11/2026, «conserva queste idee»)

Usa gli stessi dati del trimestre in libri (già fatto, modulo `wrap.js`).

1. **Traguardi (medaglie da collezionare):** colorate se conquistate, grigie con la barra se da prendere; un piccolo festeggiamento quando se ne conquista una.
   - Biblioteca: 10, 50, 100, 250, 500 libri catalogati.
   - Lettore: primo libro letto, poi 10, 25, 50; «Maratoneta» (oltre 800 pagine); «Divoratore» (3 libri in un mese).
   - Esploratore: 5 generi, 10 autori, 5 decenni diversi (con la voce 12: N paesi).
   - Collezionista: una serie completa; «Fan di…» (10 libri dello stesso autore).
   - Citazioni: la prima, poi 25; la prima foto evidenziata.
   - Ordine: tutti i libri con lo scaffale, nessun «Da verificare», tutte le pagine compilate.
2. **Sfide e obiettivi:** obiettivo annuale con il ritmo («sei avanti di 2 libri»); sfida del mese che cambia da sola («Finisci un libro iniziato», «Leggi un genere nuovo», «Dai un voto ai libri letti»); settimane di fila con almeno un libro letto o aggiunto.
3. **Curiosità sulla libreria**, una diversa a ogni apertura: altezza della libreria impilata (circa 0,05 mm a pagina più le copertine); tempo per leggere i «Da leggere» a 20 pagine al giorno; libro più vecchio e decennio preferito.

**Da decidere con Piero:** tono (giocoso o sobrio da diario) e posizione (dentro Statistiche o voce «Traguardi» a sé nel menu). Si lega agli album e ai traguardi degli ex-libris (voce 15).

---

## F. Amici, prestiti, ex-libris

### 14. Libri ricevuti in prestito (chiesto il 16/11/2026)

**Richiesta di Piero:** una sezione per i libri che **ricevi** in prestito. Quando presti un libro, poter **mandare un messaggio WhatsApp**: chi lo riceve lo aggiunge alla sua app con l'etichetta **«Prestato da …»**. Con un **avviso dopo un mese** di prestito ricevuto, come per i libri prestati.

**Già fatto (vera 99, amici):** tra amici che hanno tutti e due l'account, prestiti e regali passano dentro l'app (tabella `scambi`: chi riceve segnala il reso, chi presta conferma). **Resta:** chi non è amico nell'app o non ha l'account, e la sezione dei libri ricevuti.

**Idee da proporre (nessuna costruita):**
- stato del libro «Ricevuto in prestito da …» (con la data), filtro e pillola «Ricevuti in prestito», riga nel riepilogo in alto, fuori dal conteggio e dal valore della libreria (vedere come si lega ai libri ricevuti dagli amici, che già non diventano doppioni);
- in «Presta, vendi o regala», dopo «Presta»: «Avvisa con WhatsApp» con un messaggio già scritto e un **link** con i dati del libro (per esempio `…/next-libris/#ricevi=ISBN&da=Piero`); chi lo tocca apre Next Libris, che propone «Aggiungi come ricevuto in prestito da Piero». Niente server per chi non ha l'account;
- avviso in cima dopo 30 giorni («Hai il libro di Anna da un mese: restituito?») con «Restituito».

### 15. Ex-libris personale, da scambiare e collezionare (chiesto il 16/11/2026)

**Richiesta di Piero:** ognuno ha il suo **ex-libris**, importato (una sua immagine) o **generato a caso**, con **motto e immagine**. Quando si **presta o si riceve** un libro ci si scambia l'ex-libris. Una sezione mostra **il proprio** e **quali e quanti altri** si sono incontrati. Un libro **regalato** porta con sé il suo ex-libris (il libro porta la sua storia).

**Aggiunte di Piero (16/11/2026):**
- un **codice casuale** legato all'ex-libris, che **segue il libro**, collegato al telefono o **all'account**;
- **le immagini restano il cuore** («il bello degli ex-libris sono proprio le immagini»): il codice è il **seme** da cui l'app **disegna** l'ex-libris (cornice, simbolo, ornamenti, colori, caratteri). Stesso codice = stessa immagine su ogni telefono;
- **da collezionare come figurine/sticker**: un album con le caselle da riempire e il contatore («12 ex-libris raccolti»), qualche **rarità**, piccoli traguardi («Il primo ex-libris», «5 amici lettori», «Un libro passato per 3 mani»), il proprio ex-libris da «staccare» come sticker da condividere.

**Cosa è cambiato con gli account (vera 98-99):** il codice ora può stare nel **profilo** (`profili`) invece che solo nel telefono, così non si perde cambiando telefono; tra amici lo scambio può passare dagli `scambi` già esistenti invece che dai link. Per chi non ha l'account resta la strada dei link (voce 14).

**Idee da proporre (nessuna costruita):**
- **Il tuo ex-libris** (nel menu o in Amici): nome, motto, immagine (importata o generata: cornice, iniziali, un simbolo — libro, albero, gufo, nave… — e i colori, con «Rigenera»); finisce nel backup e, con l'account, nel profilo;
- **lo scambio** nei prestiti e regali: tra amici dal server; con WhatsApp nel link (codice + motto, niente immagini pesanti; un'immagine importata si riduce o si manda a parte);
- **la collezione:** griglia degli ex-libris incontrati, con chi, quando e con quale libro;
- **sul libro:** la «storia» con gli ex-libris di chi l'ha avuto (regalato da…, prestato a…), come i timbri di un passaporto; una «catena» di codici ricostruisce i passaggi anche senza immagini.

---

### 24. Data di nascita e avviso per il compleanno degli amici (chiesto il 17/11/2026)

**Richiesta di Piero:** aggiungere la **data di nascita**, così **10 giorni prima del compleanno di un amico** arriva una notifica che porta alla sua **lista dei desideri**. Nulla di costruito.

**Prima di costruire, chiedere:** solo giorno e mese o anche l'anno (per la privacy basta giorno e mese); dove si inserisce (Impostazioni › Amici e privacy, o alla prima entrata con l'account) e se è facoltativa; se gli amici la vedono (e se si può nascondere); avviso solo se l'amico ha i desideri visibili o comunque; solo campanella o anche push (nuovo tipo «Compleanni» nelle preferenze); un secondo avviso il giorno stesso?

**Note tecniche:** colonna in `profili` (es. `nascita` come «mm-gg»), lavoro giornaliero con pg_cron (c'è già nella prova, `push-attese`) che scrive in `notifiche` un tipo nuovo `compleanno`; tocco → libreria dell'amico sui Desideri. Va scritto in privacy.html.

### 25. Chat tra amici (chiesto il 17/11/2026)

**Richiesta di Piero:** un **sistema di chat**. Nulla di costruito.

**Prima di costruire, chiedere:** solo tra amici e uno a uno, o anche gruppi; messaggi legati ai libri (es. da una scheda) o liberi; quanto tempo si tengono i messaggi; avvisi nella campanella e con le push; foto o solo testo.

**Limiti da tenere presenti (piano gratuito di Supabase):** Realtime 200 connessioni e 2 milioni di messaggi al mese (oggi niente Realtime: gli avvisi arrivano alla riapertura, ogni ~3 minuti e con le push); spazio 500 MB in tutto. Senza Realtime la chat non sarebbe «in diretta»: si potrebbe controllare più spesso solo con la chat aperta.

### 26. Condividere libri con un testo (chiesto il 17/11/2026)

**Richiesta di Piero:** poter **condividere dei libri accompagnandoli con del testo** (un messaggio scritto da chi manda). Nulla di costruito.

**Prima di costruire, chiedere:** un libro alla volta o più libri insieme; solo verso amici dentro l'app («Manda a un amico», tabella `consigli`) o anche nel link esterno; lunghezza massima del testo; dove lo legge chi riceve (campanella, push, scheda del consiglio). Si collega alla chat (25): decidere se è una cosa sola.

### 28. Foto del profilo, poi l'ex-libris (chiesto il 17/11/2026)

**Richiesta di Piero:** prima la **foto del profilo**, **dopo** l'ex-libris (voce 15). Nulla di costruito.

**Prima di costruire, chiedere:** foto dalla galleria o dalla fotocamera, con ritaglio tondo; in alternativa l'immagine dell'account Google (che arriva già con l'accesso) o le iniziali colorate come oggi; dove si vede (elenco amici, striscia dell'amico, campanella, richieste); chi la vede (solo gli amici o anche chi ti cerca per nome).

**Limiti e note:** oggi non ci sono file online (Storage di Supabase 1 GB, 50 MB a file): la foto va rimpicciolita sul telefono (es. 256×256 WebP, ~15-25 kB) prima di salvarla; con poche centinaia di utenti è poco spazio. Regole di accesso sul file (solo amici) o una cartella pubblica con nomi non indovinabili: da decidere. Va scritto in privacy.html. L'ex-libris (15) può usare lo stesso sistema per le immagini.

### 31. Pagina del profilo (chiesto il 17/11/2026)

**Richiesta di Piero:** una **pagina del profilo** con la **raccolta delle citazioni** e la **citazione preferita**; se la libreria è visibile, anche le **statistiche**, mostrate «in modo cool». Si lega alla voce 28 (foto del profilo). Nulla di costruito. **Prima di costruire, chiedere:** chi la vede (solo tu o anche gli amici: oggi le citazioni non sono mai visibili agli amici), come si sceglie la citazione preferita, quali statistiche e in che stile, dove si apre (testata, Menu, finestra Amici).

### 32. Premio per chi usa chiave Google e worker suoi (chiesto il 17/11/2026)

**Richiesta di Piero:** un **riconoscimento («reward»)** per chi ha la sua chiave API e il suo worker (non pesa sulla chiave «della casa», vedi la simulazione degli utenti). Nulla di costruito. **Prima di costruire, chiedere:** che premio (distintivo nel profilo e nella libreria vista dagli amici, colori o temi in più, ringraziamento), se conta anche chi li presta agli amici, come si verifica che sono davvero suoi.

### 33. Avviso quando un amico aggiunge un libro ai desideri (chiesto il 17/11/2026)

**Richiesta di Piero:** poter chiedere una **notifica quando un amico aggiunge un libro ai suoi desideri**, scegliendolo **già nella richiesta di amicizia** e **dopo, con un tasto apposito** (per ogni amico). Vale **solo se l'amico rende visibili i desideri** (Impostazioni › Amici e privacy). Nulla di costruito. **Prima di costruire, chiedere:** dove sta il tasto (finestra dell'amico, sua libreria), se l'avviso va nella campanella, nelle notifiche push o in tutte e due, se un avviso per libro o uno riassuntivo al giorno, se l'amico sa di essere «seguito». Serve il database (tabella o colonna delle preferenze, avviso creato dal server quando arriva un desiderio nuovo): prima nella prova.

## G. Guide

### 13. Guida di primo avvio (chiesto il 16/11/2026; piano concordato con Piero)

**Richiesta di Piero:** una guida che illustri le funzioni dell'app al primo avvio, da **aggiornare man mano**. (Era prevista prima della versione 98; Piero ha poi scelto di pubblicare la 98 prima della guida.)

**Piano (Piero d'accordo, da riprendere):**
1. **Contenuto prima della forma:** sei schermate brevi, ognuna con un disegnino, una o due frasi semplici e «Prova adesso» che apre la cosa vera:
   1. Benvenuto: cos'è Next Libris (**niente frase sui «dati solo nel telefono»**: ora ci sono gli account);
   2. Aggiungere i libri: il **+** (Scansiona, Foto, Digita, Ce l'ho già?);
   3. La pagina del libro: stato di lettura, libricini, stella del preferito, segnalibro, matita per modificare;
   4. Trovare i libri: ricerca, filtri, etichette, Copertine/Elenco;
   5. Prestiti, Desideri e **Amici** (aggiunta da valutare: account, amici, campanella);
   6. Per te: suggerimenti, statistiche, la tua stagione in libri; il backup.
2. **Forma:** un giro da sfogliare col dito, come «La tua stagione in libri», con «Salta» sempre visibile. Alla prima apertura dopo l'installazione; si riapre dal menu («Come si usa»). Chi aggiorna non la vede da sola: per lui c'è «Cosa c'è di nuovo».
3. **Tenerla aggiornata:** modulo a parte (`guida.js`/`guida.css`, solo `window.NL`); **un test** che per ogni schermata controlla che esista la parte di app di cui parla; **regola nelle note:** a ogni novità importante si decide se va nella guida.
4. **Ordine di lavoro:** prima i testi scritti in chat per Piero, poi la guida nella prova, poi nella vera.

### 16. Guida per il worker SBN e la chiave di Google Libri (chiesto il 16/11/2026)

**Richiesta di Piero:** spiegare meglio come creare il **worker SBN** (Cloudflare) e la **chiave di Google Libri**, così chi usa l'app ci riesce da solo.

**Già fatto (nella vera dalla 102):** la guida «Crea la tua chiave Google Libri: è gratis» (`#kgSheet`) e la guida del worker in Impostazioni › Ricerca (`#sbnHow`, 5 passi, «Copia il codice del worker»). **Resta:** il controllo «Prova la chiave / Prova il worker» qui sotto.

**Idea da proporre (non costruita):** un controllo «Prova la chiave / Prova il worker» che dice subito se funziona e cosa manca; una riga su a cosa servono (più libri trovati, meno limiti) e che sono gratuiti.

---

## H. Dati, backup, servizi

### 7. Backup automatico (chiesto il 15/11/2026)

**Richiesta di Piero:** automatizzare il backup, magari in una cartella dedicata. (Risposta già data: è una app web installabile, PWA, con i limiti del browser.)

**Cosa è cambiato:** con l'account (vera 98) i libri si sincronizzano su Supabase, che fa già da copia fuori dal telefono; **non** si sincronizzano copertine e foto, e Supabase gratuito non fa backup.

**Cosa si può fare (da proporre):**
1. **Copie automatiche dentro l'app:** ogni giorno (o ogni N modifiche) una copia completa in IndexedDB, tenendo le ultime 7-10, con «Ripristina questa». Protegge dagli errori (libri cancellati, import sbagliato), non dalla cancellazione dei dati del browser.
2. **Promemoria più furbo** per il backup vero: dopo N modifiche o X giorni, un tocco solo «Fai il backup e mandalo su Drive».
3. **Cartella sul telefono senza toccare nulla: non si può** su Android con Chrome (File System Access c'è solo su computer).
4. **Google Drive automatico:** ora c'è già l'accesso con Google, ma servirebbe il permesso su Drive (ambito in più, con verifica di Google). Più lavoro.
5. Con un **APK** vero si potrebbe scrivere in una cartella del telefono.

**Proposta di partenza:** 1 + 2 (facili, nessun permesso nuovo).

### 5. Quanti dispositivi usano l'app (chiesto il 15/11/2026, «inizia a pensarci»)

**Domanda di Piero:** come capire su quanti dispositivi è installata l'app principale? GitHub Pages non dà statistiche.

**Cosa è cambiato:** chi ha l'account si conta già da Supabase (utenti e ultimo accesso). Restano da contare i telefoni **senza** account.

**Proposta preferita: contatore senza identificativo** (nessun codice del dispositivo, nessun dato personale):
- al primo avvio l'app manda una volta «nuovo dispositivo» (+ installata sì/no); una volta al mese «attivo a novembre 2026» (+ installata, versione). Ogni telefono conta al massimo una volta al mese: la somma = dispositivi attivi nel mese;
- riceve un **worker Cloudflare nuovo e separato** che non salva l'IP e incrementa contatori in **D1** (non KV); in alternativa una funzione su Supabase con una tabella di contatori, senza account;
- pagina di riepilogo per Piero con una parola segreta; copia di prova esclusa;
- nell'app una riga nella guida e l'opzione «Conta questo telefono (anonimo)»; da decidere se acceso di predefinito o chiesto una volta (chiedere è la strada più tranquilla);
- limiti: chi cancella i dati del browser viene contato di nuovo; le disinstallazioni si vedono solo dal calo degli attivi.

**Alternativa più semplice:** Cloudflare Web Analytics o GoatCounter (una riga in `index.html`): contano visite, non dispositivi.

### 18. Proposte rimaste dalla simulazione degli utenti (16/11/2026)

**Fatto (nella vera dalla 102):** contatore condiviso, meno ricerche Google per libro, archivio comune per ISBN; prima ancora (98.7) chiave e worker condivisi tra amici. La proposta 8 (chi usa molto tiene la sua chiave) c'è già. Documento: `claude/simulazione-utenti.md` nel progetto claude.ai; conti in `simulazione_utenti.py`.

**Restano (nessuna costruita):**
- **chiedere a Google più ricerche al giorno** (Console › Google Books API › Quote): gratis ma non garantito; a 10.000 al giorno il limite diventerebbe lo spazio di Supabase;
- **suggerimenti condivisi:** «Da scoprire» e «Novità dei tuoi autori» salvati per autore e genere, validi per tutti per una settimana;
- **meno traffico su Supabase:** un controllo leggero «c'è qualcosa di nuovo?» ogni 3 minuti e il giro completo degli amici solo se serve (circa 4 volte meno traffico);
- **spazio su Supabase:** verso i 2.000 utenti decidere tra togliere le descrizioni dalla copia online (si ritrovano nell'archivio comune) o passare al piano Pro (25 $ al mese);
- **rifare i conti** con le ricerche di oggi (da ~2,75 a ~1,2 ricerche per libro nuovo): la simulazione è ancora quella del 16/11.

### 21. Dominio proprio ed email di accesso (dalla copia social, 16/11/2026)

- **Indirizzo:** fatto con nextlibris.github.io (versione 100), senza «piero» anche nell'accesso con Google.
- **Dominio proprio** (`nextlibris.it` o simile, 10–15 € l'anno): servirebbe solo per la verifica del marchio di Google (nome e logo nella finestra di accesso) e per le email. Piero deve controllare se è libero. Cambiando dominio servirebbe di nuovo il trasloco dei dati.
- **Email di accesso con Brevo:** ferma (accesso solo con Google, `CFG.email = false`). Con un dominio: `accesso@nextlibris.it`, modelli con il codice di 6 cifre (testo pronto in `claude/guida-accesso-google-brevo.md` del progetto claude.ai).

### 22. Chiave e worker prestati davvero nascosti (chiesto il 16/11/2026)

**Richiesta di Piero:** chi riceve chiave API e worker da un amico non deve poterli vedere né passare ad altri.

**Già fatto (nella vera dalla 102):** nascosti nell'app (niente campo in Impostazioni › Ricerca, niente salvati, backup o link). Restano però sul telefono di chi li usa: una persona esperta li legge con gli strumenti del browser.

**Da fare quando lo chiede («davvero nascosti»):** le ricerche di chi usa la chiave di un amico passano da un servizio sul server (Edge Function di Supabase) che tiene chiave e worker e fa la richiesta al posto suo; il telefono riceve solo i risultati. Costi: ricerche un po' più lente, funzioni del piano gratuito (500.000 al mese, ~2-3 per libro), da contare con la simulazione degli utenti; serve anche per i suggerimenti e le novità degli autori. Si lega al contatore condiviso (012) e alla voce 18.

---

### 30. Versioni accessibili per chi non distingue i colori (chiesto il 17/11/2026)

**Richiesta di Piero:** versioni dell'app adatte ai daltonici, prima **verificando se si può fare**. Nulla fatto.

**Appunti per la verifica (non ancora controllati):** l'app ha già Aspetto › tema e colori, quindi una scelta in più («Colori per daltonici») si aggancia lì. Da controllare: dove il colore da solo porta un significato (pallino della sincronizzazione verde/arancio, avvisi ⚠, prestiti, «da verificare», interruttori acceso/spento, grafici delle Statistiche e della stagione in libri); per ognuno serve anche un segno o una parola, non solo il colore. Provare i colori con un simulatore (protanopia, deuteranopia, tritanopia) e il contrasto WCAG.

### 34. Copertine grandi di Google con i link ufficiali (chiesto il 17/11/2026)

**Richiesta di Piero:** tenerla in sospeso. Dal 17/11/2026 la copertina grande di Google si prende dallo stesso indirizzo della miniatura con **zoom=3** («medium»); **zoom=0 è stato tolto** perché spesso dà la prima pagina del libro e non la copertina («Latinoamericana»). Per la **massima qualità** senza quel rischio: chiedere a Google la **scheda del volume** (`/volumes/<id>`), che ha i link ufficiali **large** ed **extraLarge** quando esistono. Costa **una ricerca Google in più per libro** (era stata tolta il 16/11 per il limite di 1.000 al giorno). Idea: farlo **solo quando si apre la copertina ingrandita**, e solo se la zoom=3 non c'è o è piccola. **Prima di costruire, chiedere:** solo all'ingrandimento o sempre; se conta nel contatore condiviso; se salvarla nell'archivio comune (così la scheda si chiede una volta sola per ISBN).

### 35. Google per ultimo nella ricerca dei libri (chiesto il 17/11/2026)

**Richiesta di Piero:** valutare di **invertire l'ordine delle ricerche**, perché Google Libri è la fonte più limitata (1.000 ricerche al giorno per chiave; vedi la simulazione degli utenti). **Oggi** (lib.js `lookupIsbn`): Google, Open Library e SBN partono **insieme**; Crossref solo se manca qualcosa; prima di tutto l'archivio comune. **Idea:** archivio → Open Library e SBN → **Google solo se manca ancora qualcosa** (titolo, autore, editore, anno, copertina, descrizione). **Da valutare prima:** quanto spesso Open Library e SBN bastano per i libri italiani (copertina e descrizione arrivano quasi sempre solo da Google, quindi il risparmio potrebbe essere piccolo se servono sempre); tempi più lunghi (Google aspetta le altre); cosa vale come «manca qualcosa» (per esempio la descrizione si potrebbe cercare solo all'apertura del libro, come la proposta 2 della simulazione). Si può misurare con le ricerche vere della prova prima di decidere. **Prima di costruire, chiedere.**

### 36. Dividere app.js in moduli (dalla verifica del 17/11/2026)

**Proposta della verifica, lasciata da parte da Piero:** `app.js` è troppo grande (~470 KB). Spostare in moduli propri, un pezzo alla volta e con le prove: fotocamera e scansione, editor delle foto, suggerimenti, statistiche. Rapporto in `claude/verifica-17-11-2026.md` del progetto claude.ai.

## Fatti (tolti dall'elenco)

- **1. Fotocamera e luce:** fotocamera del telefono (v90), controllo dell'obiettivo (v91), «Prova la luce» (v92). Restano solo le verifiche nella parte B.
- **2. Il tuo anno in libri:** fatto come «Il tuo trimestre in libri» (95) e «La tua stagione in libri» (96), modulo `wrap.js`.
- **4. Da verificare sul telefono:** spostato nella parte B.
- **Amicizie** (dalla copia social): fatte, nella vera dalla 99.
- **18. Contatore e archivio:** fatti nella prova 99.3; il resto è sopra.
- **29. Indirizzo nextlibris.github.io:** fatto con la versione 100 (17/11/2026), con il trasloco dal vecchio indirizzo.
- **20. Notifiche push:** fatte (prova 99.6, nella vera dalla 102); Piero ha confermato sul telefono il 17/11/2026.
- **27. Verifica di sicurezza:** fatta il 17/11/2026 (rapporto `claude/verifica-17-11-2026.md`); bonifiche nella prova 101.2, nella vera dalla 102.
- **Campanella:** scelte confermate da Piero il 17/11/2026 (richiesta d'amicizia solo nella campanella; nessuna notifica se si annulla o si cambia un regalo).
- **Titolare nella privacy:** «Piero R., l'ideatore di Next Libris» (prova 103.2).
- **Verifiche sul telefono** (fotocamera posteriore, backup su Drive, luce del Galaxy A32): confermate o chiuse da Piero il 17/11/2026.
