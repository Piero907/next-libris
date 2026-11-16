-- Prova delle regole delle amicizie (002_amicizie.sql). Si esegue nell'editor SQL (o con execute_sql) e alla fine ANNULLA tutto.
-- Ogni riga del risultato dice tra parentesi cosa ci si aspetta. Esito del 16/11/2026 sul progetto della prova: tutto come atteso.
begin;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'prova-a@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'prova-b@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'prova-c@invalid.test', 'authenticated', 'authenticated');
insert into public.profili (id, nome, utente) values
  ('00000000-0000-0000-0000-0000000000a1', 'Anna', 'anna_prova'),
  ('00000000-0000-0000-0000-0000000000b2', 'Bruno', 'bruno.prova'),
  ('00000000-0000-0000-0000-0000000000c3', 'Carla', 'carla_prova');
create temp table esito (prova text, risultato text) on commit drop;
grant all on esito to anon, authenticated;
set local role anon;
do $$ begin
  begin perform * from public.cerca_utenti('anna'); insert into esito values ('anon cerca', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito values ('anon cerca', 'negato (bene)'); end;
  begin perform count(*) from public.amicizie; insert into esito values ('anon legge amicizie', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito values ('anon legge amicizie', 'negato (bene)'); end;
end $$;
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ declare n int; r text; begin
  select count(*) into n from public.cerca_utenti('br'); insert into esito values ('cerca 2 lettere', n || ' (deve essere 0)');
  select string_agg(utente || ':' || rel, ',') into r from public.cerca_utenti('@Bruno'); insert into esito values ('cerca @Bruno', coalesce(r,'-') || ' (bruno.prova:)');
  select count(*) into n from public.cerca_utenti('anna_prova'); insert into esito values ('cerca se stesso', n || ' (deve essere 0)');
  insert into esito values ('A chiede a B', public.chiedi_amicizia('bruno.prova') || ' (attesa)');
  insert into esito values ('A chiede di nuovo', public.chiedi_amicizia('BRUNO.prova') || ' (attesa)');
  begin perform public.chiedi_amicizia('anna_prova'); insert into esito values ('A chiede a se', 'PERMESSO (male)');
  exception when others then insert into esito values ('A chiede a se', 'negato (bene)'); end;
  begin insert into public.amicizie (da, a, stato) values ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000a1', 'amici'); insert into esito values ('A scrive amicizia finta', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito values ('A scrive amicizia finta', 'negato (bene)'); end;
  perform public.rispondi_amicizia('00000000-0000-0000-0000-0000000000b2', true);
  select stato into r from public.amicizie where da = '00000000-0000-0000-0000-0000000000a1'; insert into esito values ('A accetta per conto di B', r || ' (attesa)');
end $$;
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
set local role authenticated;
do $$ declare n int; begin
  select count(*) into n from public.amicizie; insert into esito values ('C vede amicizie altrui', n || ' (deve essere 0)');
  perform public.togli_amicizia('00000000-0000-0000-0000-0000000000a1');
end $$;
reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
set local role authenticated;
do $$ declare r text; begin
  select string_agg(utente || ':' || stato || ':' || verso, ',') into r from public.miei_amici(); insert into esito values ('B vede richiesta', coalesce(r,'-') || ' (anna_prova:attesa:ricevuta)');
  perform public.rispondi_amicizia('00000000-0000-0000-0000-0000000000a1', true);
  select string_agg(utente || ':' || stato, ',') into r from public.miei_amici(); insert into esito values ('B accetta', coalesce(r,'-') || ' (anna_prova:amici)');
  select string_agg(utente || ':' || rel, ',') into r from public.cerca_utenti('anna'); insert into esito values ('B cerca anna', coalesce(r,'-') || ' (anna_prova:amici)');
  perform public.togli_amicizia('00000000-0000-0000-0000-0000000000a1');
  select count(*)::text into r from public.miei_amici(); insert into esito values ('B toglie A', r || ' (0)');
end $$;
reset role;
select * from esito;
rollback;
