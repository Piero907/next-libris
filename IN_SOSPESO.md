# Next Libris: cose in sospeso

Questo file sta nel ramo `prove`, separato dall'app. Raccoglie le idee e i problemi che Piero ha chiesto di **tenere in sospeso**, con quanto serve per ripartire da qui anche in una sessione nuova.

**Regola:** nulla di questo elenco si costruisce finché Piero non lo chiede. Quando dice «riprendiamo …», si riparte dalla voce giusta: prima si rilegge, poi si fanno le domande ancora aperte, poi si costruisce. A lavoro finito la voce si toglie da qui e va nel registro delle novità dell'app.

Ultimo aggiornamento: 15/11/2026, app alla versione 94 (copia di prova più avanti: Suggerimenti, trimestre, disposizione A).

---

## 1. Fotocamera e luce — ripresa il 15/11/2026: fotocamera del telefono (v90) e controllo dell'obiettivo (v91)

- **Il problema:** Piero ha confermato che il flash non si accende neanche nella fotocamera dell'app. Quindi Chrome su quel telefono non lascia usare la luce.
- **La soluzione:**
  - pulsante «📷 Usa la fotocamera del telefono (con il flash)» nella fotocamera dell'app (`#snapNative`, usa l'input `#fileNative`) e nella scansione (`#scanNative`, chiude la scansione e usa `#fileCam` → `addPhotos`);
  - opzione `settings.camNative` («Per le foto usa la fotocamera del telefono»);
  - le due fotocamere hanno lo stesso aspetto.
- **Da verificare sul telefono:** che la fotocamera del telefono si apra su quella posteriore (`capture="environment"`). Se si apre in selfie, di solito basta girarla una volta.
- **Restano nell'app:** torcia 🔦 e flash ⚡ della scansione (v88), per i telefoni che li permettono.
- **v91, il controllo dell'obiettivo** (chiesto da Piero il 15/11/2026):
  - La prima volta `rearStream()` prova gli obiettivi (`probeLenses` / `chooseLightLens`) e salva in `settings.torchCam` l'obiettivo con `torch`, oppure `'none'`.
  - Se nessuno ha la luce, o la luce non si accende davvero (`getSettings().torch` resta `false`), i pulsanti della luce spariscono (`noLight`).
  - La diagnosi è in Opzioni › App › «Prova gli obiettivi».
  - **Esito sul Galaxy A32 di Piero (15/11/2026):** Chrome vede solo 3 fotocamere: «camera 1, facing front», «camera 2, facing front» e «camera 0, facing back», che dichiara la luce («luce sì»). Il telefono ne ha di più, ma Chrome espone un solo obiettivo posteriore. La luce però non si accende: il telefono dichiara la torcia e accetta il comando senza accenderla, e l'app non può accorgersene.
  - **v92:** «Prova la luce» (Opzioni › App) accende per 2,5 s e chiede «Sì / No». Con «No» si salva `settings.torchCam = 'none'` e i pulsanti della luce spariscono, anche se l'obiettivo dichiara `torch`. `torchOnTrack()` prova sia `advanced: [{ torch }]` sia `{ torch }`.
  - **Esito di «Prova la luce» (15/11/2026, v92):** Piero ha risposto **No**, quindi sul Galaxy A32 la luce non si accende neanche con il secondo metodo. Per lui la soluzione è la fotocamera del telefono (v90), anche sempre attiva con l'opzione «Per le foto usa la fotocamera del telefono». I pulsanti della luce gli spariscono dopo il «No».
  - **Possibile prova futura, solo se lui la chiede:** riaprire la fotocamera a risoluzione più bassa prima di accendere la luce (su alcuni Samsung la torcia va solo a certe risoluzioni). Non è verificato.

---

## 2. «Il tuo anno in libri» (wrap stile Spotify)

**Ripreso il 15/11/2026:** Piero l'ha chiesto **ogni tre mesi**, opzionale (predefinito sì) e facile da togliere. Fatto come modulo `wrap.js`/`wrap.css` nella copia di prova (prova e2e64). Resta da decidere se portarlo nella versione vera. Sotto, l'idea di partenza.

**Stato iniziale:** proposta mostrata il 14/11/2026 con un disegno delle schermate. Piero: «Teniamo in sospeso la funzione del wrap».

**Idea:** schermate a tutto schermo come le storie di Instagram (tocco a destra = avanti, a sinistra = indietro, barre di avanzamento in alto, colori della palette, numeri grandi con le grazie).
1. Apertura: «Il tuo 2026 in libri».
2. Quanto hai letto: libri letti, pagine, media al giorno, mese più letto, obiettivo raggiunto o no.
3. Gusti dell'anno: genere preferito (con le percentuali dei primi tre) e autore dell'anno.
4. Il libro più lungo e quello con il voto più alto.
5. La citazione dell'anno, i libri nuovi entrati in libreria, a chi hai prestato di più.
6. Riassunto finale da condividere come immagine (canvas → Web Share), con «Next Libris».

**Dati usati:**
- `rd` (data di lettura), `rs` (stato di lettura), `pg` (pagine), `gen`, `a`, `rt` (voto);
- `ts` (aggiunta), `qs` (citazioni), `p` / `pd` (prestiti).

**Limite:** conta come «letto nell'anno» solo un libro con la data di lettura. I libri segnati «Letto» senza data non si attribuiscono a un anno.

**Da decidere con Piero:**
- periodo: solo l'anno in corso, oppure anche gli anni passati e un «da sempre»;
- schermate da togliere o aggiungere;
- quando mostrarlo: sempre da Statistiche e/o con un invito in cima all'elenco a dicembre.

---

## 3. Statistiche con una parte di «intrattenimento»

**Stato:** proposta del 14/11/2026. Piero: «conserva queste idee». Va pensata insieme al wrap, che usa gli stessi dati.

1. **Traguardi (badge da collezionare):** griglia di medaglie, colorate se conquistate e grigie con la barra di avanzamento se da prendere. Quando se ne conquista una, un piccolo festeggiamento.
   - Biblioteca: 10, 50, 100, 250, 500 libri catalogati.
   - Lettore: primo libro letto, poi 10, 25, 50; «Maratoneta» (letto un libro di oltre 800 pagine); «Divoratore» (3 libri in un mese).
   - Esploratore: 5 generi diversi letti, 10 autori diversi, libri di 5 decenni diversi.
   - Collezionista: una serie completa (campi Serie e Volume); «Fan di…» (10 libri dello stesso autore).
   - Citazioni: la prima, poi 25; la prima foto evidenziata.
   - Ordine: tutti i libri con lo scaffale, nessun «Da verificare», tutte le pagine compilate. Spinge a completare i dati.
2. **Sfide e obiettivi:**
   - obiettivo annuale con il ritmo («sei avanti di 2 libri» / «ti mancano 3 libri in 6 settimane»);
   - sfida del mese che cambia da sola («Finisci un libro iniziato», «Leggi un genere che non leggi mai», «Dai un voto ai libri letti», «Aggiungi le pagine ai libri che non le hanno»);
   - settimane di fila con almeno un libro letto o aggiunto.
3. **Curiosità sulla libreria**, una diversa a ogni apertura:
   - altezza della libreria impilata (circa 0,05 mm a pagina più le copertine);
   - tempo per leggere i «da leggere» a 20 pagine al giorno;
   - libro più vecchio e decennio preferito.

**Da decidere con Piero:**
- tono: giocoso, con nomi simpatici e festeggiamenti, oppure sobrio da diario di lettura;
- posizione: dentro Statistiche, oppure una voce «Traguardi» a sé nel menu, accanto a Statistiche.

---

## 4. Da verificare sul telefono (non in sospeso, ma senza riscontro)

- **Backup «Fai il backup e mandalo su Drive, email…»** (v88): se la condivisione non parte compare «Il backup non è partito», con il motivo tra parentesi (per esempio `NotAllowedError`). Se Piero riferisce la sigla, la causa si capisce da lì:
  - `NotAllowedError`: di solito il tocco è «scaduto» o il file non è ammesso;
  - `DataError` / `TypeError`: file troppo grande o non ammesso.

---

## 5. Quanti dispositivi usano l'app principale (chiesto il 15/11/2026; «inizia a pensarci»)

**Domanda di Piero:** c'è un modo per capire su quanti dispositivi è installata l'app principale? Oggi no: GitHub Pages non dà statistiche e l'app non manda nulla fuori dal telefono.

**Proposta preferita: contatore senza identificativo** (nessun codice del dispositivo, nessun dato personale):
- Al primo avvio l'app manda una volta sola «nuovo dispositivo» (+ installata sì/no) e si segna sul telefono che l'ha fatto.
- Una volta al mese manda «attivo a novembre 2026» (+ installata sì/no, numero di versione) e si segna il mese. Ogni telefono conta al massimo una volta al mese, quindi la somma = **dispositivi attivi nel mese**, senza bisogno di riconoscerli.
- Riceve un **worker Cloudflare nuovo e separato** (non quello SBN, che ognuno si installa per conto suo), indirizzo fisso nell'app. Il worker non salva l'IP: incrementa solo dei contatori in **D1** (`UPDATE ... SET n = n + 1`, atomico; KV non va bene: 1.000 scritture al giorno sul piano gratuito e non incrementa in modo sicuro).
- Lettura per Piero: una pagina del worker (`/riepilogo?chiave=…`, con una parola segreta) con totale dispositivi, attivi per mese, quanti l'hanno installata, versioni in uso.
- Copia di prova esclusa (o contata a parte). Senza rete: il segnale parte alla prossima apertura con rete.
- Nell'app: riga nella guida + opzione «Conta questo telefono (anonimo)» in Opzioni › App. Da decidere con Piero se acceso di predefinito o chiesto una volta (in Italia la regola sui dati salvati nel telefono va tenuta presente: chiedere una volta è la strada più tranquilla; non siamo avvocati).
- Limiti: chi cancella i dati del browser viene contato di nuovo come «nuovo»; non si sa quanti l'hanno disinstallata (si vede dal calo degli attivi).

**Alternativa più semplice:** Cloudflare Web Analytics o GoatCounter (una riga in `index.html`): contano visite e visitatori di passaggio, **non** i dispositivi; utile per vedere se l'app viene aperta, meno per «quanti telefoni».

**Cosa servirebbe da Piero per partire:** creare su Cloudflare un worker «contatore-next-libris» e un database D1 (passi guidati, come per il worker SBN), scegliere la parola segreta, decidere acceso/chiesto.

---

## 6. Film tratti dai libri (chiesto il 15/11/2026, «per dopo»)

**Domanda di Piero:** l'app può cercare i film ispirati o tratti dai libri che ha in libreria o nei Desideri?

**Idea (da proporre quando la riprende):**
- **Fonte: Wikidata**, gratuita, senza chiave, interrogabile dal browser (query.wikidata.org). Ogni film ha la proprietà «basato su» (P144) che punta all'opera letteraria.
- Collegare il libro all'opera: dall'ISBN (P212/P957) si trova l'edizione, e da lì l'opera («edizione di», P629); se l'ISBN non c'è, si cerca per titolo e autore (etichetta in italiano + autore P50). Poi: film e serie con P144 = quell'opera, con anno, regista, titolo italiano e, se c'è, la pagina di Wikipedia in italiano (l'app usa già Wikipedia per le descrizioni).
- **Dove:** nella scheda del libro una riga «🎬 Ne hanno tratto un film: Il nome della rosa (1986, Jean-Jacques Annaud)»; e in «Per te» / Suggerimenti una scheda «Dai tuoi libri al cinema» con l'elenco dei film tratti dai libri della libreria (e dei Desideri), magari con «Visto» / «Da vedere».
- Ricerca a gruppi in sottofondo (una richiesta SPARQL per più opere), una volta sola per libro, risultato salvato.
- **Limiti:** Wikidata è ricca per i classici e i libri famosi, povera per le edizioni minori; un libro senza opera collegata non dà risultati. Alternativa con più film ma con chiave: TMDB (serve registrarsi).

---

## 7. Backup automatico (chiesto il 15/11/2026, «in sospeso»)

**Richiesta di Piero:** automatizzare il backup, magari in una cartella dedicata dell'app. Ha chiesto anche se è un'app o una pagina web.

**Risposta da dargli:** è una **app web installabile (PWA)**: una pagina web che, installata, si apre a schermo intero con la sua icona e funziona senza rete. Per questo ha i limiti del browser sul telefono.

**Cosa si può fare (da proporre quando la riprende):**
1. **Copie automatiche dentro l'app:** ogni giorno (o a ogni N modifiche) l'app salva da sola una copia completa nel suo spazio (IndexedDB), tenendo le ultime 7-10. Opzioni › Backup: «Copie automatiche» con l'elenco e «Ripristina questa». Protegge da errori (libri cancellati, import sbagliato) ma **non** se si cancellano i dati del browser o si cambia telefono.
2. **Promemoria più furbo per il backup vero** (già c'è l'avviso): dopo N modifiche o X giorni, un tocco solo «Fai il backup e mandalo su Drive».
3. **Cartella sul telefono senza toccare nulla: non si può** su Android con Chrome: una pagina web non può scrivere da sola nei file del telefono (la scelta di una cartella permanente, File System Access, c'è solo su computer). Ogni salvataggio nei Download chiede un tocco.
4. **Google Drive automatico:** possibile con l'accesso a Google (OAuth): l'app salverebbe da sola un file nella cartella «Next Libris» su Drive. Serve creare un progetto su Google Cloud (ID cliente) e il consenso di Google; più lavoro, ma è il vero backup automatico fuori dal telefono.
5. Se un giorno ci sarà l'**APK**: con un'app vera (non solo una PWA impacchettata) si potrebbe scrivere in una cartella del telefono da soli.

**Proposta di partenza:** 1 + 2 subito (facili, nessun account), 4 se vuole il backup automatico fuori dal telefono.

**Aggiunta del 15/11/2026 (Piero: «ottima idea», chiede se Wikipedia ha banche dati per i libri):** Wikidata ha i libri, ma solo quelli «notevoli» e con l'ISBN solo sulle singole edizioni: come fonte per la ricerca iniziale (ISBN → titolo, autore, editore) troverebbe poco delle edizioni italiane, che SBN, Google Libri e Open Library coprono già meglio. È invece utile a livello di **opera**, insieme ai film: titolo originale, anno della prima edizione, premi, serie, genere. Proposta: quando si fanno i film, usare la stessa ricerca su Wikidata anche per arricchire la scheda (riga «Prima edizione 1980 · titolo originale … · Premio Strega»), senza toccare la ricerca iniziale.

---

## 8. Libri in lettura (chiesto il 15/11/2026: «dobbiamo lavorare ai libri in lettura»)

**Richiesta di Piero:** segnare che bisogna lavorare sui libri «In lettura». Non ha ancora detto cosa vuole: quando lo riprende, chiedere prima che cosa non gli torna o cosa gli manca.

**Idee da proporre (nessuna costruita):**
- un riquadro «Stai leggendo» in cima all'elenco (o in «Per te») con la copertina e un tocco per aprire la scheda;
- a che pagina sei (campo «pagina» + barra di avanzamento sulle pagine totali), giorni da quando l'hai iniziato, data di inizio messa da sola quando passa a «In lettura»;
- «Finito!» con un tocco: segna Letto con la data e chiede il voto (si collega a «Cosa leggere dopo»);
- filtro rapido «In lettura» e ordine «iniziati di recente»;
- nelle statistiche e nel trimestre: tempo medio per finire un libro.
