-- Next Libris: la restituzione di un prestito la conferma chi ha prestato (16/11/2026, richiesta di Piero).
-- Chi ha ricevuto il libro dice «Restituito» → stato «reso» (da confermare); chi ha prestato conferma (chiuso) o «Non ancora» (torna aperto).
-- Chi ha prestato può sempre chiudere da solo («Restituito» nel suo libro). Applicato al progetto della prova.
alter table public.scambi drop constraint scambi_stato_check;
alter table public.scambi add constraint scambi_stato_check check (stato in ('aperto', 'reso', 'chiuso'));
-- chiudi_scambio: ora solo chi ha prestato (da), da aperto o reso
-- segnala_reso: solo chi ha ricevuto (a), da aperto a reso
-- rifiuta_reso: solo chi ha prestato, da reso ad aperto
-- miei_scambi: anche quelli «reso»
-- (testo completo delle funzioni: vedi la migrazione «reso_da_confermare» nel progetto; stessa forma di 004)
