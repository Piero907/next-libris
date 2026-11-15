# Next Libris: cose in sospeso

Questo file sta nel ramo `prove`, separato dall'app. Raccoglie le idee e i problemi che Piero ha chiesto di **tenere in sospeso**, con quanto serve per ripartire da qui anche in una sessione nuova.

**Regola:** nulla di questo elenco si costruisce finché Piero non lo chiede. Quando dice «riprendiamo …», si riparte dalla voce giusta: prima si rilegge, poi si fanno le domande ancora aperte, poi si costruisce. A lavoro finito la voce si toglie da qui e va nel registro delle novità dell'app.

Ultimo aggiornamento: 15/11/2026, app alla versione 90.

---

## 1. Fotocamera e luce — ripresa il 15/11/2026, risolta con la fotocamera del telefono (v90)

- **Il problema:** Piero ha confermato che il flash non si accende neanche nella fotocamera dell'app. Quindi Chrome su quel telefono non lascia usare la luce.
- **La soluzione:**
  - pulsante «📷 Usa la fotocamera del telefono (con il flash)» nella fotocamera dell'app (`#snapNative`, usa l'input `#fileNative`) e nella scansione (`#scanNative`, chiude la scansione e usa `#fileCam` → `addPhotos`);
  - opzione `settings.camNative` («Per le foto usa la fotocamera del telefono»);
  - le due fotocamere hanno lo stesso aspetto.
- **Da verificare sul telefono:** che la fotocamera del telefono si apra su quella posteriore (`capture="environment"`). Se si apre in selfie, di solito basta girarla una volta.
- **Restano nell'app:** torcia 🔦 e flash ⚡ della scansione (v88), per i telefoni che li permettono.

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
