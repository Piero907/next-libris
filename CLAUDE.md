# Next Libris: note per lavorare sull'app

Questo file sta nel ramo `prove`, separato dall'app. Il README.md accanto spiega come preparare ed eseguire le prove e come sono fatte.

## Il progetto

- **Cos'è:** Next Libris, PWA in JavaScript puro (nessun framework, nessuna compilazione) per catalogare la libreria di casa. L'utente è Piero, italiano, e la usa su un telefono e un tablet Android.
- **Repository:** `Piero907/next-libris`.
  - Ramo `main`: l'app, pubblicata su GitHub Pages: https://piero907.github.io/next-libris/
  - Ramo `prove`: prove automatiche, materiali e strumenti; non fa parte dell'app.
  - Ramo `versione-76`: punto di salvataggio della versione 76 (i tag non passano dal proxy: si usano rami).
- **File dell'app:**
  - `index.html`, `app.js`, `lib.js` (UMD, provabile in Node), `style.css`;
  - `sw.js` (cache `catalogo-libri-vN`, elenco SHELL per l'uso senza rete), `manifest.json`, `version.json`;
  - `vendor/` (lettore del testo e dei codici), `icons/`, `cloudflare-sbn-worker.js`;
  - `LEGGIMI.txt` (guida completa), `REGISTRO_MODIFICHE.md` (novità per versione, mostrate anche dentro l'app), `.nojekyll`.

## Regole di lavoro concordate con Piero

- **Lingua:** rispondere sempre in italiano, semplice e concreto.
- **Pubblicazione:** si implementa, si prova e si pubblica direttamente su `main`. Ogni pubblicazione alza il numero di versione e il numero va detto a Piero.
- **Registro:** a ogni versione va aggiunta in cima a `REGISTRO_MODIFICHE.md` la voce `## Versione N · gg/mm/aaaa`. Se serve, si aggiorna anche `LEGGIMI.txt`.
- **Prima di pubblicare:** girano **tutte** le prove (`node esegui.js`). Per ogni novità serve una prova nuova o aggiornata, salvata anche nel ramo `prove`.
- **Commit:** i messaggi finiscono con le righe di attribuzione indicate dalla sessione (Co-Authored-By e link alla sessione).
- **Privacy:** l'indirizzo email di Piero non va mai mandato a servizi esterni né messo nei file.
- **Materiali separati:** prove e materiali restano fuori da `main`, così un eventuale APK contiene solo l'app.
- **Proposte:** quando chiede «proponimi», si propone senza modificare nulla, con esempi e anche immagini.

## Scelte già fatte (da non disfare senza chiedere)

- **Messaggi:** i messaggi in basso (toast) sono brevi; con «Annulla» durano 4 secondi. Prima di eliminare, anche un solo libro, si chiede conferma.
- **Prezzo:** «Prezzo (facoltativo)» si chiede dopo ogni libro, a mano: niente lettura del prezzo dalla fotocamera. Salvandolo suona il «fatto» (`chime()`), diverso dal bip della scansione.
- **Fotocamera e testo:** la fotocamera dentro l'app usa sempre quella posteriore. La lettura del testo delle citazioni parte solo su richiesta (c'è l'opzione per renderla automatica).
- **Navigazione:** si esce premendo due volte Indietro. Si apre una sola scheda alla volta; Indietro chiude prima le finestre in primo piano.
- **Stati del libro:** «Presta, vendi o regala» con Prestato, Venduto e Regalato (Smarrito solo per i libri vecchi).
- **Donazioni:** link `https://www.paypal.me/PieroRagusa907`, importi 2, 3 e 5 € più «Altro».
  - La riga in cima all'elenco compare dopo 5 accessi; la × la nasconde per 10 giorni.
  - Il riquadro compare ogni 50 libri: «Più tardi» = 10 giorni, oppure «Non chiedere più».
  - Al ritorno da PayPal: con almeno 20 secondi passati lì, pausa di 3 mesi, altrimenti 10 giorni. Non esiste un pulsante «Ho donato».
- **Foto della copertina non trovata:** si apre subito «Scrivi titolo e autore», già riempita con il testo letto.
- **Vista compatta:** «Titolo, N» quando il volume della serie è compilato.
- **Foto di un libro:** con una foto sola si apre «Riconosco il libro» con la percentuale, poi da sola il passo giusto: prezzo, scelta poi prezzo, oppure titolo, autore e prezzo a mano. La fotocamera avvisa con poca luce e mette a fuoco col tocco.
- **Menu laterale:** largo due terzi. Dal bordo e dalla linguetta apre il menu (Filtri e ordine, Tutte le citazioni, Statistiche, Impostazioni), mai direttamente i filtri. Il pulsante «Filtri» apre la pagina dei filtri.
- **Vista all'apertura:** Copertine (predefinita) o Elenco, in Opzioni › Aspetto. Le prove usano `?vista=elenco`.
- **Tastiera:** `enterkeyhint="done"` sui campi singoli («Fatto», non «Succ.»).
- **Suoni:** accesi di predefinito; si spengono in Opzioni › Aspetto o con 🔊/🔇 nella fotocamera (la vibrazione resta).
- **Backup:** pulsanti «Fai il backup e mandalo su Drive, email…» (consigliato) e «Fai il backup sul telefono (Download)».
- **Finestre dal basso:** si chiudono anche trascinandole giù (maniglia in cima).

## In sospeso (idee concordate, da non costruire finché Piero non lo chiede)

- **«Il tuo anno in libri»**, stile Spotify Wrapped: schermate a storie (apertura; libri e pagine lette, mese più letto, obiettivo; genere e autore dell'anno; libro più lungo e voto più alto; citazione dell'anno, libri nuovi, a chi hai prestato di più; riassunto da condividere come immagine). Proposta mostrata il 14/11/2026; restano da decidere il periodo (anno in corso o anche passati / «da sempre»), le schermate e quando mostrarlo (da Statistiche, invito a dicembre). Limite: conta come letto nell'anno solo un libro con la data di lettura.
- **Statistiche con una parte di «intrattenimento»** (proposta del 14/11/2026, approvata come idea: «conserva queste idee»). Da costruire solo quando Piero lo chiede.
  1. **Traguardi (badge da collezionare):** griglia di medaglie, colorate se conquistate, grigie con barra di avanzamento se da prendere; piccolo festeggiamento quando se ne conquista una.
     - Biblioteca: 10, 50, 100, 250, 500 libri catalogati.
     - Lettore: primo libro letto, poi 10, 25, 50; «Maratoneta» (libro di oltre 800 pagine letto); «Divoratore» (3 libri in un mese).
     - Esploratore: 5 generi diversi letti, 10 autori diversi, libri di 5 decenni diversi.
     - Collezionista: una serie completa (campi Serie e Volume); «Fan di…» (10 libri dello stesso autore).
     - Citazioni: la prima, poi 25; la prima foto evidenziata.
     - Ordine: tutti i libri con lo scaffale, nessun «Da verificare», tutte le pagine compilate (spinge a completare i dati).
  2. **Sfide e obiettivi:** obiettivo annuale con il ritmo («sei avanti di 2 libri» / «ti mancano 3 libri in 6 settimane»); sfida del mese che cambia da sola («Finisci un libro iniziato», «Leggi un genere che non leggi mai», «Dai un voto ai libri letti», «Aggiungi le pagine ai libri che non le hanno»); serie di settimane di fila con almeno un libro letto o aggiunto.
  3. **Curiosità sulla libreria**, una diversa a ogni apertura: altezza della libreria impilata (circa 0,05 mm a pagina più le copertine), tempo per leggere i «da leggere» a 20 pagine al giorno, libro più vecchio, decennio preferito.
  4. **Il wrap** usa gli stessi dati e diventa il racconto di fine anno.
  - Da decidere: tono (giocoso con nomi simpatici e festeggiamenti, oppure sobrio da diario di lettura) e posizione (dentro Statistiche oppure voce «Traguardi» a sé nel menu, accanto a Statistiche).
