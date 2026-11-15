# Next Libris: cose in sospeso

Questo file sta nel ramo `prove`, separato dall'app. Raccoglie le idee e i problemi che Piero ha chiesto di **tenere in sospeso**, con quanto serve per ripartire da qui anche in una sessione nuova.

**Regola:** nulla di questo elenco si costruisce finché Piero non lo chiede. Quando dice «riprendiamo …», si riparte dalla voce giusta: prima si rilegge, poi si fanno le domande ancora aperte, poi si costruisce. A lavoro finito la voce si toglie da qui e va nel registro delle novità dell'app.

Ultimo aggiornamento: 15/11/2026, app alla versione 89.

---

## 1. Fotocamera e luce (torcia e flash) — problema aperto

**Stato:** segnalato da Piero il 15/11/2026: «La torcia ed il flash non funzionano». In sospeso su sua richiesta.

**Cosa c'è oggi nell'app (v88-89):**
- **Scansione dal vivo** (`startScan`, schermata `#scan`): per la scelta della fotocamera usa `rearStream({ width: 1920, height: 1080 })`, cioè la posteriore principale. Se non riesce, ripiega su `getUserMedia` con `facingMode: environment`.
  - La luce si cerca con `scanLightCaps()`: `track.getCapabilities().torch` oppure `ImageCapture.getPhotoCapabilities().fillLightMode`, ricontrollando dopo 700 ms.
  - 🔦 `#scanTorch`: la torcia resta accesa (`setTorch` → `applyConstraints({ advanced: [{ torch }] })`).
  - ⚡ `#scanFlash`: compare solo in modalità Copertina. Allo scatto (`shootCover`) accende la torcia, aspetta 650 ms, prende il fotogramma e la spegne.
  - Se `applyConstraints` fallisce compare il messaggio «Questo telefono non lascia accendere la torcia da qui…».
- **Fotocamera delle foto** (`snapPhoto`, schermata `#snap`: Foto › Scatta, copertina di un libro, citazioni): usa `rearStream()` ad alta risoluzione.
  - Il pulsante «Luce» `#snapTorch` accende la torcia.
  - `snapShoot` usa `ImageCapture.takePhoto({ fillLightMode: 'flash' })` se la luce è accesa.
  - C'è anche l'avviso di poca luce e la messa a fuoco col tocco (v83).
- **Fotocamera del telefono:** gli input `#fileCam`, `#fileCover`, `#fileQuote` e `#filePrice` hanno `capture="environment"`. Oggi si usano solo come ripiego, se la fotocamera dell'app non si apre.
- **Prove:** la luce è stata provata solo con una luce finta (e2e59 sovrascrive `getCapabilities` e `applyConstraints`); sul telefono di Piero non funziona.

**Domande ancora senza risposta (farle per prime):**
1. Nella scansione compaiono i pulsanti 🔦 e ⚡ in alto a destra? Se sì, toccandoli compare un messaggio in basso?
2. In Foto › Scatta una foto, il pulsante «Luce» funziona?

**Come leggere le risposte:**
- **«Luce» funziona in Foto ma non nella scansione:** il problema è come la scansione apre la fotocamera. Si può provare la stessa `rearStream()` senza vincoli di risoluzione, cercare la luce più tardi o riaprire lo stream.
- **Non funziona da nessuna parte:** Chrome su quel telefono non lascia accendere la luce, e la soluzione è la fotocamera del telefono.
- **I pulsanti non compaiono:** il telefono non dichiara la luce a Chrome. Stessa soluzione: la fotocamera del telefono.

**Soluzione proposta a Piero (da confermare):**
1. **Nella fotocamera dell'app** (Foto, copertina nella scansione, citazioni): pulsante «📷 Fotocamera del telefono», che apre quella del telefono con il suo flash; la foto torna nell'app come adesso.
2. **Nella scansione dal vivo:** «Scatta il codice con la fotocamera del telefono», per poca luce. Si fa la foto con il flash e l'app legge il codice dalla foto (`processPhoto` legge già i codici a barre).
3. **Nelle Opzioni:** «Per le foto usa: fotocamera dell'app / del telefono». Predefinita quella dell'app: la fotocamera del telefono si apriva a volte in modalità selfie, ed è il motivo per cui nella v62 è nata la fotocamera dell'app.

**Limite da ricordare:** la fotocamera del telefono non permette la scansione dal vivo, perché passa all'app solo la foto finita.

---

## 2. «Il tuo anno in libri» (wrap stile Spotify)

**Stato:** proposta mostrata il 14/11/2026 con un disegno delle schermate. Piero: «Teniamo in sospeso la funzione del wrap».

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
