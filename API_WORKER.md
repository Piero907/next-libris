# Next Libris — API Google Libri e worker SBN

**Aggiornato il 20/11/2026, vera 111** (più la scelta del **worker della casa**, da costruire). Come si creano, come si prestano, «Chiedimela», limiti e sicurezza. La ricerca dei libri sta in `claude/ricerca-libri.md` (`RICERCA.md`), l'aspetto in `claude/stile-base.md` (`STILE.md`). Copia uguale: progetto Claude `claude/api-e-worker.md`, ramo `prove` `API_WORKER.md`.

Tutte le scelte qui sotto sono di Piero e **già chieste: non richiedere**.

## Cosa sono
- **API Google Libri**: un permesso gratuito di Google per cercare libri, 1.000 ricerche al giorno per ogni API. Crearla non costa nulla, né oggi né dopo. Si crea in circa 5 minuti con la guida dell'app (più comodo dal computer).
- **Nome**: sempre «**API Google Libri**» in tutta l'app (dal 19/11/2026, prima «chiave»). Restano «Chiave API», «Crea credenziali» e «Rigenera chiave» solo dove sono le parole di Google Cloud.
- **Worker SBN**: un piccolo programma gratuito su Cloudflare (100.000 richieste al giorno) che interroga il catalogo SBN delle biblioteche italiane. **Dal 20/11/2026 (scelta, da costruire): un solo worker «della casa» per tutti, nascosto dietro il server** (sezione sotto). Oggi, finché non è costruito: ogni utente può avere il suo, con origini ammesse `https://nextlibris.github.io` e `https://piero907.github.io`.
- L'API è **facoltativa**: senza, l'app cerca nell'archivio comune, in Open Library e (col worker della casa) in SBN.
- **Scopo** (istruzioni del progetto): far capire agli utenti che possono creare l'API **da soli e con semplicità**. Con il worker della casa **agli utenti resta da creare solo l'API**. Nella guida va messo in evidenza che l'API **è gratis**, che crearla **non costa nulla** e che **aiuta l'app a crescere**; **niente frase sulla carta di credito**.

## Worker SBN della casa (scelta di Piero, 20/11/2026 — da costruire)
**Scelte (già chieste):**
1. **Solo il worker della casa.** Tra amici si presta **solo l'API**. Quando è costruito spariscono: il worker proprio, il prestito del worker, il limite di 3.000 ricerche, la sezione worker nella guida e in Indice › Ricerca dei libri, il «sì/no worker» di «Chiedimela».
2. **Passa dal server (via B).** L'app chiede alla funzione `libri` di Supabase, la funzione chiama il worker con un **segreto**. **L'indirizzo del worker non arriva mai sul telefono** e non è scritto nell'app. Il worker risponde solo a chi conosce il segreto.
3. **Limiti:**
   - **Con l'account: 500 ricerche al giorno per utente** (solo contro gli abusi), contate sul server.
   - **Senza account: 50 ricerche al giorno per telefono** (un numero salvato sul telefono, facile da aggirare: accettato) **e un tetto di 3.000 al giorno in tutto** per tutti quelli senza account insieme, contato sul server: chi aggira il limite consuma al massimo quel tetto.
   - Giorno UTC, come Cloudflare. Al limite l'app cerca in archivio comune, Open Library e Google, con il motivo vero nel messaggio.

**Perché B e non A** (A = indirizzo nell'app e il worker controlla da solo il «pass» dell'accesso): B è davvero privata e riusa il codice del prestito di oggi; il conto al giorno si fa sul database. Con A il limitatore pronto di Cloudflare lavora solo su 10 o 60 secondi, e per contare al giorno servirebbero i Durable Objects. **Passare ad A più avanti** se si arriva verso i **5.000 utenti nuovi al mese** (senza cambiare niente per gli utenti).

**Conti:**
- Ogni ricerca SBN è una chiamata alla funzione `libri`: **500.000 al mese nel piano gratuito, condivise con le push e con le ricerche dell'API prestata**. Una ricerca per ogni libro aggiunto con il codice → circa **8.000-10.000 utenti nuovi al mese** (50 libri a testa); chi usa già l'app consuma pochissimo.
- Il worker (100.000 al giorno, oltre si ferma fino al giorno dopo senza costi) non è il limite.

**Rischi:** il catalogo SBN potrebbe rallentare un worker unico con molte richieste (nessun limite pubblicato); se il worker si ferma, SBN manca a tutti ma l'app continua con le altre fonti. Il problema R5 (worker usato da un programma con l'indirizzo, IN_SOSPESO 40) si chiude: l'indirizzo non è più pubblico.

**Insieme:** nella ricerca per titolo SBN e Open Library partiranno insieme e Google servirà solo se mancano edizioni italiane (`claude/ricerca-libri.md`). Costruzione: **Fable, impegno medio**.

## Creare l'API
- Guida passo passo in Indice › Ricerca dei libri e nella finestra «Crea la tua API» (5 passi). Il passo 4 (R3, testo approvato): «Limita la chiave: in «Restrizioni API» scegli solo **Books API**. La fatturazione non va attivata (di partenza è già spenta, non devi fare niente): così non si paga mai niente, qualunque cosa succeda.»
- **«Scopri di più»** (dalla scheda di benvenuto dell'API e dal percorso): è un permesso di Google per cercare libri, 1.000 ricerche al giorno · è gratis, crearla non costa nulla · si crea in 5 minuti con la guida · resta tua, la togli quando vuoi · prestandola aiuti Next Libris a crescere. [Crea la tua API] [Chiudi].
- Nel campo l'API è coperta («AIza…7Gt», con «Mostra»).
- **Finestra Indice › Ricerca dei libri**: frase in alto «API e worker sono facoltativi: servono a trovare più libri e ad avere dati più precisi.»; **Google Libri in cima**, sopra il worker; le sezioni si aprono e si chiudono e dicono lo stato («● In uso», «● Prestata da Serena B.»); il tasto «Come si crea…» compare solo a chi non ha la sua API o il suo worker. *(Con il worker della casa resta solo l'API: frase e sezioni da riscrivere in quel giro.)*
- **«La mia chiave è finita in giro»** (link sotto il campo, solo per chi ha un'API sua; testo R4 approvato): «Niente paura. Una chiave Google Libri fa solo ricerche di libri e non costa niente: al massimo qualcuno consuma le tue ricerche del giorno. Per chiuderla fuori: 1. Apri Google Cloud › Credenziali. 2. Tocca la tua chiave › «Rigenera chiave». 3. Incolla qui la chiave nuova. Gli amici a cui la presti continuano a cercare senza fare niente.»
- Pulsante «Deploy to Cloudflare» per il worker: lasciato stare (con il worker della casa non serve più).

## Prestito tra amici
- Si presta **solo dentro l'app** e **solo agli amici**. Il link con la chiave (`#k=`) è stato tolto (giro 8): un vecchio link aperto oggi mostra solo un avviso e non cambia niente.
- Si prestano **solo API (e, finché c'è, worker) propri**: il server rifiuta quelli di un altro («non tua»), e l'app riconosce e toglie dal telefono quelli altrui (026, dopo il caso del 18/11/2026).
- **Resta tutto sul server**: sul telefono dell'amico arriva solo un segno, mai l'API né l'indirizzo del worker. Le sue ricerche passano dalla funzione `libri` di Supabase. I worker copiati prima sono stati cancellati dai telefoni (chi li avesse copiati potrebbe ancora usarli: accettato).
- **Limiti per amico**: **300 ricerche al giorno con l'API**; oggi anche **3.000 con il worker** (sparisce con il worker della casa). Giorno UTC, come Cloudflare. Arrivati al limite, fino al giorno dopo l'app cerca in Open Library. Testo approvato per il worker (finché c'è): «Per oggi hai finito le ricerche con il worker di Marta. Fino a domattina l'app cerca in Open Library e con Google.» (al posto di Marta il nome di chi presta). Niente link «Il mio worker è finito in giro».
- Chi presta **cambia l'API**: la nuova vale subito per tutti gli amici, senza un'altra notifica.
- Chi presta **smette**: si ferma alla ricerca successiva; il server risponde 403 e l'app dice che l'API prestata non c'è più (mai «Google è al limite» a chi non ha un'API sua).
- Contatore «La usano N amici» in fondo a «Presta a un amico» (solo amici, solo con l'account).
- Testo della finestra «API Google e worker» (giro 5, approvato con il nome di allora): «Una chiave Google Libri fa 1.000 ricerche al giorno. Con un uso normale bastano per te e per decine di amici. Il primo giorno, quando un amico carica la sua libreria, ne consuma di più: puoi aiutare fino a **6 amici nuovi al giorno** (50 libri ciascuno). Il worker ne regge migliaia. Prestarli non ti costa niente e puoi smettere quando vuoi. Tocca un amico per scegliere cosa prestargli.» *(Con il worker della casa la frase sul worker va tolta: testo nuovo da chiedere a Piero in quel giro.)*

## «Chiedimela» (giro 12)
- L'app deve sapere **chi ha un'API sua da prestare**: ogni telefono dice al server **solo un sì/no** («ho un'API mia», oggi anche «ho un worker mio»); i valori restano sul telefono. Lo vedono solo gli amici. Il sì/no lo dichiara il telefono (il server non può controllarlo senza vederlo).
- **Dove**: Indice › Amici › API Google e worker (sezione «Chiedila a un amico»); percorso del primo avvio, passo 2; **profilo dell'amico**, in un riquadro sotto il riquadro del profilo (non nella riga dei tasti): «🔑 Anna ha un'API Google Libri sua. Se te la presta, la tua ricerca trova molti più libri, con copertine e descrizioni. [Chiedimela]» → «Richiesta mandata».
- Compare **solo a chi non ha un'API sua né prestata**, e solo accanto agli amici che ne hanno una loro (anche se la prestano già).
- **Limiti**: una richiesta allo stesso amico **ogni 7 giorni**, **10 al giorno** in tutto. Chi la riceve non deve rifiutare: basta ignorarla. Nella campanella un solo avviso per persona; push nel tipo «Chiavi condivise».
- «Prestala» apre «Presta a …», dove si sceglie cosa prestare (oggi API, worker o tutti e due; con il worker della casa solo l'API); chi non ha niente di suo viene portato a «Crea la tua API».
- Un amico compare solo dopo aver aperto almeno una volta l'app aggiornata con il suo account (oppure se presta già a qualcuno).
- **Da riprendere dopo il worker della casa** (Piero, 20/11/2026): rendere più visibile «cerca tra i tuoi amici chi può prestarti l'API», con i tasti. Domande già preparate: dove metterla (pillola in Libreria, pagina I tuoi amici, finestra «Titolo o ISBN»), se mostrare anche gli amici senza API, tasto «Scrivi» accanto a «Chiedimela».
- **Idea per il futuro** (Piero): riconoscimenti per chi presta la sua API (il server sa già chi presta e a quanti). In sospeso: IN_SOSPESO 32.

## Tecnica
- Database: 020 (API prestata sul server, avvisi importanti), 026 (solo le proprie, worker dal server), 027 (limite del worker), 030 (`chiavi_ho`, `chiavi_richieste`, `chiavi_dichiara`, `amici_chiavi`, `chiedi_chiavi`). Vera e prova con 001-030. Il worker della casa richiederà una migrazione nuova (contatori al giorno per utente, per telefono e totale senza account) e i segreti del worker nel Vault o nei segreti della funzione.
- Funzione `libri` versione 3 in tutte e due le copie: `?da=&isbn=` per il worker; 429 + `x-nl-stop: mio` al limite del worker; 403 + `x-nl-stop: no` se il prestito è tolto.
- App: `app.js` `apiFetch`, `lentFetch`, `lentWorker`, `LENTW_STOP`; `amici.js` `declareKeys`, `askState`, `NLAmici.ask`, `ownCheck`; `notifiche.js` `lendKey`; `ricerche.js` (guida); `profilo.js` (`.pf-ask`).
- Ogni ricerca con un'API prestata o con il worker della casa è una chiamata alla funzione del server (500.000 al mese nel piano gratuito, condivise con le push).
