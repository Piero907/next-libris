-- Prova di 015_amici_visibili.sql (amici_di e profili.amici). Finisce con un errore voluto che mostra l'esito e ANNULLA tutto.
-- A-B, B-C, A-C amici (C in comune); B-D amici; A ha chiesto l'amicizia a D (in attesa).
begin;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'prova-a@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'prova-b@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'prova-c@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d4', 'prova-d@invalid.test', 'authenticated', 'authenticated');
insert into public.profili (id, nome, utente) values
  ('00000000-0000-0000-0000-0000000000a1', 'Anna', 'Anna prova'),
  ('00000000-0000-0000-0000-0000000000b2', 'Bruno', 'Bruno prova'),
  ('00000000-0000-0000-0000-0000000000c3', 'Carla', 'Carla prova'),
  ('00000000-0000-0000-0000-0000000000d4', 'Dario', 'Dario prova');
insert into public.amicizie (da, a, stato) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'amici'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000b2', 'amici'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c3', 'amici'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d4', 'amici'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d4', 'attesa');
create temp table esito (n serial, prova text, risultato text) on commit drop;
grant all on esito to anon, authenticated; grant usage on sequence esito_n_seq to anon, authenticated;
insert into esito (prova, risultato) select 'partenza amici', string_agg(utente || '=' || amici, ',' order by utente) || ' (tutti true)' from public.profili where utente like '% prova';
set local role anon;
do $$ begin
  begin perform public.amici_di('00000000-0000-0000-0000-0000000000b2'); insert into esito (prova, risultato) values ('anon', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito (prova, risultato) values ('anon', 'negato (bene)'); end;
end $$;
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ declare r jsonb; begin
  r := public.amici_di('00000000-0000-0000-0000-0000000000b2');
  insert into esito (prova, risultato) values ('A guarda B (acceso)', r::text || ' (Carla comune amici, poi Dario inviata; niente Anna)');
  insert into esito (prova, risultato) values ('niente email', case when r::text like '%@%' then 'EMAIL (male)' else 'bene' end);
  begin perform public.amici_di('00000000-0000-0000-0000-0000000000d4'); insert into esito (prova, risultato) values ('A guarda D (non amici)', 'PERMESSO (male)');
  exception when others then insert into esito (prova, risultato) values ('A guarda D (non amici)', 'negato: ' || sqlerrm || ' (bene)'); end;
  update public.profili set amici = false where id = '00000000-0000-0000-0000-0000000000b2';
  insert into esito (prova, risultato) select 'A cambia B', case when (select amici from public.profili where id = '00000000-0000-0000-0000-0000000000b2' ) is distinct from false then 'non cambiato (bene)' else 'CAMBIATO (male)' end;
  update public.profili set amici = false where id = '00000000-0000-0000-0000-0000000000a1';
end $$;
reset role;
insert into esito (prova, risultato) select 'A spegne il suo', amici::text || ' (false)' from public.profili where id = '00000000-0000-0000-0000-0000000000a1';
update public.profili set amici = false where id = '00000000-0000-0000-0000-0000000000b2';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ begin
  insert into esito (prova, risultato) values ('A guarda B (spento)', public.amici_di('00000000-0000-0000-0000-0000000000b2')::text || ' (solo Carla, visibili false)');
end $$;
reset role;
do $$ begin raise exception E'ESITO (voluto, annulla tutto):\n%', (select string_agg(n || '. ' || prova || ': ' || risultato, E'\n' order by n) from esito); end $$;
rollback;
