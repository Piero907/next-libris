# Next Libris: prove automatiche

Questo è il ramo `prove` del repository `Piero907/next-libris`. Le regole di lavoro sono in `CLAUDE.md`, le idee e i problemi in sospeso in `IN_SOSPESO.md`. Contiene **solo** le prove automatiche, i materiali che usano (foto e video finti) e gli strumenti di lavoro. **Non contiene l'app.**

- L'app vera sta nel ramo `main` e si pubblica su **https://nextlibris.github.io/** (repository `nextlibris/nextlibris.github.io`, con `pubblica_vera.py`); il vecchio indirizzo https://piero907.github.io/next-libris/ (servito da `main`) fa solo il trasloco. Il codice della copia di prova sta nel ramo `prova`.
- Questo ramo non ha file in comune con `main` (è un ramo «orfano»). Così nulla di quanto c'è qui finisce nel sito o nell'app.

## Preparazione

Le prove si aspettano i due rami estratti uno accanto all'altro:

```
cartella/
  next-libris/         ramo main  (l'app)
  next-libris-prove/   ramo prove (questo)
```

```bash
git clone https://github.com/Piero907/next-libris.git
cd next-libris
git worktree add ../next-libris-prove prove      # oppure: git clone -b prove ... ../next-libris-prove
cd ../next-libris-prove
npm install                                      # solo puppeteer-core (non scarica browser)
```

Servono Node.js 18 o più recente e Google Chrome (o Chromium) installato. `_config.js` cerca Chrome nei percorsi soliti di Linux, macOS e Windows.

Variabili d'ambiente facoltative:

| Variabile | A cosa serve | Predefinito |
|---|---|---|
| `APP_DIR` | cartella dell'app da provare (per esempio una copia di lavoro non ancora pubblicata) | `../next-libris` |
| `PROVE_OUT` | dove finiscono schermate, PDF, file di backup di prova e resoconti | `<tmp>/next-libris-prove` |
| `CHROME` | percorso di Chrome/Chromium | ricerca automatica |

## Eseguire le prove

```bash
node esegui.js                    # tutte, due alla volta (circa 9 minuti); prima della versione vera
node esegui.js --veloce e2e65     # libreria + gruppo di controllo + quelle indicate (circa 1-2 minuti); prima della copia di prova
node esegui.js e2e53 e2e52        # solo alcune
node esegui.js --paralleli=1      # una alla volta, come prima (circa 14 minuti)
node esegui.js --solo-unita       # solo le prove della libreria lib.js (pochi secondi)
APP_DIR=/percorso/copia node esegui.js
```

`esegui.js` stampa `OK`/`FAIL` per ogni prova e il tempo impiegato. Il resoconto completo di ogni prova va in `<PROVE_OUT>/log/<nome>.log`, e alla fine elenca quelle fallite.

- **Due alla volta:** le prove nel browser girano a coppie (`--paralleli=N` per cambiare). La seconda della coppia usa le porte spostate di 1000 (`PROVE_SLOT=1`, vedi `CFG.port`).
- **Da sole:** le prove sensibili ai tempi (elenco `DA_SOLE` in `esegui.js`: e2e8, 30, 35, 37, 40, 42, 43, 44, 55) girano da sole, alla fine.
- **Ripetizione:** una prova fallita viene ripetuta una volta, da sola; se passa, conta come superata e il riepilogo lo dice («Passate alla seconda»). Se fallisce di nuovo, è un errore da guardare.
- **`--veloce`:** prove della libreria + gruppo di controllo `FUMO` (e2e, 5, 6, 7, 10, 15, 56, 62: aggiunta dei libri, schede, prestiti ed esportazione, menu e opzioni, copia di prova) + le prove indicate (quelle della parte toccata). Si può anche lanciare una prova da sola con `node e2e53.js`.

**Prove sensibili ai tempi.** e2e8, e2e35, e2e40, e2e42 e e2e44 ogni tanto falliscono per lentezza della macchina (fotocamera finta, pressione lunga, caricamento delle immagini). Se una di queste fallisce, prima di cercare un errore va ripetuta da sola. Un vero errore si ripete sempre.

## Copia di prova (da v93)

- **Cos'è:** una seconda copia dell'app, nel repository `Piero907/next-libris-prova` (GitHub Pages: https://piero907.github.io/next-libris-prova/), per provare le novità prima di portarle nella versione vera.
- **Dati separati:** sta allo stesso indirizzo di base della versione vera (`piero907.github.io`), quindi sul telefono condividerebbe lo stesso spazio. Per questo il codice riconosce la copia di prova dall'indirizzo (`PROVA` in app.js e sw.js) e usa nomi suoi:
  - `prova:` davanti alle chiavi di localStorage;
  - il database `prova-catalogo-libri`;
  - le copie offline `prova-catalogo-libri-vN`, e ogni service worker cancella solo le proprie.

  Mostra l'etichetta PROVA accanto al titolo. La prova e2e62 controlla tutto questo.
- **Pubblicarla:** `python3 pubblica_prova.py "nota"`. Copia l'app in `../next-libris-prova` (o in `PROVA_DIR`), mette il manifest da prova («Next Libris (prova)», colore diverso), fa il commit e il push. Le righe di attribuzione dei commit si passano in `ATTRIBUZIONE`.
- **Flusso concordato con Piero:** ogni novità va prima nella copia di prova. Quando lui dice che va bene, si porta nella versione vera (numero di versione, registro, prove, come sempre).

## Copia social (16/11/2026, non c'è più)

La terza copia («social», `pubblica_social.py`, ramo `social`) è servita a costruire account e amici; dal 16/11/2026 tutto è nella prova e la copia social non si usa più. Il riconoscimento delle copie dall'indirizzo (`COPIA` in app.js e sw.js: `…/next-libris-NOME/` → prefisso `NOME:`) è rimasto generale.

## Flusso di lavoro per ogni nuova versione

1. Modificare i file dell'app (`app.js`, `index.html`, `style.css`, `lib.js`, `sw.js`…) in una copia di lavoro.
2. Scrivere o aggiornare una prova `e2eNN.js` per la novità: nuovo numero, nuova porta (la prossima libera, vedi in fondo; scritta come `.listen(CFG.port(NNNN))` e `'http://localhost:' + CFG.port(NNNN) + '/…'`) e una riga di commento iniziale che dica cosa prova.
3. Aggiornare `REGISTRO_MODIFICHE.md` (nuova voce `## Versione N · gg/mm/aaaa` in cima) e, se serve, `LEGGIMI.txt`.
4. Alzare la versione: `python3 nuova_versione.py N "breve nota"`. Cambia insieme `APP_VERSION` in `app.js`, `version.json` e il nome della cache in `sw.js` (`catalogo-libri-vN`).
5. Prove: per la **copia di prova** basta `node esegui.js --veloce eNN …` con le prove della parte toccata; per la **versione vera** sempre **tutte** (`node esegui.js`). Se un cambiamento voluto rompe una prova vecchia, si aggiorna la prova e lo si dice.
6. Portare il codice nel ramo `main` (unione veloce di `prova`), fare il commit (con le righe di attribuzione richieste) e il push; poi `pubblica_vera.py` copia l'app nel sito https://nextlibris.github.io/ (repository `nextlibris/nextlibris.github.io`).
7. Fare il commit anche qui nel ramo `prove` delle prove nuove o cambiate.

Nella prima riga dei file di prova c'è `const CFG = require("./_config")`. I percorsi passano sempre da `CFG.APP`, `CFG.IMG`, `CFG.OUT` e `CFG.CHROME`: niente percorsi scritti a mano.

## Come sono fatte le prove

**Prove della libreria** (`test_*.js`, `test_worker.mjs`): Node puro con `assert`. Caricano `lib.js` dall'app (è UMD, funziona anche in Node) o il worker SBN (`cloudflare-sbn-worker.js`).

**Aiutante comune** (`_harness.js`, 17/11/2026): `const H = require('./_harness')` subito dopo `_config`.
- `H.serve(CFG.port(NNNN), ROOT)`: il server dei file dell'app (prima ~10 righe ripetute in ogni prova). Le prove con un server speciale (Supabase finto, percorsi `/next-libris-prova/`, errori voluti) tengono il loro.
- `const wait = H.wait`: **attesa «finché»**. `wait(ms)` torna appena nella pagina non c'è più niente in corso che arriverebbe entro `ms` (timer, rete, immagini, IndexedDB, `toBlob`, FileReader, animazioni CSS), poi aspetta due fotogrammi; al massimo `ms`, come prima. Le pagine aperte con `browser.newPage()` si preparano da sole. `H.sleep(ms)` è l'attesa fissa vera; `PROVE_ATTESE=fisse node esegui.js` rimette le attese fisse dappertutto (per capire se un errore dipende dai tempi); `PROVE_ATTESE=debug node e2eNN.js` stampa quanto si è aspettato e perché. Se una prova aspetta qualcosa che il contatore non vede, lì si usa `H.sleep(ms)`.
- **Moduli:** una prova che ha bisogno di file dell'app che non ci sono sempre lo scrive nelle prime righe, `// moduli: amici, notifiche`; `esegui.js` la salta se l'app non li ha (per esempio sulla vera, che non ha notifiche.js). Una prova può anche saltarsi da sola uscendo con il codice 77 (e2e27 senza le foto vere in `FOTO_PB`).

**Prove nel browser** (`e2e*.js`): ognuna fa le stesse cose.

- **Server e telefono:** avvia un piccolo server HTTP sulla sua porta che serve la cartella dell'app, poi apre Chrome senza finestra (`puppeteer-core`, `headless: 'new'`) con uno schermo da telefono: 390×844, `isMobile`, `hasTouch`.
- **Rete simulata:** con `page.setRequestInterception(true)` le chiamate verso Google Libri, Open Library, Wikipedia, il worker SBN e le copertine ricevono risposte preparate nella prova. Le prove non dipendono da internet e possono simulare «nessun risultato», errori 429/500 o niente rete (`page.setOfflineMode`).
- **Fotocamera finta:** Chrome parte con `--use-fake-device-for-media-stream --use-file-for-fake-video-capture=<video>.mjpeg`. Per le foto da file: `elementHandle.uploadFile(CFG.IMG + '/cover.jpg')` sugli input `#fileCam`, `#fileGal`, `#fileCover` e `#fileBackup`.
- **Agganci dell'app per le prove:** `window.__app` (stato, impostazioni, `addIsbn`, `addPhotos`, `setTab`, `openOptions`, `openDrawer`, `openManual`, `donBack`, `chimes()`, `sounds()`…) e `window.__ped` (editor delle foto). Si usano per preparare situazioni e leggere lo stato; le azioni vere si fanno con clic e tasti come un utente.
- **Vista dell'elenco:** dalla versione 84 l'app si apre con le copertine. Le prove aprono l'app con `?vista=elenco` nell'indirizzo (vista elenco per quell'apertura), perché quasi tutte lavorano sulle righe dell'elenco. Una prova nuova che vuole le copertine usa l'indirizzo senza parametro o `?vista=copertine`.
- **Dati salvati:** l'app tiene libri e impostazioni in `localStorage` (`catalogo-libri-v2`, `catalogo-libri-set`) e copertine e foto in IndexedDB. Per partire da dati preparati serve un accorgimento. All'uscita la pagina salva sopra i suoi dati, quindi prima di ricaricare si scrivono i dati e si blocca `Storage.prototype.setItem` per quelle due chiavi, poi `page.reload()` (vedi `load()` in e2e52.js).
- **Visibilità della pagina** (ritorno da PayPal, accessi): si simula ridefinendo `document.visibilityState` e lanciando l'evento `visibilitychange` (e2e52.js).
- **Controlli:** con `assert`; ogni prova controlla anche che non ci siano errori JavaScript (`page.on('pageerror')`). Le schermate vanno in `CFG.OUT` e servono a guardare il risultato.
- **Esito:** l'ultima riga è `eNN OK`, altrimenti `FAIL` con l'errore e uscita con codice 1.

## Catalogo delle prove

| Prova | Porta | Cosa controlla |
|---|---|---|
| test_lib.js | – | lib.js: ISBN, lettura delle risposte delle banche dati, testo della copertina, prezzi, serie, descrizioni |
| test_sbn.js | – | lettura dei record del catalogo SBN |
| test_new.js | – | funzioni aggiunte a lib.js (case editrici, unione dei doppioni…) |
| test_order.js | – | ordinamenti dell'elenco |
| test_worker.mjs | – | worker Cloudflare per SBN |
| e2e.js | 8123 | aggiunta a mano, ISBN non valido o non trovato, foto del codice, foto della copertina |
| e2e2.js | 8124 | foto della copertina: sporca, ambigua (scelta), nessun risultato, illeggibile; errori, offline, doppioni, elenco di ISBN |
| e2e3.js | 8124 | limiti di Google (429), diagnosi del servizio, riprova |
| e2e4.js | 8125 | libro non trovato, editore dedotto dal prefisso ISBN (mai inventato) |
| e2e5.js | 8126 | riquadro del prezzo dopo una foto: prima e dopo il riconoscimento, Salta |
| e2e6.js | 8128 | genere e pagine automatici, scaffale e note, prestito, esportazione e backup |
| e2e7.js | 8132 | schede chiuse e aperte, copertina nella riga, tastiera |
| e2e8.js | 8134 | copertine grandi: Google, Open Library, la tua foto; backup con copertine |
| e2e9.js | 8135 | avvio, promemoria del backup, offline e rete debole, stampa PDF |
| e2e10.js | 8136 | doppioni e copie, Annulla, «Unisci i doppioni» |
| e2e11.js | 8141 | gesto per aprire il pannello dei filtri |
| e2e12.js | 8127 | «Ce l'ho già?»: scansione di controllo |
| e2e13.js | 8142 | case editrici: avviso, copia dai tuoi libri |
| e2e14.js | 8128 | Foto: fotocamera o galleria, più foto insieme |
| e2e15.js | 8143 | menu laterale e pagine delle Opzioni, Indietro |
| e2e16.js | 8144 | «Vedi tutti i libri di», filtro per autore |
| e2e17.js | 8146 | tema chiaro/scuro, palette e caratteri dopo il riavvio |
| e2e18.js | 8147 | sposta tra Libreria e Desideri, Annulla |
| e2e19.js | 8148 | aggiornamento disponibile, avviso, versione dell'app |
| e2e20.js | 8149 | barra che scorre, scheda sotto la barra |
| e2e21.js | 8129 | Desideri: «Cerca per titolo» e aggiunta |
| e2e22.js | 8130 | installazione su Android, Indietro sul foglio |
| e2e23.js | 8133 | worker SBN e chiave Google: campi, contatori, Cancella |
| e2e24.js | 8135 | tema predefinito, backup delle impostazioni, backup vecchi |
| e2e25.js | 8136 | copertina: stessa edizione o altra edizione, «Non è questa» |
| e2e26.js | 8139 | pulsanti della scheda aperta: prestato, venduto, non trovato, desideri |
| ~~e2e27.js~~ | — | tolta nel giro 7 (lettura del prezzo dalle foto non c'è più) |
| e2e28.js | 8144 | preferiti, condivisione di un libro e di una lista, link ricevuto |
| e2e29.js | 8145 | filtri e schede compatte; uscita dalla fotocamera |
| e2e30.js | 8147 | schermata d'apertura nell'app installata |
| e2e31.js | 8148 | condividere chiave Google e worker (link «#k=») |
| e2e32.js | 8149 | rete lentissima: avvio dalla copia sul telefono entro ~3 s |
| e2e33.js | 8150 | aggiornamenti in sottofondo, mai file di versioni diverse (copia l'app in `PROVE_OUT/site33`) |
| e2e34.js | 8151 | «Descrizione» nella scheda: ricerca, fonti, errori, lingua |
| e2e35.js | 8152 | ricerca nelle descrizioni, obiettivo di lettura, serie, novità degli autori, citazioni |
| e2e36.js | 8153 | «Leggi tutte le citazioni», filtro «Con citazioni» |
| e2e37.js | 8154 | citazioni con foto; Indietro; due volte Indietro per uscire |
| e2e38.js | 8155 | condividere le citazioni |
| e2e39.js | 8156 | tastiera: campo visibile, barra nascosta; «Cerca sul web» |
| e2e40.js | 8157 | selezione multipla: pressione lunga, elimina con conferma, modifiche di gruppo |
| e2e41.js | 8159 | riquadro «Libro aggiunto» con prezzo facoltativo |
| e2e42.js | 8160 | fotocamera dentro l'app (sempre quella posteriore) |
| e2e43.js | 8161 | editor delle foto, in quattro parti (prima e2e43, e2e44, e2e48, e2e50): evidenziatore, penne, annulla; zoom con due dita; gomma e adesivi; maniglie per grandezza e rotazione |
| e2e45.js | 8163 | descrizione cercata da sola; senza rete in sospeso e ripresa |
| e2e46.js | 8165 | numerazione personalizzata della serie |
| e2e47.js | 8166 | durata dei messaggi (brevi; con Annulla 4 s) |
| e2e49.js | 8168 | autore: profilo Wikipedia, matita, ricerca, i suoi libri; fotografo trovato con la foto (si ingrandisce), omonimo: vince chi scrive |
| e2e51.js | 8170 | novità delle versioni dentro l'app, anche senza rete |
| e2e52.js | 8171 | donazioni: riga dopo 5 accessi, promemoria ogni 50 libri, PayPal, soglia di 20 s |
| e2e53.js | 8173 | foto della copertina non trovata: titolo e autore a mano; volume accanto al titolo; suono del prezzo |
| e2e54.js | 8174 | tastiera: «Fatto» (non «Succ.») nei campi della scheda e delle finestre; Invio chiude la tastiera; statistiche: libri senza pagine |
| e2e55.js | 8175 | foto di un libro: finestra con l'avanzamento e passo giusto (prezzo, scelta, a mano con prezzo); fotocamera: poca luce, messa a fuoco col tocco |
| e2e56.js | 8176 | menu laterale: pagina principale, largo due terzi, «Filtri e ordine» come pagina con Indietro, pillole e «Altri…», «Sostieni» al centro; «Prestato» centrato |
| e2e57.js | 8177 | finestre dal basso: chiusura trascinando giù (non da un campo, non con contenuto scorso, corto = resta) |
| e2e58.js | 8178 | suoni: Opzioni › Aspetto e pulsante 🔊/🔇 nella fotocamera; spenti niente bip; la scelta resta |
| e2e59.js | 8179 | backup: nome del file, «Il backup non è partito» con Riprova e Download; fotocamera della scansione: torcia e flash (luce finta via getCapabilities/applyConstraints) |
| e2e60.js | 8180 | fotocamera del telefono: pulsante nella fotocamera dell'app e nella scansione, opzione «sempre», niente in «Ce l'ho già?» (usa `page.waitForFileChooser`) |
| e2e62.js | 8182 | copia di prova allo stesso indirizzo di base: dati, database, copie offline ed etichetta separati dalla versione vera; timbro della pubblicazione: «Aggiorna adesso» nella prova anche a parità di versione; numero della prova (94.n), registro della prova sopra quello vero |
| e2e63.js | 8183 | Suggerimenti: «Cosa leggere dopo» (seguito della serie, perché, Inizio questo, Un altro, niente prestati), riquadro in cima dopo aver finito un libro, «Da scoprire» (autori, generi, serie; italiano o tutte le lingue; + Desideri, No grazie), ricerca automatica settimanale. Google finto con intestazione CORS |
| e2e64.js | 8184 | Modulo «Il tuo trimestre in libri» (wrap.js/wrap.css): invito nel primo mese del trimestre (orologio finto al 5/10/2026), 6 schermate a storie con i numeri, trimestre prima, immagine 1080×1350, menu, opzione in Aspetto, Esc e Indietro; tema scuro con fondo scuro; l'app senza i file del modulo funziona uguale |
| e2e65.js | 8185 | Modulo «Disposizione dello schermo» (layout.js/layout.css): la A è quella dell'app, senza scelta nelle Opzioni (avvisi sempre uno alla volta, senza opzione; la classica solo su localhost, con `NLLayout.set`). A: barra in basso (Aggiungi, Per te, Menu), avvisi sopra la ricerca e uno alla volta (opzione), da scorrere col dito (sinistra/destra, in giro; il menu non si apre), riga Prestati solo se serve; riepilogo in alto con le opzioni (euro e «non più in libreria» spenti, «in prestito» si tocca), «Salvato» nascondibile; vecchia scelta B/C/D → A; senza modulo resta la classica |
| e2e66.js | 8186 | Dalle copertine alla scheda e ritorno: chiudendo la scheda (freccetta o Indietro) si torna alle copertine allo stesso punto; con la vista cambiata a mano resta l'elenco; le «Non trovato» non si aprono tutte insieme (Copertine→Elenco, filtro tolto con la x, riapertura) |
| e2e67.js | 8187 | Suoni della scansione: bip alla lettura; «non trovato» (due note basse) se titolo e autore non si trovano; trovato: niente in più; in sottofondo e con i suoni spenti: niente |
| e2e68.js | 8188 | Triangolino nel riepilogo: compare quando un avviso ancora valido è stato chiuso (prestiti, «Hai finito…»), accanto a «N in prestito»; li riapre tutti; non nei Desideri; nella A si riparte dal primo |
| e2e69.js | 8189 | ISBN 979-8 non trovato (pubblicazione Amazon): casa editrice «Amazon (pubblicazione in proprio)», riquadro nella scheda (Fotografa la copertina, Cerca sul web, uno solo), foto che riconosce titolo e autore tenendo il codice; i 979-8 vecchi sistemati all'avvio |
| e2e70.js | 8190 | Dopo un aggiornamento: «Aggiornato in questa versione» con le novità delle versioni nuove (prima quelle in grassetto), una volta sola, non alla prima apertura; «Tutte le novità» apre il registro. La versione per la prova è in e2e62 |
| e2e71.js | 8191 | Modulo «Scheda aperta del libro» (schede.js/.css): Pagina del libro è quella dell'app, sezione tolta dalle Opzioni (Classica solo su localhost, con `NLCard.set`); nei Desideri anche preferito e Presta, vendi o regala. Icone in alto su una riga con la matita, descrizione in 3 righe con freccetta, lettura modificabile, autore che apre la sua finestra, etichette-filtro in fondo, copertina che si ingrandisce, Presta e Cerca sul web in fondo |
| e2e72.js | 8192 | Menu laterale riordinato: «La tua libreria» (Sistema l'elenco, Backup con la data dell'ultimo), «Impostazioni» chiuse finché non le apri (Aspetto, Ricerca, Schede e prezzo, Condivisione, App), Sostieni e versione in fondo; l'ingranaggio le apre già aperte; tornando da una voce restano aperte; Aspetto (tema, colori, caratteri vicini), «Aggiunta dei libri» (prezzo, suoni, fotocamera, luce; tolte le altre opzioni), «Installazione sul telefono» |
| e2e73.js | 8193 | Due copie insieme (vera e prova; fino al 16/11 anche la social): libri, impostazioni, database delle copertine e copie offline separati; tema all'avvio letto dalla copia giusta; ogni service worker cancella solo le sue copie offline |
| e2e100.js | 8300 | Modulo «Account e sincronizzazione» (social.js, Supabase finto): voce nel Menu, accesso, copia di sicurezza prima della prima sincronizzazione, due telefoni, uscita |
| e2e102.js | 8302 | Modulo «Amici» (amici.js): parte «Amici» nel Menu, nome, ricerca, inviti, richieste |
| e2e103.js | 8303 | Amici: libreria e desideri dell'amico, «Te lo regalo io», prestiti e regali, reso da confermare |
| e2e104.js | 8304 | Amici, seconda parte: librerie visibili, «Me lo presti?», consigli |
| e2e105.js | 8305 | Modulo «Notifiche» (notifiche.js): campanella in testata solo con l'account, elenco, lette, testata a 360/412/1280 |
| e2e106.js | 8306 | Modulo «Ricerche condivise» (ricerche.js): contatore condiviso della chiave, notifica «limite», archivio comune per ISBN |
| e2e107.js | 8307 | Chiavi prestate nascoste, «Info e condivisione», Contatti |
| e2e108.js | 8308 | Modulo «Notifiche push» (push.js, sw.js): permesso, iscrizione, tipi, orari di silenzio, push simulato |
| e2e109.js | 8309 | Condivisione su misura e finestra della chiave; Libreria/Desideri nel +; scheda senza titolo su PC |
| e2e110.js | 8310 | Amici dell'amico e icona Amici nella libreria di un amico |
| e2e111.js | 8311 | Desideri e libreria di un amico: icona «Aggiungi ai miei desideri», regali visibili a scelta |
| e2e112.js | 8312 | Menu riordinato, Indietro che torna al Menu, testata su due righe, «Usa la tua», guida del worker |
| e2e113.js | 8313 | Trasloco da piero907.github.io a nextlibris.github.io (trasloco.html, trasloco.js) |
| e2e115.js | 8315 | 17/11 pomeriggio: «In prestito» sulle copertine ricevute, boccale nella testata, Raggruppa per (autore, genere, genere › autore, lettura), vista che resta dopo eliminare/spostare, privacy nell'app, «Cosa c'è di nuovo» che si riprova |
| e2e120.js | 8320 | Giro 1 (18/11/2026): «In comune» da amico, «Da verificare» dall'elenco, icona della chiave nella propria libreria, Info Autore, dimensione delle copertine (cursore e due dita), vista e ordine ricordati, serie e copie accorpate, autori con nomi simili uniti |
| e2e121.js | 8321 | Giro 2 (18/11/2026), Wikidata simulata: paese degli autori (un solo paese, nascita tra parentesi, correzione a mano, Raggruppa per Paese, filtro, Statistiche, Stagione), film e serie TV nella scheda e in «Per te», opere di un autore da Info Autore e dal + |
| e2e122.js | 8322 | Giro 3 (18/11/2026), Supabase finto: libro prestato visibile con la libreria nascosta, foto del profilo (Google o scelta, 128 px), pagina del profilo (numeri, citazione preferita, interruttori in «Amici e privacy»), profilo dell'amico, «Segui» (elenco, profilo, richiesta d'amicizia), notifica «desideri» |
| e2e123.js | 8323 | Giro 4-5: guida di primo avvio (8 schermate dal giro 5, tocco ai lati, vista una volta anche da chi usa già l'app) e libreria di esempio senza richieste fuori |
| e2e124.js | 8324 | Giro 5 (18/11/2026): X nella ricerca (solo il testo), bandiere come immagini (solo quelle che servono), «Dal libro» con i film, Ricerca dei libri (Google sopra il worker, sezioni richiudibili, «Prestata da …», chiave coperta con «Mostra»), testo e contatore della finestra della chiave |
| e2e125.js | 8325 | Giro 6 (18/11/2026), Supabase finto: coccarda «Lo consiglio», puntine sulle citazioni (max 3), il tuo profilo e quello dell'amico (Libreria, Desideri, icone, file di copertine, citazioni in evidenza, numeri tra voi), interruttori nuovi, «Ce l'ha già…» sui desideri, avviso «trovato» nella campanella con «Me lo presti?» |
| e2e127.js | 8327 | Giro 8 (18/11/2026), Supabase finto: chiave Google prestata sul server (segno «prestata:id», funzione `libri`, nessuna richiesta a Google dal telefono, 300 al giorno, prestito tolto), guida con «solo Books API», «La mia chiave è finita in giro» (`chiavi_aggiorna`), avviso importante nella campanella. `SCHERMATE=` |
| e2e128.js | 8328 | Giro 9b (18/11/2026), Supabase finto della chat: fumetto in testata tra campanella e Amici, «+ Nuova», primo messaggio, tenuto premuto (Copia, Elimina per tutti; Segnala sui messaggi degli altri), ⋮ (Silenzia, Profilo, Blocca, Elimina chat), Indietro del telefono, numero sul fumetto, richiesta di messaggio di chi non è amico (Accetta/Rifiuta, Segnala con «Blocca anche»), «Possono scrivermi», «Persone bloccate», «Scrivi» negli amici e nel profilo, riassunto «messaggi» nella campanella. `SCHERMATE=` |
| e2e131.js | 8331 | Giro 9e (18/11/2026), Supabase finto delle funzioni admin_*: admin.js caricato solo per gli amministratori (Bruno no, nessuna chiamata), Menu › Amministrazione con 5 schede, segnalazione con i messaggi prima (testo pulito), Sospendi con conferma, «Va tutto bene» subito, Chiuse, Sospesi › Riattiva, Avviso con anteprima e conferma, Numeri, Archivio (cerca, correggi, togli), Indietro del telefono, tocco sull'avviso, «non autorizzato» chiude il pannello. `SCHERMATE=` |
| e2e74.js | 8194 | Schermi di misure diverse (telefono piccolo, telefono, telefono sdraiato, tablet, PC, PC grande): niente scorrimento orizzontale; pagina del libro a tutta larghezza e su due colonne da 760 px; modifica in colonna; barra in basso raccolta al centro, sottile sugli schermi bassi |
| e2e75.js | 8195 | Segnalibro: «Sono a pagina [N] di T · %» con la barra nella pagina del libro «In lettura» (solo cifre, si salva con la data, resta alla riapertura, oltre l'ultima pagina 100%); senza pagine del libro solo il campo; «In lettura · 34%» con la linea sottile nell'elenco, barretta sulle copertine; con «Letto» sparisce |
| e2e76.js | 8196 | «In lettura» in cima: sezioni «In lettura» e «Gli altri libri» in Elenco e Copertine (si chiudono, se lo ricorda); niente sezioni con ricerca, filtri, ordine diverso da «Più recenti», nei Desideri o senza libri in lettura; dalla copertina si apre ancora la pagina del libro |
| e2e61.js | 8181 | obiettivo con la luce: tre obiettivi finti (anteriore, grandangolare senza luce, principale), scelta e memoria; senza luce o luce «morta» niente pulsanti; diagnosi in Opzioni › App; «Prova la luce» Sì/No (modo «lie» come il Galaxy A32); Sostieni in evidenza |

Le porte si ripetono tra prove diverse: due prove con la stessa porta non girano mai insieme sullo stesso slot (la seconda della coppia usa porta + 1000). Per una prova nuova: sessione della prova `e2e74`–`e2e99` con porte **8194–8299**, sessione social `e2e100`–`e2e199` con porte **8300–8399**, sempre attraverso `CFG.port()` (regole in CLAUDE.md).

## Materiali (`img/`)

Immagini disegnate apposta, non foto di libri veri.

- **Copertine:** `cover.jpg` (L'amica geniale), `cover_noisy.jpg` (sporca e storta), `author_only.jpg` (solo autore: più edizioni), `cover_blank.jpg` (senza testo). Più `cov_*.png` e `g_*.jpg` / `ol_big.jpg`, piccole immagini usate come copertine «scaricate».
- **Retri e prezzi:** `back.jpg`, `back_price.jpg`, `back_noprice.jpg`, `back_phone.jpg` (codice 9788806219352); `price_only.jpg`, `price_phone.jpg`, `live_price.jpg`.
- **Testo:** `isbn_text.jpg` (ISBN scritto senza barre), `pagina.jpg` (pagina per le citazioni). `isbn.txt` è l'ISBN dei retri.
- **Video per la fotocamera finta (`.mjpeg`):** `live` (codice), `live_price` (codice e prezzo), `cover_live` (copertina), `isbn_text`, `pagina`, `blank` (niente), `dark` (quasi buio: avviso di poca luce).
- **Vuota:** `blank.jpg`.
