-- Next Libris · 029: libri scritti a mano proposti all'archivio comune. 19/11/2026, prima nella prova. Scelte di Piero.
-- Un libro che nessuna banca dati conosce (es. ISBN 979-8, autopubblicati su Amazon) e che l'utente completa a mano
-- (titolo e autore) viene PROPOSTO: entra nell'archivio comune solo dopo il controllo dell'amministratore
-- (Amministrazione › Archivio › Da controllare: Approva, con correzioni, oppure Scarta).

create table public.archivio_proposte (
  isbn text not null check (isbn ~ '^97[89][0-9]{10}$'),
  utente uuid not null references auth.users (id) on delete cascade,
  dati jsonb not null check (jsonb_typeof(dati) = 'object' and pg_column_size(dati) < 9000),
  creato timestamptz not null default now(),
  primary key (isbn, utente)
);
create index archivio_proposte_creato on public.archivio_proposte (creato);
create index archivio_proposte_utente on public.archivio_proposte (utente, creato);
alter table public.archivio_proposte enable row level security;
revoke all on table public.archivio_proposte from public, anon, authenticated;

-- stessi campi, misure e siti delle copertine di archivia()
create function public.archivio_pulisci(dati jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare d jsonb := '{}'::jsonb; k text; v text; lim integer;
  campi constant text[] := array['t', 'a', 'e', 'y', 'pg', 'img', 'imgL', 'ds', 'dsl', 'gen', 'se', 'sn'];
  massimi constant integer[] := array[300, 300, 200, 10, 6, 600, 600, 6000, 2, 60, 200, 10];
  copertine constant text := '^https://(books\.google\.[a-z.]{2,8}|[a-z0-9-]+\.googleusercontent\.com|covers\.openlibrary\.org|([a-z0-9-]+\.)?archive\.org)/';
begin
  if jsonb_typeof(dati) is distinct from 'object' then return d; end if;
  for i in 1 .. array_length(campi, 1) loop
    k := campi[i]; lim := massimi[i];
    if jsonb_typeof(dati -> k) in ('string', 'number') then
      v := btrim(dati ->> k);
      if v <> '' and char_length(v) <= lim and (k not in ('img', 'imgL') or v ~* copertine) then d := d || jsonb_build_object(k, v); end if;
    end if;
  end loop;
  return d;
end $$;
revoke all on function public.archivio_pulisci(jsonb) from public, anon, authenticated;

-- l'utente propone un libro scritto a mano: 'ok', oppure 'c_e' se l'archivio lo ha già
create function public.proponi_archivio(isbn text, dati jsonb) returns text
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := auth.uid(); d jsonb;
begin
  if me is null then raise exception 'non autenticato'; end if;
  if proponi_archivio.isbn !~ '^97[89][0-9]{10}$' then raise exception 'dati non validi'; end if;
  d := public.archivio_pulisci(proponi_archivio.dati);
  if coalesce(d ->> 't', '') = '' or coalesce(d ->> 'a', '') = '' then raise exception 'dati non validi'; end if;
  if exists (select 1 from public.archivio a where a.isbn = proponi_archivio.isbn and coalesce(a.dati ->> 't', '') <> '') then return 'c_e'; end if;
  if not exists (select 1 from public.archivio_proposte p where p.isbn = proponi_archivio.isbn and p.utente = me) then
    if (select count(*) from public.archivio_proposte p where p.utente = me and p.creato > now() - interval '1 day') >= 30
      then raise exception 'troppe proposte oggi'; end if;
    if (select count(*) from public.archivio_proposte p where p.utente = me) >= 200
      then raise exception 'troppe proposte'; end if;
  end if;
  insert into public.archivio_proposte as p (isbn, utente, dati) values (proponi_archivio.isbn, me, d)
    on conflict (isbn, utente) do update set dati = excluded.dati;
  return 'ok';
end $$;

-- amministratore: le proposte da controllare (le più vecchie prima, al massimo 50) e quante sono in tutto
create function public.admin_proposte() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_controllo();
  return jsonb_build_object(
    'tot', (select count(*) from public.archivio_proposte),
    'elenco', (select coalesce(jsonb_agg(jsonb_build_object('isbn', r.isbn, 'utente', r.utente, 'nome', r.nome, 'dati', r.dati, 'creato', r.creato,
                 'simili', r.simili) order by r.creato), '[]'::jsonb) from (
      select p.isbn, p.utente, coalesce(pr.utente, pr.nome, '') as nome, p.dati, p.creato,
        (select count(*) from public.archivio_proposte x where x.isbn = p.isbn) as simili
      from public.archivio_proposte p left join public.profili pr on pr.id = p.utente
      order by p.creato limit 50) r));
end $$;

-- amministratore: approva (con le sue correzioni): il libro entra nell'archivio, le proposte di quell'ISBN si chiudono
create function public.admin_proposta_approva(isbn text, dati jsonb) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare d jsonb;
begin
  perform public.admin_controllo();
  if admin_proposta_approva.isbn !~ '^97[89][0-9]{10}$' then raise exception 'dati non validi'; end if;
  d := public.archivio_pulisci(admin_proposta_approva.dati);
  if coalesce(d ->> 't', '') = '' then raise exception 'dati non validi'; end if;
  insert into public.archivio as a (isbn, dati) values (admin_proposta_approva.isbn, d)
    on conflict (isbn) do update set dati = excluded.dati, aggiornato = now();
  delete from public.archivio_proposte p where p.isbn = admin_proposta_approva.isbn;
end $$;

-- amministratore: scarta una proposta
create function public.admin_proposta_scarta(isbn text, utente uuid) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.admin_controllo();
  delete from public.archivio_proposte p where p.isbn = admin_proposta_scarta.isbn and p.utente = admin_proposta_scarta.utente;
end $$;

revoke all on function public.proponi_archivio(text, jsonb), public.admin_proposte(), public.admin_proposta_approva(text, jsonb),
  public.admin_proposta_scarta(text, uuid) from public, anon;
grant execute on function public.proponi_archivio(text, jsonb), public.admin_proposte(), public.admin_proposta_approva(text, jsonb),
  public.admin_proposta_scarta(text, uuid) to authenticated;

-- numeri: in più le proposte da controllare
create or replace function public.admin_numeri() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g date := (now() at time zone 'America/Los_Angeles')::date;
begin
  perform public.admin_controllo();
  return jsonb_build_object(
    'utenti', (select count(*) from public.profili),
    'attivi_mese', (select count(distinct s.user_id) from auth.sessions s
                    where greatest(s.updated_at, s.refreshed_at at time zone 'UTC', s.created_at) > now() - interval '30 days'),
    'libri', (select count(*) from public.libri l where not l.cancellato),
    'archivio', (select count(*) from public.archivio),
    'proposte', (select count(*) from public.archivio_proposte),
    'spazio', pg_database_size(current_database()),
    'spazio_max', 500 * 1024 * 1024,
    'ricerche_oggi', (select coalesce(sum(r.n), 0) from public.ricerche r where r.giorno = g and r.chiave like 'g:%'),
    'ricerche_chiave_max', (select coalesce(max(r.n), 0) from public.ricerche r where r.giorno = g and r.chiave like 'g:%'),
    'chat', (select count(*) from public.chat),
    'messaggi', (select count(*) from public.messaggi),
    'messaggi_spazio', pg_total_relation_size('public.messaggi'),
    'segnalazioni', (select count(*) from public.segnalazioni z where z.stato = 'aperta'),
    'sospesi', (select count(*) from public.sospesi));
end $$;
