-- Prova di 020_chiave_sul_server_avvisi.sql. Finisce con un errore voluto che mostra l'esito e ANNULLA tutto.
-- A presta la chiave a B (amici). C è amico di A ma senza prestito. Tra parentesi il risultato atteso.
begin;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'prova-a@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'prova-b@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'prova-c@invalid.test', 'authenticated', 'authenticated');
insert into public.profili (id, nome, utente) values
  ('00000000-0000-0000-0000-0000000000a1', 'Anna', 'Anna prova'),
  ('00000000-0000-0000-0000-0000000000b2', 'Bruno', 'Bruno prova'),
  ('00000000-0000-0000-0000-0000000000c3', 'Carla', 'Carla prova');
insert into public.amicizie (da, a, stato) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'amici'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c3', 'amici');
create temp table esito (n serial, prova text, risultato text) on commit drop;
grant all on esito to anon, authenticated; grant usage on sequence esito_n_seq to anon, authenticated;

-- A presta chiave e worker a B
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select public.presta_chiavi('00000000-0000-0000-0000-0000000000b2', 'AIzaPROVA_chiave_vecchia_0123456789abcde', 'https://w.prova.workers.dev');
insert into esito (prova, risultato) select '1 chi presta vede solo i segni', gb_key || '/' || sbn || ' (si/si)' from public.chiavi_mie() where da = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  begin perform public.chiave_prestata('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1');
    insert into esito (prova, risultato) values ('2 chiave_prestata da utente', 'CHIAMATA RIUSCITA (doveva essere negata)');
  exception when insufficient_privilege then insert into esito (prova, risultato) values ('2 chiave_prestata da utente', 'negata (negata)'); end;
  begin perform public.avviso_importante('x', 'y');
    insert into esito (prova, risultato) values ('3 avviso_importante da utente', 'CHIAMATA RIUSCITA (doveva essere negata)');
  exception when insufficient_privilege then insert into esito (prova, risultato) values ('3 avviso_importante da utente', 'negato (negato)'); end;
end $$;

-- B: riceve il segno, mai la chiave
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
insert into esito (prova, risultato) select '4 chi riceve vede il segno', gb_key || ' ' || sbn || ' (prestata:…a1 https://w.prova.workers.dev)' from public.chiavi_mie() where a = '00000000-0000-0000-0000-0000000000b2';
insert into esito (prova, risultato) select '5 notifica chiavi a B', count(*) || ' (1)' from public.notifiche where utente = '00000000-0000-0000-0000-0000000000b2' and tipo = 'chiavi';
reset role;

-- il server chiede la chiave
do $$ declare r jsonb; i int; kg text := 'g:' || encode(sha256(convert_to('AIzaPROVA_chiave_vecchia_0123456789abcde', 'UTF8')), 'hex');
  g date := (now() at time zone 'America/Los_Angeles')::date;
begin
  r := public.chiave_prestata('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1');
  insert into esito (prova, risultato) values ('6 prima ricerca di B', (r->>'k') || ' tot=' || (r->>'tot') || ' mio=' || (r->>'mio') || ' (AIzaPROVA_chiave_vecchia… tot=1 mio=1)');
  r := public.chiave_prestata('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a1');
  insert into esito (prova, risultato) values ('7 C senza prestito', r::text || ' ({"e": "no"})');
  r := public.chiave_prestata('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2');
  insert into esito (prova, risultato) values ('8 al contrario', r::text || ' ({"e": "no"})');
  for i in 2 .. 300 loop r := public.chiave_prestata('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1'); end loop;
  insert into esito (prova, risultato) values ('9 la 300ª passa', 'mio=' || (r->>'mio') || ' k=' || (r ? 'k') || ' (mio=300 k=true)');
  r := public.chiave_prestata('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1');
  insert into esito (prova, risultato) values ('10 la 301ª no', r::text || ' ({"e": "mio", "mio": 300, "tot": 300})');
  -- totale della chiave a 949: passa una, poi «pieno» e notifica «limite» con il nome di chi presta
  update public.ricerche set n = 0 where chiave like 'p:%' and giorno = g;
  update public.ricerche set n = 949 where chiave = kg and giorno = g;
  r := public.chiave_prestata('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1');
  insert into esito (prova, risultato) values ('11 a 949 passa', 'tot=' || (r->>'tot') || ' k=' || (r ? 'k') || ' (tot=950 k=true)');
  r := public.chiave_prestata('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1');
  insert into esito (prova, risultato) values ('12 a 950 no', (r->>'e') || ' (pieno)');
  insert into esito (prova, risultato) select '13 notifica limite', count(*) || ' ' || coalesce(max(titolo), '') || ' (1 Anna prova)' from public.notifiche where utente = '00000000-0000-0000-0000-0000000000b2' and tipo = 'limite';
  update public.ricerche set n = 10 where chiave = kg and giorno = g;
end $$;

-- A cambia chiave: aggiornata per tutti, nessuna notifica nuova; poi il server dà quella nuova
update public.notifiche set letta = true where utente = '00000000-0000-0000-0000-0000000000b2';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
insert into esito (prova, risultato) select '14 chiavi_aggiorna', public.chiavi_aggiorna('AIzaPROVA_chiave_nuova_9876543210zyxwvu') || ' (1)';
do $$ begin
  begin perform public.chiavi_aggiorna('corta'); insert into esito (prova, risultato) values ('15 chiave non valida', 'ACCETTATA');
  exception when others then insert into esito (prova, risultato) values ('15 chiave non valida', sqlerrm || ' (chiave non valida)'); end;
end $$;
reset role;
insert into esito (prova, risultato) select '16 nessuna notifica per il cambio', count(*) || ' (0)' from public.notifiche where utente = '00000000-0000-0000-0000-0000000000b2' and tipo = 'chiavi' and not letta;
insert into esito (prova, risultato) select '17 il server dà la chiave nuova', (public.chiave_prestata('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1')->>'k') || ' (AIzaPROVA_chiave_nuova…)';

-- stop immediato: A smette di prestare; e amicizia tolta
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select public.riprendi_chiavi('00000000-0000-0000-0000-0000000000b2');
reset role;
insert into esito (prova, risultato) select '18 dopo «Smetti di prestare»', public.chiave_prestata('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1')::text || ' ({"e": "no"})';
insert into public.chiavi (da, a, gb_key) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c3', 'AIzaPROVA_chiave_nuova_9876543210zyxwvu');
update public.amicizie set stato = 'attesa' where a = '00000000-0000-0000-0000-0000000000c3';
insert into esito (prova, risultato) select '19 prestito senza amicizia', public.chiave_prestata('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a1')::text || ' ({"e": "no"})';

-- avvisi importanti: a tutti i profili; push sempre (anche a chi ha tolto tutti i tipi)
insert into public.push_preferenze (utente, tipi, silenzio_da, silenzio_a) values ('00000000-0000-0000-0000-0000000000b2', '{}', 0, 0);
insert into public.push_iscrizioni (utente, endpoint, p256dh, auth) values ('00000000-0000-0000-0000-0000000000b2', 'https://fcm.googleapis.com/fcm/send/prova-giro8', repeat('A', 87), repeat('B', 22));
insert into esito (prova, risultato) select '20 avviso a tutti', (public.avviso_importante('Aggiornamento importante', 'Apri Next Libris e aggiorna alla versione nuova.') = (select count(*) from public.profili))::text || ' (true)';
insert into esito (prova, risultato) select '21 avviso nella campanella di B', rif || ' / ' || titolo || ' / da=' || coalesce(da::text, 'nessuno') from public.notifiche where utente = '00000000-0000-0000-0000-0000000000b2' and tipo = 'avviso';
insert into esito (prova, risultato) select '22 push pronto anche senza tipi scelti', count(*) || ' (1)' from public.push_pronte() where utente = '00000000-0000-0000-0000-0000000000b2' and tipo = 'avviso';
do $$ begin
  begin perform public.avviso_importante('', 'x'); insert into esito (prova, risultato) values ('23 avviso senza titolo', 'ACCETTATO');
  exception when others then insert into esito (prova, risultato) values ('23 avviso senza titolo', sqlerrm || ' (titolo: da 1 a 80 caratteri)'); end;
end $$;
do $$ begin raise exception E'ESITO (annullato tutto):\n%', (select string_agg(n || '. ' || prova || ': ' || risultato, E'\n' order by n) from esito); end $$;
