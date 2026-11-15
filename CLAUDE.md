# Next Libris: note per lavorare sull'app

Questo file sta nel ramo `prove`, separato dall'app. Il README.md accanto spiega come preparare ed eseguire le prove e come sono fatte.

## Il progetto

- **Cos'è:** Next Libris, PWA in JavaScript puro (nessun framework, nessuna compilazione) per catalogare la libreria di casa. L'utente è Piero, italiano, e la usa su un telefono e un tablet Android.
- **Repository:** `Piero907/next-libris`.
  - Ramo `main`: l'app, pubblicata su GitHub Pages: https://piero907.github.io/next-libris/
  - Ramo `prove`: prove automatiche, materiali e strumenti; non fa parte dell'app.
  - Ramo `versione-76`: punto di salvataggio della versione 76 (i tag non passano dal proxy: si usano rami).
- **Copia di prova:** repository `Piero907/next-libris-prova` (GitHub Pages: https://piero907.github.io/next-libris-prova/). Ha dati separati e l'etichetta PROVA, e si pubblica con `pubblica_prova.py` (vedi il README).
- **File dell'app:**
  - `index.html`, `app.js`, `lib.js` (UMD, provabile in Node), `style.css`;
  - `sw.js` (cache `catalogo-libri-vN`, elenco SHELL per l'uso senza rete), `manifest.json`, `version.json`;
  - `vendor/` (lettore del testo e dei codici), `icons/`, `cloudflare-sbn-worker.js`;
  - `LEGGIMI.txt` (guida completa), `REGISTRO_MODIFICHE.md` (novità per versione, mostrate anche dentro l'app), `.nojekyll`.

## Regole di lavoro concordate con Piero

- **Lingua:** rispondere sempre in italiano, semplice e concreto.
- **Pubblicazione (dal 15/11/2026):** ogni novità va **prima nella copia di prova** (`pubblica_prova.py`) e Piero la prova sul telefono. Quando dice che va bene, si pubblica su `main` della versione vera. Ogni pubblicazione nella versione vera alza il numero di versione, e il numero va detto a Piero.
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
- **Suggerimenti (v94):** menu › Suggerimenti, schede «Cosa leggere dopo» (locale, `L.nextReads`) e «Da scoprire» (Google, `catalogo-libri-sugg`, solo italiano di predefinito, automatica ogni 7 giorni); riquadro in cima dopo un libro finito.
- **Moduli staccabili:** una novità che potrebbe non andare nella versione vera si fa come **modulo** in file suoi (`NOME.js`, `NOME.css`) che usa solo `window.NL` (attacco in fondo ad `app.js`: `NL.on('list'|'menu'|'options', fn)`, più libri, impostazioni, toast…). Righe in `index.html` e nomi in `SHELL` di `sw.js` con il commento `// modulo:`. Si toglie con `APP_DIR=… python3 togli_modulo.py NOME`. `pubblica_prova.py` copia i moduli (lista `MODULES`) e li cancella dalla prova se non ci sono più. **Nella pubblicazione su `main` vanno copiati anche i file dei moduli.**
- **Wrap «Il tuo trimestre in libri» (modulo `wrap`, nella prova dal 15/11/2026):** ogni tre mesi, opzione in Aspetto (predefinito sì), dati in `catalogo-libri-wrap`. Prova e2e64.
- **Disposizione dello schermo (modulo `layout`, nella prova dal 15/11/2026):** solo Classico e A (Piero ha scelto la A; B, C, D tolte). Nella A gli avvisi stanno sopra la ricerca e si vedono uno alla volta (opzione). Opzioni in Aspetto; dati in `catalogo-libri-layout`. Predefinita: A nella copia di prova, Classico altrove (così le prove vecchie, su localhost, restano valide). Prova e2e65.
- **Riepilogo in alto (nel codice dell'app, non nel modulo):** valore in euro e «non più in libreria» spenti di predefinito (`settings.sumEur`, `sumGone`), «N in prestito» acceso e toccabile (`sumLoan`), «Salvato su questo telefono» nascondibile (`showSync`; gli errori restano). Nei Desideri il totale resta.

## In sospeso

Le idee e i problemi che Piero ha chiesto di tenere in sospeso stanno in **`IN_SOSPESO.md`**, in questa stessa cartella:
- fotocamera e luce (torcia e flash che non funzionano sul suo telefono);
- (il wrap ora è il modulo «Il tuo trimestre in libri», nella copia di prova);
- la parte di intrattenimento delle Statistiche (traguardi, sfide, curiosità);
- le cose da verificare sul telefono.

Leggerlo all'inizio di ogni sessione. Non costruire nulla di quell'elenco finché Piero non lo chiede; quando lo chiede, ripartire da lì e aggiornare il file.
