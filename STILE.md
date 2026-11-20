# Next Libris — lo stile grafico dell'app (documento fisso)

**Aggiornato il 20/11/2026, vera 111, prova 111.2.** Questo è il riferimento unico per l'**aspetto** dell'app: colori, caratteri, misure, spazi, forme e disposizione delle schermate. Non contiene il funzionamento (ricerche, dati, server) né le regole sui testi. Vale per ogni schermata e finestra, quelle di oggi e quelle future. La stessa copia sta nel progetto Claude (`claude/stile-base.md`) e nel ramo `prove` del repository (`STILE.md`). Le due copie devono restare uguali. Indice di tutti i documenti: `claude/00-indice.md`.

**Come si lavora sull'aspetto** (regole di Piero):
1. Ogni modifica di aspetto si mostra **prima nella tela di design** con le schermate vere dell'app (tela https://claude.ai/artifact/11Dj482XSn4QbSUrk1Fneu).
2. Si pubblica nella copia di prova **solo quando lo dice Piero** («pubblica nella prova»).
3. Una finestra nuova si costruisce **solo con i pezzi descritti qui**. Se serve un pezzo nuovo, prima si aggiunge a questo documento.
4. A ogni scelta nuova di Piero si aggiorna questo documento, nelle due copie.

**Codice:** `stile-g.css` e `stile-g.js`, caricati **dopo** `stile-c.css`. Lo stile G si appoggia ai pezzi di C (sezione 3) e cambia quello che dice la sezione 1. Dove la sezione 1 non dice niente, valgono le regole di C.

---

## 1. Stile G «Pagina con l'Indice»: l'app come un libro

### Carta e colori
- **Pagina color carta «A · Avorio»** (scelta di Piero, 20/11/2026), solo nel **tema chiaro** e con ogni tavolozza (Bosco, Inchiostro, Bordeaux): `--surface #FCF9F2`, `--surface2 #F4EFE3`, `--line #E2D9C6`, `--bg #F1ECE0` (`stile-g.css` G14). Il tema scuro resta com'era. Il tema scuro caldo e i segnalibri color carta sono stati provati ma non scelti.
- Si usano **solo le variabili** delle tavolozze, mai colori scritti a mano. Così funzionano tutte le tavolozze, il tema chiaro e quello scuro.
- **Riquadri, tasti tondi e campi**: ombra leggerissima **più un filo sottile** `--line` (variabile `--c-sh`), così si vedono anche in scuro.

### Testata e titolo
- **Testatina** in alto: «NEXT LIBRIS» in maiuscoletto spaziato (nella libreria di un amico: ‹ e il suo nome). A destra **solo campanella e ≡ Indice**: la chat non sta più in alto, ha il suo segnalibro. Sotto c'è una linea.
- **Titolo** Bricolage **40/800** («Libreria», «Desideri», «Libreria di Anna»).
- **Nastro segnalibro** che pende dall'alto, colore `--accent`, con il numero dei libri e «LIBRI» (nei Desideri il cuore).
- **Frase in prosa senza capolettera** (tolta il 20/11/2026), con dati veri: «Stai leggendo *X*; 5 sono in prestito.» La parte «5 sono in prestito» è un link ai prestiti. Mai numeri inventati.

### Segnalibri laterali (navigazione)
- Sono **sei**, in quest'ordine: **Libri · Desideri · Per te · Amici · Chat · Tu** (Chat aggiunta dopo Amici il 20/11/2026). Ognuno ha l'icona e la scritta verticale e sta su una fascia con il taglio delle pagine.
- **Forma da segnalibro**: **lato dritto contro la pagina, parte tonda verso il bordo dello schermo** (raggio 12 solo su quel lato). Quello attivo è pieno `--accent` e più lungo, gli altri sono `--accent-soft` e più corti (`stile-g.css` G15).
- Sul segnalibro **Chat** c'è il numero dei messaggi da leggere, in un pallino rosso `--bad` (`.g-tn`, G18).
- **Sempre visibili, in ogni schermata** (Piero, 20/11/2026): Libreria, Desideri, Per te, Amici, Chat e **conversazione aperta**, profili, pagina del libro, Indice, la **«stagione in libri»** e tutte le **finestre dal basso** (Statistiche, Suggerimenti, Dai tuoi libri al cinema, Aspetto, «+», Titolo o ISBN…). Le finestre e le pagine si aprono **accanto** ai segnalibri, mai sopra (`stile-g.css` G16 e G19).
- Con una finestra dal basso aperta **resta acceso il segnalibro da cui si è partiti** (`lastTab`). Se si tocca un altro segnalibro, la finestra o la pagina aperta si chiude (`closeAll`, anche la stagione in libri).
- **Lato**: a destra di partenza. In Indice › Aspetto c'è **«Nastro e linguette a sinistra»** (`settings.gLeft`, classe `html.g-left`): segnalibri sul bordo sinistro, sempre dritti verso la pagina e tondi verso il bordo; nastro a sinistra con il titolo accanto; pagine e finestre a destra dei segnalibri.
- Restano a tutto schermo, senza segnalibri: fotocamera, ritaglio della foto e anteprima dell'immagine da condividere. Le copertine e le foto ingrandite hanno i segnalibri sopra, e toccandone uno si chiudono.
- **Controllo di tutte le finestre** dopo ogni modifica di aspetto, a 1280, 768 e 390 px: `node ispeziona.js` con `PASSI=./passi_finestre.js` (ramo `prove`). Segnala ogni finestra fuori centro o sopra i segnalibri.

### Libreria e Desideri
- **«+ Aggiungi»** pieno `--accent` che galleggia in basso a sinistra (accanto ai segnalibri se sono a sinistra). Sparisce sulle pagine intere e sotto le finestre.
- **Ricerca sempre visibile** (46 px, raggio 14, `--surface2` con bordo `--line`). Sotto, in una riga: **ordine** e **gruppi** («Più recenti», «Autore»), poi a destra **Filtri** e **copertine/elenco** (tasti quadrati 38).
- **Spazi verticali uguali** (Piero, 20/11/2026): **14 px** sotto la riga di ordine e gruppi e **14 px** sotto le pillole («Novità dei tuoi autori», «Completa 1 libro con l'ISBN»…), prima della prima riga dell'elenco o delle copertine, con e senza gruppi, nella tua libreria, nei Desideri e in quella di un amico (G21).
- Quando si scorre, la **barra di ricerca e filtri resta in alto** con **16 px di spazio sotto e una linea sottile**, così le copertine non le si attaccano (G17).
- **Orecchia** (angolo piegato) sulle copertine dei libri in lettura.
- Sezioni con l'**etichetta maiuscola spaziata e la linea** («IN LETTURA 1 ——», 11,5/700, `--muted`), tutte allo stesso margine.

### Pagine intere
- Libro, profilo, amici, chat, Per te, Indice: fondo carta, accanto ai segnalibri. **Titolo 26/800** e **tasto tondo 38** (‹ o ×) uguali dappertutto, tranne l'Indice.
- **I tuoi amici**: l'elenco scorre **dentro il suo riquadro** (altezza massima `min(330px, 46vh)`), non la pagina, così «Aggiungi un amico» resta a portata (Piero, 20/11/2026; `stile-g.css` G23).
- **Profilo**: **niente foto**. Il nome sta dentro l'**ex libris ovale** (bordo doppio `--accent`, «EX LIBRIS» sopra, «Su Next Libris da…» sotto). Le iniziali colorate restano solo negli elenchi. «I tuoi numeri» ha lo stesso margine delle altre sezioni.
- **Pagina del libro**: copertina al centro, titolo, autore con bandiera, pillole, tasti tondi, poi Lettura, Descrizione, Dal libro, Citazioni, Prestito, Nota, Vedi tutti i libri di. **Tutti i titoletti in grassetto** 16/700, senza linea.

### Indice (il Menu)
- Titolo «Indice» con **la sola freccia ‹, senza cerchio**.
- **Capitoli numerati** (Amici · La tua libreria · Impostazioni · Info e aiuto) con il numero in un **nastrino tutto `--accent`** (anche il 2, prima dorato).
- **Gruppi di voci senza cornici** (le cornici sono state provate e tolte il 20/11/2026). Le voci partono allo stesso bordo del testo dei capitoli.
- **Puntini come nell'indice di un libro** (Piero, 20/11/2026): stanno **sulla riga sotto**, subito dopo il sottotitolo (anche sull'ultima riga se va a capo) e arrivano fino alla ›, che scende su quella riga; sono in basso sulla linea di base, leggeri (1,5 px, `--muted` al 55%). Senza sottotitolo i puntini stanno sulla riga del titolo. Capitoli e Sostieni senza puntini (`stile-g.css` G22).
- Il pallino verde della sincronizzazione sta nel margine a sinistra del titolo, così il titolo non va a capo a 360 px.
- **Sostieni** come fascia dorata (`--gilt`) in fondo. **Posizione da rivedere** (Piero, 20/11/2026: «va messo meglio in evidenza», IN_SOSPESO 41).

### Finestre dal basso
- Foglio del colore della pagina (`--surface`), maniglia, titolo 19/800 con × tonda, riquadri col filo sottile, tasto largo in fondo. Sempre accanto ai segnalibri.

### Chat
- Messaggi degli altri su `--surface` a sinistra, i miei pieni `--accent` a destra (raggio 20, angolo vicino al bordo 6).
- **Libro dentro un mio messaggio**: fondo trasparente sul verde, testo chiaro `--accent-ink`, altrimenti non si legge. Il libro in un messaggio altrui è un riquadro carta con testo `--ink` (G17).
- In basso 📚 tondo, campo a pillola, invio in cerchio `--accent`. I segnalibri restano visibili anche qui.

### Finestra «Titolo o ISBN» (risultati di una ricerca)
- Finestra dal basso normale: titolo 19/800, frase di spiegazione 13,5 `--muted`, campo di testo grande (raggio 14, bordo `--line`).
- Sopra i risultati, **una riga di messaggio** 13,5 `--muted` (mai rossa, mai in un riquadro colorato).
- **Risultati come righe-scheda**: copertina piccola a sinistra (riquadro vuoto `--surface` se manca), titolo 15/700, autore e «editore, anno» sotto in `--muted`; fondo `--surface2`, raggio 14, 8 px tra una riga e l'altra; l'elenco scorre dentro la finestra.
- Sotto i risultati, tasti **larghi secondari** uno sotto l'altro (per esempio «Come avere l'API, gratis ›», «Aggiungi solo «…», senza cercare»), poi in fondo la riga «Annulla» (secondario) e «Cerca» (pieno).
- Gli **avvisi nella riga di un libro** (libro non trovato, nuovo tentativo) stanno in un riquadro `--info-bg` sotto la riga, testo `--info`, con un tasto secondario piccolo («Riprova ora»).

### Misure (tutti i telefoni)
- Telefoni **da 380 px in su**: segnalibri 46 px, margini 20 px, titolo 40 px.
- **Sotto 380 px** (360, 375): segnalibri 36 px (scritta 10,5), margini 14 px, titolo 32 px, nastro 36 px, frase 14 px.
- **Schermi bassi** (sotto 620 px di altezza): segnalibri più corti. I sei segnalibri entrano anche a 360×640.
- **Tablet e PC (da 700 px)**: colonna di 640 px al centro, segnalibri sul suo bordo. **Anche le pagine intere** (libro, profili, Amici, Chat, Per te, Indice, stagione in libri) stanno nella colonna, accanto ai segnalibri, e **le finestre dal basso sono al centro della colonna** con il fondo scurito su tutto lo schermo; i segnalibri restano sopra il fondo scurito (`stile-g.css` G20). Le posizioni si calcolano in `%` e non in `vw`, così restano giuste anche con la barra di scorrimento del PC. La **pagina del libro** è larga quanto la colonna, con i margini normali (`--g-pad`): mai margini calcolati sulla larghezza dello schermo, altrimenti su PC il testo si schiaccia.
- **Giro di schermate** su telefono, tablet e PC: `TELEFONI=412` (poi `768`, `1280`) `node schermate_restyle.js`, anche con `MENU=1`, `SCHEDA=1`, `ALTRO=1`.
- **Controllo automatico e2e137** a 360×640, 375×667, 390×844, 412×915, 430×932, 768×1024, 1280×800: niente scorrimento di lato, tutto dentro lo schermo e fuori dai segnalibri, sei segnalibri.

---

## 2. Caratteri e misure di base
- **Titoli**: Bricolage Grotesque. **Testo**: IBM Plex Sans. In Indice › Aspetto si possono scegliere anche Literata, Lora e Roboto per i titoli, e Atkinson Hyperlegible e Roboto per il testo.
- **Dimensioni** (grandezza/peso):
  - titolo della libreria 40/800
  - titolo delle pagine intere 26/800
  - nome nell'ex libris 22/800
  - titolo del libro 24/800
  - titolo di finestra 19/800
  - titolo di riquadro 16-17/700
  - testo 15
  - testo secondario 13-13,5 `--muted`
  - etichette 11,5-12/700 maiuscole spaziate
  - numeri delle tessere 34/800
  - campi di testo **16 px** (su iPhone sotto i 16 px la pagina si ingrandisce quando si scrive)
- **Raggi**: riquadri 20, finestre 24-28, campi e pulsanti 14, quadratini delle icone 12, pillole 999, copertine 8, segnalibri 12 (solo verso il bordo).
- **Altezze**: pulsante 40-44 (piccolo 34, largo 50), campo 48, ricerca 46, riga di elenco ≥ 44, tasto tondo 38 (azioni del libro 46). Zona da toccare almeno 44 px.

## 3. Pezzi di base (da «C · Schede», ancora validi)
- **Chip**: 34 px, a pillola; quello scelto è pieno `--accent`.
- **Interruttore a schede** (Da leggere/In lettura/Letto, Tema…): pillola `--surface2`, scelta piena `--accent`.
- **Riga di elenco**: righe separate da `--line`; a sinistra una miniatura oppure l'icona nel quadratino 38 `--accent-soft`; titolo 15/700, sotto il testo secondario; a destra › oppure un tasto.
- **Pulsanti**: il principale è pieno `--accent`, ce n'è uno solo per schermata. I secondari sono `--surface` o `--surface2`; il pulsante di pericolo è `--bad` su `--bad-bg`.
- **Campo**: etichetta sopra, 48 px, raggio 14, bordo `--line`; quando è attivo ha bordo `--accent` con alone.
- **Interruttore on/off**: 46×28, acceso `--accent`.
- **Avvisi in pagina** (richieste, Segui i suoi Desideri, Chiedimela): riquadro `--accent-soft` con testo `--accent`.
- **Finestra del +**: In Libreria / Nei Desideri; tre tasti tondi (Scansiona pieno, Fotografa, Digita); Per autore; Ce l'ho già?.
- **Segni sulle copertine**: «In lettura» con l'orecchia; «Prestato» in `--warn-bg`; stella in `--brass`; «ce l'hai anche tu» con la spunta.
- **Guida, percorso e schede di benvenuto** (proposta «A · Fondo Bosco», 19/11/2026): a schermo intero su sfumatura verde Bosco fissa **#24563F→#173A2A** (nel tema scuro #1B4230→#0E241A), uguale con ogni tavolozza, **nessun altro colore** (niente oro, blu, caldo). Disegno grande in alto (sotto 600 px di altezza sparisce, i testi restano), titolo bianco Bricolage 31/800, sottotitolo #CFE6D8, righe con l'icona dell'app nel quadratino 38 verde trasparente, tasto pieno **#8FD1AE** con testo scuro, largo in basso; puntini e «Salta» in alto. «Come ti chiami?» con la stessa grafica. Il tasto «Accedi con Google» è quello ufficiale di Google.

### Colori delle stagioni (numeri del profilo e immagine da condividere)
Colori «più tenui» (Piero, 19/11/2026), uno schema per stagione; nel profilo quella di oggi, nella stagione in libri quella mostrata. Testo bianco sui colori scuri, quasi nero su quelli chiari (scelto dall'app in base alla luminosità).
```
Autunno   #A8664A  #C99A62  #8A9160   fondo #2A1A12
Inverno   #3A4F73  #9DBCCB  #A797BF   fondo #0E1626
Primavera #6B9A68  #D597AA  #D9CC7A   fondo #16241A
Estate    #3F86A3  #DDB46A  #CF7584   fondo #0F2230
```
- **Nel profilo** le tessere stanno **direttamente sulla pagina** (niente fondo scuro): tessera grande dell'anno con obiettivo e scaffale, poi due tessere affiancate, paesi in un riquadro con il solo bordo, «Da sempre» in elenco (nome a sinistra, valore a destra, linea sottile tra le righe). Numero grande Bricolage 34/800.
- **Immagine da condividere** (Storia 1080×1920, Quadrata 1080×1080): tessere su **fondo scuro** della stagione, in fondo «Next Libris · nextlibris.github.io». Copertine senza immagine disegnate col titolo intero (si rimpicciolisce finché entra, mai tagliato).

### Provati e non scelti (si possono riprendere)
- Carte: **B · Crema** `--surface #F8F2E4`, `--surface2 #EFE7D5`, `--line #DCD0B6`, `--bg #ECE3CF`, `--ink #1D2420`; **C · Carta antica** `--surface #F2E8D3`, `--surface2 #E8DDC4`, `--line #D3C4A4`, `--bg #E5D9BE`, `--ink #1F2219`.
- Tema scuro **«Notte calda»**: `--surface #1D1A15`, `--surface2 #26221B`, `--line #3A342A`, `--bg #14120E`, `--ink #ECE5D6`, `--muted #A99F8C`. Segnalibri color carta.
- Cornici intorno ai gruppi dell'Indice; capolettera; foto nel profilo; barra in basso (stile C).

## 4. Regole grafiche che restano sempre
- Niente testo che tocca i bordi dei riquadri: sempre il margine interno.
- Titoli e etichette lunghi vanno a capo bene (meglio titolo + sottotitolo + › che una riga lunghissima); niente segnaposto tagliati a 360 px.
- Peso visivo leggero: niente riquadri o pulsanti pieni dove basta poco (bordi sottili, `--muted`, pulsanti piccoli).
- Si prova alle misure dei telefoni, del tablet e del PC, in chiaro e in scuro; niente scorrimento di lato.
- Si rispetta «riduci movimento».

Le regole sui **testi** dell'app (parole, nomi, tono) stanno in `claude/regole-di-lavoro.md`; il **funzionamento della ricerca** dei libri sta in `claude/ricerca-libri.md`. Qui c'è solo l'aspetto.

## 5. Storia delle scelte di aspetto
- 19/11/2026: restyle «C · Schede».
- 20/11/2026, mattina: stile G «Pagina con l'Indice».
- 20/11/2026: Indice allineato (prova 110.17).
- 20/11/2026: carta «Avorio», via la capolettera, Indice senza cerchio e senza cornici (110.18).
- 20/11/2026: segnalibri con la forma da segnalibro (110.19).
- 20/11/2026: segnalibri visibili sotto le finestre (110.20).
- 20/11/2026: correzioni del libro in chat e della barra dei filtri (110.21).
- 20/11/2026: segnalibro Chat (110.22).
- 20/11/2026: segnalibri nella conversazione e nella stagione in libri (110.25).
- 20/11/2026: tablet e PC con pagine nella colonna, finestre al centro e segnalibri sempre visibili (110.26).
- 20/11/2026: tutte le finestre controllate una per una; barra di scorrimento del PC; segnalibri sopra ogni finestra (110.27).
- 20/11/2026: pagina del libro su PC, spazi sotto ordine/gruppi e pillole (110.28).
- 20/11/2026: tutto nella **vera 111**.
- 20/11/2026: puntini dell'Indice sulla riga sotto, elenco degli amici che scorre nel riquadro (111.2).

Tele di design: stile attuale https://claude.ai/artifact/11Dj482XSn4QbSUrk1Fneu · proposte A-G https://claude.ai/artifact/Tqa6XajvQCK2CVZdSSSimq · schede di benvenuto https://claude.ai/artifact/3K32364B9GUREgviZATvHJ.
