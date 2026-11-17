-- Prova di 017_tetti_e_protezioni.sql. Si lancia tutta insieme (execute_sql): finisce con un errore voluto che mostra l'esito e ANNULLA tutto.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'prova-a@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'prova-b@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'prova-c@invalid.test', 'authenticated', 'authenticated');
insert into public.profili (id, nome, utente) values
  ('00000000-0000-0000-0000-0000000000a1', 'Anna', 'Prova Anna'),
  ('00000000-0000-0000-0000-0000000000b2', 'Bruno', 'Prova Bruno'),
  ('00000000-0000-0000-0000-0000000000c3', 'Carla', 'Prova Carla');
insert into public.amicizie (da, a, stato) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'amici'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a1', 'amici'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c3', 'amici');
create temp table esito (prova text, risultato text) on commit drop;
grant all on esito to anon, authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ declare t int; begin
  -- 1. libri
  insert into public.libri (utente, id, dati) select auth.uid(), 'p' || i, jsonb_build_object('t', 'Libro ' || i) from generate_series(1, 5000) i;
  insert into esito values ('A: 5.000 libri', (select count(*) from public.libri where utente = auth.uid()) || ' (5000)');
  begin insert into public.libri (utente, id, dati) values (auth.uid(), 'nuovo1', '{"t":"x"}'); insert into esito values ('A: libro 5.001', 'PERMESSO (male)');
  exception when others then insert into esito values ('A: libro 5.001', 'rifiutato (bene): ' || left(sqlerrm, 40)); end;
  insert into public.libri (utente, id, dati) values (auth.uid(), 'p7', '{"t":"cambiato"}') on conflict (utente, id) do update set dati = excluded.dati;
  insert into esito values ('A: modifica (upsert) a 5.000', (select dati->>'t' from public.libri where utente = auth.uid() and id = 'p7') || ' (cambiato)');
  update public.libri set cancellato = true where utente = auth.uid() and id in ('p1', 'p2', 'p3');
  insert into public.libri (utente, id, dati) values (auth.uid(), 'nuovo2', '{"t":"x"}');
  insert into esito values ('A: nuovo libro con 3 cancellati', (select count(*) from public.libri where utente = auth.uid()) || ' righe, cancellati ' ||
    (select count(*) from public.libri where utente = auth.uid() and cancellato) || ' (5000 righe, cancellati 2)');
  begin insert into public.libri (utente, id, dati) values (auth.uid(), 'grosso', jsonb_build_object('t', 'g', 'n', (select string_agg(md5(i::text), '') from generate_series(1, 2000) i)));
    insert into esito values ('A: libro da 64 KB', 'PERMESSO (male)');
  exception when others then insert into esito values ('A: libro da 64 KB', 'rifiutato (bene)'); end;
  -- 2. archivio
  perform public.archivia('9788806219352', '{"t":"Uno","a":"X","img":"https://evil.example/c.jpg","imgL":"https://covers.openlibrary.org/b/isbn/9788806219352-L.jpg"}');
  insert into esito values ('archivio: copertina da sito qualunque', coalesce(public.da_archivio('9788806219352') ->> 'img', 'tolta') || ' (tolta)');
  insert into esito values ('archivio: copertina Open Library', (public.da_archivio('9788806219352') ? 'imgL')::text || ' (true)');
  perform public.archivia('9788806219353', '{"t":"Due","img":"https://books.google.com/books/content?id=abc&zoom=1"}');
  insert into esito values ('archivio: copertina Google', (public.da_archivio('9788806219353') ? 'img')::text || ' (true)');
  -- 3. contatore
  for i in 1 .. 6 loop t := public.conta_ricerche('g:' || repeat('a', 64), 200); end loop;
  insert into esito values ('A: 1.200 ricerche Google in un giorno', t || ' (1000)');
  t := public.conta_ricerche('g:' || repeat('b', 64), 50);
  insert into esito values ('A: altra chiave dopo il limite', t || ' (0)');
  for i in 1 .. 11 loop t := public.conta_ricerche('s:' || repeat('a', 64), 200); end loop;
  insert into esito values ('A: 2.200 ricerche del worker', t || ' (2000)');
  t := public.conta_ricerche('g:' || repeat('c', 64), 0);
  insert into esito values ('A: lettura di una chiave mai usata', t || ' (0)');
  -- 4. push
  begin perform public.push_iscrivi('https://evil.example/push/abcdefghijklmnop', repeat('k', 30), repeat('a', 10)); insert into esito values ('push verso sito qualunque', 'PERMESSO (male)');
  exception when others then insert into esito values ('push verso sito qualunque', 'rifiutato (bene)'); end;
  perform public.push_iscrivi('https://fcm.googleapis.com/fcm/send/prova-abcdefghij', repeat('k', 30), repeat('a', 10));
  perform public.push_iscrivi('https://web.push.apple.com/prova-abcdefghij', repeat('k', 30), repeat('a', 10));
  insert into esito values ('push Google e Apple', 'accettati (bene)');
  -- 5. amici in comune (A, B, C tutti amici tra loro: in comune tra A e B c'è C)
  insert into esito values ('A apre la libreria di B: amici in comune', (public.libreria_di('00000000-0000-0000-0000-0000000000b2') ->> 'comuni') || ' (1)');
  begin perform count(*) from public.ricerche_utenti; insert into esito values ('A legge ricerche_utenti', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito values ('A legge ricerche_utenti', 'negato (bene)'); end;
end $$;
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
do $$ declare t int; begin
  t := public.conta_ricerche('g:' || repeat('a', 64), 0);
  insert into esito values ('B legge la chiave condivisa', t || ' (1000)');
  t := public.conta_ricerche('g:' || repeat('d', 64), 10);
  insert into esito values ('B: il limite di A non vale per B', t || ' (10)');
  insert into public.libri (utente, id, dati) values (auth.uid(), 'b1', '{"t":"x"}');
  insert into esito values ('B: libro mentre A è a 5.000', 'accettato (bene)');
end $$;
reset role;
insert into esito values ('indice ISBN', (select count(*) from pg_indexes where indexname = 'libri_isbn') || ' (1)');
do $$ begin raise exception E'ESITO\n%', (select string_agg(prova || ': ' || risultato, E'\n') from esito); end $$;
