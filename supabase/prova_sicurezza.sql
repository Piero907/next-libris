-- Prova delle regole di sicurezza (RLS) del progetto Supabase della copia social.
-- Si esegue nell'editor SQL (o con execute_sql): crea due utenti finti e due libri, prova come chiave pubblica e come utente A,
-- poi ANNULLA tutto (rollback). Tutte le righe del risultato devono dire «bene» o il numero atteso.
-- Esito del 16/11/2026: tutto bene (anon negato su libri, profili e scrittura; A vede 1 riga, 0 di B; non scrive, modifica o cancella per B).
begin;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'prova-a@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'prova-b@invalid.test', 'authenticated', 'authenticated');
insert into public.libri (utente, id, dati) values
  ('00000000-0000-0000-0000-0000000000a1', 'libroA', '{"t":"di A"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'libroB', '{"t":"di B"}');
create temp table esito (prova text, risultato text) on commit drop;
grant all on esito to anon, authenticated;
-- 1) chiave pubblica (anon): non deve leggere ne' scrivere niente
set local role anon;
do $$ begin
  begin perform count(*) from public.libri; insert into esito values ('anon legge libri', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito values ('anon legge libri', 'negato (bene)'); end;
  begin perform count(*) from public.profili; insert into esito values ('anon legge profili', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito values ('anon legge profili', 'negato (bene)'); end;
  begin insert into public.libri (utente, id) values ('00000000-0000-0000-0000-0000000000a1', 'x'); insert into esito values ('anon scrive', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito values ('anon scrive', 'negato (bene)'); end;
end $$;
reset role;
-- 2) utente A: vede solo i suoi, non scrive per B, non cambia ne' cancella i libri di B
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ declare n int; m int; begin
  select count(*) into n from public.libri;
  select count(*) into m from public.libri where utente = '00000000-0000-0000-0000-0000000000b2';
  insert into esito values ('A vede righe', n || ' (deve essere 1)'), ('A vede righe di B', m || ' (deve essere 0)');
  begin insert into public.libri (utente, id) values ('00000000-0000-0000-0000-0000000000b2', 'intruso'); insert into esito values ('A scrive per B', 'PERMESSO (male)');
  exception when insufficient_privilege or check_violation then insert into esito values ('A scrive per B', 'negato (bene)'); end;
  update public.libri set dati = '{"t":"rovinato"}' where id = 'libroB'; get diagnostics n = row_count;
  insert into esito values ('A modifica libri di B', n || ' righe (deve essere 0)');
  delete from public.libri where utente = '00000000-0000-0000-0000-0000000000b2'; get diagnostics n = row_count;
  insert into esito values ('A cancella libri di B', n || ' righe (deve essere 0)');
  insert into public.libri (id, dati) values ('nuovoA', '{}');
  select count(*) into n from public.libri where id = 'nuovoA' and utente = '00000000-0000-0000-0000-0000000000a1';
  insert into esito values ('A aggiunge un suo libro', n || ' (deve essere 1)');
end $$;
reset role;
select * from esito;
rollback;
