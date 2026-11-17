# Next Libris — riferimento di stile

Regole per tenere coerenti tra loro gli elementi dell'app (Piero, 17/11/2026 sera). Si seguono a ogni modifica.
**Pagina campione:** `stile.html` (in questa cartella): mostra gli elementi veri con i CSS dell'app (`APP_DIR`, di solito `../next-libris`).
Si apre con un server qualunque nella cartella che contiene tutte e due, per esempio `python3 -m http.server` da `..` e poi `/prove/stile.html`.
Quando si aggiunge un elemento nuovo: prima si guarda qui se ce n'è già uno uguale; se è davvero nuovo, si aggiunge alla pagina campione.

## Colori e caratteri
- Solo le variabili di `style.css` (`--bg`, `--surface`, `--surface2`, `--ink`, `--muted`, `--line`, `--accent`, `--accent-ink`, `--accent-soft`, `--warn*`, `--bad*`, `--info*`): mai colori scritti a mano, così tema scuro e aspetti («nuovo») funzionano da soli.
- Titoli: `--font-display` (Literata nell'aspetto «nuovo»); testo: `--font-body` (IBM Plex Sans). Testo normale 15 px, piccolo 13-13,5 px in `--muted`.
- Ogni elemento va provato chiaro, scuro e con l'aspetto «nuovo» (copertine color tela, scritte `--gilt`).

## Tocchi e misure
- Zona da toccare almeno **44 px** (40 px solo dentro elenchi fitti). Icone 20-24 px, tratto 2, `currentColor`.
- Angoli: tasti 12 px, campi e finestrelle 10-12 px, pillole e contatori tondi (999 px), copertine 6 px.

## Finestre
- Finestra = `.sheet > .sheet-in`, titolo `h2` in alto.
- **× in alto a destra in tutte le finestre**: si aggiunge da sola (app.js, `sheetX`) a ogni finestra che ha «Chiudi» o «Ho capito» e fa lo stesso tocco. Non scriverla a mano; il tasto **«Chiudi» resta in fondo**.
- Le richieste che chiedono una decisione (Elimina/Annulla, Salva/Annulla, Manda/Annulla) non hanno la × : si esce con «Annulla».
- × , «Chiudi», tocco fuori e Indietro di una finestra aperta dal Menu tornano al Menu (`fromMenu`).
- Pannello del Menu (`.drawer`): «‹» per tornare indietro, × per chiudere.

## Scelte
- **Mai tendine del telefono** (`<select>` visibili): Android le apre scure e fuori stile. Si usa il tasto `.dpick` con la finestrella `#pickPop` (elenco con pallini); la `<select class="dsel">` resta nascosta e tiene il valore (lo fa da solo `pickSync`).
- Due o tre viste dello stesso posto: tasti a schede `.tabs` (`role="tab"`, `aria-selected`).
- Filtri: pillole del Menu (`.dpill`), con il numero dentro.
- Sì/no: `label.check` con la casella e il sottotitolo `small`.

## Tasti
- `.btn.primary`: l'azione principale, **una sola** per finestra. `.btn`: le altre. `.link`: azioni piccole nel testo («Chi è ›», «Annulla»).
- `.ico`: tasto con sola icona, sempre con `aria-label` (e `title` se il senso non è ovvio).
- `.chip`: pillola d'avviso (arancio); `.chip.todo`: pillola d'azione nella striscia di un amico.
- Tasti tondi per comandi di vista (Espandi tutto / Comprimi tutto): `.gx`.

## Sezioni e gruppi
- Sezione apribile: `.shelf > .shelf-h` (titolo, contatore `.sh-n` verde chiaro, freccia `.sh-c`) e `.shelf-b`. Ricorda se è aperta.
- «In lettura» sempre in cima e **mai raggruppato**; sotto «Gli altri libri».
- Gruppi (Raggruppa per): in copertine una **copertina del gruppo** `.gcard` (foto dell'autore o iniziali, iniziale del genere; numero in alto a destra `.gc-n`), nell'elenco una **riga** `.grow` (foto tonda, nome, primi titoli, numero). Un tocco apre i libri in un riquadro `.gpanel` sotto la riga (× per chiuderlo, «Chi è ›» per gli autori).
- Gruppi annidati: il primo livello come sezione `.shelf.grp`, il secondo come copertine/righe.
- In cima: Espandi tutto / Comprimi tutto.

## Copertine e schede dei libri
- Copertina `.cover` (2:3), sotto titolo `.cap` e autore `.cap2`; senza immagine il segnaposto `.ph` con il colore dal titolo (`hue`).
- Etichette sulla copertina `.badge` in basso a sinistra (Prestato, In prestito, Da verificare).

## Testi
- Italiano semplice, frasi brevi, niente parole tecniche (si dice «chiave Google e worker», non «API key»).
- Sottotitoli del Menu su **una riga**.
- Donazione: tono leggero della birra (Piccola / Media / Grande). **Mai scrivere che i libri restano solo sul telefono**: con l'account stanno anche online.
- Libri di un amico: «Anna lo sta leggendo», «Anna l'ha letto»; niente se non l'ha segnato.
- **Amici sempre in ordine alfabetico**, in ogni finestra (`abc()` in amici.js).

## Accessibilità
- Ogni tasto ha un nome leggibile (testo o `aria-label`); aperto/chiuso con `aria-expanded`; scelte con `aria-pressed`/`aria-selected`/`aria-checked`.
- Le immagini prese da fuori: `referrerpolicy="no-referrer"` e `data-rm` (spariscono se non si caricano).
