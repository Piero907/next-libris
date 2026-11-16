# Next Libris: note per lavorare sull'app

Ramo `prove` di `Piero907/next-libris` (prove, strumenti, note; mai dentro l'app).
**Altri file, da aprire solo quando servono:** `STORIA.md` (storia e motivi delle scelte fino alla v99: cercare con grep), `IN_SOSPESO.md` (idee in attesa: aprirlo solo se Piero ne chiede una), `README.md` (come girano le prove), `supabase/` (SQL del database).

## Stato attuale (16/11/2026)
- **Vera: versione 99.** Prova: **99.2** = vera + **campanella delle notifiche** (`notifiche.js`/`.css`, prova e2e105). Salvataggi: rami `salvataggio-v96`, `-v97`, `-v98` (tornare indietro solo se Piero lo chiede: `git push -f origin salvataggio-vNN:main`).
- Solo due copie: **vera** (https://piero907.github.io/next-libris/, ramo `main`) e **prova** (repository `next-libris-prova`, codice nel ramo `prova`). La copia social non esiste più.
- **Supabase**, piano gratuito, 2 progetti (il massimo), Francoforte: vera `fttdbqotjocjfjfcoyfv`, prova `amkrkvkylprjasccxmzo` (`PROGETTI` in social.js). Al 16/11/2026 i due database sono **identici** (funzioni, permessi, colonne, vincoli, indici, regole), **tranne `011_notifiche.sql` e `012_ricerche_archivio.sql`: solo nella prova** (tabella `notifiche` scritta dai trigger, `mie_notifiche`, `notifiche_lette`; prova SQL `prova_notifiche.sql`). Va applicata alla vera quando si porta la campanella.

## Lavoro in corso (aggiornare a ogni passo: le sessioni si chiudono spesso)
- **Campanella delle notifiche** (prova 99.2, 16/11/2026): fatta e pubblicata nella prova. **Si porta nella vera solo quando lo dice Piero.**
  - Per portarla: applicare `supabase/011_notifiche.sql` al progetto vero (`fttdbqotjocjfjfcoyfv`; il file è già la versione finale: nella prova c'era anche la correzione `011b`, compresa nel file), rifare `prova_notifiche.sql` (finisce con un errore voluto che mostra l'esito e annulla tutto), `get_advisors`, confronto con la prova; poi la procedura «Vera» qui sotto (e2e102-105 già aggiornate).
  - Scelte fatte da Claude, **da confermare con Piero**: anche la richiesta d'amicizia è solo nella campanella (niente riquadro in cima); notifica a chi aveva il libro se chi presta segna «Restituito», nessuna se si annulla o cambia un regalo.
  - Possibili seguiti (solo se li chiede): notifiche push con l'app chiusa (Web Push + Edge Function).
- **Simulazione utenti** (16/11/2026, fatta): documento `claude/simulazione-utenti.md` nel progetto claude.ai, conti in `simulazione_utenti.py`. Con chiave Google e worker «della casa»: il muro è Google (1.000/giorno: ~140 ricerche per 50 libri → 6-7 nuovi al giorno, ~430 utenti misti); poi Supabase (spazio ~2.550 dopo un anno, traffico ~6.600). **Il contatore Google è per telefono: con una chiave condivisa non protegge.** 8 proposte nel documento, **nessuna costruita**: si fanno solo se Piero le chiede.

- **Ricerche condivise e archivio** (chiesto il 16/11/2026, IN CORSO nella prova), scelte di Piero:
  1. **Contatore condiviso su Supabase** per chi usa la stessa chiave Google o lo stesso worker (conto del giorno per hash della chiave/indirizzo); soglie come oggi ma condivise (700: niente copertine grandi/suggerimenti/novità; 950: solo Open Library e SBN).
  2. **Notifica nella campanella** quando una chiave arriva al limite: invita a crearne una propria; aprendola, guida con link e passaggi, **in evidenza che è gratis**.
  3. **Descrizione solo dalla prima ricerca**: se manca, «Descrizione non disponibile» e **nessun'altra richiesta**. Copertina grande senza la richiesta in più a Google.
  4. **Archivio comune per ISBN** (dati + descrizione, visibile a chi ha l'account): chi cerca un libro già cercato non usa Google.
  - Fatto: database della prova (`supabase/012_ricerche_archivio.sql`, applicato con la correzione 012b già nel file; prova `prova_ricerche_archivio.sql` 19/19). Da fare: app (descrizioni, copertina, modulo `ricerche.js`, notifica «limite» e guida), prove, pubblicazione.

## Regole con Piero
- **Annotare subito:** a ogni passo concluso aggiornare «Stato attuale» e «Lavoro in corso» qui (e fare push), così una sessione nuova riparte senza perdere niente.
- **Lingua:** sempre italiano, semplice e concreto.
- **Domande prima, non dopo:** se una richiesta non è chiara o ha più strade, chiedere **subito**, prima di scrivere codice (meglio con AskUserQuestion, opzioni concrete). Non chiedere quando la strada è ovvia.
- **Risparmiare risorse** (l'uso settimanale è già alto): poche azioni, niente esplorazioni larghe del codice (grep mirati), prove veloci in prova, schermate solo per finestre nuove o cambiate, documenti del progetto claude.ai aggiornati solo a ogni versione vera.
- **Pubblicazione:** ogni novità va **prima nella prova**; quando Piero dice ok, nella vera, con il numero di versione nuovo detto a Piero.
- **Schermate giuste al primo colpo:** componenti dell'app (`.field` con `input` diretto, `.btn`, `.link`, `.row-btns`), niente riquadri intorno agli input; griglie `minmax(0,1fr)`; guardare le schermate a 360, 412 scuro e 1280 con nomi lunghi e tutti gli stati (`schermate_amici2.js` come modello); nella prova e2e controllo `scrollWidth - clientWidth <= 0`.
- **Database:** controllare sempre le relazioni tra tabelle (chiavi esterne, `on delete cascade`, pulizia quando si toglie un amico), RLS, funzioni `security definer` con `set search_path = ''`, `revoke … from public, anon` + `grant execute … to authenticated`; poi `get_advisors`. Una modifica fatta sulla prova va rifatta uguale sulla vera quando si porta la versione (migrazione), poi confronto con gli hash. Supabase fa confermare a Piero le migrazioni con `delete`.
- **Privacy:** l'email di Piero mai a servizi esterni né nei file. Email dell'app: nextlibris.app@gmail.com.
- **Proposte:** quando chiede «proponimi», proporre senza modificare nulla.
- **Commit:** con le righe di attribuzione della sessione. Tag e release non passano (403): si usano rami. Push: `git -c push.negotiate=true push -q origin …`.

## Come si fa
- **Cartelle:** app in `next-libris` (ramo `prova`), prove in `prove`, copia pubblicata della prova in `next-libris-prova`.
- **Prova:** `node esegui.js --veloce eNN …` (1-2 min), poi `APP_DIR=… PROVA_DIR=… ATTRIBUZIONE="…" python3 pubblica_prova.py "nota per Piero"` (numero V.n automatico, `REGISTRO_PROVA.md`). Nota con la novità in `**grassetto**`.
- **Vera:** `node esegui.js` completo (~10 min; e2e27 fallisce sempre qui: mancano le foto in `/tmp/pb`). Poi: ramo `salvataggio-v<vecchia>` da `origin/main`; in `REGISTRO_MODIFICHE.md` in cima `## Versione N · gg/mm/aaaa` con **2-6 righe `> **Titolo** frase`** (mostrate in «Cosa c'è di nuovo») e i dettagli in `- `, solo le cose davvero portate, come stato finale; `LEGGIMI.txt` se serve; `main` avanza **solo con unione veloce** di `prova`; `APP_DIR=… python3 nuova_versione.py N "nota"`; push; poi `prova` = `main` e `pubblica_prova.py` (riparte da N.1).
- **Moduli:** le novità grandi stanno in file propri (`NOME.js`/`.css`) agganciati a `window.NL` (`NL.on/emit`); righe in `index.html` e `SHELL` di `sw.js` con `// modulo:`; lista `MODULES` in `pubblica_prova.py`. Moduli attuali: wrap, layout, schede, social (account), amici, notifiche (campanella, solo nella prova).
- **Prove nuove:** una per ogni novità, numero libero dopo l'ultima (`e2e104`), porta con `CFG.port()`.

## Scelte da non disfare senza chiedere
- Toast brevi (4 s con «Annulla»); conferma prima di eliminare. Prezzo chiesto a mano dopo ogni libro, senza lettura dalla fotocamera. Fotocamera posteriore. Due volte Indietro per uscire; una scheda aperta alla volta.
- Disposizione A, scheda «Pagina del libro» (D), voto a libricini con la parola, segnalibro, «In lettura» in cima, stella dei preferiti.
- Menu: Filtri, Suggerimenti, Citazioni, Statistiche; «La tua libreria»; **Impostazioni** (Account e sincronizzazione, Amici e privacy, Aspetto, Ricerca, Aggiunta dei libri, Condivisione, Installazione); Sostieni e versione in fondo.
- Donazioni PayPal `PieroRagusa907` (2, 3, 5 €, Altro), riga dopo 5 accessi, riquadro ogni 50 libri.
- Account: solo «Accedi con Google» (`CFG.email = false`); il telefono resta la copia principale; niente Realtime né email (limiti del piano gratuito).
- Amici: amicizia reciproca, un solo nome (`profili.utente`), desideri e libreria visibili solo se scelto, mai citazioni o appunti; libreria dell'amico solo da leggere (modalità ospite: `guestEnter`/`guestExit`, si salvano e sincronizzano solo i propri libri); il reso lo conferma chi presta; libri prestati o ricevuti mai uniti come doppioni; condividere prima dentro l'app, il link dopo; elenchi con ricerca (non pillole) per 20-30 amici; avvisi alla riapertura e ogni ~3 min.
- Notifiche (scelte di Piero del 16/11/2026): campanella accanto ad Amici per tutte le novità (amicizie, prestiti e regali, resi, «Me lo presti?», consigli, chiavi); icona Amici senza numero; in cima restano solo «Me lo presti?» e il reso da confermare; «letto» sul server (tabella `notifiche`, 30 giorni); niente push per ora.
