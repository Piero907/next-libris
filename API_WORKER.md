# Next Libris — API Google Libri e worker SBN

**Aggiornato il 20/11/2026: vera 111; nel ramo `prova` (non ancora pubblicato) il worker SBN della casa.** Come si crea l'API, come si presta, «Chiedimela», il catalogo SBN, limiti e sicurezza. La ricerca dei libri sta in `claude/ricerca-libri.md` (`RICERCA.md`), l'aspetto in `claude/stile-base.md` (`STILE.md`). Copia uguale: progetto Claude `claude/api-e-worker.md`, ramo `prove` `API_WORKER.md`.

Tutte le scelte qui sotto sono di Piero e **già chieste: non richiedere**.

## Cosa sono
- **API Google Libri**: un permesso gratuito di Google per cercare libri, 1.000 ricerche al giorno per ogni API. Crearla non costa nulla, né oggi né dopo. Si crea in circa 5 minuti con la guida dell'app (più comodo dal computer). È **facoltativa**.
- **Nome**: sempre «**API Google Libri**» in tutta l'app (dal 19/11/2026, prima «chiave»). Restano «Chiave API», «Crea credenziali» e «Rigenera chiave» solo dove sono le parole di Google Cloud.
- **Catalogo SBN** (biblioteche italiane): **incluso nell'app per tutti**, attraverso il **worker «della casa»** (un piccolo programma gratuito su Cloudflare, 100.000 richieste al giorno, sull'account di Piero). Gli utenti non creano e non prestano più nessun worker, e la parola «worker» non compare più nell'app.
- **Scopo** (istruzioni del progetto): far capire agli utenti che possono creare l'API **da soli e con semplicità**. Agli utenti resta da creare **solo l'API**. Nella guida va messo in evidenza che l'API **è gratis**, che crearla **non costa nulla** e che **aiuta l'app a crescere**; **niente frase sulla carta di credito**.

## Worker SBN della casa (scelte di Piero del 20/11/2026)
**Stato: fatto nella copia di prova** (database 031, funzione `libri` versione 4, app nel ramo `prova` da pubblicare quando lo dice Piero). **Nella vera: da portare** (vedi «Per portarlo nella vera»).

**Scelte:**
1. **Solo il worker della casa.** Tra amici si presta **solo l'API**. Tolti: worker proprio, prestito del worker, limite di 3.000 ricerche, sezione e guida del worker in Indice › Ricerca dei libri, «ho un worker mio» di «Chiedimela», worker nel backup.
2. **Passa dal server.** L'app chiede alla funzione `libri` di Supabase (`?isbn=`), la funzione chiama il worker. **L'indirizzo del worker non arriva mai sul telefono** e non è scritto nell'app: sta nel Vault di Supabase (`sbn_worker`).
3. **Il worker risponde solo al server.** Ogni richiesta è **firmata** dalla funzione (ECDSA P-256 del testo «isbn.secondi», intestazione `x-nl-firma`, valida 2 minuti e solo per quell'ISBN). La chiave privata sta nel Vault (`sbn_firma`, una per copia); nel codice del worker ci sono solo le **chiavi pubbliche**, che non sono segrete. Così non c'è nessun segreto da copiare a mano in Cloudflare.
4. **Limiti** (giorno UTC):
   - **con l'account: 500 ricerche al giorno per utente**, contate sul server (`sbn_conta`);
   - **senza account: 50 al giorno per telefono** (contate sul telefono: si aggirano, accettato) **e 3.000 al giorno in tutto** per tutti quelli senza account, contate sul server. Senza account la funzione risponde solo alle richieste che arrivano dall'app.
   - Al limite l'app cerca in archivio comune, Open Library e Google; ogni avviso si dice una volta al giorno.
5. **Chi aveva un worker suo** (o ne usava uno prestato): sparisce dal telefono **senza avvisi** (Piero: «senza dire niente»).
6. **Stesso worker di prima** (scelta di Piero: «aggiorniamo quello che c'è già»): il codice nuovo si incolla nel worker di Piero. **Fino al 27/11/2026** il worker risponde ancora anche alle richieste senza firma che arrivano dall'app (come prima), così chi ha ancora la 111 non resta senza SBN; dopo quella data solo richieste firmate, senza rifare niente.

**Testi approvati (20/11/2026):**
- Limite con l'account: «Per oggi hai finito le ricerche nel catalogo delle biblioteche (SBN). Fino a domattina l'app cerca in Open Library e con Google.»
- Limite senza account: «Senza account il catalogo delle biblioteche (SBN) fa 50 ricerche al giorno. Entra con Google per averne 500.» (con il tasto «Entra»)
- Tetto di tutti senza account: «Oggi il catalogo delle biblioteche (SBN) è al completo per chi non ha l'account. Entra con Google per usarlo subito.» (con il tasto «Entra»)
- Indice › Ricerca dei libri, frase in alto: «L'API Google Libri è facoltativa: serve a trovare più libri e ad avere dati più precisi.»
- Indice › Ricerca dei libri, riga SBN: «Catalogo delle biblioteche italiane (SBN) · ● Incluso» e sotto «Non devi fare niente. Ricerche di oggi: 12 su 500.» (senza account «su 50»).
- Finestra del prestito: «Un'API Google Libri fa 1.000 ricerche al giorno. Con un uso normale bastano per te e per decine di amici. Il primo giorno, quando un amico carica la sua libreria, ne consuma di più: puoi aiutare fino a **6 amici nuovi al giorno** (50 libri ciascuno). Prestarla non ti costa niente e puoi smettere quando vuoi. Tocca un amico per prestargliela.»
- La finestra «API Google e worker» si chiama ora «**API Google Libri**» (anche la voce nell'Indice › Amici e la scorciatoia nel profilo).
- Privacy (`privacy.html`): aggiunto che le ricerche SBN passano dal server, che riceve l'ISBN e, con l'account, conta quante ne fai al giorno; il codice cercato non viene salvato.

**Perché dal server e non l'indirizzo nell'app:** è davvero privato e riusa il codice del prestito; il conto al giorno si fa sul database. **Passare al worker che controlla da solo l'accesso** (senza passare da Supabase) se si arriva verso i **5.000 utenti nuovi al mese**, senza cambiare niente per gli utenti.

**Conti:** ogni ricerca SBN è una chiamata alla funzione `libri`: **500.000 al mese nel piano gratuito, condivise con le push e con le ricerche dell'API prestata**. Una ricerca per ogni libro aggiunto con il codice → circa **8.000-10.000 utenti nuovi al mese** (50 libri a testa); chi usa già l'app consuma pochissimo. Il worker (100.000 al giorno, oltre si ferma fino al giorno dopo senza costi) non è il limite.

**Rischi:** il catalogo SBN potrebbe rallentare un worker unico con molte richieste (nessun limite pubblicato); se il worker si ferma, SBN manca a tutti ma l'app continua con le altre fonti. Il problema R5 (worker usato da un programma con l'indirizzo, IN_SOSPESO 40) si chiude il 27/11/2026, quando il worker accetta solo richieste firmate.

**Dopo:** nella ricerca per titolo SBN e Open Library partiranno insieme e Google servirà solo se mancano edizioni italiane (`claude/ricerca-libri.md`); poi «cerca tra i tuoi amici chi può prestarti l'API» più in vista.

### Per portarlo nella vera
1. Piero incolla il codice nuovo nel suo worker (file `cloudflare-sbn-worker.js` del ramo `prove`): Cloudflare › Workers & Pages › il worker › «Edit code» › cancella tutto › incolla › «Deploy». Si può fare in qualsiasi momento: la 111 continua a funzionare fino al 27/11.
2. Database della vera: nel Vault `sbn_worker` (l'indirizzo del worker di Piero, preso da `chiavi.sbn` **prima** della migrazione) e `sbn_firma` (la chiave privata della vera, la cui chiave pubblica è già nel worker); poi la migrazione `031_worker_della_casa`; poi la funzione `libri` versione 4. La funzione nuova serve anche chi ha ancora la 111 con un worker prestato (il vecchio `?da=&isbn=` passa dal worker della casa).
3. App: «porta nella vera» come sempre.
- Le chiavi private non stanno in nessun file del repository. Se quella della vera andasse persa prima del passaggio: se ne genera una nuova, si mette la sua chiave pubblica in `CHIAVI` nel worker e Piero lo incolla di nuovo.

## Creare l'API
- Guida passo passo in Indice › Ricerca dei libri e nella finestra «Crea la tua API» (5 passi). Il passo 4 (R3, testo approvato): «Limita la chiave: in «Restrizioni API» scegli solo **Books API**. La fatturazione non va attivata (di partenza è già spenta, non devi fare niente): così non si paga mai niente, qualunque cosa succeda.»
- **«Scopri di più»** (dalla scheda di benvenuto dell'API e dal percorso): è un permesso di Google per cercare libri, 1.000 ricerche al giorno · è gratis, crearla non costa nulla · si crea in 5 minuti con la guida · resta tua, la togli quando vuoi · prestandola aiuti Next Libris a crescere. [Crea la tua API] [Chiudi].
- Nel campo l'API è coperta («AIza…7Gt», con «Mostra»).
- **Finestra Indice › Ricerca dei libri**: frase in alto (testo approvato sopra); **Google Libri in cima** (sezione che si apre e si chiude e dice lo stato: «● In uso», «● Prestata da Serena B.»; il tasto «Come si crea l'API (gratis)» compare solo a chi non ha la sua); sotto la riga fissa del catalogo SBN («● Incluso»), senza campi né tasti.
- **«La mia chiave è finita in giro»** (link sotto il campo, solo per chi ha un'API sua; testo R4 approvato): «Niente paura. Una chiave Google Libri fa solo ricerche di libri e non costa niente: al massimo qualcuno consuma le tue ricerche del giorno. Per chiuderla fuori: 1. Apri Google Cloud › Credenziali. 2. Tocca la tua chiave › «Rigenera chiave». 3. Incolla qui la chiave nuova. Gli amici a cui la presti continuano a cercare senza fare niente.»

## Prestito tra amici (solo l'API)
- Si presta **solo dentro l'app** e **solo agli amici**. Il link con la chiave (`#k=`) è stato tolto (giro 8): un vecchio link aperto oggi mostra solo un avviso e non cambia niente.
- Si presta **solo un'API propria**: il server rifiuta quella di un altro («non tua»), e l'app riconosce e toglie dal telefono quelle altrui (026, dopo il caso del 18/11/2026).
- **Resta tutto sul server**: sul telefono dell'amico arriva solo un segno, mai l'API. Le sue ricerche passano dalla funzione `libri` di Supabase.
- **Limite per amico**: **300 ricerche al giorno con l'API** (giorno di Google). Arrivati al limite, fino al giorno dopo l'app cerca in Open Library e nel catalogo SBN.
- Chi presta **cambia l'API**: la nuova vale subito per tutti gli amici, senza un'altra notifica.
- Chi presta **smette**: si ferma alla ricerca successiva; il server risponde 403 e l'app dice che l'API prestata non c'è più (mai «Google è al limite» a chi non ha un'API sua).
- Contatore «La usano N amici» in fondo a «Presta a un amico» (solo amici, solo con l'account).
- Finestra «Presta a …»: una sola casella, «API Google Libri» («Presta», «Salva», «Smetti di prestare»).

## «Chiedimela» (giro 12)
- L'app deve sapere **chi ha un'API sua da prestare**: ogni telefono dice al server **solo un sì/no** («ho un'API mia»); l'API resta sul telefono. Lo vedono solo gli amici. Il sì/no lo dichiara il telefono (il server non può controllarlo senza vederla).
- **Dove**: Indice › Amici › API Google Libri (sezione «Chiedila a un amico»); percorso del primo avvio, passo 2; **profilo dell'amico**, in un riquadro sotto il riquadro del profilo (non nella riga dei tasti): «🔑 Anna ha un'API Google Libri sua. Se te la presta, la tua ricerca trova molti più libri, con copertine e descrizioni. [Chiedimela]» → «Richiesta mandata».
- Compare **solo a chi non ha un'API sua né prestata**, e solo accanto agli amici che ne hanno una loro (anche se la prestano già).
- **Limiti**: una richiesta allo stesso amico **ogni 7 giorni**, **10 al giorno** in tutto. Chi la riceve non deve rifiutare: basta ignorarla. Nella campanella un solo avviso per persona; push nel tipo «API condivise».
- «Prestala» apre «Presta a …»; chi non ha un'API sua viene portato a «Crea la tua API».
- Un amico compare solo dopo aver aperto almeno una volta l'app aggiornata con il suo account (oppure se presta già a qualcuno).
- **Da riprendere dopo il worker della casa** (Piero, 20/11/2026): rendere più visibile «cerca tra i tuoi amici chi può prestarti l'API», con i tasti. Domande già preparate: dove metterla (pillola in Libreria, pagina I tuoi amici, finestra «Titolo o ISBN»), se mostrare anche gli amici senza API, tasto «Scrivi» accanto a «Chiedimela».
- **Idea per il futuro** (Piero): riconoscimenti per chi presta la sua API (il server sa già chi presta e a quanti). In sospeso: IN_SOSPESO 32.

## Tecnica
- **Database**: 020 (API prestata sul server, avvisi importanti), 026 (solo le proprie), 030 (`chiavi_ho`, `chiavi_richieste`, `chiavi_dichiara`, `amici_chiavi`, `chiedi_chiavi`), **031** (`supabase/031_worker_della_casa.sql`: `sbn_conta(utente)` solo per `service_role`, righe «c:» nella tabella `ricerche`; tolte `worker_conta` e `worker_prestato`; `chiavi.sbn` sempre vuoto con il vincolo `chiavi_senza_worker`; `presta_chiavi`, `chiavi_mie`, `chiavi_dichiara`, `amici_chiavi`, `chiedi_chiavi` solo per l'API). Prova: 001-031; vera: 001-030. Prova dei permessi e dei limiti: `supabase/prova_sbn_casa.sql`.
- **Vault** (per copia): `sbn_worker`, `sbn_firma` (oltre a quelli delle push). Nella prova ci sono; nella vera da mettere al passaggio.
- **Funzione `libri`** (`supabase/funzioni/libri/index.ts`): versione 4 nella prova (3 nella vera). `?isbn=` → worker della casa: con l'intestazione `Authorization` controlla l'utente (500 al giorno, `x-nl-mio`), senza accetta solo le origini dell'app (tetto di 3.000); 429 con `x-nl-stop: mio` o `tetto`; firma con la chiave del Vault; l'indirizzo del worker non torna mai nella risposta. `?da=&u=` → API prestata (come prima: 429 `mio`/`pieno`, 403 `no`).
- **Worker**: `cloudflare-sbn-worker.js` nel ramo `prove` (non più nell'app): `CHIAVI` (pubbliche, prova e vera), `TOLLERANZA` 120 secondi, `VECCHIO_FINO` 27/11/2026. Prova: `test_worker.mjs`.
- **App**: `app.js` `SBN_CASA` (indirizzo finto `https://sbn-casa.invalid/` che `apiFetch` gira a `casaFetch`), `sbnOut`, `sbnNow`, `sbnSay`, stato del giorno in `catalogo-libri-sbn-casa`, conto senza account in `quota.s`; `social.js` `rawOpen` (richiesta alla funzione anche senza account); `amici.js` (`ownKeys`, `keySheet`, `declareKeys`, `askState`, `NLAmici.ask`, `ownCheck`: solo l'API); `app.js` `apiFetch`, `lentFetch` (API prestata); `ricerche.js` (guida, contatore condiviso solo dell'API); `profilo.js` (`.pf-ask`).
- **Prove**: e2e23 (senza account: riga «Incluso», 50 al giorno, tetto, worker di prima tolto), e2e133 (con l'account: dal server con l'accesso, 500 al giorno), e2e9, e2e24 (backup), e2e104, e2e106, e2e107, e2e109, e2e112, e2e124, e2e136.
