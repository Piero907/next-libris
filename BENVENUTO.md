# Next Libris — funzioni principali, schede di benvenuto e primo avvio

**Aggiornato il 20/11/2026, vera 115.** Le schede di benvenuto **sono la guida** dell'app (hanno sostituito la guida a più schermate, anche in Indice › Come si usa). Copia uguale: progetto Claude `claude/benvenuto-e-primo-avvio.md`, ramo `prove` `BENVENUTO.md`.

Tutte le scelte qui sotto sono di Piero e **già chieste: non richiedere**.

## Regola: la guida a ogni versione vera (Piero, 20/11/2026)
Quando si porta una versione nella vera, Claude **controlla** se le novità toccano una delle funzioni principali raccontate dalle schede. Se sì, **lo segnala a Piero e chiede** cosa cambiare: **non aggiorna le schede da solo**. Se no, lo dice in una riga.

## In una frase
Next Libris è il social dei libri: metti in ordine i tuoi libri, guardi quelli degli amici, ve li prestate e vi viene voglia di leggere. È gratis; chi vuole può sostenerla con una donazione (🍺 Sostieni).

## Funzioni principali
1. **La tua libreria**: aggiungi un libro inquadrando il codice a barre, fotografando la copertina o scrivendo il titolo; anche per autore e «Ce l'ho già?». Vista a copertine o a elenco, serie e copie raggruppate, ricerca e ordinamento.
2. **La pagina del libro**: uguale per tutti i libri; copertina, autore con paese, dati, descrizione a richiesta, «Dal libro» (film e serie tratti), citazioni, nota. La matita rende scrivibili i dati al loro posto.
3. **Lettura**: Da leggere, In lettura, Letto, con i libricini del voto e la data. La stella vuol dire «Lo consiglio».
4. **Desideri**: i libri che vorresti; gli amici possono seguire i tuoi Desideri.
5. **Prestiti**: segni a chi hai prestato un libro.
6. **Amici**: vi guardate le librerie (stessa impaginazione della tua), vedi «ce l'hai anche tu» e «ce l'ha Marta», chiedi un libro in prestito.
7. **Chat**: anche con chi non è tra gli amici (con richiesta), gruppi fino a 30, libri mandati in chat, avvisi sul telefono.
8. **Profilo**: numeri delle tue letture a tessere nei colori delle stagioni, immagine da condividere.
9. **Per te**: la scheda della stagione e i suggerimenti.
10. **API Google Libri**: con l'API l'app trova molti più libri, con copertine e descrizioni. È **gratis**: crearla non costa nulla e la crei da solo, in pochi passi. Si **presta**: un amico te la presta con un tocco (fino a 300 ricerche al giorno), l'API resta sul server e non la vedi; chi non ce l'ha la chiede con «Chiedimela»; chi ce l'ha la presta e aiuta l'app a crescere.
11. **Fonti libere**: Open Library, SBN (il catalogo delle biblioteche italiane, incluso per tutti dal 20/11/2026), Wikipedia, Wikidata e Commons; Google Libri solo quando manca il libro o la copertina.
12. **Ovunque**: prima il telefono, poi tablet e PC; si installa come un'app; libri salvati sul telefono e, con l'account, anche online; copia in .txt.

## Le 3 schede di benvenuto
| # | Scheda | Messaggio | Quando |
|---|---|---|---|
| 1 | Questo è Next Libris | Il social dei libri, gratis | sempre |
| 2 | I tuoi libri in un tocco | Aggiungi, segna cosa leggi, Desideri e prestiti | sempre |
| 3 | L'API Google Libri è gratis | La crei in 5 minuti; con gli amici ve la prestate | sempre |

La scheda 4 «Installa l'app» è stata tolta il 20/11/2026 (vera 115): sui telefoni si installa prima.

**Testi approvati (19/11/2026; senza maschile per le persone):**
- **1 · Questo è Next Libris**: Il social dei libri. · Metti in ordine i tuoi libri. · Scopri cosa leggono gli amici. · Prestatevi i libri e la voglia di leggere. · Nota: «È gratis. Se ti piace, puoi sostenerla.»
- **2 · I tuoi libri in un tocco**: Inquadra il codice, fotografa la copertina o scrivi il titolo. · Segna cosa leggi e cosa ti è piaciuto. · Tieni i Desideri e i libri prestati.
- **3 · L'API Google Libri è gratis** (20/11/2026): pillole Gratis · Tua · Si presta. Con l'API trovi molti più libri, con copertine e descrizioni. · Crearla non costa nulla: la fai in autonomia, in 5 minuti. · Quando avrai degli amici su Next Libris, potrete prestarvela. Con il link d'invito la seconda riga è «**Anna R.** è su Next Libris: se ha un'API, può prestartela.» · «Scopri di più ›» (testo in `claude/api-e-worker.md`).
- **Accedi**: Entra con Google. Con l'account i tuoi libri si salvano anche online e trovi gli amici. [Accedi con Google] (il tasto ufficiale di Google) · Più tardi.
- **Nome**: Come ti chiami? È il nome con cui gli amici ti troveranno. [campo] [Continua] (obbligatorio, vedi `claude/amici-chat-avvisi.md`).

## Prima installa, poi il benvenuto (scelte di Piero del 20/11/2026, **vera 115**)
- **Installazione obbligatoria solo sui telefoni** (Android e iPhone, non tablet né PC: lato corto sotto 600 px): nel browser c'è solo la schermata «Installa Next Libris» (anche su iPhone: «Mettila» non va bene, Piero 21/11/2026), con la grafica verde delle schede; **niente «Continua nel browser»**. Su Android il tasto «Installa» (o i passi del menu), poi «Fatto! Aprila dall'icona». Nelle app che aprono i link dentro di sé: passi per aprirla nel browser e «Copia il link».
- **Invito su iPhone:** l'app installata non riceve il link (dati separati da Safari): la schermata dice «Ti ha invitato Anna R. Nell'app installata cerca «Anna R.» in Amici». Su Android l'invito passa da solo.
- **Chi ha già libri nel browser su iPhone:** la schermata lo dice e offre «Fai il backup» (con l'account tornano da soli).
- **Percorso dei primi passi** con la stessa grafica delle schede (puntini, «Passo N di 3», disegno, righe, tasto largo, «Più tardi»).

## Sequenza del primo avvio
1. **Telefono nel browser**: solo la schermata d'installazione (sopra). Le schede aspettano l'app installata.
2. **Le 3 schede**. «Salta» porta alla scheda «Entra con Google» (se non sei dentro).
3. **Accedi con Google** («Più tardi» chiude e il percorso parte dal passo 2) → **Come ti chiami?**
4. **Percorso guidato** a schermo intero, stessa grafica verde: «Passo N di 3», icona, titolo, due righe brevi, tasto pieno e «Più tardi».
   - Passo 1 «Accedi con Google» (si salta da solo se sei già dentro).
   - Passo 2 «Trova più libri»: con un'API l'app trova molti più libri; «È gratis: crearla non costa nulla»; «Crea la tua (gratis)» e, con l'account e solo se un amico ha un'API sua, «Chiedila a un amico» (altrimenti «La crei in 5 minuti, con la guida.»).
   - Passo 3 «Aggiungi il primo libro».
   - Un passo già fatto si salta da solo; chiusa a metà la finestra di un passo, il passo torna; se chiudi l'app a metà, il percorso riprende alla prossima apertura.

**Altri casi:**
- **Chi usa già l'app** vede le schede **una volta** (senza «Entra con Google» se è già dentro).
- Con il **link d'invito** (`?amico=`) le schede si aprono anche in quella sessione.
- Da **Indice › Come si usa** si vedono solo le schede, senza l'accesso alla fine.
- La **libreria di esempio** (12 libri, solo da guardare, zero chiamate) si apre ancora da Indice › Info e aiuto.

## Grafica
Proposta **A «Fondo Bosco»**: tutto sulla sfumatura verde (dettagli e colori in `claude/stile-base.md`, sezione «Guida, percorso e schede di benvenuto»). Nella scheda 3 il cerchio dell'amico ha l'icona del libro aperto con le righe di testo sulle pagine. Tela delle proposte: https://claude.ai/artifact/3K32364B9GUREgviZATvHJ (fila A).

## Da provare sul telefono
Prima apertura da zero, accesso vero di Google, nome, Android con «Installa»; su iPhone (iOS 26.1) la schermata in Safari, l'installazione, l'accesso dall'app installata (pulsante e link di riserva «Entra da questo link»), push e numero sull'icona, fotocamera, campi senza ingrandimento.

## Tecnica
`guida.js` (schede `S`, disegni `ART`, `open(i, flow)`, `finish()`, `auto()`, versione `GV` 6; percorso `pathShow`/`pathStep`/`pathDo`/`pathWatch`), `guida.css` (`.wc-*`), `amici.js`/`amici.css` (`askName`, `.nm-*`), `social.js` (`NLSocial.gButton`), `app-avvio.js` (`iosGate` = schermata d'installazione dei telefoni, `gatePhone`, `gatePaint`), `amici.js` (`NLAmici.lenders`). Prove: e2e123, e2e136, e2e102, e2e22, **e2e142**.
