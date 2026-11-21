-- Prova di 033_suggerimenti_amici.sql. Finisce con un errore voluto che mostra l'esito e ANNULLA tutto.
-- A amici di B (libreria visibile, «Lo consiglio» visibile) e di C (libreria nascosta); D non è amico di A.
begin;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'prova-a@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'prova-b@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'prova-c@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d4', 'prova-d@invalid.test', 'authenticated', 'authenticated');
insert into public.profili (id, nome, utente, libreria, p_cons) values
  ('00000000-0000-0000-0000-0000000000a1', 'Anna', 'Anna prova', true, true),
  ('00000000-0000-0000-0000-0000000000b2', 'Bruno', 'Bruno prova', true, true),
  ('00000000-0000-0000-0000-0000000000c3', 'Carla', 'Carla prova', false, true),
  ('00000000-0000-0000-0000-0000000000d4', 'Dario', 'Dario prova', true, true);
insert into public.amicizie (da, a, stato) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'amici'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a1', 'amici'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d4', 'attesa');
insert into public.libri (utente, id, dati) values
  ('00000000-0000-0000-0000-0000000000a1', 'a1', '{"t":"Il barone rampante","a":"Italo Calvino","i":"9788804668237"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'a2', '{"t":"La storia","a":"Elsa Morante","w":true}'),
  ('00000000-0000-0000-0000-0000000000b2', 'b1', '{"t":"Il barone rampante","a":"Italo Calvino","i":"9788804668237","rt":5}'),
  ('00000000-0000-0000-0000-0000000000b2', 'b2', '{"t":"La Storia","a":"Morante, Elsa","rt":5}'),
  ('00000000-0000-0000-0000-0000000000b2', 'b3', '{"t":"Lessico famigliare","a":"Natalia Ginzburg","lc":true,"n":"nota segreta","qs":[{"x":"citazione"}]}'),
  ('00000000-0000-0000-0000-0000000000b2', 'b4', '{"t":"Le otto montagne","a":"Paolo Cognetti","rt":4,"p":"Marta"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'b5', '{"t":"Libro mediocre","a":"X","rt":2}'),
  ('00000000-0000-0000-0000-0000000000b2', 'b6', '{"t":"Desiderio di Bruno","a":"Y","rt":5,"w":true}'),
  ('00000000-0000-0000-0000-0000000000c3', 'c1', '{"t":"Nascosto","a":"Z","rt":5}'),
  ('00000000-0000-0000-0000-0000000000d4', 'd1', '{"t":"Non amico","a":"W","rt":5}');
create temp table esito (n serial, prova text, risultato text) on commit drop;
grant all on esito to anon, authenticated; grant usage on sequence esito_n_seq to anon, authenticated;
set local role anon;
do $$ begin
  begin perform public.suggerimenti_amici(); insert into esito (prova, risultato) values ('anon', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito (prova, risultato) values ('anon', 'negato (bene)'); end;
end $$;
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
insert into esito (prova, risultato) select 'amici visibili', string_agg((x->>'utente') || ' comuni=' || (x->>'comuni'), ', ') || ' (atteso: solo Bruno comuni=1)' from jsonb_array_elements(public.suggerimenti_amici()->'amici') x;
insert into esito (prova, risultato) select 'libri', string_agg(x->>'t', ' | ' order by x->>'t') || ' (atteso: Le otto montagne | Lessico famigliare)' from jsonb_array_elements(public.suggerimenti_amici()->'libri') x;
insert into esito (prova, risultato) select 'campi', string_agg(k, ',' order by k) || ' (mai n, qs)' from (select distinct jsonb_object_keys(x) k from jsonb_array_elements(public.suggerimenti_amici()->'libri') x) s;
insert into esito (prova, risultato) select 'segni', string_agg((x->>'t') || ':lc=' || coalesce(x->>'lc','-') || ',fuori=' || (x->>'fuori'), ' ; ' order by x->>'t') || ' (atteso Lessico lc=true, Otto fuori=true)' from jsonb_array_elements(public.suggerimenti_amici()->'libri') x;
reset role;
update public.profili set p_cons = false where id = '00000000-0000-0000-0000-0000000000b2';
set local role authenticated;
insert into esito (prova, risultato) select 'Lo consiglio nascosto', coalesce(string_agg(x->>'t', ' | '), '-') || ' (atteso: solo Le otto montagne)' from jsonb_array_elements(public.suggerimenti_amici()->'libri') x;
reset role;
do $$ begin raise exception E'ESITO (voluto, annulla tutto):\n%', (select string_agg(n || '. ' || prova || ': ' || risultato, E'\n' order by n) from esito); end $$;
