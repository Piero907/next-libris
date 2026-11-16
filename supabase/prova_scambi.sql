-- Prova delle regole di desideri, prestiti, regali e prenotazioni (004_desideri_scambi.sql). Alla fine ANNULLA tutto.
-- A e B amici, C amico di A ma non di B, D estraneo. B ha due desideri.
begin;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'prova-a@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'prova-b@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'prova-c@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d4', 'prova-d@invalid.test', 'authenticated', 'authenticated');
insert into public.profili (id, nome, utente) values
  ('00000000-0000-0000-0000-0000000000a1', 'Anna', 'Anna'), ('00000000-0000-0000-0000-0000000000b2', 'Bruno', 'Bruno'),
  ('00000000-0000-0000-0000-0000000000c3', 'Carla', 'Carla'), ('00000000-0000-0000-0000-0000000000d4', 'Dario', 'Dario');
insert into public.amicizie (da, a, stato) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'amici'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000b2', 'amici');
insert into public.libri (utente, id, dati) values
  ('00000000-0000-0000-0000-0000000000b2', 'w1', '{"t":"Desiderio uno","i":"9788800000001","w":true}'),
  ('00000000-0000-0000-0000-0000000000b2', 'w2', '{"t":"Desiderio due","w":true}'),
  ('00000000-0000-0000-0000-0000000000b2', 'l1', '{"t":"Libro mio","w":false}');
create temp table esito (prova text, risultato text) on commit drop;
grant all on esito to anon, authenticated;
set local role anon;
do $$ begin
  begin perform count(*) from public.scambi; insert into esito values ('anon legge scambi', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito values ('anon legge scambi', 'negato (bene)'); end;
  begin perform public.desideri_di('00000000-0000-0000-0000-0000000000b2'); insert into esito values ('anon legge desideri', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito values ('anon legge desideri', 'negato (bene)'); end;
end $$;
reset role;
-- A: desideri di B spenti; poi B li accende
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ begin insert into esito values ('A: desideri di B spenti', (public.desideri_di('00000000-0000-0000-0000-0000000000b2')->>'visibili') || ' (false)'); end $$;
reset role;
update public.profili set desideri = true where id = '00000000-0000-0000-0000-0000000000b2';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
set local role authenticated;
do $$ declare j jsonb; begin
  j := public.desideri_di('00000000-0000-0000-0000-0000000000b2');
  insert into esito values ('A vede i desideri di B', jsonb_array_length(j->'libri') || ' (2, non il libro della libreria)');
  insert into esito values ('A prenota w1', public.prenota_regalo('00000000-0000-0000-0000-0000000000b2', 'w1', true) || ' (io)');
  begin perform public.prenota_regalo('00000000-0000-0000-0000-0000000000b2', 'l1', true); insert into esito values ('A prenota un libro non desiderio', 'PERMESSO (male)');
  exception when others then insert into esito values ('A prenota un libro non desiderio', 'negato (bene)'); end;
  begin perform count(*) from public.prenotazioni; insert into esito values ('A legge la tabella prenotazioni', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito values ('A legge la tabella prenotazioni', 'negato (bene)'); end;
  begin perform public.desideri_di('00000000-0000-0000-0000-0000000000c3'); insert into esito values ('A legge desideri di C (non amici)', 'PERMESSO (male)');
  exception when others then insert into esito values ('A legge desideri di C (non amici)', 'negato (bene)'); end;
end $$;
reset role;
-- C (amico di B): vede che w1 lo regala Anna, non può prenotarlo
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
set local role authenticated;
do $$ declare r text; begin
  select x->>'prenotato' into r from jsonb_array_elements(public.desideri_di('00000000-0000-0000-0000-0000000000b2')->'libri') x where x->>'id' = 'w1';
  insert into esito values ('C vede chi regala w1', r || ' (Anna)');
  begin perform public.prenota_regalo('00000000-0000-0000-0000-0000000000b2', 'w1', true); insert into esito values ('C prenota w1 già preso', 'PERMESSO (male)');
  exception when others then insert into esito values ('C prenota w1 già preso', 'negato (bene)'); end;
end $$;
reset role;
-- B (proprietario): non può leggere le prenotazioni né i suoi desideri con prenotazioni
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
set local role authenticated;
do $$ begin
  begin perform public.desideri_di('00000000-0000-0000-0000-0000000000b2'); insert into esito values ('B vede le prenotazioni sui suoi desideri', 'PERMESSO (male)');
  exception when others then insert into esito values ('B vede le prenotazioni sui suoi desideri', 'negato (bene)'); end;
end $$;
reset role;
-- prestiti e regali: D (estraneo) non può prestare ad A; A presta e regala a B
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}';
set local role authenticated;
do $$ begin
  begin perform public.crea_scambio('00000000-0000-0000-0000-0000000000a1', 'prestito', '{"t":"x"}', 'z'); insert into esito values ('D presta ad A (non amici)', 'PERMESSO (male)');
  exception when others then insert into esito values ('D presta ad A (non amici)', 'negato (bene)'); end;
  begin insert into public.scambi (da, a, tipo, libro) values ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000a1', 'prestito', '{}'); insert into esito values ('D scrive nella tabella', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito values ('D scrive nella tabella', 'negato (bene)'); end;
end $$;
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
set local role authenticated;
do $$ declare p uuid; n int; begin
  p := public.crea_scambio('00000000-0000-0000-0000-0000000000b2', 'prestito', '{"t":"Prestato"}', 'l9');
  perform public.crea_scambio('00000000-0000-0000-0000-0000000000b2', 'regalo', '{"t":"Desiderio uno","i":"9788800000001"}', 'l8');
  perform public.segna_visto(p); select count(*) into n from public.scambi where visto; insert into esito values ('A segna visto per conto di B', n || ' (0)');
end $$;
reset role;
insert into esito select 'regalo fatto: prenotazione tolta', count(*) || ' (0)' from public.prenotazioni;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
set local role authenticated;
do $$ declare r text; p uuid; begin
  select string_agg(nome_da || ':' || tipo || ':' || stato, ',' order by tipo) into r from public.miei_scambi(); insert into esito values ('B vede', coalesce(r, '-') || ' (Anna:prestito:aperto,Anna:regalo:aperto)');
  select id into p from public.miei_scambi() where tipo = 'prestito';
  perform public.segna_visto(p); perform public.chiudi_scambio(p);
  select string_agg(stato || ':' || visto, ',') into r from public.miei_scambi() where tipo = 'prestito'; insert into esito values ('B visto e restituito', coalesce(r, '-') || ' (chiuso:true)');
end $$;
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
set local role authenticated;
do $$ declare n int; begin select count(*) into n from public.miei_scambi(); insert into esito values ('C vede scambi altrui', n || ' (0)'); end $$;
reset role;
select * from esito;
rollback;
