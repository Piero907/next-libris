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

## In sospeso

Le idee e i problemi che Piero ha chiesto di tenere in sospeso stanno in **`IN_SOSPESO.md`**, in questa stessa cartella:
- fotocamera e luce (torcia e flash che non funzionano sul suo telefono);
- il wrap «Il tuo anno in libri»;
- la parte di intrattenimento delle Statistiche (traguardi, sfide, curiosità);
- le cose da verificare sul telefono.

Leggerlo all'inizio di ogni sessione. Non costruire nulla di quell'elenco finché Piero non lo chiede; quando lo chiede, ripartire da lì e aggiornare il file.
