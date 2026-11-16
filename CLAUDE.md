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
- **«Aggiornato in questa versione» (prova 94.18):** dopo un aggiornamento l'app mostra le righe del registro (della prova, nella copia di prova) delle versioni nuove: **prima le righe che cominciano in grassetto**, poi le altre. Quindi nel registro: la novità principale comincia con `**…**`, le correzioni e i ritocchi senza grassetto.
- **Registro della copia di prova (dal 15/11/2026):** `REGISTRO_PROVA.md` sta solo nel repository della prova e lo scrive `pubblica_prova.py`: ogni pubblicazione aggiunge in cima `## Prova V.n · gg/mm/aaaa hh:mm` (n riparte da 1 a ogni versione vera) con una riga per ogni nota passata (`python3 pubblica_prova.py "nota 1" "nota 2"`). Scrivere le note per Piero, chiare, con il grassetto sulla novità. Nell'app di prova il registro compare sopra quello della versione vera; in fondo al Menu «prova V.n del …». **Quando si porta nella versione vera** (richiesta di Piero, 15/11/2026): nella voce `## Versione N` di `REGISTRO_MODIFICHE.md` vanno le modifiche **effettivamente portate**, prese dal registro della prova e riscritte come stato finale (niente cose provate e poi tolte, come B/C/D o gli avvisi di prova; niente passaggi intermedi).
- **Prima di pubblicare (regola cambiata con Piero il 15/11/2026):** prima della **copia di prova** bastano le prove veloci, `node esegui.js --veloce eNN …` (libreria + gruppo di controllo + le prove della parte toccata, 1-2 minuti); prima della **versione vera** girano **tutte** (`node esegui.js`, due alla volta, circa 9 minuti). Per ogni novità serve una prova nuova o aggiornata, salvata anche nel ramo `prove`.
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
- **Disposizione dello schermo (modulo `layout`, nella prova dal 15/11/2026):** la **A è la disposizione dell'app** (16/11/2026: tolta la scelta in Opzioni › Aspetto, e anche «Avvisi in cima uno alla volta»: gli avvisi sono sempre uno alla volta). La classica resta nel codice **solo per le prove su localhost**: lì è la predefinita e si cambia con `NLLayout.set(v)` (la scelta salvata in `catalogo-libri-layout` vale solo su localhost). Nella A gli avvisi stanno sopra la ricerca, uno alla volta, da scorrere col dito. Prova e2e65.
- **Modulo temporaneo `avvisi-prova`:** tolto il 16/11/2026 (non e' mai andato nella versione vera).
- **Scheda aperta del libro (modulo `schede`, nella prova dal 15/11/2026):** la **D, «Pagina del libro», è la scheda dell'app** (16/11/2026: tolta la sezione in Opzioni). «Classica» resta **solo per le prove su localhost** (predefinita lì; `NLCard.set(v)`). Nei Desideri la scheda ha anche preferito e «Presta, vendi o regala» (`loanBtn`/`favBtn` senza `!b.w`). Usa `NL.on('rows', el)` (emesso da `renderList` e `refreshRow`): sposta i pulsanti e i campi veri dell'app, non li rifà. Prova e2e71.
- **Schede «Non trovato» (senza titolo), 16/11/2026:** si aprono da sole **una volta sola**, appena aggiunte in questa sessione (`S[id]` presente, ricordato in `autoOpened`). Prima si aprivano tutte insieme a ogni ridisegno dell'elenco (filtro tolto, Copertine→Elenco, riapertura dell'app): Piero dice che è sbagliato. Prova e2e66.
- **Riepilogo in alto (nel codice dell'app, non nel modulo):** valore in euro e «non più in libreria» spenti di predefinito (`settings.sumEur`, `sumGone`), «N in prestito» acceso e toccabile (`sumLoan`), «Salvato su questo telefono» nascondibile (`showSync`; gli errori restano). Nei Desideri il totale resta.

## In sospeso

Le idee e i problemi che Piero ha chiesto di tenere in sospeso stanno in **`IN_SOSPESO.md`**, in questa stessa cartella:
- fotocamera e luce (torcia e flash che non funzionano sul suo telefono);
- (il wrap ora è il modulo «Il tuo trimestre in libri», nella copia di prova);
- la parte di intrattenimento delle Statistiche (traguardi, sfide, curiosità);
- le cose da verificare sul telefono.

Leggerlo all'inizio di ogni sessione. Non costruire nulla di quell'elenco finché Piero non lo chiede; quando lo chiede, ripartire da lì e aggiornare il file.
- **Menu laterale (16/11/2026):** in alto Filtri, Suggerimenti, Citazioni, Statistiche (+ trimestre); poi «La tua libreria» (Sistema l'elenco, Backup ed esportazione con «Ultimo backup» dentro la voce, `#optBackupHint`); poi la voce **«Impostazioni»** (`#goSettings`, `#setList`) che apre/chiude Aspetto, Ricerca dei libri, Schede e prezzo, Condivisione, App; poi Sostieni e la versione (Piero: «Sostieni e info versione manteniamole dove sono»). Dal Menu le impostazioni partono chiuse; dall'ingranaggio in alto (`#btnOpts`) già aperte; tornando da una voce (freccetta) restano aperte. I testi dell'app dicono «Menu › Impostazioni › …». Prova e2e72.
- **Impostazioni riordinate (16/11/2026):** Aspetto = Tema, Colori, Caratteri (vicini), Torna all'aspetto predefinito, All'apertura mostra, Riepilogo in alto (+ trimestre del modulo `wrap`, agganciato a `.sum-opts`). «Schede e prezzo» diventa **«Aggiunta dei libri»** (`data-sec="cards"`): Chiedi il prezzo, Suoni (spostato da Aspetto), Fotocamera del telefono, «Fotocamera e luce» (spostata da App). «App» diventa **«Installazione sul telefono»** (`data-sec="app"`) con una frase che spiega a cosa serve. **Tolte** (comportamento fisso): schede sempre aperte (`openAll` solo su localhost per le prove vecchie), scaffale/genere/pagine/note (`extra` sempre vero), lettura automatica delle foto delle citazioni (`quoteOcrAuto` falso; il codice resta).
- **Autore (16/11/2026):** Wikipedia accetta qualsiasi mestiere (`AU_WORDS` largo: fotografo, cuoco…), ma con nomi ambigui vince chi scrive (`AU_WRITE`). Foto dall'anteprima di Wikipedia (`thumbnail`, solo upload.wikimedia.org) accanto al nome; toccandola si ingrandisce. Prova e2e49.
- **Statistiche (16/11/2026):** toccare autore, casa editrice, genere o scaffale apre un **filtro** vero (`applyFacet`), che si vede tra i filtri; le serie restano una ricerca. Prova e2e6.
- **Lettura e voto nella «Pagina del libro» (16/11/2026):** tra cinque proposte (A-E, provate e tolte) Piero ha tenuto la **C**: striscia a tutta larghezza subito sotto copertina e titolo, tra due righe sottili; stato su tutta la riga, sotto le stelle e «Letto il» sulla stessa riga. Prova e2e71.
- **Filtri sempre visibili (16/11/2026):** anche «In prestito» (dal riepilogo) e «Da verificare» hanno la pillola con la × sotto la ricerca. `history.scrollRestoration = 'manual'` e `applyFacet` scorre in cima senza animazione (sul telefono il filtro da un'etichetta finiva a metà elenco). «Conferma del salvataggio» spenta di predefinito (`syncOff`).
- **Versione 95 (16/11/2026):** portato sulla versione vera tutto quanto provato da 94.1 a 94.33 (moduli wrap, layout, schede compresi; avvisi-prova no). Registro e LEGGIMI aggiornati con le sole cose tenute. La prova riparte da 95.1.
- **«Cosa c'è di nuovo» (16/11/2026):** la pagina dopo un aggiornamento mostra, per ogni versione nuova, le righe **«> …» (In breve)** scritte in cima alla sezione del registro, in parole semplici («> **Titolo** una frase»); se mancano, solo i titoli in grassetto. Nel registro dentro l'app le righe «>» non si vedono. **A ogni versione vera vanno scritte 2-6 righe «>».** Compare anche a chi aggiorna (ha libri e impostazioni salvate da una versione precedente: `oldApp` = c'è `look`); `wn2` segna chi l'ha già vista (nella 95 vera non compariva a chi arrivava dalla 94). Prova e2e70.
- **Triangolino (16/11/2026):** c'è quando ci sono avvisi, aperti o chiusi (`openNotices()` + `closedNotices()`); toccato porta in cima, fa lampeggiare l'avviso e riapre i chiusi. Un MutationObserver su `main` lo aggiorna quando un avviso compare o sparisce. Prova e2e68.
- **Stagioni (16/11/2026, solo nella prova finché Piero non approva):** il wrap segue le stagioni a mesi interi (inverno dic-feb, primavera mar-mag, estate giu-ago, autunno set-nov), chiavi `AAAA-S1..S4` (l'inverno 2027 = dic 2026-feb 2027). «La tua stagione in libri», «Riepilogo di ogni stagione». Prova e2e64.
- **Salvataggi delle versioni (16/11/2026):** da questa sessione GitHub non permette tag né release (403). Un salvataggio è un **ramo** nel repository vero: `salvataggio-v96` = versione 96 (commit 2cf4738). Per tornarci: `git push -f origin salvataggio-v96:main` (solo se Piero lo chiede). Si manda a Piero anche lo zip (`git archive --prefix=next-libris-vNN/`).
- **Voto a libricini (prova 96.2, 16/11/2026):** al posto delle stelle (si confondevano con la stella del preferito) cinque libricini con la parola: Non mi è piaciuto, Così così, Bello, Bellissimo, Capolavoro (`L.RATE_WORDS`, `L.rateWord` in lib.js; `RATE_BOOK` in app.js; i pulsanti restano `.star.bk` per le prove). La parola compare anche nell'elenco («Letto · Bellissimo»), nelle statistiche («4,0 su 5», «voto medio: bellissimo»), nella stagione in libri e nei suggerimenti. **PROVA TEMPORANEA:** due disposizioni in cima ad Aspetto (`#optRtPos`, `catalogo-libri-rtpos`, `html[data-rtp]`): A al centro con la parola sotto, B a sinistra con la parola a destra. Quando Piero sceglie, togliere la scelta. Prova e2e71, e2e9.
