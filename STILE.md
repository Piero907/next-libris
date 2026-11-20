# Next Libris — lo stile dell'app (documento fisso)

**Aggiornato il 20/11/2026, prova 110.27.** Questo è il riferimento unico per l'aspetto dell'app. Vale per ogni schermata e finestra, quelle di oggi e quelle future. La stessa copia sta nel progetto Claude (`claude/stile-base.md`) e nel ramo `prove` del repository (`STILE.md`). Le due copie devono restare uguali.

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
- Quando si scorre, la **barra di ricerca e filtri resta in alto** con **16 px di spazio sotto e una linea sottile**, così le copertine non le si attaccano (G17).
- **Orecchia** (angolo piegato) sulle copertine dei libri in lettura.
- Sezioni con l'**etichetta maiuscola spaziata e la linea** («IN LETTURA 1 ——», 11,5/700, `--muted`), tutte allo stesso margine.

### Pagine intere
- Libro, profilo, amici, chat, Per te, Indice: fondo carta, accanto ai segnalibri. **Titolo 26/800** e **tasto tondo 38** (‹ o ×) uguali dappertutto, tranne l'Indice.
- **Profilo**: **niente foto**. Il nome sta dentro l'**ex libris ovale** (bordo doppio `--accent`, «EX LIBRIS» sopra, «Su Next Libris da…» sotto). Le iniziali colorate restano solo negli elenchi. «I tuoi numeri» ha lo stesso margine delle altre sezioni.
- **Pagina del libro**: copertina al centro, titolo, autore con bandiera, pillole, tasti tondi, poi Lettura, Descrizione, Dal libro, Citazioni, Prestito, Nota, Vedi tutti i libri di. **Tutti i titoletti in grassetto** 16/700, senza linea.

### Indice (il Menu)
- Titolo «Indice» con **la sola freccia ‹, senza cerchio**.
- **Capitoli numerati** (Amici · La tua libreria · Impostazioni · Info e aiuto) con il numero in un **nastrino tutto `--accent`** (anche il 2, prima dorato).
- **Gruppi di voci senza cornici** (le cornici sono state provate e tolte il 20/11/2026). Le voci partono allo stesso bordo del testo dei capitoli e hanno i **puntini** fino a ›.
- Il pallino verde della sincronizzazione sta nel margine a sinistra del titolo, così il titolo non va a capo a 360 px.
- **Sostieni** come fascia dorata (`--gilt`) in fondo.

### Finestre dal basso
- Foglio del colore della pagina (`--surface`), maniglia, titolo 19/800 con × tonda, riquadri col filo sottile, tasto largo in fondo. Sempre accanto ai segnalibri.

### Chat
- Messaggi degli altri su `--surface` a sinistra, i miei pieni `--accent` a destra (raggio 20, angolo vicino al bordo 6).
- **Libro dentro un mio messaggio**: fondo trasparente sul verde, testo chiaro `--accent-ink`, altrimenti non si legge. Il libro in un messaggio altrui è un riquadro carta con testo `--ink` (G17).
- In basso 📚 tondo, campo a pillola, invio in cerchio `--accent`. I segnalibri restano visibili anche qui.

### Ricerca per titolo (finestra «Titolo o ISBN»)
- Prima si cerca su Google Libri. Se Google non risponde o non trova niente, si cerca in **Open Library**, prima le edizioni italiane.
- **Ordine dei risultati**: prima i titoli più vicini a quello scritto; poi quelli che corrispondono all'**editore o all'anno scritti accanto** («l'isola del tesoro bur», «l'isola del tesoro 1996»); poi le edizioni italiane, quelle con ISBN e copertina, e infine dalla più recente.
- Sopra i risultati c'è il **motivo vero**: «Senza un'API Google Libri cerco in Open Library», «L'API che ti avevano prestato non è più disponibile», «Google Libri non ha risposto» oppure «Google Libri non ha trovato niente». «Google Libri è al limite di richieste» compare solo a chi ha un'API valida e ha finito le ricerche del giorno.
- Senza API compare il tasto «Come avere l'API, gratis ›», che apre la guida.

### Misure (tutti i telefoni)
- Telefoni **da 380 px in su**: segnalibri 46 px, margini 20 px, titolo 40 px.
- **Sotto 380 px** (360, 375): segnalibri 36 px (scritta 10,5), margini 14 px, titolo 32 px, nastro 36 px, frase 14 px.
- **Schermi bassi** (sotto 620 px di altezza): segnalibri più corti. I sei segnalibri entrano anche a 360×640.
- **Tablet e PC (da 700 px)**: colonna di 640 px al centro, segnalibri sul suo bordo. **Anche le pagine intere** (libro, profili, Amici, Chat, Per te, Indice, stagione in libri) stanno nella colonna, accanto ai segnalibri, e **le finestre dal basso sono al centro della colonna** con il fondo scurito su tutto lo schermo; i segnalibri restano sopra il fondo scurito (`stile-g.css` G20). Le posizioni si calcolano in `%` e non in `vw`, così restano giuste anche con la barra di scorrimento del PC.
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
- **Guida, percorso e schede di benvenuto**: a schermo intero su sfumatura verde Bosco fissa (#24563F→#173A2A), uguale con ogni tavolozza.

## 4. Regole che restano sempre
- Testi senza maschile per le persone.
- Numeri coerenti tra le finestre.
- Niente testo che tocca i bordi.
- Si prova alle misure dei telefoni e in scuro.
- Si rispetta «riduci movimento».
- Niente «di nascosto» nei testi.
- L'API Google Libri si chiama sempre «API Google Libri».

## 5. Storia delle scelte di aspetto
- 19/11/2026: restyle «C · Schede».
- 20/11/2026, mattina: stile G «Pagina con l'Indice».
- 20/11/2026: Indice allineato (prova 110.17).
- 20/11/2026: carta «Avorio», via la capolettera, Indice senza cerchio e senza cornici (110.18).
- 20/11/2026: segnalibri con la forma da segnalibro (110.19).
- 20/11/2026: segnalibri visibili sotto le finestre (110.20).
- 20/11/2026: correzioni del libro in chat e della barra dei filtri (110.21).
- 20/11/2026: segnalibro Chat (110.22).
- 20/11/2026: ricerca per titolo con Open Library (110.23 e 110.24).
- 20/11/2026: ordine dei risultati; segnalibri nella conversazione e nella stagione in libri (110.25).
- 20/11/2026: tablet e PC con pagine nella colonna, finestre al centro e segnalibri sempre visibili (110.26).
- 20/11/2026: tutte le finestre controllate una per una; barra di scorrimento del PC; segnalibri sopra ogni finestra (110.27).
