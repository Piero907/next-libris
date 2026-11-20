# Next Libris — mappa dell'app (elemento → codice, aspetto, prove)

**Aggiornata il 21/11/2026 sul ramo `prova` dopo la 115.3** (commit 82de146: errori dei telefoni, GitHub Actions). Copia uguale nel progetto claude.ai: `claude/mappa-app.md`.

**A cosa serve:** prima di una modifica, dice **dove mettere le mani** (file, funzione, id, regola CSS) e **quali prove rifare**. Non sostituisce la lettura del codice: prima di modificare si controlla sempre il codice vero (`grep -n "nome" *.js`).

**Regola 12 (Piero, 21/11/2026):** ogni modifica che aggiunge, sposta, rinomina o toglie un elemento aggiorna **anche questa mappa**, nello stesso lavoro e in tutte e due le copie. Se la mappa e il codice non coincidono, vince il codice: si corregge la mappa.

**Come leggere le righe:** `file.js` `funzione()` · `#id` · CSS (`G12` = sezione 12 di `stile-g.css`; `C` = `stile-c.css`) · **prove** (numeri delle e2e). Le scelte e i motivi stanno nei documenti per argomento (`STILE.md`, `RICERCA.md`, `API_WORKER.md`, `AMICI_CHAT.md`, `LIBRERIA_LIBRO.md`, `BENVENUTO.md`): qui c'è solo **dove**.

---

## 0. File dell'app

| File | Cosa contiene |
|---|---|
| `index.html` | tutta la pagina fissa: testatina stile G, elenco, finestre dal basso (`#…Sheet`), fotocamere, Indice (`#drawer`), Opzioni (`#optSheet`); ordine di caricamento di CSS e moduli |
| `avvio.js` | primo script (prima di disegnare): blocco dentro iframe, tema, niente lampi |
| `app.js` (1/10) | utilità, stato, `toast()`, `notice()`, suoni, quote e conti delle ricerche, `apiFetch` / `lentFetch` (API prestata) / `casaFetch` (SBN della casa), `sbnSay`/`sbnOut`, `guestEnter`/`guestExit`, `persist`, `loadAll`, `saveSettings` |
| `app-aggiungi.js` (2) | aggiunta dei libri: codici a barre (ZXing), `addIsbn`, `doLookup`, foto e OCR (`processPhoto`), `startScan`/`onScanned`, «Ce l'ho già?» (`onCheck`), prezzo (`askPrice`), torcia |
| `app-vista.js` (3) | filtri visibili (`visible`), doppioni, selezione multipla (`startSel`, `openBulk`, numerazione), conferma (`askConfirm`), fotocamera dell'app (`snap…`), editor delle foto (`ped…`), luce e obiettivi |
| `app-scheda.js` (4) | autore (`openAuthor`), novità delle versioni (`openLog`, `checkWhatsNew`), Sostieni (`openDon`, `donPaint`), descrizione (`loadDesc`), serie, citazioni (`openQuote`, `quotesHTML`) |
| `app-per-te.js` (5) | Novità dei tuoi autori (`runNews`), Suggerimenti / Da scoprire (`runSugg`, `renderNext`), riquadro «Hai finito un libro» (`nxBoxPaint`), tutte le citazioni (`openAllQuotes`) |
| `app-elenco.js` (6) | righe e copertine (`rowHTML`, `coverHTML`, `renderList`), sezioni In lettura, gruppi (`groupBy`, `renderGroups`), foto degli autori (`auf…`), barra che resta in alto (`updateStick`) |
| `app-finestre.js` (7) | azioni sulle righe (`delBook`, `retryRow`), **Titolo o ISBN** (`openIsbnSheet`, `searchTitle`, `rankCands`, `olWhy`), scelta e a mano (`openPick`, `openManual`), esportazione, **backup** (`backup`, `restore`, `checkBackupNag`), IndexedDB, copertine (`findCover`, `openCover`) |
| `app-filtri.js` (8) | Filtri (`renderDrawer`), **Indice** (`openDrawer`, `closeDrawer`, `paintMenuHome`, `setsOpen`, `infoOpen`, `fromMenu`, `menuReopen`), Aspetto (`applyLook`), versione (`checkVersion`), **Opzioni** (`openOptions(sec)`), suggerimenti nei campi, copie (`openDup`), colonne (`applyCols`) |
| `app-strumenti.js` (9) | condividi libro/lista (`openShare`, `sharePack`), link ricevuto (`checkIncoming`, `openImport`), prestiti (`openLoan`, `saveLoan`, `returnLoan`), Libreria↔Desideri (`moveToLib`, `moveToWish`), `setTab`, `setView`, Statistiche (`openStats`), case editrici (`openPubs`), stampa (`printCatalog`) |
| `app-wiki.js` (10) | Wikidata: paese e bandiera degli autori (`wdCountry`, `wdFlagImg`), film tratti dai libri (`wdFilms`, `filmLine`, `openFilms`), film omonimi (`wdSameQuery`), «Per autore» (`openWorks`) |
| `app-avvio.js` (11) | eventi, chiusura delle finestre (`sheetCloser`, trascinamento), installazione (`updateInstallUi`, `doInstall`), **schermata d'installazione dei telefoni** (`iosGate`, `gatePhone`, `gatePaint`, `gateInvite`), `window.NL` (riga ~895), avvio |
| `lib.js` | logica pura, senza DOM: ISBN, `lookupIsbn`, `searchText`, parser (Google, Open Library, SBN `sbnRec`/`parseSbnList`, Crossref), CSV/XLSX, doppioni, condivisione, `computeStats`, descrizioni, serie. Provata da `test_lib.js`, `test_sbn.js`, `test_order.js` |
| `stile-g.js` | segnalibri `#gTabs` (`TABS`, `tabs()`, `closeAll()`, `current()`, `paintTabs()`), «+ Aggiungi» `#gAdd`, testatina/nastro/frase (`paintHead`), titolo «Indice», «Nastro e linguette a sinistra» (`side`), colore della barra di stato |
| Moduli (`NOME.js` + `NOME.css`, agganciati a `window.NL`) | `layout` (+, Per te, icone dell'Indice, avvisi in cima) · `schede` (pagina del libro) · `social` (account) · `profilo` · `amici` · `notifiche` (campanella) · `chat` · `ricerche` (archivio comune, guida dell'API) · `push` · `guida` (schede di benvenuto, percorso, libreria di esempio) · `wrap` (stagione in libri) · `admin` (solo per gli amministratori, caricato da `chat.js`) |
| CSS | `style.css` (base) → CSS dei moduli → `stile-c.css` (pezzi di base) → `stile-g.css` (G1-G27, vince su tutto) |
| Automazioni | `.github/workflows/prove.yml` (giro completo delle prove a ogni push di `prova` e `prove`; uguale nei due rami), `.github/workflows/tieni-attivo.yml` (`tieni_attivo()` nei due database ogni 2 giorni; parte solo da `main`) |
| Altri | `sw.js` (copia offline, `SHELL`), `manifest.json`, `version.json`, `privacy.html`, `REGISTRO_MODIFICHE.md` (mostrato in «Novità delle versioni»), `LEGGIMI.txt`, `indirizzo.js` + `trasloco.html/js` (vecchio indirizzo: «Ci siamo spostati»), `vendor/` (ZXing, Tesseract, font, bandiere), `icons/` |

**Aggiungere un modulo:** `NOME.js`/`.css`, una riga in `index.html` e una in `SHELL` di `sw.js` con `// modulo:`, il nome in `MODULES` di `pubblica_prova.py`. Si toglie con `python3 togli_modulo.py NOME`.

---

## 1. Avvio e installazione

| Elemento | Codice | Aspetto | Prove |
|---|---|---|---|
| Schermata d'apertura (splash) | `#splash`, `app-avvio.js` | `style.css` | 30, 32 |
| **Installazione obbligatoria sui telefoni** («Installa Next Libris» / «Mettila sul tuo iPhone» / «Fatto!», invito, «Fai il backup») | `app-avvio.js` `iosGate()`, `gatePhone()` (lato corto < 600), `gatePaint()`, `gateInvite()`, `gateIc()`; `#iosGate.wc` | `style.css` (`#iosGate`), grafica `wc` di `guida.css` | **142**, 22 |
| Riquadro «Installa» in cima (tablet/PC), finestra «Come installarla» | `#instCard`, `#instSheet`, `updateInstallUi()`, `openInstallHelp()`, `doInstall()` | — | 22, 116 |
| Aggiornamento disponibile, «Aggiorna adesso» | `checkVersion()`, `updateNow()` (app-filtri), `#verBox`/`#verUpdate`; `sw.js` | — | 19, 33 |
| «Cosa c'è di nuovo» dopo un aggiornamento | `#wnSheet`, `checkWhatsNew()` (app-scheda) | — | 70 |
| Copia di prova separata dalla vera | `COPIA`/`PROVA` in `app.js` (dall'indirizzo), chiavi `prova:` | pillola «prova» G26 | 62, 73 |
| Vecchio indirizzo | `indirizzo.js`, `trasloco.html`, `trasloco.js` | — | 113 |

## 2. Benvenuto, accesso, nome, percorso

| Elemento | Codice | Aspetto | Prove |
|---|---|---|---|
| **3 schede di benvenuto** (= la guida; anche Indice › Come si usa) | `guida.js`: schede `S`, disegni `ART`, `open(i, flow)`, `finish()`, `auto()`, versione `GV`; `#gdStage`, `#gdProg`, `#gdFoot` | `guida.css` (`.wc-*`) | **123**, 136, 142 |
| «Scopri di più» sull'API | `guida.js` `info()`, `#gdInfo` | `C` («Scopri di più») | 136 |
| Entra con Google (scheda finale e finestra Account) | `social.js` `gButton()`, `google()`, `gisButton()`; `#wcG` | `social.css` | 100, 123 |
| **Come ti chiami?** (obbligatorio) | `amici.js` `askName()`, `nameForm()`, `validName()` | `amici.css` (`.nm-*`) | 102, 136 |
| **Percorso dei primi passi** (Passo N di 3) | `guida.js` `pathShow()`, `pathStep()`, `pathDo()`, `pathWatch()`, `ptLogged/ptKey/ptLender/ptBooks`; `NLAmici.lenders` | `guida.css` (`wc`) | 136, 142 |
| Libreria di esempio (12 libri) | `guida.js` (`enter`, `bar`, `wdFix`), `esempio()` in `app.js` | `guida.css` | 123 |

## 3. Cornice stile G (sempre visibile)

| Elemento | Codice | Aspetto | Prove |
|---|---|---|---|
| Testatina «NEXT LIBRIS» (o ‹ e nome dell'amico), pillola BETA / prova | `index.html` `#gHead`, `#gRun`, `#gBack`, `#gBeta`; `stile-g.js` `paintHead()` | G2, G26 | 138, 141 |
| Campanella (e tasto chat nascosto con il numero) in `#gIcs` | `notifiche.js` `paintTop()`; `chat.js` `paintTop()` (`#btnChatN`) | `notifiche.css`, G18 | 105 |
| Titolo «Libreria» / «Desideri» / «Libreria di Anna» | `header.top h1 .g-t`, `paintHead()` | G2 | 138 |
| Nastro con il numero dei libri | `#gRib`, `paintHead()` | G2 | 138 |
| Frase in prosa («Stai leggendo…; 5 sono in prestito») | `#gProse`, `paintHead()`; link → `NL.loanFilter()` | G3 | 138 |
| **Segnalibri** Indice · Libri · Desideri · Per te · Amici · Chat · Tu | `stile-g.js` `TABS`, `tabs()`, `closeAll()`, `current()`, `paintTabs()` (`lastTab`); Libri/Desideri/Per te/Tu → `NLLayout.act()`; Amici → `NLAmici.open`; Chat → `NLChat.open`; Indice → `NL.openMenu(true)` | G6, G15, G16, G18, G19, G20 | 65, **139**, 137 |
| Numero dei non letti sul segnalibro Chat | `paintTabs()` (`.g-tn`, letto da `#btnChatN`) | G18 | 128 |
| Nastro e linguette a sinistra (Aspetto) | `stile-g.js` `side()`, `settings.gLeft`, `html.g-left` | G11 | 65 |
| **«+ Aggiungi»** che galleggia | `#gAdd` (`head()` in stile-g.js) → `NLLayout.act('add')` | G7 | 65, 109 |
| Misure su telefoni, tablet, PC | — | G1, G20 | **137**, 74 |

## 4. Libreria e Desideri

| Elemento | Codice | Aspetto | Prove |
|---|---|---|---|
| Elenco / copertine | `#list`; `renderList()`, `rowHTML()`, `coverHTML()` (app-elenco); vista `setView()` (app-strumenti); colonne `applyCols()`, `setCols()` (app-filtri) | G4, G5, `style.css` | 7, 66, 132 |
| Libreria ↔ Desideri | `setTab()` (app-strumenti), `NL.tab()`, `inTab()`/`tabBooks()` (app.js) | — | 18, 21 |
| Barra di ricerca, × solo testo | `#q`, `#qX`, `qxSync()` (app-elenco) | G4, G17 | 124, 35 |
| Ordine e gruppi («Più recenti», «Autore») | `#sortBar`, `#sort`, `#grp`/`#grpPick`; `groupBy()`, `grpParts()`, `renderGroups()` (app-elenco); testi brevi `shortGrp()` (stile-g) | G4, G21 | 115, 116, 117 |
| Filtri (pagina dell'Indice) | `#btnFilters`, `#drawerFilters`; `renderDrawer()`, `facets()`, `clearFilters()`, `goFilters()` (app-filtri); paesi `wdFacets()` (app-wiki) | `style.css` (pannello Filtri) | 11, 29, 36, 56 |
| Barra che resta in alto mentre scorri | `#stick`, `#stickSentinel`, `updateStick()` | G17 | 20 |
| Sezioni «In lettura» / «Gli altri libri», orecchia | `renderList()` / `renderGroups()` (app-elenco) | G5 | 76 |
| Pillole sopra l'elenco («Novità dei tuoi autori», «Completa 1 libro con l'ISBN», «Da verificare») | `#btnNews`, `#btnTodo`, `#fltGuess`, `todoRows()`/`runTodo()` (app-aggiungi) | G21, `C` (pillole) | 120 |
| **Avvisi in cima**, uno alla volta, «Non riesco a salvare» | `#notice` (`notice()` in app.js, tipo `'save'` → `.nt-save`); scorrimento `layout.js` `notes()`, `slide()` | G24, `C` (avvisi) | 112, 116, 117 |
| Riquadro «Hai finito un libro. E adesso?» | `#nxBox`, `nxBoxPaint()` (app-per-te) | — | 63 |
| Sostieni: riga dopo 5 accessi, riquadro ogni 50 libri | `#donRow`, `#donAsk`; `donPaint()`, `donSnooze()` (app-scheda) | `C` (Sostieni) | 52 |
| Selezione di più libri (pressione lunga) | `#selBar`; `startSel()`, `toggleSel()`, `openBulk()` (`#bulkSheet`), numerazione `numPlan()` (app-vista) | — | 40, 46 |
| Doppioni e copie | `#dupSheet`, `openDup()`, `dupMerge()` (app-filtri); `computeDups()` (app-vista) | — | 10 |
| Libri «non più in libreria» (venduti, regalati, smarriti) | `goneText()`, `goneTag()` (app-vista); contati in Statistiche | `style.css` | 26 |
| Condividi i Desideri | `#btnShareWish`, `shareWish()` (app-strumenti) | — | 28 |

## 5. Aggiungere i libri

| Elemento | Codice | Aspetto | Prove |
|---|---|---|---|
| **Finestra del +** (In Libreria / Nei Desideri, Scansiona, Fotografa, Digita, Per autore, Ce l'ho già?) | `layout.js` `build()` (`#layAdd`), `act('add')`, `onClick()` | `layout.css`, `C` (finestra del +) | 109, 121, 136 |
| **Scansione del codice a barre** | `#scan` (`#scanGuide`, `#scanRes`, torcia `#scanTorch`, `#scanSound`); `startScan()`, `scanTick()`, `onScanned()`, `stopScan()`, `toggleTorch()` (app-aggiungi); `NL.scan(m)` | `style.css` (fotocamera) | 12, 58, 59, 60, 67 |
| Prezzo durante la scansione / dopo ogni libro | `#scanPrice`, `#priceAsk`; `askPrice()`, `closePriceAsk()`, `openPriceType()` | `style.css` | 5, 41, 53, 55 |
| **Foto della copertina** (fotocamera o galleria) | `#photoSheet`, `openPhoto()` (app-avvio), `processPhoto()`, `startFlow()` (app-aggiungi), `#recSheet` «Riconosco il libro» | — | 2, 14, 55 |
| «Quale libro è?» / «Scrivi titolo e autore» | `#pickSheet` `openPick()`, `#manSheet` `openManual()` (app-finestre) | — | 2, 53, 55 |
| **Titolo o ISBN** (Digita) | `#isbnSheet`; `openIsbnSheet()`, `searchTitle()`, `qParts()`, `rankCands()`, `olWhy()`, `pickTitle()`, `addTitleAsIs()`, `submitIsbn()` (app-finestre); tasto `#isbnKey`, `#isbnAsIs` | `C`, STILE.md «Titolo o ISBN» | **143**, 21, 24, 121 |
| Per autore (tutte le opere) | `#woSheet`, `openWorks()`, `woFind()`, `woPick()` (app-wiki) | — | 121 |
| «Ce l'ho già?» (in negozio) | `onCheck()`, `showRes()` (app-aggiungi) | `style.css` | 12 |
| Copertina non trovata | `#covSheet`, `askCoverPhoto()` (app-finestre) | — | 8, 25, 42 |
| ISBN 979-8 (KDP) e proposte all'archivio | `isKdp()`, `markKdp()`, `proposeLater()` (app-aggiungi); `proponi_archivio` | — | 69, 135 |
| Riga del libro in ricerca / non trovato / senza rete, «Riprova ora» | `setStatusText()` (app-aggiungi), `retryRow()` (app-finestre), `resumeLookups()` (app-avvio) | `C` | 3, 4, 9 |

## 6. Ricerca dei dati dei libri (senza interfaccia)

| Pezzo | Codice | Prove |
|---|---|---|
| Per ISBN: archivio → Open Library + SBN → Google → Crossref | `lib.js` `lookupIsbn()` (`tryOl`, `trySbn`, `tryCrossref`, `google`); `app-aggiungi.js` `doLookup()`, `addIsbn()`; archivio comune `ricerche.js` + `da_archivio`/`archivia` | 106, 23, 133, test_lib |
| Per titolo: SBN + Open Library, Google solo se manca un'edizione italiana | `lib.js` `searchText()` (`sbnTextUrl`, `parseSbnList`, `parseOlSearch`), `app-finestre.js` `searchTitle()`, `rankCands()` | **143**, 21, test_sbn, test_order |
| Chiamate di rete | `app.js` `apiFetch()` (indirizzo finto `SBN_CASA` → `casaFetch()`), `lentFetch()` (API prestata), `countCall()`, `googleLeft()`, `loadQuota()` | 23, 127, 133 |
| Limiti SBN e avvisi | `app.js` `sbnRoll()`, `sbnAuth()`, `sbnSay()`, `sbnOut()`, `sbnNow()`; chiave `catalogo-libri-sbn-casa` | 23, 133 |
| Server | funzione Supabase `libri` (`supabase/funzioni/libri/index.ts`: `?isbn=`, `?t=`, `?da=&u=`), `sbn_conta`; worker `cloudflare-sbn-worker.js` | test_worker.mjs, `prova_sbn_casa.sql` |
| Descrizione a richiesta | `app-scheda.js` `loadDesc()`, `queueDesc()`, `runDescQueue()`; `lib.js` `pickDesc()`, `olDesc()` | 34, 45 |
| Copertine più grandi | `app-finestre.js` `findCover()`, `improveCovers()`, `googleBig()`; `lib.js` `coverCandidates()` | 8, 25 |
| Wikidata / Wikipedia / Commons | `app-wiki.js` (`wdAsk`, `wdFetch`, `wdLoop`); foto degli autori `auf…` (app-elenco), `auLookup()` (app-scheda) | 118, 119, 121 |

## 7. Pagina del libro

| Elemento | Codice | Aspetto | Prove |
|---|---|---|---|
| Pagina intera (uguale per tutti i libri), ‹ e ⋯ | `schede.js` `doD()` (disegno), `dActs()`, `cPage()`, `decorate()`; apertura `NL.openCard`, `showBook()` (app.js) | `schede.css`, `C` (pagina del libro), G13, G20 | **71**, 26, 66, 141 |
| Copertina, ingrandita | `openCover()`, `lbButtons()` (app-finestre), `#lightbox` | `C` | 8, 71 |
| Autore con bandiera e paese; profilo dell'autore | `wdFlagImg()` (app-wiki); `#auSheet`, `openAuthor()`, `editAuthor()` (app-scheda) | `C` | 49, 121 |
| Pillole dei dati, «da verificare» | `schede.js` `verifyK()`, `put()` | `C` | 120 |
| Tasti tondi (Lo consiglio, desideri, condividi, matita, elimina) | `schede.js` `dActs()`; `toggleFav()`, `openShare()` (app-strumenti), `delBook()` (app-finestre) | `C` (tasti tondi) | 26, 125 |
| **Matita = modifica nel posto**, «+ Genere»… | `schede.js` `editPage()`, `fld()`, `box()` | `C` (modifica) | 71, 54 |
| ⋯: Cerca sul web, Cerca di nuovo | `schede.js` (`.cv-popi`) | `C` | 26, 39 |
| **Avviso del libro nella pagina** | `schede.js` sposta `.status` in `.cv-status` | G25 | 139 |
| Lettura (Da leggere / In lettura / Letto, libricini, «Letto il», «Sono a pagina…») | `schede.js` `rdShow()`; `setRead()` (app-finestre); `rdLong()`, `readHTML()` (app-elenco) | `C` (lettura) | 75, 35 |
| Descrizione | `descHTML()`, `paintDesc()`, `noDesc()` (app-scheda) | `C` | 34, 45 |
| Dal libro (film e serie) | `filmLine()`, `filmHTML()` (app-wiki) | `C` (Dal libro) | 121, 124 |
| Serie | `seriesHTML()`, `seriesBody()` (app-scheda); `lib.js` `seriesInfo()` | — | 35, 46 |
| Citazioni (prima in vista, Tutte ›, puntina) | `quotesHTML()`, `paintQuotes()`, `togglePin()` (app-scheda) | `C` (citazioni) | 37, 125 |
| Prestito («Presta, vendi o regala ›») | `#loanSheet`; `openLoan()`, `saveLoan()`, `returnLoan()`, `setLoanKind()` (app-strumenti); tra amici `amici.js` `sendSwap()` | `C` (Prestito) | 6, 103, 116 |
| Nota, Costo | `schede.js` `editPage()` | `C` (Nota) | 6, 54 |
| Vedi tutti i libri di | `schede.js`; filtro autore `autFlt` | G27 | 16, 29, 141 |
| Pagina del libro nella libreria di un amico (‹ e ⋯) | `schede.js` + modalità ospite (`amici.css`) | G27 | 141 |

## 8. Citazioni, foto e fotocamera dell'app

| Elemento | Codice | Prove |
|---|---|---|
| Citazione o appunto (finestra) | `#quoteSheet`; `openQuote()`, `saveQuote()`, `delQuote()`, `quoteOcr()`, `shareQuoteForm()` (app-scheda) | 38, 42, 43 |
| Tutte le citazioni | `#allqSheet`; `openAllQuotes()`, `renderAllQuotes()`, `shareAllQuotes()` (app-per-te) | 36, 125 |
| Foto delle citazioni (sfoglia) | `#phView`; `openPh()`, `openPhs()`, `closePh()` (app-scheda) | 37, 49 |
| Fotocamera dell'app | `#snap`; `snapPhoto()`, `snapShoot()`, `closeSnap()`, `rearStream()` (app-vista) | 42, 55, 60 |
| Editor della foto (evidenziatore, penne, adesivi) | `#ped`; `editPhoto()`, `ped…()` (app-vista) | 43 |
| Luce e obiettivi (Aggiunta dei libri) | `runLightTest()`, `runLensCheck()`, `chooseLightLens()` (app-vista) | 61 |

## 9. Per te, numeri e stagione in libri

| Elemento | Codice | Aspetto | Prove |
|---|---|---|---|
| **Pagina Per te** (stagione, Suggerimenti, Cinema, Citazioni, Statistiche, Backup) | `layout.js` `build()` (`#layYou`, `#layYouList`, `#layYouSeason`), `youItems()`, `paintYou()`, `act('you')` | `layout.css`, `C` (Per te) | 65, 116, 121 |
| Suggerimenti (Cosa leggere dopo / Da scoprire) | `#suggSheet`; `openSugg()`, `renderNext()`, `renderDisc()`, `runSugg()`, `autoSugg()` (app-per-te) | — | 63, 116 |
| Novità dei tuoi autori | `#newsSheet`; `openNews()`, `runNews()`, `autoNews()` (app-per-te) | — | 35 |
| Dai tuoi libri al cinema | `#filmSheet`; `openFilms()`, `filmPaintAll()` (app-wiki) | `C` | 121, 132 |
| Statistiche | `#statsSheet`; `openStats()`, `barsHTML()`, `goalHTML()` (app-strumenti); `lib.js` `computeStats()`; paesi `wdStatsHTML()` (app-wiki) | `style.css` | 37, 54, 57, 65 |
| **Stagione in libri** (schermate a storia) | `wrap.js` `open()`, `build()`, `slides()`, `paint()`, `go()`, `pickQ()`; `#wrap`; invito `#wrapAsk` `paintAsk()`; voce dell'Indice `#goWrap`; opzione «Riepilogo di ogni stagione» `paintOption()` | `wrap.css`, G19 | 64, 134 |
| Immagine da condividere (Storia, Quadrata, anteprima) | `wrap.js` `card()`, `makeBlob()`, `pvShow()`, `shareCard()`; dal profilo `profilo.js` | `wrap.css` | 134 |

## 10. Profilo («Tu» e profilo degli amici)

| Elemento | Codice | Aspetto | Prove |
|---|---|---|---|
| Pagina del profilo (tuo e dell'amico, stesso layout) | `profilo.js` `open(id)`, `paint()`, `head()`, `sheet()` (`#profSheet`); voce «Il mio profilo» `#goProf` | `profilo.css`, G9 | 122, 125, 126 |
| Ex libris con il nome | `profilo.js` `head()` | G9 | 126 |
| In lettura, Consigliati, citazioni in evidenza | `profilo.js` `strip()`, `myPins()`, `quoteHTML()` | `profilo.css` | 125 |
| **I tuoi numeri** (tessere della stagione, Da sempre, obiettivo) | `profilo.js` `statsHTML()`, `yearTiles()`, `tess()`, `pal()`, `animate()`, `yearCardData()` | `profilo.css`, `C` (numeri) | 134 |
| Scrivi, ⇄, Chiedimela, Segui i suoi Desideri (profilo dell'amico) | `profilo.js` `friRow()`, `setRows()`; `amici.js` `swapSheet()`, `askHTML()`; `#friAsk` | `profilo.css` (`.pf-ask`) | 104, 125, 136 |
| Scorciatoie alle impostazioni (Account, Amici e privacy, Notifiche, API) | `profilo.js` `setRow()` | — | 126 |

## 11. Amici

| Elemento | Codice | Aspetto | Prove |
|---|---|---|---|
| **Pagina «I tuoi amici»** (ricerca, elenco che scorre, Aggiungi un amico, richieste) | `amici.js` `sheet()` (`#friSheet`), `open()`, `paint()`, `row()`, `relBtn()`, `onClick()`; dati `load()`, `friends()`, `received()` | `amici.css`, G23 | 102, 103, 110 |
| Link d'invito `?amico=` | `amici.js` (blocco «link d'invito»), `shareInvite()`, `findInvite()` | — | 102, 142 |
| **Libreria di un amico** (ospite, solo da leggere) | `amici.js` `openGuest()`, `guestBar()`, `guestActs()`, `friendView()`; `app.js` `guestEnter()`/`guestExit()` | `amici.css`, G2 | 103, 104, 110, 141 |
| «Ce l'hai anche tu», «ce l'ha Marta», «In comune» | `app-elenco.js` `rowHTML()`, `coverHTML()`; `amici.js` `snapG()` | — | 104, 120 |
| Amici dell'amico | `amici.js` `openFF()`, `loadFF()`, `ffView()` | — | 110 |
| Desideri dell'amico, «Segui i suoi Desideri», «Ce l'ha già Marta» | `amici.js` `loadWishes()`, `wishList()`, `wishCheck()`, `wishAsk()`, `follow()` | — | 111, 125 |
| Prestiti e regali tra amici, reso da confermare, «Prestato da un amico» | `amici.js` `sendSwap()`, `applySwaps()`, `paintRet()`, `#recvSheet`, `swapSheet()` (⇄) | — | 103, 115 |
| Togli un amico (conferma) | `amici.js` `dropSheet()` | — | 104 |
| Consiglia ai tuoi amici (dalla condivisione) | `amici.js` `paintShareFriends()` (`#shareFriBox`) | — | 104, 130 |
| **API Google Libri** (Indice › Amici; «Chiedila a un amico») | `amici.js` `kwSheet()` (`#kwSheet`), `keysHTML()`, `ownKeyIco()` | `amici.css` | 109, 120, 136 |
| **Presta a …** | `amici.js` `keySheet()`, `setKeys()`, `keyAct()`, `stopBorrow()`, `lentCount()` | `amici.css` | 104, 109, 136 |
| **Chiedimela** | `amici.js` `askState()`, `askHTML()`, `askKey()`, `declareKeys()`, `NLAmici.ask`; server `chiavi_dichiara`, `chiedi_chiavi` | `profilo.css` (`.pf-ask`) | **136** |
| API altrui riconosciute e tolte | `amici.js` `ownCheck()`, `checkKeys()`; `chiavi_controlla` | — | 133 |
| Amici e privacy (nome, visibilità, Possono scrivermi, Persone bloccate) | `amici.js` `optsView()`, `paintSet()` (`#goFriOpt`) | `amici.css` | 122, 125 |

## 12. Chat

| Elemento | Codice | Aspetto | Prove |
|---|---|---|---|
| Elenco delle chat, Richieste di messaggio, «+ Nuova» | `chat.js` `sheet()` (`#chSheet`), `open()`, `paint()`, `rowHTML()`, `loadList()`, `newMenu()` | `chat.css`, `C` (Chat) | 128 |
| Conversazione (messaggi, campo, invio, controllo ogni 15 s) | `chat.js` `openChat()`, `paintConv()`, `msgHTML()`, `paintFoot()`, `send()`, `start()`/`stop()` | `chat.css`, G17, G19 | 128 |
| Tenuto premuto (Copia, Elimina per tutti, Segnala) e ⋮ (Silenzia, Profilo, Blocca, Elimina chat) | `chat.js` `msgMenu()`, `delMsg()`, `chatMenu()`, `mute()`, `askBlock()`, `askDelChat()`, `report()` | `chat.css` | 128 |
| Gruppi (crea, membri, nome, esci) | `chat.js` `makeGroup()`, `openInfo()`, `paintInfo()`, `memMenu()`, `rename()`, `askExit()`, `addPicked()` | `chat.css` | 129 |
| Libri in chat, Consiglialo | `chat.js` `paintBookPick()`, `sendBook()`, `bookCard()`, `recommend()` | G17 | 130 |
| Caricamento del pannello Amministrazione | `chat.js` `adminCheck()` (`admin_sono`) | — | 131 |

## 13. Campanella e notifiche push

| Elemento | Codice | Aspetto | Prove |
|---|---|---|---|
| **Campanella** (elenco, letti, avvisi importanti) | `notifiche.js` `paintTop()`, `sheet()` (`#ntSheet`), `open()`, `paint()`, `text()`, `markAll()`, `go()` | `notifiche.css` | 105, 108, 125 |
| Push: «Ricevi notifiche dagli amici», tipi, ore di silenzio, numero sull'icona | `push.js` `paintAsk()` (`#puAsk`), `enable()`, `disable()`, `section()`, `checks()`, `quietTxt()`, `badge()`; Indice › Notifiche `#goPush`; `sw.js` (evento push) | `push.css` | **108**, 132 |

## 14. Indice (il Menu)

`#drawer` in `index.html`; si apre con `openDrawer()` / `NL.openMenu(true)` e si chiude con `closeDrawer()` (app-filtri); titolo «Indice» da `stile-g.js` `indice()`; Indietro, × e «Chiudi» da una finestra tornano all'Indice (`fromMenu()`, `menuReopen()`). Aspetto: G10, G12, G13, G22. Prove: 15, 56, 72, 112, **139**.

| Voce (in ordine) | Aggiunta da | Apre |
|---|---|---|
| Il mio profilo | `profilo.js` (`#goProf`) | profilo |
| Filtri · Suggerimenti · Tutte le citazioni · Statistiche | `index.html` (`#goFilters`, `#goSugg`, `#goQuotes`, `#goStats`) | pagina Filtri, `#suggSheet`, `#allqSheet`, `#statsSheet` |
| La tua stagione in libri | `wrap.js` (`#goWrap`) | `#wrap` |
| Sostieni Next Libris (fascia dorata) | `index.html` `#donMenu` | `#donSheet` (`openDon()`) |
| **Amici** › I tuoi amici · API Google Libri | `amici.js` `paintMenu()` (`#friMenu`, `#goFri`), `ownKeyIco()` | `#friSheet`, `#kwSheet` |
| **La tua libreria** › Sistema l'elenco · Backup ed esportazione | `index.html` (`data-sec="fix"`, `data-sec="export"`) | `#optSheet` sezione fix, `#exportSheet` |
| **Impostazioni** › Account e sincronizzazione · Amici e privacy · Notifiche · Ricerca dei libri · Aggiunta dei libri · Aspetto | `social.js` (`#goAcc`), `amici.js` `paintSet()` (`#goFriOpt`), `push.js` (`#goPush`), `index.html` (`#setList`) | `#accSheet`, Amici e privacy, sezione push, `#optSheet` sezioni search/cards/look |
| **Info e aiuto** › Come si usa · Guarda una libreria di esempio · Condivisione · Installazione · Privacy · Contatti | `guida.js` `menu()` (`#goGuida`, `#goEsempio`), `index.html` (`#infoList`) | schede di benvenuto, libreria di esempio, `#optSheet` sezioni share/app/privacy/contact |
| Amministrazione (solo amministratori) | `admin.js` `menuItem()` (`#goAdmin`) | `#adSheet` |
| Versione, «Novità delle versioni» | `#verBox`, `#verLog` → `openLog()` (`#logSheet`) | registro da `REGISTRO_MODIFICHE.md` |

## 15. Finestre delle impostazioni

| Finestra | Codice | Aspetto | Prove |
|---|---|---|---|
| **Opzioni** (una finestra con le sezioni `data-sec`: look, search, cards, fix, share, privacy, contact, app) | `#optSheet`; `openOptions(sec)`, `closeOptions()`, `loadPrivacy()` (app-filtri) | `C` (gruppi di scelte, interruttori) | 15, 24, 107 |
| Aspetto (tema, tavolozza, caratteri, autori «Neruda, Pablo», colonne, linguette a sinistra, Riepilogo di ogni stagione) | `applyLook()` (app-filtri), `#lookNew`, `#lookReset`, `#optCols`; `side()` (stile-g); `paintOption()` (wrap) | G11, G14 | 17, 24, 117 |
| **Ricerca dei libri** (Google Libri in cima, riga SBN «Incluso», contatori, «La mia API è finita in giro», Prova la ricerca ISBN) | `renderSvc()`, `svcRow()`, `svcFold()`, `gbMask()` (app.js / app-strumenti); `#svcKey`, `#gbKey`, `#svcSbn`, `#btnDiag`; `lib.js` `diagnose()` | `C` (Ricerca dei libri) | **23**, 109, 112, 124 |
| Guida «Crea la tua API Google Libri» | `ricerche.js` `sheet()`/`guide()` (`#kgSheet`) | `ricerche.css` | 106, 109, 136 |
| «La mia API è finita in giro» | `ricerche.js` `leakSheet()` (`#klSheet`) | `ricerche.css` | 127 |
| Aggiunta dei libri (prezzo, suoni, fotocamera, luce) | `#optPrice`, `#optSound`, `#optCamNative`, `#lightRun`, `#lensRun` | — | 58, 60, 61 |
| Sistema l'elenco (verificato, case editrici, copertine, doppioni, ipotesi) | `#btnVerifyAll`, `#btnPubs` → `openPubs()` (`#pubSheet`), `#btnFill` → `fillMissing()`, `#btnCovers` → `improveCovers()`, `#btnMergeDups` → `mergeDups()`, `#btnClearGuess` | `style.css` | 10, 13 |
| Condivisione (il tuo nome, link, QR) | `#optName`, `#shareApp`, `#copyApp`; `saveName()`, `shareApp()`, `copyAppLink()` | — | 28, 107 |
| Installazione sul telefono | `#btnInstall`, `#btnInstDiag`, `#instOut` | — | 22 |
| Privacy, Contatti | `#pvBody` (`loadPrivacy()` da `privacy.html`), `#ctCopy`, `#ctWrite` (`contactURL()`) | — | 107 |
| **Account e sincronizzazione** | `social.js` `sheet()` (`#accSheet`), `open()`, `paintSheet()`, `doSync()`, `logout()`; voce `#goAcc` | `social.css` | 100, 132 |

## 16. Backup ed esportazione

| Elemento | Codice | Prove |
|---|---|---|
| Finestra Esporta (Excel, CSV, copia, stampa, backup, ripristino) | `#exportSheet`; `openExport()` (app-avvio), `saveXLSX()`, `saveCSV()`, `copyTSV()` (`#copySheet`), `printCatalog()` (app-strumenti, `#printView`), `backup()`, `shareBackup()`, `restore()` (app-finestre) | 6, 9, 15, 57, 126 |
| Il backup non è partito | `#bkFailSheet`, `bkFail()` | 59 |
| Promemoria (45 giorni o 40 libri), suggerimento nell'Indice | `checkBackupNag()`, `backupDue()`, `updateBackupInfo()` (`#optBackupHint`) | 9 |
| Solo .txt, limite di 45 MB, «Invia senza le foto» | `prepBackup()`, `bkMB()`, `#bkFailLite` | 59 |

## 17. Altre finestre e pezzi comuni

| Elemento | Codice | Prove |
|---|---|---|
| Toast (4 s con Annulla) | `toast()` in app.js, `#toast` | 47 |
| Conferma | `#confirmSheet`, `askConfirm()` (app-vista) | 40, 47 |
| Chiusura delle finestre dal basso (×, trascinamento) | `sheetCloser()`, `sheetX()`, `endSheetDrag()` (app-avvio) | 57, 116 |
| Due volte Indietro per uscire | app-vista (`two`, `on`) | 37 |
| Condividi un libro o una lista, link ricevuto | `#shareSheet`, `#importSheet`; `openShare()`, `sendShare()`, `checkIncoming()`, `doImport()` (app-strumenti) | 28, 130 |
| Sostieni (PayPal 2, 3, 5 €, Altro) | `#donSheet`, `openDon()`, `donGo()`, `donBack()` (app-scheda) | 52, 115 |
| Novità delle versioni | `#logSheet`, `openLog()`, `logHTML()` (app-scheda) | 51 |
| Registro degli errori (ultimi 20, in fondo alla mail di Contatti) | `nlErr()`, `ERRS`, `errText()` (app.js) | 114 |
| **Errori dei telefoni veri** (anonimi, al server) | `social.js` `errSend()`, `errTel()`, `errClean()`, `errVer()`, `errNew()`; chiave `catalogo-libri-errori-inviati`; server `errori_manda`; testo in `privacy.html` | **144** |

## 18. Amministrazione (solo «Piero R.» e «Next Libris»)

`admin.js`/`admin.css`, caricati solo se `admin_sono` risponde sì (`chat.js` `adminCheck()`). Pannello `#adSheet` (`sheet()`, `open()`, `setTab()`): Segnalazioni (`loadSegs()`, `segHTML()`, `decide()`), Sospesi (`sospHTML()`, `riattiva()`), Avviso (`avHTML()`, `prevHTML()`, `avSend()`), Numeri (`loadNums()`, `numHTML()`), Archivio e «Da controllare» (`arHTML()`, `arSave()`, `arDel()`, `propHTML()`, `prOk()`, `prNo()`). Prove: **131**, 135. Server: funzioni `admin_*` (`supabase/023_chat.sql`, 025, 029), prova `prova_sicurezza.sql`.

---

## 19. Server (Supabase, uguale nelle due copie)

SQL in `supabase/` del ramo `prove` (migrazioni 001-031). Ogni funzione è `security definer` con `set search_path = ''`.

| Area | Tabelle | Funzioni principali | Migrazioni |
|---|---|---|---|
| Libri e sincronizzazione | `libri`, `profili` | `libri_aggiornato`, `libri_tetto`, `elimina_account` | 001, 017 |
| Amici e visibilità | `amicizie`, `seguiti`, `prenotazioni`, `scambi` | `chiedi_amicizia`, `rispondi_amicizia`, `togli_amicizia`, `miei_amici`, `cerca_utenti`, `amici_di`, `amici_di_amici`, `libreria_di`, `desideri_di`, `profilo_di`, `profilo_libri`, `crea_scambio`, `chiudi_scambio`, `prenota_regalo`, `segui`, `chi_ha` | 002-010, 015-016, 018-019, 021-022 |
| Desideri trovati dagli amici | `desideri_nuovi`, `desideri_trovati` | `desideri_annota`, `desideri_riassunto` (cron 17 UTC), `trovati_annota` | 018-019 |
| Notifiche e push | `notifiche`, `push_iscrizioni`, `push_preferenze` | `notifica_nuova`, `mie_notifiche`, `notifiche_lette`, `push_*`, `avviso_importante` | 011, 014, 020, 025 |
| API prestata e Chiedimela | `chiavi_ho`, `chiavi_richieste` (+ chiavi sul server) | `presta_chiavi`, `chiavi_mie`, `chiave_prestata`, `chiavi_controlla`, `chiavi_dichiara`, `amici_chiavi`, `chiedi_chiavi` | 008, 013, 020, 026, 030 |
| Ricerche e archivio comune | `ricerche`, `ricerche_utenti`, `archivio`, `archivio_proposte` | `conta_ricerche`, `archivia`, `da_archivio`, `proponi_archivio`, `sbn_conta` | 012, 029, 031 |
| Chat | `chat`, `chat_membri`, `messaggi`, `blocchi`, `segnalazioni`, `sospesi` | `chat_*`, `gruppo_*`, `blocca`, `segnala`, `consiglia`, `chat_avvisa` | 023, 024, 028 |
| Amministrazione | `amministratori` | `admin_*`, `e_admin` | 023, 025, 029 |
| Errori dei telefoni e database attivo | `errori` (30 giorni), `battito` | `errori_manda` (anon), `tieni_attivo` (anon), `errori_pulizia` (cron errori-pulizia) | 032 (per ora solo nella prova) |

- **Funzioni Edge:** `libri` (v4 vera, **v5 prova**: API prestata e catalogo SBN, `supabase/funzioni/libri/index.ts`) e `push` (`supabase/funzioni/push`).
- **Vault:** `sbn_worker`, `sbn_firma`, `push_url`, `push_segreto`, `push_vapid_*`.
- **Cron:** push-attese, desideri-riassunto (17 UTC), chat-pulizia (notte), errori-pulizia (notte, 032).
- **Leggere gli errori:** `select giorno, versione, dove, messaggio, telefono, app, volte from public.errori order by ultima desc limit 50;` (solo dal database, con il connettore Supabase).
- **Prove SQL:** `supabase/prova_*.sql` (sicurezza, tetti, amici, notifiche, ricerche, SBN…).
- **Worker SBN:** `cloudflare-sbn-worker.js` (ramo `prove`), prova `test_worker.mjs`.

## 20. Prove e strumenti (ramo `prove`)

- **GitHub Actions:** il giro completo gira da solo a ogni push (`prove.yml`); risultato con `gh api repos/Piero907/next-libris/actions/runs?per_page=3` e file «esito-prove». Prima di rifare prove qui, guardare l'esito di Actions.
- **Descrizione di ogni prova:** tabella in `README.md` (porta e cosa controlla). Comandi: `node esegui.js eNN …`; `--veloce` (libreria + gruppo FUMO: e2e, 5, 6, 7, 10, 15, 56, 62); prove sensibili ai tempi in `DA_SOLE`.
- **Aiutanti:** `_harness.js` (`H.serve`, `H.wait`, `H.fai(p, 'menu'|'add'|'lib'|…)`, `H.aggiungi`, `H.matita`, `H.prestiti`), `_config.js` (porte).
- **Controlli grafici:** `ispeziona.js` con `PASSI=./passi_finestre.js` (tutte le finestre a 1280, 768, 390), `schermate_restyle.js`, `schermate_telefoni.js`, `schermate_amici*.js`; e2e137 (misure dei telefoni).
- **Pubblicazione:** `pubblica_prova.py` (lista `MODULES`), `nuova_versione.py`, `pubblica_vera.py`; `togli_modulo.py`.
- **Logica pura:** `test_lib.js`, `test_sbn.js`, `test_order.js`, `test_new.js`.

### Prove per zona (cosa rifare quando si tocca una parte)
| Zona | Prove |
|---|---|
| Cornice stile G, segnalibri, misure | 65, 137, 138, 139, 141 |
| Installazione, benvenuto, percorso | 22, 123, 136, 142 |
| Libreria: elenco, ordine, gruppi, filtri | 7, 11, 16, 20, 29, 56, 66, 76, 115, 116, 117, 120 |
| Aggiunta: scansione, foto, prezzo | e2e, 2, 5, 12, 14, 41, 53, 55, 58, 59, 60, 67 |
| Ricerca per ISBN / titolo, API, SBN | 3, 4, 21, 23, 106, 107, 109, 127, 133, **143** |
| Pagina del libro | 26, 34, 35, 45, 49, 54, 71, 75, 141 |
| Citazioni e foto | 36, 37, 38, 42, 43 |
| Per te, statistiche, stagione in libri | 63, 64, 121, 134 |
| Profilo | 122, 125, 126, 134 |
| Amici e libreria dell'amico | 102, 103, 104, 110, 111, 120, 136 |
| Chat | 128, 129, 130 |
| Campanella e push | 105, 108 |
| Indice e Opzioni | 15, 72, 107, 112, 139 |
| Backup ed esportazione | 6, 8, 9, 24, 57, 59 |
| Account | 100, 132 |
| Errori dei telefoni | 144 |
| Amministrazione | 131, 135 |
| Copia di prova, aggiornamenti, offline | 19, 32, 33, 51, 62, 70, 73 |
