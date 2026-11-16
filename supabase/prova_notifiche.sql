-- Prova delle notifiche (011_notifiche.sql). Alla fine ANNULLA tutto.
-- A e B amici; C chiede l'amicizia ad A; D estraneo.
begin;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'prova-a@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'prova-b@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'prova-c@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d4', 'prova-d@invalid.test', 'authenticated', 'authenticated');
insert into public.profili (id, nome, utente, libreria) values
  ('00000000-0000-0000-0000-0000000000a1', 'Anna', 'Anna', false), ('00000000-0000-0000-0000-0000000000b2', 'Bruno', 'Bruno', true),
  ('00000000-0000-0000-0000-0000000000c3', 'Carla', 'Carla', false), ('00000000-0000-0000-0000-0000000000d4', 'Dario', 'Dario', false);
insert into public.amicizie (da, a, stato) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'amici');
insert into public.libri (utente, id, dati) values ('00000000-0000-0000-0000-0000000000b2', 'l1', '{"t":"Libro di Bruno","w":false}');
create temp table esito (prova text, risultato text) on commit drop;
create temp table ids (k text primary key, v uuid) on commit drop;
grant all on esito, ids to anon, authenticated;
create function pg_temp.n(u text, t text) returns int language sql as $$
  select count(*)::int from public.notifiche where utente = ('00000000-0000-0000-0000-0000000000' || u)::uuid and tipo = t $$;
create function pg_temp.nl(u text, t text) returns int language sql as $$
  select count(*)::int from public.notifiche where utente = ('00000000-0000-0000-0000-0000000000' || u)::uuid and tipo = t and not letta $$;

set local role anon;
do $$ begin
  begin perform count(*) from public.notifiche; insert into esito values ('anon legge notifiche', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito values ('anon legge notifiche', 'negato (bene)'); end;
  begin perform * from public.mie_notifiche(); insert into esito values ('anon mie_notifiche', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito values ('anon mie_notifiche', 'negato (bene)'); end;
end $$;
reset role;

-- amicizia: C chiede, A accetta
insert into public.amicizie (da, a) values ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a1');
insert into esito values ('A: richiesta da C', pg_temp.nl('a1', 'amicizia') || ' (1)');
update public.amicizie set stato = 'amici' where da = '00000000-0000-0000-0000-0000000000c3' and a = '00000000-0000-0000-0000-0000000000a1';
insert into esito values ('A: richiesta letta dopo il sì', pg_temp.nl('a1', 'amicizia') || ' (0)');
insert into esito values ('C: A ha accettato', pg_temp.n('c3', 'amico') || ' (1)');

-- prestito A → B, reso segnalato, rifiutato, di nuovo, confermato
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ begin insert into ids values ('s', public.crea_scambio('00000000-0000-0000-0000-0000000000b2', 'prestito', '{"t":"Il prestito"}', 'x1')); end $$;
reset role;
insert into esito values ('B: prestito ricevuto', pg_temp.n('b2', 'prestito') || ' (1)');
insert into esito values ('B: titolo', (select titolo from public.notifiche where tipo = 'prestito'));
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
do $$ begin perform public.segnala_reso((select v from ids where k = 's')); end $$;
reset role;
insert into esito values ('A: B dice di aver reso', pg_temp.nl('a1', 'reso') || ' (1)');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ begin perform public.rifiuta_reso((select v from ids where k = 's')); end $$;
reset role;
insert into esito values ('B: reso non ancora ricevuto', pg_temp.n('b2', 'reso_no') || ' (1)');
insert into esito values ('A: avviso del reso letto', pg_temp.nl('a1', 'reso') || ' (0)');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
do $$ begin perform public.segnala_reso((select v from ids where k = 's')); end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ begin perform public.chiudi_scambio((select v from ids where k = 's')); end $$;
reset role;
insert into esito values ('B: reso confermato', pg_temp.n('b2', 'reso_ok') || ' (1)');

-- regalo chiuso (cambiato o annullato da chi regala): nessun avviso
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ begin insert into ids values ('r', public.crea_scambio('00000000-0000-0000-0000-0000000000b2', 'regalo', '{"t":"Il regalo"}', 'x2'));
  perform public.chiudi_scambio((select v from ids where k = 'r')); end $$;
reset role;
insert into esito values ('B: regalo e chiusura', pg_temp.n('b2', 'regalo') || '+' || pg_temp.n('b2', 'chiuso') || ' (1+0)');

-- Me lo presti?: A chiede, B dice sì; A chiede di nuovo e annulla
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ begin insert into ids values ('q', public.chiedi_prestito('00000000-0000-0000-0000-0000000000b2', 'l1')); end $$;
reset role;
insert into esito values ('B: richiesta di prestito', pg_temp.nl('b2', 'richiesta') || ' (1)');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
do $$ begin perform public.rispondi_richiesta((select v from ids where k = 'q'), true); end $$;
reset role;
insert into esito values ('A: B presta / B: richiesta letta', pg_temp.n('a1', 'richiesta_si') || ' / ' || pg_temp.nl('b2', 'richiesta') || ' (1 / 0)');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ begin insert into ids values ('q2', public.chiedi_prestito('00000000-0000-0000-0000-0000000000b2', 'l1'));
  perform public.annulla_richiesta((select v from ids where k = 'q2')); end $$;
reset role;
insert into esito values ('B: richiesta annullata sparita', pg_temp.n('b2', 'richiesta') || ' (1, solo la prima)');

-- consiglio e chiavi
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ begin insert into ids values ('c', public.consiglia('00000000-0000-0000-0000-0000000000b2', '{"t":"Da leggere"}'));
  perform public.presta_chiavi('00000000-0000-0000-0000-0000000000b2', 'chiave1', '');
  perform public.presta_chiavi('00000000-0000-0000-0000-0000000000b2', 'chiave2', ''); end $$;
reset role;
insert into esito values ('B: consiglio / chiavi (una sola)', pg_temp.nl('b2', 'consiglio') || ' / ' || pg_temp.n('b2', 'chiavi') || ' (1 / 1)');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
do $$ begin perform public.togli_consiglio((select v from ids where k = 'c')); end $$;
reset role;
insert into esito values ('B: consiglio letto dopo averlo tolto', pg_temp.nl('b2', 'consiglio') || ' (0)');

-- lettura: ognuno solo le sue; segna lette
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
do $$ declare n int; m int; t text; begin
  select count(*), count(*) filter (where not letta) into n, m from public.mie_notifiche();
  select string_agg(distinct coalesce(nome, '?'), ',') into t from public.mie_notifiche();
  insert into esito values ('B: mie_notifiche (tutte / non lette / da)', n || ' / ' || m || ' / ' || t || ' (7 / 5 / Anna)');
end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}';
do $$ declare n int; begin
  select count(*) into n from public.notifiche; insert into esito values ('D legge la tabella', n || ' (0)');
  select count(*) into n from public.mie_notifiche(); insert into esito values ('D mie_notifiche', n || ' (0)');
  perform public.notifiche_lette(null);
  begin perform public.notifica_nuova('00000000-0000-0000-0000-0000000000b2', null, 'amico', '', 'falsa'); insert into esito values ('D scrive una notifica', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito values ('D scrive una notifica', 'negato (bene)'); end;
end $$;
reset role;
insert into esito values ('B: non lette dopo il tentativo di D', (select count(*) from public.notifiche where utente = '00000000-0000-0000-0000-0000000000b2' and not letta) || ' (5)');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
do $$ begin perform public.notifiche_lette(array[(select id from public.mie_notifiche() where tipo = 'prestito')]); end $$;
reset role;
insert into esito values ('B: una letta', (select count(*) from public.notifiche where utente = '00000000-0000-0000-0000-0000000000b2' and not letta) || ' (4)');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
do $$ begin perform public.notifiche_lette(); end $$;
reset role;
insert into esito values ('B: tutte lette', (select count(*) from public.notifiche where utente = '00000000-0000-0000-0000-0000000000b2' and not letta) || ' (0)');

-- pulizia: notifiche vecchie, amicizia tolta, account eliminato
insert into public.notifiche (utente, da, tipo, creata) values ('00000000-0000-0000-0000-0000000000c3', null, 'amico', now() - interval '40 days');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ begin perform public.consiglia('00000000-0000-0000-0000-0000000000c3', '{"t":"Per Carla"}'); end $$;
reset role;
insert into esito values ('C: vecchie di 40 giorni tolte', (select count(*) from public.notifiche where utente = '00000000-0000-0000-0000-0000000000c3' and creata < now() - interval '30 days') || ' (0)');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ begin perform public.togli_amicizia('00000000-0000-0000-0000-0000000000b2'); end $$;
reset role;
insert into esito values ('dopo togli_amicizia A-B', (select count(*) from public.notifiche where '00000000-0000-0000-0000-0000000000a1' in (utente, da) and '00000000-0000-0000-0000-0000000000b2' in (utente, da)) || ' (0)');
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a1';
insert into esito values ('dopo eliminazione di A', (select count(*) from public.notifiche where '00000000-0000-0000-0000-0000000000a1' in (utente, da)) || ' (0)');
select * from esito;
rollback;
