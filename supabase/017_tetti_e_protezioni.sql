-- Next Libris: limiti e protezioni del database (17/11/2026, dalla verifica del 17/11, scelte di Piero).
-- Prima nella prova; nella vera arriva insieme a 011→016 (dipende da 012 e 014), quando lo dice Piero.
-- 1. Libri online: al massimo 5.000 righe per account e 50 KB per libro. Quando si arriva a 5.000, i libri già cancellati
--    più vecchi (cancellati: restano online solo per recuperarli) si tolgono da soli per fare posto; se sono tutti libri veri,
--    la sincronizzazione si ferma con un messaggio chiaro e i libri in più restano sul telefono.
-- 2. Archivio comune: copertine solo da Google Libri, Open Library e archive.org (le stesse fonti ammesse dall'app, COVER_HOST
--    in lib.js). Prima andava bene qualunque indirizzo https.
-- 3. Contatore delle ricerche: ogni account può aggiungere al massimo 1.000 ricerche Google e 2.000 del worker al giorno
--    (oltre, il numero non sale: nessun errore, l'app non riprova all'infinito); la sola lettura (n = 0) non crea più righe.
--    Così nessuno può portare da solo a 950 la chiave condivisa né riempire la tabella di righe inventate.
-- 4. Notifiche push: iscrizioni solo verso i servizi push veri (Google, Mozilla, Apple, Microsoft).
-- 5. Velocità: indice sull'ISBN dei libri (chi_ce_lha); «amici in comune» di libreria_di calcolato partendo dalle amicizie.
-- Prova: prova_tetti.sql (alla fine annulla tutto).

-- 1. libri ---------------------------------------------------------------------------------------------------------------
alter table public.libri drop constraint libri_dati_check;
alter table public.libri add constraint libri_dati_check check (pg_column_size(dati) < 50000);

create function public.libri_tetto() returns trigger
language plpgsql set search_path = '' as $$
declare tot integer;
begin
  -- l'aggiornamento di un libro già online non aggiunge righe (vale anche per l'«upsert» dell'app)
  if exists (select 1 from public.libri l where l.utente = new.utente and l.id = new.id) then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('libri:' || new.utente::text, 0));     -- due sincronizzazioni insieme contano giusto
  select count(*) into tot from public.libri l where l.utente = new.utente;
  if tot >= 5000 then
    delete from public.libri l where l.utente = new.utente and l.id in (
      select x.id from public.libri x where x.utente = new.utente and x.cancellato order by x.aggiornato limit tot - 4999);
    select count(*) into tot from public.libri l where l.utente = new.utente;
    if tot >= 5000 then
      raise exception 'Online si possono salvare al massimo 5.000 libri: quelli in più restano solo su questo telefono.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger libri_tetto before insert on public.libri for each row execute function public.libri_tetto();
revoke all on function public.libri_tetto() from public, anon, authenticated;

-- 2. archivio comune -----------------------------------------------------------------------------------------------------
create or replace function public.archivia(isbn text, dati jsonb) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := auth.uid(); d jsonb := '{}'::jsonb; k text; v text; lim integer; tot integer;
  campi constant text[] := array['t', 'a', 'e', 'y', 'pg', 'img', 'imgL', 'ds', 'dsl', 'gen', 'se', 'sn'];
  massimi constant integer[] := array[300, 300, 200, 10, 6, 600, 600, 6000, 2, 60, 200, 10];
  copertine constant text := '^https://(books\.google\.[a-z.]{2,8}|[a-z0-9-]+\.googleusercontent\.com|covers\.openlibrary\.org|([a-z0-9-]+\.)?archive\.org)/';
begin
  if me is null then raise exception 'non autenticato'; end if;
  if archivia.isbn !~ '^97[89][0-9]{10}$' or jsonb_typeof(archivia.dati) <> 'object' then raise exception 'dati non validi'; end if;
  for i in 1 .. array_length(campi, 1) loop
    k := campi[i]; lim := massimi[i];
    if jsonb_typeof(archivia.dati -> k) in ('string', 'number') then
      v := btrim(archivia.dati ->> k);
      if v <> '' and char_length(v) <= lim and (k not in ('img', 'imgL') or v ~* copertine) then d := d || jsonb_build_object(k, v); end if;
    end if;
  end loop;
  if coalesce(d ->> 't', '') = '' then return; end if;                                   -- senza titolo non si salva
  insert into public.ricerche as r (chiave, giorno, n)
    values ('a:' || encode(sha256(convert_to(me::text, 'UTF8')), 'hex'), current_date, 1)
    on conflict (chiave, giorno) do update set n = r.n + 1 returning r.n into tot;
  if tot > 300 then raise exception 'troppi libri salvati oggi'; end if;
  insert into public.archivio as a (isbn, dati) values (archivia.isbn, d)
    on conflict (isbn) do update set dati = excluded.dati || a.dati, aggiornato = now()
    where not (excluded.dati - array(select jsonb_object_keys(a.dati))) = '{}'::jsonb;    -- solo se aggiunge qualcosa
end $$;

-- copertine già salvate da siti non ammessi: si tolgono (il resto del libro resta)
update public.archivio a set dati = a.dati - 'img'
  where a.dati ? 'img' and a.dati ->> 'img' !~* '^https://(books\.google\.[a-z.]{2,8}|[a-z0-9-]+\.googleusercontent\.com|covers\.openlibrary\.org|([a-z0-9-]+\.)?archive\.org)/';
update public.archivio a set dati = a.dati - 'imgL'
  where a.dati ? 'imgL' and a.dati ->> 'imgL' !~* '^https://(books\.google\.[a-z.]{2,8}|[a-z0-9-]+\.googleusercontent\.com|covers\.openlibrary\.org|([a-z0-9-]+\.)?archive\.org)/';

-- 3. contatore delle ricerche ----------------------------------------------------------------------------------------------
create table public.ricerche_utenti (
  utente uuid not null references auth.users (id) on delete cascade,
  giorno date not null,
  g integer not null default 0 check (g >= 0),
  s integer not null default 0 check (s >= 0),
  primary key (utente, giorno)
);
alter table public.ricerche_utenti enable row level security;
revoke all on table public.ricerche_utenti from anon, authenticated;

create or replace function public.conta_ricerche(chiave text, n integer, di text default '') returns integer
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := auth.uid(); g date; tot integer; tipo text := left(conta_ricerche.chiave, 1);
  oggi date := (now() at time zone 'UTC')::date; gia integer; m integer;
begin
  if me is null then raise exception 'non autenticato'; end if;
  if conta_ricerche.chiave !~ '^[gs]:[0-9a-f]{64}$' then raise exception 'chiave non valida'; end if;
  if conta_ricerche.n is null or conta_ricerche.n < 0 or conta_ricerche.n > 200 then raise exception 'numero non valido'; end if;
  g := case when tipo = 'g' then (now() at time zone 'America/Los_Angeles')::date else (now() at time zone 'UTC')::date end;
  m := conta_ricerche.n;
  if m > 0 then                                          -- quanto può ancora aggiungere questo account oggi
    insert into public.ricerche_utenti as u (utente, giorno) values (me, oggi) on conflict (utente, giorno) do nothing;
    select case when tipo = 'g' then u.g else u.s end into gia from public.ricerche_utenti u where u.utente = me and u.giorno = oggi for update;
    m := least(m, greatest(0, (case when tipo = 'g' then 1000 else 2000 end) - coalesce(gia, 0)));
    if m > 0 then
      update public.ricerche_utenti u set g = u.g + case when tipo = 'g' then m else 0 end, s = u.s + case when tipo = 's' then m else 0 end
        where u.utente = me and u.giorno = oggi;
    end if;
  end if;
  if m > 0 then
    insert into public.ricerche as r (chiave, giorno, n) values (conta_ricerche.chiave, g, m)
      on conflict (chiave, giorno) do update set n = r.n + excluded.n
      returning r.n into tot;
  else                                                   -- sola lettura: nessuna riga nuova
    select r.n into tot from public.ricerche r where r.chiave = conta_ricerche.chiave and r.giorno = g;
    tot := coalesce(tot, 0);
  end if;
  if random() < 0.02 then                                -- pulizia leggera
    delete from public.ricerche r where r.giorno < current_date - 3;
    delete from public.ricerche_utenti u where u.giorno < current_date - 3;
  end if;
  if tipo = 'g' and tot >= 950 and not exists (select 1 from public.notifiche x where x.utente = me and x.tipo = 'limite' and x.rif = conta_ricerche.chiave || ':' || g) then
    perform public.notifica_nuova(me, null, 'limite', conta_ricerche.chiave || ':' || g, left(coalesce(conta_ricerche.di, ''), 40));
  end if;
  return tot;
end $$;

-- 4. notifiche push ------------------------------------------------------------------------------------------------------
delete from public.push_iscrizioni i where i.endpoint !~* '^https://(fcm\.googleapis\.com|android\.googleapis\.com|(updates\.)?push\.services\.mozilla\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/';
alter table public.push_iscrizioni add constraint push_iscrizioni_servizio check (endpoint ~* '^https://(fcm\.googleapis\.com|android\.googleapis\.com|(updates\.)?push\.services\.mozilla\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/');

create or replace function public.push_iscrivi(endpoint text, p256dh text, auth text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'non autenticato'; end if;
  if push_iscrivi.endpoint !~* '^https://(fcm\.googleapis\.com|android\.googleapis\.com|(updates\.)?push\.services\.mozilla\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/' then
    raise exception 'servizio push non ammesso';
  end if;
  insert into public.push_iscrizioni (endpoint, utente, p256dh, auth)
    values (push_iscrivi.endpoint, me, push_iscrivi.p256dh, push_iscrivi.auth)
    on conflict on constraint push_iscrizioni_pkey do update set utente = me, p256dh = excluded.p256dh, auth = excluded.auth, creata = now();
  delete from public.push_iscrizioni i where i.utente = me and i.endpoint in (   -- al massimo 10 telefoni per account
    select x.endpoint from public.push_iscrizioni x where x.utente = me order by x.creata desc offset 10);
end $$;

-- 5. velocità ------------------------------------------------------------------------------------------------------------
create index libri_isbn on public.libri ((dati ->> 'i')) where not cancellato;

create or replace function public.libreria_di(amico uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); vis boolean; tot int; com int;
begin
  if me is null then raise exception 'non autenticato'; end if;
  if not public.sono_amici(me, libreria_di.amico) then raise exception 'non amici'; end if;
  select count(*) into com from (                         -- amici in comune: si parte dai miei amici, non da tutti i profili
    select case when f.da = me then f.a else f.da end as x from public.amicizie f
    where f.stato = 'amici' and (f.da = me or f.a = me)) m
    where m.x <> libreria_di.amico and public.sono_amici(libreria_di.amico, m.x);
  select p.libreria into vis from public.profili p where p.id = libreria_di.amico;
  if not coalesce(vis, false) then return jsonb_build_object('visibili', false, 'totale', 0, 'comuni', com, 'libri', '[]'::jsonb); end if;
  select count(*) into tot from public.libri l where l.utente = libreria_di.amico and not l.cancellato
    and coalesce(l.dati->>'w', 'false') <> 'true' and coalesce(l.dati->>'xs', '') = '' and coalesce(l.dati->>'sk', '') not in ('p', 'q');
  return jsonb_build_object('visibili', true, 'totale', tot, 'comuni', com, 'libri', coalesce((
    select jsonb_agg(jsonb_build_object('id', l.id, 't', l.dati->>'t', 'a', l.dati->>'a', 'e', l.dati->>'e', 'y', l.dati->>'y', 'i', l.dati->>'i',
             'img', l.dati->>'img', 'pg', l.dati->>'pg', 'gen', l.dati->>'gen', 'se', l.dati->>'se', 'sn', l.dati->>'sn',
             'rs', l.dati->>'rs', 'rt', l.dati->'rt', 'rd', l.dati->>'rd', 'pp', case when l.dati->>'rs' = 'in' then l.dati->>'pp' else null end,
             'ts', l.quando, 'fuori', coalesce(l.dati->>'p', '') <> '') order by l.quando desc)
    from (select l0.id, l0.dati, case when l0.dati->>'ts' ~ '^[0-9]{1,15}(\.[0-9]+)?$' then (l0.dati->>'ts')::numeric else 0 end as quando
          from public.libri l0
          where l0.utente = libreria_di.amico and not l0.cancellato
            and coalesce(l0.dati->>'w', 'false') <> 'true' and coalesce(l0.dati->>'xs', '') = '' and coalesce(l0.dati->>'sk', '') not in ('p', 'q')
          order by quando desc limit 1000) l), '[]'::jsonb));
end $$;
