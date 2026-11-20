# Next Libris: cose in sospeso

Questo file sta nel ramo `prove`, separato dall'app. Raccoglie le idee e i problemi che Piero ha chiesto di **tenere in sospeso**, con quanto serve per ripartire anche in una sessione nuova.

**Regola:** nulla di questo elenco si costruisce finché Piero non lo chiede. Quando dice «riprendiamo …», si riparte dalla voce giusta: prima si rilegge, poi si fanno le domande ancora aperte, poi si costruisce. A lavoro finito la voce si toglie da qui (va in «Fatti», in fondo, con una riga) e la novità va nel registro dell'app.

**Numeri:** ogni voce tiene il suo numero di sempre (le note e STORIA.md li citano), anche se l'ordine qui è per argomento. Una voce nuova prende il primo numero libero: **42**.

Ultimo aggiornamento: **19/11/2026**, vera **107**, prova **107.6**. Da sistemare anche: prova e2e40 incerta.

## Indice

- **A. In attesa di Piero**: 41 Sostieni più in evidenza
- **B. Da verificare sul telefono**: foto di Flaiano (104)
- **C. Uso di tutti i giorni:** 8 libri in lettura · 9 copertine esplorabili · 17 filtro ISBN non trovati · 19 foto del codice scritto · 23 collane raggruppate nelle copertine (in lavorazione) · 38 risolvere gli ISBN non trovati
- **D. Wikipedia e Wikidata:** 10 opere dell'autore · 11 altri dati wiki
- **E. Statistiche e svago:** 3 traguardi, sfide e curiosità
- **F. Amici, prestiti, ex-libris:** 14 libri ricevuti in prestito · 15 ex-libris · 24 compleanni degli amici · 26 libri condivisi con un testo · 32 premio per chi usa chiave e worker suoi · 37 libro del mese · 39 bacheca
- **G. Guide:** 16 «Prova la chiave / Prova il worker»
- **H. Dati, backup, servizi:** 7 backup automatico · 5 quanti dispositivi · 18 proposte rimaste dalla simulazione · 21 dominio proprio ed email · 30 colori per daltonici · 34 copertine grandi «large» di Google
- **Fatti** (tolti dall'elenco)

---

## A. In attesa di Piero

### 41. Sostieni più in evidenza (20/11/2026)
Piero: «torneremo sull'argomento dopo, va messo meglio in evidenza». Oggi nell'Indice dello stile G Sostieni è la **fascia dorata in fondo**; la scelta del 18/11 diceva «sempre al centro del Menu, sopra Amici», e il boccale stava nella testata (pillola «🍺 Sostieni»), che con lo stile G non si vede più. Quando si riprende: prima le domande (dove, quanto in evidenza, con o senza testo) e le prove nella tela di design. Testo e regole di Sostieni: `LIBRERIA_LIBRO.md`.

## B. Da verificare sul telefono

Il 17/11/2026 sera Piero ha confermato **tutto il resto** (vera 103 e 102, «Accedi con Google» con la CSP, notifiche push, foto degli autori, fotocamera posteriore, backup su Drive, luce del Galaxy A32 lasciata così).

- **Foto di Ennio Flaiano** (vera 104): non compariva perché Wikipedia ha cambiato l'indirizzo delle miniature (vedi CLAUDE.md). Dalla pagina della prova la foto arriva; da guardare sul telefono, con la rete.

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

### 38. Risolvere gli ISBN non trovati (chiesto il 17/11/2026)

**Richiesta di Piero:** cercare di risolvere il problema dei codici ISBN che non si trovano in nessuna banca dati (legata alla 17, che è solo il filtro). Nulla di costruito. **Da studiare:** quali ISBN non si trovano (vecchi, piccoli editori, pubblicati in proprio) e con quali altre fonti provare (altri cataloghi, ricerca per titolo dalla foto della copertina, archivio comune, nuova ricerca periodica dei «non trovati»).

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

### 42. Idee con i dati pubblici della rete (20/11/2026)

**Richiesta di Piero:** «salviamole perché piano piano le implementeremo». Elenco completo, fonti e domande aperte nel documento del progetto claude.ai `claude/idee-dati-pubblici.md` (11 idee: biblioteca che ha il libro con SBN + Anagrafe delle biblioteche, «Leggilo gratis», audiolibri, biblioteche vicine, premi letterari, prossimo della serie, luoghi dei libri, titolo originale e traduttore, anniversari degli autori, Wikiquote, sfide di lettura). **In corso: «Leggilo gratis»** (tela, ramo `tela-leggilo-gratis`, modulo `gratis.js`/`gratis.css`, prova e2e140; si toglie con `togli_modulo.py gratis`).


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

### 26. Condividere libri con un testo (chiesto il 17/11/2026)

**Richiesta di Piero:** poter **condividere dei libri accompagnandoli con del testo** (un messaggio scritto da chi manda). Nulla di costruito.

**Prima di costruire, chiedere:** un libro alla volta o più libri insieme; solo verso amici dentro l'app («Manda a un amico», tabella `consigli`) o anche nel link esterno; lunghezza massima del testo; dove lo legge chi riceve (campanella, push, scheda del consiglio). Si collega alla chat (25): decidere se è una cosa sola.

### 32. Premio per chi usa chiave Google e worker suoi (chiesto il 17/11/2026)

**Richiesta di Piero:** un **riconoscimento («reward»)** per chi ha la sua chiave API e il suo worker (non pesa sulla chiave «della casa», vedi la simulazione degli utenti). Nulla di costruito. **Prima di costruire, chiedere:** che premio (distintivo nel profilo e nella libreria vista dagli amici, colori o temi in più, ringraziamento), se conta anche chi li presta agli amici, come si verifica che sono davvero suoi.

### 37. Il libro del mese (chiesto il 17/11/2026)

**Richiesta di Piero:** «Il libro del mese», con **invio di citazioni agli interessati**. Nulla di costruito. **Prima di costruire, chiedere:** chi sceglie il libro (ognuno il suo, un gruppo di amici, l'app); chi sono «gli interessati» (amici che si iscrivono, tutti gli amici); quali citazioni (quelle scritte da chi legge, o da Wikiquote) e con che ritmo; come arrivano (campanella, push). Attenzione: oggi citazioni e appunti non sono mai visibili agli amici.

### 39. Bacheca (chiesto il 17/11/2026)

**Richiesta di Piero:** una «bacheca». Nulla di costruito e niente dettagli. **Prima di costruire, chiedere** cosa deve contenere (novità degli amici: libri aggiunti, letti, voti; avvisi; consigli) e chi la vede.

## G. Guide

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

**Giro 7 (18/11/2026, scelte di Piero):** fatto il punto 2 nella prova: promemoria ogni **45 giorni** o dopo **20 libri nuovi**, e «Fai il backup» lo manda su Drive, WhatsApp o email con un tocco (le foto si preparano mentre l'avviso è in vista). **Restano in sospeso:**
- **C · backup automatico su Google Drive** (cartella nascosta dell'app nel Drive dell'utente, copertine e foto comprese, una volta a settimana; permesso in più «file creati da Next Libris», da verificare se Google chiede una verifica);
- **D · copia del database per Piero:** un'esportazione a mano ogni tanto (amicizie, prestiti, archivio), con una procedura scritta, perché il piano gratuito di Supabase non fa backup.

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
- **Email di accesso con Brevo:** ferma (accesso solo con Google, `CFG.email = false`). Con un dominio: `accesso@nextlibris.it`, modelli con il codice di 6 cifre (`claude/accesso-google-e-servizi.md` del progetto claude.ai).

### 40. Worker e link della chiave (dal giro 7-8, 18/11/2026)
- **R5 · limite di richieste per il worker** (**si chiude con il worker della casa**, fatto nella prova il 20/11/2026: indirizzo solo sul server e richieste firmate; dal 27/11/2026 il worker accetta solo quelle; vedi API_WORKER.md) (**worker prestato: FATTO**, 026 + giro 11A del 18/11/2026: passa dal server, 3.000 ricerche al giorno per amico, nella prova con 027; resta solo il worker usato da un programma con l'indirizzo): oggi chiunque conosca l'indirizzo lo può usare da un programma; il piano gratuito si ferma a 100.000 al giorno senza costi, ma SBN potrebbe bloccare il worker. Possibile: un limite per indirizzo IP o un piccolo segreto.
- **R2 · link con la chiave (`#k=`): TOLTO nel giro 8** (Piero, 18/11/2026: «si condivide solo dentro l'app»). Un vecchio link aperto oggi dà solo un avviso.

---

### 30. Versioni accessibili per chi non distingue i colori (chiesto il 17/11/2026)

**Verifica fatta nel giro 4 (18/11/2026), scelta di Piero: niente per ora.** Il colore è quasi sempre accompagnato da una parola o un segno; si confondono solo verde/rosso di «Ce l'hai/Non ce l'hai» (c'è ✓/✗) e oro/rosso dei cerchietti della campanella (il limite ha «!»). Punti deboli se si riprende: campi dedotti nella scheda (`.f.is-guess`, spiegazione solo nel `title`) → scritta «da verificare»; tipo di notifica nel cerchietto `.nt-ico` solo dal colore → simbolo piccolo. Rapporto completo qui sopra (il documento del giro 4 è stato riassunto in `claude/storia-delle-scelte.md` il 20/11/2026).

**Richiesta di Piero:** versioni dell'app adatte ai daltonici, prima **verificando se si può fare**. Nulla fatto.

**Appunti per la verifica (non ancora controllati):** l'app ha già Aspetto › tema e colori, quindi una scelta in più («Colori per daltonici») si aggancia lì. Da controllare: dove il colore da solo porta un significato (pallino della sincronizzazione verde/arancio, avvisi ⚠, prestiti, «da verificare», interruttori acceso/spento, grafici delle Statistiche e della stagione in libri); per ognuno serve anche un segno o una parola, non solo il colore. Provare i colori con un simulatore (protanopia, deuteranopia, tritanopia) e il contrasto WCAG.

### 34. Copertine grandi di Google con i link ufficiali (chiesto il 17/11/2026)

**Richiesta di Piero:** tenerla in sospeso. Dal 17/11/2026 la copertina grande di Google si prende dallo stesso indirizzo della miniatura con **zoom=3** («medium»); **zoom=0 è stato tolto** perché spesso dà la prima pagina del libro e non la copertina («Latinoamericana»). Per la **massima qualità** senza quel rischio: chiedere a Google la **scheda del volume** (`/volumes/<id>`), che ha i link ufficiali **large** ed **extraLarge** quando esistono. Costa **una ricerca Google in più per libro** (era stata tolta il 16/11 per il limite di 1.000 al giorno). Idea: farlo **solo quando si apre la copertina ingrandita**, e solo se la zoom=3 non c'è o è piccola. **Prima di costruire, chiedere:** solo all'ingrandimento o sempre; se conta nel contatore condiviso; se salvarla nell'archivio comune (così la scheda si chiede una volta sola per ISBN).

## Fatti (tolti dall'elenco)

- **6.** Film tratti dai libri: scheda e «Dai tuoi libri al cinema» (giro 2, vera 105).
- **12.** Nazionalità degli autori con bandiere (giri 2 e 5, vera 105).
- **25.** Chat a due e gruppi (giro 9, vera 105).
- **28.** Foto del profilo (vera 105).
- **31.** Pagina del profilo (giri 3, 6, 11C).
- **33.** Avviso sui desideri di un amico (giro 6, vera 105).
- **13.** Guida di primo avvio (giri 4-10, vera 105).
- **22.** Chiave e worker prestati restano sul server (giro 8, 026, giro 11A).
- **35.** Google per ultimo e descrizione a richiesta (giro 11B, prova 107.6).
- **36.** app.js diviso in 12 file (17/11/2026).
- **1. Fotocamera e luce:** fotocamera del telefono (v90), controllo dell'obiettivo (v91), «Prova la luce» (v92). Restano solo le verifiche nella parte B.
- **2. Il tuo anno in libri:** fatto come «Il tuo trimestre in libri» (95) e «La tua stagione in libri» (96), modulo `wrap.js`.
- **4. Da verificare sul telefono:** spostato nella parte B.
- **Amicizie** (dalla copia social): fatte, nella vera dalla 99.
- **18. Contatore e archivio:** fatti nella prova 99.3; il resto è sopra.
- **29. Indirizzo nextlibris.github.io:** fatto con la versione 100 (17/11/2026), con il trasloco dal vecchio indirizzo.
- **20. Notifiche push:** fatte (prova 99.6, nella vera dalla 102); Piero ha confermato sul telefono il 17/11/2026.
- **27. Verifica di sicurezza:** fatta il 17/11/2026 (rapporto `claude/verifica-17-11-2026.md`); bonifiche nella prova 101.2, nella vera dalla 102.
- **Campanella:** scelte confermate da Piero il 17/11/2026 (richiesta d'amicizia solo nella campanella; nessuna notifica se si annulla o si cambia un regalo).
- **Titolare nella privacy:** «Piero R., l'ideatore di Next Libris» (vera 104).
- **Verifiche sul telefono** (fotocamera posteriore, backup su Drive, luce del Galaxy A32): confermate o chiuse da Piero il 17/11/2026.
