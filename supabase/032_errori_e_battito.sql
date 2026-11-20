-- 032 (21/11/2026, scelte di Piero): errori dei telefoni veri e database sempre attivo.
-- 1) errori: l'app manda in forma anonima file:riga, messaggio, versione, tipo di telefono (android/ios/pc) e se e' installata.
--    Mai nome, account o libri. Stessi errori dello stesso giorno = una riga con il conto (volte). Tetto di 2.000 righe nuove al giorno.
--    Si tengono 30 giorni (cron errori-pulizia). Li legge solo Claude dal database: nessuna lettura per anon/authenticated.
-- 2) battito: una riga che tieni_attivo() aggiorna (GitHub Actions ogni 2 giorni e il controllo programmato di Claude),
--    cosi' il progetto gratuito non va in pausa dopo 7 giorni senza attivita'.

create table if not exists public.errori (
  id bigint generated always as identity primary key,
  giorno date not null default ((now() at time zone 'utc')::date),
  ultima timestamptz not null default now(),
  versione text not null,
  dove text not null,
  messaggio text not null,
  telefono text not null check (telefono in ('android', 'ios', 'pc', 'altro')),
  app boolean not null default false,
  volte integer not null default 1,
  unique (giorno, versione, dove, messaggio, telefono, app)
);
alter table public.errori enable row level security;
revoke all on public.errori from public, anon, authenticated;

create table if not exists public.battito (
  id integer primary key default 1 check (id = 1),
  ultimo timestamptz not null default now()
);
insert into public.battito (id) values (1) on conflict (id) do nothing;
alter table public.battito enable row level security;
revoke all on public.battito from public, anon, authenticated;

create or replace function public.errori_manda(lista jsonb, ver text, tel text, inst boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  x jsonb;
  oggi date := (now() at time zone 'utc')::date;
  t text := case when tel in ('android', 'ios', 'pc') then tel else 'altro' end;
  v text := left(coalesce(nullif(ver, ''), '?'), 20);
  quante integer;
begin
  if lista is null or jsonb_typeof(lista) <> 'array' then return; end if;
  select count(*) into quante from public.errori where giorno = oggi;
  if quante >= 2000 then return; end if;                    -- tetto del giorno: oltre, si ignora in silenzio
  for x in select e from jsonb_array_elements(lista) as e limit 5 loop
    if jsonb_typeof(x) <> 'object' then continue; end if;
    insert into public.errori as r (giorno, versione, dove, messaggio, telefono, app, volte)
    values (oggi, v, left(coalesce(x->>'dove', ''), 60), left(coalesce(nullif(x->>'msg', ''), '?'), 160), t, coalesce(inst, false),
            case when coalesce(x->>'n', '') ~ '^[0-9]{1,3}$' then greatest((x->>'n')::integer, 1) else 1 end)
    on conflict (giorno, versione, dove, messaggio, telefono, app)
    do update set volte = least(r.volte + excluded.volte, 1000000), ultima = now();
  end loop;
end;
$$;
revoke all on function public.errori_manda(jsonb, text, text, boolean) from public;
grant execute on function public.errori_manda(jsonb, text, text, boolean) to anon, authenticated;

create or replace function public.tieni_attivo()
returns void
language sql
security definer
set search_path = ''
as $$ update public.battito set ultimo = now() where id = 1; $$;
revoke all on function public.tieni_attivo() from public;
grant execute on function public.tieni_attivo() to anon, authenticated;

create or replace function public.errori_pulizia()
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.errori where giorno < ((now() at time zone 'utc')::date - 30); $$;
revoke all on function public.errori_pulizia() from public, anon, authenticated;

select cron.schedule('errori-pulizia', '40 3 * * *', 'select public.errori_pulizia()');
