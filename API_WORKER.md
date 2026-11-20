# Next Libris — API Google Libri e worker SBN

**Aggiornato il 20/11/2026, vera 111.** Come si creano, come si prestano, «Chiedimela», limiti e sicurezza. La ricerca dei libri sta in `claude/ricerca-libri.md` (`RICERCA.md`), l'aspetto in `claude/stile-base.md` (`STILE.md`). Copia uguale: progetto Claude `claude/api-e-worker.md`, ramo `prove` `API_WORKER.md`.

Tutte le scelte qui sotto sono di Piero e **già chieste: non richiedere**.

## Cosa sono
- **API Google Libri**: un permesso gratuito di Google per cercare libri, 1.000 ricerche al giorno per ogni API. Crearla non costa nulla, né oggi né dopo. Si crea in circa 5 minuti con la guida dell'app (più comodo dal computer).
- **Nome**: sempre «**API Google Libri**» in tutta l'app (dal 19/11/2026, prima «chiave»). Restano «Chiave API», «Crea credenziali» e «Rigenera chiave» solo dove sono le parole di Google Cloud.
- **Worker SBN**: un piccolo programma gratuito su Cloudflare (100.000 richieste al giorno) che interroga il catalogo SBN delle biblioteche italiane. Origini ammesse: `https://nextlibris.github.io` e `https://piero907.github.io`.
- Tutti e due sono **facoltativi**: senza, l'app cerca nell'archivio comune e in Open Library.
- **Scopo** (istruzioni del progetto): far capire agli utenti che possono creare API e worker **da soli e con semplicità**. Nella guida va messo in evidenza che l'API **è gratis**, che crearla **non costa nulla** e che **aiuta l'app a crescere**; **niente frase sulla carta di credito**.

## Creare l'API
- Guida passo passo in Indice › Ricerca dei libri e nella finestra «Crea la tua API» (5 passi). Il passo 4 (R3, testo approvato): «Limita la chiave: in «Restrizioni API» scegli solo **Books API**. La fatturazione non va attivata (di partenza è già spenta, non devi fare niente): così non si paga mai niente, qualunque cosa succeda.»
- **«Scopri di più»** (dalla scheda di benvenuto dell'API e dal percorso): è un permesso di Google per cercare libri, 1.000 ricerche al giorno · è gratis, crearla non costa nulla · si crea in 5 minuti con la guida · resta tua, la togli quando vuoi · prestandola aiuti Next Libris a crescere. [Crea la tua API] [Chiudi].
- Nel campo l'API è coperta («AIza…7Gt», con «Mostra»).
- **Finestra Indice › Ricerca dei libri**: frase in alto «API e worker sono facoltativi: servono a trovare più libri e ad avere dati più precisi.»; **Google Libri in cima**, sopra il worker; le sezioni si aprono e si chiudono e dicono lo stato («● In uso», «● Prestata da Serena B.»); il tasto «Come si crea…» compare solo a chi non ha la sua API o il suo worker.
- **«La mia chiave è finita in giro»** (link sotto il campo, solo per chi ha un'API sua; testo R4 approvato): «Niente paura. Una chiave Google Libri fa solo ricerche di libri e non costa niente: al massimo qualcuno consuma le tue ricerche del giorno. Per chiuderla fuori: 1. Apri Google Cloud › Credenziali. 2. Tocca la tua chiave › «Rigenera chiave». 3. Incolla qui la chiave nuova. Gli amici a cui la presti continuano a cercare senza fare niente.»
- Pulsante «Deploy to Cloudflare» per il worker: lasciato stare (serve anche un account GitHub/GitLab).

## Prestito tra amici
- Si presta **solo dentro l'app** e **solo agli amici**. Il link con la chiave (`#k=`) è stato tolto (giro 8): un vecchio link aperto oggi mostra solo un avviso e non cambia niente.
- Si prestano **solo API e worker propri**: il server rifiuta quelli di un altro («non tua»), e l'app riconosce e toglie dal telefono quelli altrui (026, dopo il caso del 18/11/2026).
- **Resta tutto sul server**: sul telefono dell'amico arriva solo un segno, mai l'API né l'indirizzo del worker. Le sue ricerche passano dalla funzione `libri` di Supabase. I worker copiati prima sono stati cancellati dai telefoni (chi li avesse copiati potrebbe ancora usarli: accettato).
- **Limiti per amico**: **300 ricerche al giorno con l'API**, **3.000 con il worker** (giorno UTC, come Cloudflare). Arrivati al limite, fino al giorno dopo l'app cerca in Open Library. Testo approvato per il worker: «Per oggi hai finito le ricerche con il worker di Marta. Fino a domattina l'app cerca in Open Library e con Google.» (al posto di Marta il nome di chi presta). Niente link «Il mio worker è finito in giro».
- Chi presta **cambia l'API**: la nuova vale subito per tutti gli amici, senza un'altra notifica.
- Chi presta **smette**: si ferma alla ricerca successiva; il server risponde 403 e l'app dice che l'API prestata non c'è più (mai «Google è al limite» a chi non ha un'API sua).
- Contatore «La usano N amici» in fondo a «Presta a un amico» (solo amici, solo con l'account).
- Testo della finestra «API Google e worker» (giro 5, approvato con il nome di allora): «Una chiave Google Libri fa 1.000 ricerche al giorno. Con un uso normale bastano per te e per decine di amici. Il primo giorno, quando un amico carica la sua libreria, ne consuma di più: puoi aiutare fino a **6 amici nuovi al giorno** (50 libri ciascuno). Il worker ne regge migliaia. Prestarli non ti costa niente e puoi smettere quando vuoi. Tocca un amico per scegliere cosa prestargli.»

## «Chiedimela» (giro 12)
- L'app deve sapere **chi ha un'API sua da prestare**: ogni telefono dice al server **solo un sì/no** («ho un'API mia», «ho un worker mio»); i valori restano sul telefono. Lo vedono solo gli amici. Il sì/no lo dichiara il telefono (il server non può controllarlo senza vederlo).
- **Dove**: Indice › Amici › API Google e worker (sezione «Chiedila a un amico»); percorso del primo avvio, passo 2; **profilo dell'amico**, in un riquadro sotto il riquadro del profilo (non nella riga dei tasti): «🔑 Anna ha un'API Google Libri sua. Se te la presta, la tua ricerca trova molti più libri, con copertine e descrizioni. [Chiedimela]» → «Richiesta mandata».
- Compare **solo a chi non ha un'API sua né prestata**, e solo accanto agli amici che ne hanno una loro (anche se la prestano già).
- **Limiti**: una richiesta allo stesso amico **ogni 7 giorni**, **10 al giorno** in tutto. Chi la riceve non deve rifiutare: basta ignorarla. Nella campanella un solo avviso per persona; push nel tipo «Chiavi condivise».
- «Prestala» apre «Presta a …», dove si sceglie cosa prestare (API, worker o tutti e due); chi non ha niente di suo viene portato a «Crea la tua API».
- Un amico compare solo dopo aver aperto almeno una volta l'app aggiornata con il suo account (oppure se presta già a qualcuno).
- **Idea per il futuro** (Piero): riconoscimenti per chi presta la sua API (il server sa già chi presta e a quanti). In sospeso: IN_SOSPESO 32.

## Worker SBN fisso nell'app (in programma)
- **Scelta di Piero (19/11/2026)**: il worker di Piero **dentro l'app per tutti**, così tra amici si presta solo l'API. **Giro a parte, dopo** (Fable, impegno medio).
- **Conti**: una richiesta per ogni libro aggiunto con il codice → circa **2.000 utenti nuovi al giorno** (50 libri a testa) e, a regime, centinaia di migliaia di utenti (uso intenso ~375.000). Non è il limite: prima arrivano lo spazio di Supabase e la quota di Google.
- **Rischi**: il catalogo SBN potrebbe rallentare un worker con molte richieste (nessun limite pubblicato); l'indirizzo diventa pubblico nell'app (si protegge con le origini ammesse; oltre i 100.000 al giorno Cloudflare gratuito si ferma fino al giorno dopo, senza costi). Resta aperto R5: il worker usato da un programma con l'indirizzo (IN_SOSPESO 40).
- **Vantaggio**: le ricerche con il worker non passano più dalla funzione `libri` di Supabase.
- **Insieme**: nella ricerca per titolo SBN e Open Library partiranno insieme e Google servirà solo se mancano edizioni italiane (`claude/ricerca-libri.md`).

## Tecnica
- Database: 020 (API prestata sul server, avvisi importanti), 026 (solo le proprie, worker dal server), 027 (limite del worker), 030 (`chiavi_ho`, `chiavi_richieste`, `chiavi_dichiara`, `amici_chiavi`, `chiedi_chiavi`). Vera e prova con 001-030.
- Funzione `libri` versione 3 in tutte e due le copie: `?da=&isbn=` per il worker; 429 + `x-nl-stop: mio` al limite del worker; 403 + `x-nl-stop: no` se il prestito è tolto.
- App: `app.js` `apiFetch`, `lentFetch`, `lentWorker`, `LENTW_STOP`; `amici.js` `declareKeys`, `askState`, `NLAmici.ask`, `ownCheck`; `notifiche.js` `lendKey`; `ricerche.js` (guida); `profilo.js` (`.pf-ask`).
- Ogni ricerca con un'API prestata è una chiamata alla funzione del server (500.000 al mese nel piano gratuito, condivise con le push).
