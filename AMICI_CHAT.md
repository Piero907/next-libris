# Next Libris — account, amici, chat e avvisi

**Aggiornato il 20/11/2026, vera 111.** Funzionamento e scelte; l'aspetto (segnalibri, profilo con l'ex libris, chat) sta in `claude/stile-base.md` (`STILE.md`). Copia uguale: progetto Claude `claude/amici-chat-avvisi.md`, ramo `prove` `AMICI_CHAT.md`.

Tutte le scelte qui sotto sono di Piero e **già chieste: non richiedere**.

## Account e nome
- Solo **«Accedi con Google»** (`CFG.email = false`; niente email né Brevo). Il telefono resta la copia principale; con l'account i libri si salvano anche online. Configurazione in `claude/accesso-google-e-servizi.md`.
- **Nome utente obbligatorio** (dalla vera 109): la domanda compare subito dopo l'accesso e a ogni apertura finché manca, senza «Più tardi» né chiusura. Proposta già scritta: nome e iniziale del cognome da Google («Victoria I.»). Nome già usato: lo dice il database al tocco su «Conferma» (indice unico senza maiuscole/minuscole). Grafica verde come le schede di benvenuto («Come ti chiami?», con l'iniziale e «Ciao, …» che cambiano mentre scrivi). Motivo: la ricerca degli amici (`cerca_utenti`) lavora solo sul nome utente.

## Amici
- Amicizia **reciproca**, un solo nome (`profili.utente`). Si trovano con la ricerca per nome, con il link d'invito (`?amico=`) e dal profilo degli amici degli amici.
- **Dove**: segnalibro **Amici** (stile G). Nella pagina «I tuoi amici» la ricerca sta sempre sopra l'elenco («Nessun amico con questo nome.»); **scorre solo il riquadro dell'elenco**, così «Aggiungi un amico» resta a portata (111.2).
- Elenco: niente «0 amici in comune»; «in comune» detto una volta («1 amico · 3 libri in comune»).
- La libreria dell'amico è **solo da leggere** (modalità ospite), con lo **stesso layout** della propria; «ce l'hai anche tu» (✓) e «ce l'ha Marta». Libri prestati o ricevuti mai uniti come doppioni. Il reso lo conferma chi presta.
- Togliere un amico: icona in rosso nel profilo, con conferma.

## Profilo (tuo e degli amici)
- Stesso layout per il tuo profilo e per quello di un amico. **Niente foto**: il nome sta nell'ex libris (stile G); le iniziali colorate restano solo negli elenchi.
- Parti: Libreria e Desideri (sempre), **Scrivi**, ⇄ (solo se tra voi c'è un prestito o un regalo), riquadro «Chiedimela» (vedi `claude/api-e-worker.md`), **In lettura**, **Consigliati** (stella = «Lo consiglio»; i Preferiti sono stati tolti il 18/11), **citazioni in evidenza** (al massimo 3, con la puntina; prendono il posto della citazione preferita), numeri. Il tocco su una copertina apre quel libro nella sua libreria.
- Numeri e immagine da condividere: `claude/libreria-e-libro.md`. Nel profilo dell'amico in più «in comune con te» («12 libri · il 24% dei suoi») e «prestiti tra voi»; **niente «Condividi»**.
- Nel tuo profilo: riquadro «Amici › I tuoi amici» e scorciatoie alle impostazioni (Account e sincronizzazione, Amici e privacy, Notifiche, API Google e worker).
- **Obiettivo dell'anno** facoltativo (1-365 libri), barra «Obiettivo 24 · 75%»; gli amici lo vedono con i numeri.

## Visibilità (Amici e privacy)
- Di partenza **tutto acceso tranne «Gli amici vedono tutte le mie citazioni»**: libreria, desideri, nomi degli amici, regali prenotati, In lettura, Consigliati, citazioni in evidenza (interruttore suo), numeri. Mai appunti.
- In lettura, Consigliati e numeri si vedono **solo se l'amico vede anche la libreria**.
- **«Possono scrivermi»**: tutti / amici degli amici (di partenza) / solo amici. «Persone bloccate» con «Sblocca».

## Desideri degli amici
- **«Segui i suoi Desideri»** (solo se l'amico li mostra; poi «Stai seguendo i suoi Desideri ✓»). Frase approvata: «Piero R. ti mostra già i suoi Desideri: seguili e scopri cosa sogna di leggere. Magari ci trovi il regalo giusto, o il tuo prossimo libro. Ti scriviamo al massimo una volta al giorno, solo quando c'è qualcosa di nuovo, e Piero R. non lo saprà.» (al posto di Piero R. il nome dell'amico). Nei testi mai «di nascosto».
- **«Un tuo desiderio è nella libreria di un amico»**: nel riassunto del giorno (17 UTC), uno per amico, solo se la sua libreria è visibile a te: «📚 Marta ha aggiunto «Il Gattopardo», che è nei tuoi Desideri. [Me lo presti?]».
- Aggiungendo un desiderio che un amico ha già: avviso «Ce l'ha già Marta» (con «Me lo presti?» se ce l'ha uno solo e non è in prestito); il libro **resta nei Desideri**.
- **Stesso libro** = stesso ISBN, oppure stesso titolo e stesso autore (maiuscole, accenti e «Cognome, Nome» non contano; un sottotitolo in più sì).

## Chat
- **Dove**: segnalibro **Chat** dopo Amici, con il numero dei non letti (l'icona in alto è stata tolta il 20/11). «Scrivi» anche dal profilo dell'amico, dall'elenco degli amici, dalla ricerca per nome e da «Ce l'hanno i tuoi amici» di un desiderio; se la chat c'è già si apre quella.
- **Anche con chi non è amico**, con la **richiesta di messaggio**: il primo messaggio va in una cartella a parte; chi lo riceve sceglie Accetta o Rifiuta, e finché non accetta l'altro non può scriverne altri. Chi ha scritto **non sa del rifiuto** (vede «in attesa»); può riprovare **dopo 30 giorni**; **dopo il secondo rifiuto non può più**. Al massimo **15 richieste nuove al giorno** verso chi non è amico.
- **Messaggi**: si tengono **6 mesi** (pulizia ogni notte), fino a **1.000 caratteri**, niente foto. Cancellare un proprio messaggio: per tutti, **solo entro 1 ora** («Messaggio eliminato»); nessuna modifica del testo. **Nessun segno «letto»**. Quasi in diretta senza Realtime: con la chat aperta controllo ogni 15 secondi.
- **Tenuto premuto**: Copia · Elimina per tutti (solo i miei, entro 1 ora) · Segnala (solo quelli degli altri). **⋮**: Silenzia · Profilo · Blocca · Elimina chat («Elimina chat» solo per te: per gli altri resta).
- Amicizia tolta o persona bloccata: la chat resta da leggere, ma non si scrive più.
- **Gruppi**: fino a **30 persone**; nome fino a 40 caratteri; si crea da «+ Nuova» › «👥 Nuovo gruppo» in una schermata. Tutti aggiungono, ma **solo i propri amici**; **solo chi l'ha creato** toglie le persone e cambia il nome; tutti possono uscire; se esce chi l'ha creato il gruppo passa al membro più vecchio. Chi entra vede i messaggi da quel momento. Icona: cerchio con le iniziali del nome. Messaggi di servizio senza maschile («… ha lasciato il gruppo»). Nel ⋮ di un gruppo niente «Elimina chat» (si esce).
- **Libri nella chat**: tasto 📚 accanto al campo e dalla finestra Condividi del libro. Una sola sezione **«Consiglialo»** (amici e gruppi da spuntare, due righe facoltative): i consigli finiscono solo in chat («Ti consiglia»). Tocco su un libro in chat: schedina con «✓ Ce l'hai già», «★ È già nei tuoi Desideri» o «Aggiungi ai Desideri» (il libro ricorda chi l'ha mandato). Viaggiano solo titolo, autore, ISBN, editore, anno, pagine, genere, serie e copertina (solo da Google, Open Library, archive.org); mai appunti, voti o foto fatte a mano.

## Blocca e Segnala
- **Blocco completo**: toglie anche l'amicizia; la persona non ti trova con la ricerca, non può chiederti l'amicizia né aggiungerti ai gruppi; non viene avvisata. Nei gruppi in comune i messaggi tra le due persone sono nascosti nei due versi.
- **Segnala**: Offese o molestie / Spam o pubblicità / Contenuti non adatti / Altro; casella «Blocca anche» già spuntata. L'amministratore riceve avviso e push, vede il messaggio e i 10 prima. Chi segnala lo sa, chi è segnalato no.
- **Stop automatico**: 3 persone diverse in 30 giorni → niente richieste nuove a chi non è amico finché l'amministratore non controlla.

## Avvisi (campanella e push)
- **Campanella** per tutte le novità (amicizie, prestiti e regali, resi, «Me lo presti?», consigli, API, chat); «letto» sul server (tabella `notifiche`, 30 giorni). Push con l'app chiusa, scelta dei tipi e ore di silenzio (22-8). Numero sull'icona dell'app.
- **Avvisi della chat** (giro 11E, al posto del riassunto ogni 2 ore): chat a due = **una notifica per ogni giro di messaggi non letti** (subito se avevi letto tutto, poi niente finché non apri la chat); **gruppi** = uguale, ma con un avviso già in attesa ne riparte uno dopo **30 minuti** per gruppo. Niente avviso se hai quella chat aperta, se è silenziata, se chi scrive è bloccato. Nella campanella un solo avviso per persona («3 messaggi nuovi da Bruno»).
- **Avvisi importanti** (dall'amministratore, a chi ha l'account): titolo fino a 80 caratteri e testo fino a 300, cerchietto «NL»; la push parte sempre, ma rispetta le ore di silenzio. Ultimo: 20/11/2026 «Next Libris si è rifatto il look».

## Amministrazione
- Amministratori in tutte e due le copie: **«Piero R.» e «Next Libris»**; Piero gestisce le segnalazioni. Riconosciuti **dal server** (tabella `amministratori`), mai dal telefono. Non si possono segnalare, si possono bloccare. Segno «Next Libris» accanto al nome.
- **Pannello dentro l'app** (Indice › Amministrazione, solo per loro; `admin.js` si scarica solo se `admin_sono` risponde sì; nessun segreto nel file): schede Segnalazioni · Sospesi · Avviso · Numeri · Archivio.
  - Segnalazioni: «Va tutto bene» (chiude e toglie lo stop), «Tieni fermo», «Sospendi» (con conferma: non può più scrivere a nessuno); «Riattiva» tra i sospesi.
  - Avviso con anteprima e conferma «Non si può ritirare».
  - Numeri: utenti, libri, spazio sui 500 MB, ricerche Google di oggi, chat, segnalazioni.
  - Archivio comune: correggere o togliere un libro; **«Da controllare»** per le proposte dei libri scritti a mano (Approva/Scarta, 029).
- Niente eliminazione degli account dall'app (i casi estremi con Claude sul database). L'amministratore non legge le chat fuori dalle segnalazioni.
- **Regola di sicurezza**: ogni azione passa da funzioni `security definer` che controllano per prime `auth.uid()` in `amministratori`; prova SQL obbligatoria che un utente normale venga respinto.

## Limiti per il piano gratuito
30 messaggi al minuto e 2.000 al giorno a testa, 10 gruppi nuovi al giorno, 10 segnalazioni al giorno, 500 persone bloccate. Un messaggio ≈ 0,6 KB (1.000 utenti in 6 mesi ≈ 330 MB nel caso peggiore). Ogni notifica è una chiamata alla funzione `push` (500.000 al mese, condivise con le ricerche prestate).

## Da sapere
- I messaggi non sono cifrati da un capo all'altro (la privacy lo dice).
- Se si elimina un account, le sue chat a due spariscono anche per l'altra persona; nei gruppi i suoi messaggi restano senza nome.
- Un messaggio cancellato entro l'ora non si può più segnalare con il suo testo.

## Tecnica
- Database: 018-019 (profilo dell'amico, avvisi dei desideri), 021-022 (visibilità), 023 (chat), 024 (consigli in chat), 028 (avvisi della chat subito: `chat_avvisa`, trigger `chat_messaggio_avviso`, `chat_membri.avvisato_il`/`visto_il`), 029 (proposte all'archivio). Cron: push-attese, desideri-riassunto (17 UTC), chat-pulizia (notte).
- App: `amici.js`/`amici.css` (amici, nome, Chiedimela), `profilo.js`/`profilo.css`, `chat.js`/`chat.css`, `notifiche.js`, `push.js`, `admin.js`/`admin.css`, `social.js` (accesso), `privacy.html`.
- Prove: e2e100, 102, 104, 105, 110, 122, 125, 128-131, 136.
