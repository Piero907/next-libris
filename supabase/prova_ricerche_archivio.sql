-- Prova di 012_ricerche_archivio.sql. Si lancia tutta insieme (execute_sql): finisce con un errore voluto che mostra l'esito e ANNULLA tutto.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'prova-a@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'prova-b@invalid.test', 'authenticated', 'authenticated');
create temp table esito (prova text, risultato text) on commit drop;
grant all on esito to anon, authenticated;
set local role anon;
do $$ begin
  begin perform public.conta_ricerche('g:' || repeat('a', 64), 1); insert into esito values ('anon conta', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito values ('anon conta', 'negato (bene)'); end;
  begin perform public.da_archivio('9788806219352'); insert into esito values ('anon archivio', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito values ('anon archivio', 'negato (bene)'); end;
end $$;
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ declare t int; begin
  begin perform count(*) from public.ricerche; insert into esito values ('A legge la tabella ricerche', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito values ('A legge la tabella ricerche', 'negato (bene)'); end;
  begin perform count(*) from public.archivio; insert into esito values ('A legge la tabella archivio', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito values ('A legge la tabella archivio', 'negato (bene)'); end;
  for i in 1 .. 5 loop t := public.conta_ricerche('g:' || repeat('a', 64), 188, 'Bruno'); end loop;   -- al massimo 200 per volta
  insert into esito values ('A: 940 ricerche', t || ' (940)');
  insert into esito values ('A: notifiche prima di 950', (select count(*) from public.notifiche where tipo = 'limite') || ' (0)');
  t := public.conta_ricerche('g:' || repeat('a', 64), 0);
  insert into esito values ('A: solo lettura', t || ' (940)');
  begin perform public.conta_ricerche('g:' || repeat('a', 64), 5000); insert into esito values ('A: 5000 in una volta', 'PERMESSO (male)');
  exception when others then insert into esito values ('A: 5000 in una volta', 'rifiutato (bene)'); end;
  begin perform public.conta_ricerche('x:abc', 1); insert into esito values ('A: chiave non valida', 'PERMESSO (male)');
  exception when others then insert into esito values ('A: chiave non valida', 'rifiutata (bene)'); end;
  begin perform public.conta_ricerche('a:' || repeat('a', 64), 1); insert into esito values ('A: conta i salvataggi di un altro', 'PERMESSO (male)');
  exception when others then insert into esito values ('A: conta i salvataggi di un altro', 'rifiutato (bene)'); end;
end $$;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
do $$ declare t int; begin
  t := public.conta_ricerche('g:' || repeat('a', 64), 15, 'Bruno');
  insert into esito values ('B: stessa chiave, totale condiviso', t || ' (955)');
  t := public.conta_ricerche('g:' || repeat('a', 64), 1, 'Bruno');
  t := public.conta_ricerche('s:' || repeat('b', 64), 3);
  insert into esito values ('B: worker a parte', t || ' (3)');
  -- archivio
  perform public.archivia('9788806219352', '{"t":"Il Gattopardo","a":"Tomasi di Lampedusa","e":"Feltrinelli","y":"2015","img":"https://covers.openlibrary.org/b/id/1-M.jpg","ds":"Sicilia","n":"nota privata","p":"Anna","c":12}');
  insert into esito values ('B: archivio, solo i campi pubblici', (select string_agg(k, ',' order by k) from jsonb_object_keys(public.da_archivio('9788806219352')) k) || ' (a,ds,e,img,t,y)');
  perform public.archivia('9788806219352', '{"t":"Titolo sbagliato","pg":"320","img":"http://non-sicuro"}');
  insert into esito values ('B: non cambia i dati già salvati, aggiunge le pagine', (public.da_archivio('9788806219352') ->> 't') || ' / ' || (public.da_archivio('9788806219352') ->> 'pg') || ' (Il Gattopardo / 320)');
  perform public.archivia('9788806219353', '{"a":"senza titolo"}');
  insert into esito values ('B: senza titolo non si salva', coalesce(public.da_archivio('9788806219353')::text, 'null') || ' (null)');
  begin perform public.archivia('12345', '{"t":"x"}'); insert into esito values ('B: ISBN non valido', 'PERMESSO (male)');
  exception when others then insert into esito values ('B: ISBN non valido', 'rifiutato (bene)'); end;
  perform public.archivia('9788806219354', jsonb_build_object('t', 'Lungo', 'ds', repeat('x', 7000)));
  insert into esito values ('B: descrizione troppo lunga scartata', (public.da_archivio('9788806219354') ? 'ds')::text || ' (false)');
end $$;
reset role;
insert into esito values ('notifiche «limite» (B una, A nessuna: A non ha più cercato)', (select string_agg(coalesce(p.nome, '?') || ':' || n.titolo, ',') from public.notifiche n left join public.profili p on p.id = n.utente where n.tipo = 'limite')
  || ' / B=' || (select count(*) from public.notifiche where tipo = 'limite' and utente = '00000000-0000-0000-0000-0000000000b2') || ' (B=1, titolo Bruno)');
insert into esito values ('archivio senza utenti', (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'archivio' and data_type = 'uuid') || ' (0)');
do $$ begin raise exception E'ESITO\n%', (select string_agg(prova || ': ' || risultato, E'\n') from esito); end $$;
