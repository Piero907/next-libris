-- Prova di 016_regali_visibili.sql. Finisce con un errore voluto che mostra l'esito e ANNULLA tutto.
-- A, B, C amici tra loro; B ha un desiderio «w1» visibile; A lo prenota.
begin;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'prova-a@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'prova-b@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'prova-c@invalid.test', 'authenticated', 'authenticated');
insert into public.profili (id, nome, utente, desideri) values
  ('00000000-0000-0000-0000-0000000000a1', 'Anna', 'Anna prova', false),
  ('00000000-0000-0000-0000-0000000000b2', 'Bruno', 'Bruno prova', true),
  ('00000000-0000-0000-0000-0000000000c3', 'Carla', 'Carla prova', false);
insert into public.amicizie (da, a, stato) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'amici'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000b2', 'amici'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c3', 'amici');
insert into public.libri (utente, id, dati) values ('00000000-0000-0000-0000-0000000000b2', 'w1', '{"t":"Desiderio","w":true}');
create temp table esito (n serial, prova text, risultato text) on commit drop;
grant all on esito to anon, authenticated; grant usage on sequence esito_n_seq to anon, authenticated;
insert into esito (prova, risultato) select 'partenza regali', string_agg(utente || '=' || regali, ',' order by utente) || ' (tutti true)' from public.profili where utente like '% prova';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ declare r jsonb; begin
  perform public.prenota_regalo('00000000-0000-0000-0000-0000000000b2', 'w1', true);
  r := public.desideri_di('00000000-0000-0000-0000-0000000000b2');
  insert into esito (prova, risultato) values ('A vede la sua', (r->'libri'->0->>'prenotato') || '/' || (r->'libri'->0->>'preso') || ' (io/true)');
end $$;
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
do $$ declare r jsonb; begin
  r := public.desideri_di('00000000-0000-0000-0000-0000000000b2');
  insert into esito (prova, risultato) values ('C, A acceso', (r->'libri'->0->>'prenotato') || '/' || (r->'libri'->0->>'preso') || ' (Anna prova/true)');
  update public.profili set regali = false where id = '00000000-0000-0000-0000-0000000000a1';
end $$;
reset role;
insert into esito (prova, risultato) select 'C cambia A', case when (select regali from public.profili where id = '00000000-0000-0000-0000-0000000000a1') then 'non cambiato (bene)' else 'CAMBIATO (male)' end;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ begin update public.profili set regali = false where id = '00000000-0000-0000-0000-0000000000a1'; end $$;
reset role;
insert into esito (prova, risultato) select 'A spegne la sua', case when (select regali from public.profili where id = '00000000-0000-0000-0000-0000000000a1') then 'NON CAMBIATO (male)' else 'spenta (bene)' end;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
do $$ declare r jsonb; begin
  r := public.desideri_di('00000000-0000-0000-0000-0000000000b2');
  insert into esito (prova, risultato) values ('C, A spento', '«' || (r->'libri'->0->>'prenotato') || '»/' || (r->'libri'->0->>'preso') || ' («»/true)');
  insert into esito (prova, risultato) values ('C, niente nome', case when r::text like '%Anna%' then 'NOME (male)' else 'bene' end);
end $$;
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ declare r jsonb; begin
  r := public.desideri_di('00000000-0000-0000-0000-0000000000b2');
  insert into esito (prova, risultato) values ('A spento, vede ancora la sua', (r->'libri'->0->>'prenotato') || ' (io)');
end $$;
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
do $$ declare n int; begin
  begin perform public.desideri_di('00000000-0000-0000-0000-0000000000b2'); insert into esito (prova, risultato) values ('B sui suoi', 'PERMESSO (male)');
  exception when others then insert into esito (prova, risultato) values ('B sui suoi', 'negato: ' || sqlerrm || ' (bene)'); end;
  begin select count(*) into n from public.prenotazioni; insert into esito (prova, risultato) values ('B legge prenotazioni', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito (prova, risultato) values ('B legge prenotazioni', 'negato (bene)'); end;
end $$;
reset role;
do $$ begin raise exception E'ESITO (annullato tutto):\n%', (select string_agg(n || '. ' || prova || ': ' || risultato, E'\n' order by n) from esito); end $$;
