-- Prova della 031 (worker SBN della casa): permessi e limiti di sbn_conta. Si esegue a mano (execute_sql); alla fine toglie le sue righe.
-- Atteso: tutte le righe «ok».
create temp table esiti (passo text, esito text);
grant all on esiti to public;
do $$
declare r jsonb; u uuid := gen_random_uuid(); ka text := 'c:' || encode(sha256(convert_to('senza-account','UTF8')),'hex'); ku text; ok boolean;
begin
  foreach ku in array array['authenticated','anon'] loop   -- 1) utenti normali e anonimi respinti
    begin
      execute 'set local role ' || ku;
      perform public.sbn_conta(null);
      reset role; insert into esiti values ('permesso ' || ku, 'ERRORE: ha potuto chiamarla');
    exception when insufficient_privilege then reset role; insert into esiti values ('permesso ' || ku, 'ok: respinto');
    end;
  end loop;
  ku := 'c:' || encode(sha256(convert_to(u::text,'UTF8')),'hex');
  r := public.sbn_conta(u);                                 -- 2) con l'account: conta, e a 500 si ferma
  insert into esiti values ('utente prima ricerca', case when r ? 'w' and r ? 'f' and (r->>'mio')::int = 1 then 'ok' else 'ERRORE ' || (r - 'w' - 'f')::text end);
  update public.ricerche set n = 499 where chiave = ku;
  r := public.sbn_conta(u);
  insert into esiti values ('utente a 500', case when (r->>'mio')::int = 500 and r ? 'w' then 'ok' else 'ERRORE' end);
  r := public.sbn_conta(u);
  insert into esiti values ('utente oltre 500', case when r->>'e' = 'mio' and not r ? 'w' then 'ok: fermato' else 'ERRORE' end);
  r := public.sbn_conta(null);                              -- 3) senza account: tetto di 3.000 in tutto
  insert into esiti values ('senza account', case when r ? 'w' then 'ok' else 'ERRORE ' || (r - 'w' - 'f')::text end);
  update public.ricerche set n = 3000 where chiave = ka;
  r := public.sbn_conta(null);
  insert into esiti values ('senza account oltre 3000', case when r->>'e' = 'tetto' and not r ? 'w' then 'ok: fermato' else 'ERRORE' end);
  r := public.sbn_conta(gen_random_uuid());
  insert into esiti values ('altro utente col tetto pieno', case when r ? 'w' then 'ok' else 'ERRORE' end);
  delete from public.ricerche where chiave like 'c:%' and giorno = (now() at time zone 'UTC')::date;   -- attenzione: azzera i conti SBN di oggi
  select not exists (select 1 from public.chiavi where sbn <> '') into ok; insert into esiti values ('chiavi senza worker', case when ok then 'ok' else 'ERRORE' end);
  select not exists (select 1 from pg_proc where proname in ('worker_conta','worker_prestato')) into ok; insert into esiti values ('funzioni worker tolte', case when ok then 'ok' else 'ERRORE' end);
end $$;
select * from esiti;
