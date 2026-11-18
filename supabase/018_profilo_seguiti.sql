-- Next Libris: giro 3 (18/11/2026, scelte di Piero). Prima nella prova; nella vera con la versione, quando lo dice Piero.
-- 1. Libreria di un amico: i libri che ha in prestito da te adesso si vedono sempre, anche se nasconde la libreria.
-- 2. Foto del profilo: piccola (128 px, dentro la riga del profilo: niente archivio dei file) oppure quella dell'account
--    Google; la vedono solo gli amici (chi cerca per nome non la riceve).
-- 3. Pagina del profilo: citazione preferita, statistiche e raccolta delle citazioni visibili agli amici solo se scelto
--    (tre interruttori, spenti di partenza); mai gli appunti. Le statistiche le calcola il telefono (che è la copia
--    principale e conosce i paesi degli autori) e le salva nel profilo.
-- 4. Seguire i desideri di un amico: tabella «seguiti» (l'amico non lo sa: nessuna funzione glielo dice), un solo
--    riassunto al giorno per amico (pg_cron alle 17 UTC), campanella e push (gruppo «consigli»), solo se l'amico
--    mostra i desideri.

-- ---------- 2 e 3: profilo ----------
alter table public.profili
  add column foto text not null default '' check (foto = '' or (char_length(foto) <= 20000 and
    (foto ~ '^data:image/(jpeg|webp|png);base64,[A-Za-z0-9+/]+=*$' or foto ~ '^https://lh[0-9]\.googleusercontent\.com/[A-Za-z0-9_=./-]+$'))),
  add column foto_il timestamptz,
  add column cit jsonb check (cit is null or (jsonb_typeof(cit) = 'object' and pg_column_size(cit) < 2500)),
  add column stat jsonb check (stat is null or (jsonb_typeof(stat) = 'object' and pg_column_size(stat) < 4000)),
  add column p_cit boolean not null default false,
  add column p_stat boolean not null default false,
  add column p_cits boolean not null default false;

create function public.profili_foto() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then if new.foto <> '' then new.foto_il := now(); end if;
  elsif new.foto is distinct from old.foto then new.foto_il := now();
  else new.foto_il := old.foto_il; end if;
  return new;
end $$;
revoke all on function public.profili_foto() from public, anon, authenticated;
create trigger profili_foto before insert or update on public.profili for each row execute function public.profili_foto();

-- ---------- 4: seguiti ----------
create table public.seguiti (
  chi uuid not null references auth.users (id) on delete cascade,      -- chi segue
  amico uuid not null references auth.users (id) on delete cascade,    -- di chi segue i desideri
  creato timestamptz not null default now(),
  primary key (chi, amico),
  check (chi <> amico)
);
create index seguiti_amico on public.seguiti (amico);
alter table public.seguiti enable row level security;
revoke all on table public.seguiti from anon, authenticated;            -- solo con le funzioni

create table public.desideri_nuovi (                                    -- desideri aggiunti da chi ha qualcuno che lo segue, in attesa del riassunto
  utente uuid not null references auth.users (id) on delete cascade,
  libro text not null,
  quando timestamptz not null default now(),
  primary key (utente, libro)
);
alter table public.desideri_nuovi enable row level security;
revoke all on table public.desideri_nuovi from anon, authenticated;

create function public.segui(amico uuid, si boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'non autenticato'; end if;
  if not si then delete from public.seguiti s where s.chi = me and s.amico = segui.amico; return; end if;
  if not exists (select 1 from public.amicizie f where (f.da = me and f.a = segui.amico) or (f.da = segui.amico and f.a = me)) then raise exception 'non amici'; end if;
  insert into public.seguiti (chi, amico) values (me, segui.amico) on conflict do nothing;
end $$;
revoke all on function public.segui(uuid, boolean) from public, anon;
grant execute on function public.segui(uuid, boolean) to authenticated;

-- tolta o rifiutata un'amicizia: nessuno dei due segue più l'altro
create function public.amicizie_pulizia() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.seguiti s where (s.chi = old.da and s.amico = old.a) or (s.chi = old.a and s.amico = old.da);
  return null;
end $$;
revoke all on function public.amicizie_pulizia() from public, anon, authenticated;
create trigger amicizie_pulizia after delete on public.amicizie for each row execute function public.amicizie_pulizia();

-- un desiderio nuovo (riga nuova tra i desideri, o libro che ci torna) si annota solo se qualcuno segue quell'utente
create function public.desideri_annota() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.cancellato or coalesce(new.dati->>'w', '') <> 'true' then return null; end if;
  if tg_op = 'UPDATE' and not old.cancellato and coalesce(old.dati->>'w', '') = 'true' then return null; end if;
  if not exists (select 1 from public.seguiti s where s.amico = new.utente) then return null; end if;
  insert into public.desideri_nuovi (utente, libro) values (new.utente, new.id) on conflict do nothing;
  return null;
end $$;
revoke all on function public.desideri_annota() from public, anon, authenticated;
create trigger desideri_annota after insert or update on public.libri for each row execute function public.desideri_annota();

alter table public.notifiche drop constraint notifiche_tipo_check;
alter table public.notifiche add constraint notifiche_tipo_check check (tipo = any (array['amicizia', 'amico', 'prestito', 'regalo', 'reso', 'reso_ok', 'reso_no',
  'chiuso', 'richiesta', 'richiesta_si', 'richiesta_no', 'consiglio', 'chiavi', 'limite', 'desideri']));

create or replace function public.push_gruppo(tipo text) returns text
language sql immutable set search_path = '' as $$
  select case
    when tipo in ('amicizia', 'amico') then 'amicizie'
    when tipo in ('prestito', 'regalo', 'reso', 'reso_ok', 'reso_no', 'chiuso', 'richiesta', 'richiesta_si', 'richiesta_no') then 'prestiti'
    when tipo in ('consiglio', 'desideri') then 'consigli'
    when tipo = 'chiavi' then 'chiavi'
  end;
$$;

-- il riassunto del giorno: una notifica per amico a chi lo segue (rif = quanti, titolo = i primi tre titoli), poi si svuota
create function public.desideri_riassunto() returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in
    select x.utente, count(*) as n, string_agg('«' || left(x.t, 70) || '»', ', ' order by x.rn) filter (where x.rn <= 3) as titoli
    from (select d.utente, coalesce(nullif(btrim(l.dati->>'t'), ''), 'un libro') as t, row_number() over (partition by d.utente order by d.quando, d.libro) as rn
          from public.desideri_nuovi d
          join public.libri l on l.utente = d.utente and l.id = d.libro and not l.cancellato and l.dati->>'w' = 'true'
          join public.profili p on p.id = d.utente and p.desideri) x
    group by x.utente
  loop
    perform public.notifica_nuova(s.chi, r.utente, 'desideri', r.n::text, r.titoli)
      from public.seguiti s where s.amico = r.utente and public.sono_amici(s.chi, r.utente);
  end loop;
  delete from public.desideri_nuovi d where d.quando <= now();
end $$;
revoke all on function public.desideri_riassunto() from public, anon, authenticated;
select cron.schedule('desideri-riassunto', '0 17 * * *', 'select public.desideri_riassunto()');

-- ---------- amicizie: seguire già dalla richiesta o dalla risposta ----------
drop function public.chiedi_amicizia(text);
create function public.chiedi_amicizia(utente text, segui boolean default false) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); altro uuid; st text;
begin
  if me is null then raise exception 'non autenticato'; end if;
  select p.id into altro from public.profili p where lower(p.utente) = lower(btrim(chiedi_amicizia.utente));
  if altro is null then raise exception 'utente non trovato'; end if;
  if altro = me then raise exception 'sei tu'; end if;
  select f.stato into st from public.amicizie f where f.da = me and f.a = altro;
  if st is null then
    update public.amicizie f set stato = 'amici' where f.da = altro and f.a = me returning f.stato into st;
    if st is null then
      if (select count(*) from public.amicizie f where f.da = me and f.stato = 'attesa') >= 100 then raise exception 'troppe richieste in attesa'; end if;
      insert into public.amicizie (da, a) values (me, altro);
      st := 'attesa';
    end if;
  end if;
  if coalesce(chiedi_amicizia.segui, false) then insert into public.seguiti (chi, amico) values (me, altro) on conflict do nothing; end if;
  return st;
end $$;
revoke all on function public.chiedi_amicizia(text, boolean) from public, anon;
grant execute on function public.chiedi_amicizia(text, boolean) to authenticated;

drop function public.rispondi_amicizia(uuid, boolean);
create function public.rispondi_amicizia(da uuid, accetta boolean, segui boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'non autenticato'; end if;
  if accetta then
    update public.amicizie f set stato = 'amici' where f.da = rispondi_amicizia.da and f.a = me and f.stato = 'attesa';
    if coalesce(rispondi_amicizia.segui, false) and public.sono_amici(me, rispondi_amicizia.da) then
      insert into public.seguiti (chi, amico) values (me, rispondi_amicizia.da) on conflict do nothing;
    end if;
  else delete from public.amicizie f where f.da = rispondi_amicizia.da and f.a = me and f.stato = 'attesa'; end if;
end $$;
revoke all on function public.rispondi_amicizia(uuid, boolean, boolean) from public, anon;
grant execute on function public.rispondi_amicizia(uuid, boolean, boolean) to authenticated;

-- elenco degli amici: in più «segue» (li segui tu) e quando è cambiata la foto (la foto si chiede a parte, solo se è cambiata)
drop function public.miei_amici();
create function public.miei_amici() returns table (id uuid, utente text, nome text, stato text, verso text, creato timestamptz, segue boolean, foto_il timestamptz)
language sql stable security definer set search_path = '' as $$
  select case when f.da = auth.uid() then f.a else f.da end, p.utente, p.nome, f.stato,
         case when f.da = auth.uid() then 'inviata' else 'ricevuta' end, f.creato,
         exists (select 1 from public.seguiti s where s.chi = auth.uid() and s.amico = case when f.da = auth.uid() then f.a else f.da end),
         case when f.stato = 'amici' then p.foto_il end
  from public.amicizie f
  left join public.profili p on p.id = case when f.da = auth.uid() then f.a else f.da end
  where auth.uid() in (f.da, f.a)
  order by f.creato desc;
$$;
revoke all on function public.miei_amici() from public, anon;
grant execute on function public.miei_amici() to authenticated;

create function public.foto_amici(ids uuid[]) returns table (id uuid, foto text)
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'non autenticato'; end if;
  if coalesce(cardinality(ids), 0) > 60 then raise exception 'troppi'; end if;
  return query select p.id, p.foto from public.profili p where p.id = any (foto_amici.ids) and public.sono_amici(me, p.id);
end $$;
revoke all on function public.foto_amici(uuid[]) from public, anon;
grant execute on function public.foto_amici(uuid[]) to authenticated;

-- pagina del profilo di un amico: solo ciò che ha scelto di mostrare
create function public.profilo_di(amico uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); p public.profili; r jsonb;
begin
  if me is null then raise exception 'non autenticato'; end if;
  if not public.sono_amici(me, profilo_di.amico) then raise exception 'non amici'; end if;
  select * into p from public.profili x where x.id = profilo_di.amico;
  r := jsonb_build_object('utente', coalesce(p.utente, p.nome, ''), 'creato', p.creato, 'foto', coalesce(p.foto, ''),
    'desideri', coalesce(p.desideri, false), 'libreria', coalesce(p.libreria, false),
    'segue', exists (select 1 from public.seguiti s where s.chi = me and s.amico = profilo_di.amico));
  if p.p_cit and p.cit is not null then r := r || jsonb_build_object('cit', p.cit); end if;
  if p.p_stat and p.libreria and p.stat is not null then r := r || jsonb_build_object('stat', p.stat); end if;
  if p.p_cits then
    r := r || jsonb_build_object('cits', coalesce((
      select jsonb_agg(jsonb_build_object('x', q.x, 'pg', q.pg, 'd', q.d, 't', q.t, 'a', q.a) order by q.d desc)
      from (select c->>'x' as x, c->>'pg' as pg, case when c->>'d' ~ '^[0-9]{1,15}$' then (c->>'d')::numeric else 0 end as d, l.dati->>'t' as t, l.dati->>'a' as a
            from public.libri l cross join lateral jsonb_array_elements(case when jsonb_typeof(l.dati->'qs') = 'array' then l.dati->'qs' else '[]'::jsonb end) c
            where l.utente = profilo_di.amico and not l.cancellato and coalesce(c->>'x', '') <> ''
            order by d desc limit 300) q), '[]'::jsonb));
  end if;
  return r;
end $$;
revoke all on function public.profilo_di(uuid) from public, anon;
grant execute on function public.profilo_di(uuid) to authenticated;

-- ---------- 1: libreria di un amico, con i libri che ha in prestito da me adesso (sempre) ----------
create or replace function public.libreria_di(amico uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); vis boolean; tot int; com int; miei jsonb;
begin
  if me is null then raise exception 'non autenticato'; end if;
  if not public.sono_amici(me, libreria_di.amico) then raise exception 'non amici'; end if;
  select count(*) into com from (                         -- amici in comune: si parte dai miei amici, non da tutti i profili
    select case when f.da = me then f.a else f.da end as x from public.amicizie f
    where f.stato = 'amici' and (f.da = me or f.a = me)) m
    where m.x <> libreria_di.amico and public.sono_amici(libreria_di.amico, m.x);
  -- prestiti aperti da me a lui: i dati del prestito, più lo stato di lettura se il libro è già nella sua libreria
  select coalesce(jsonb_agg(jsonb_build_object('id', coalesce(l.id, 'ps-' || s.id::text), 't', d.x->>'t', 'a', d.x->>'a', 'e', d.x->>'e', 'y', d.x->>'y', 'i', d.x->>'i',
           'img', d.x->>'img', 'pg', d.x->>'pg', 'gen', d.x->>'gen', 'se', d.x->>'se', 'sn', d.x->>'sn',
           'rs', l.dati->>'rs', 'rt', l.dati->'rt', 'rd', l.dati->>'rd', 'pp', case when l.dati->>'rs' = 'in' then l.dati->>'pp' else null end,
           'ts', extract(epoch from s.creato) * 1000, 'fuori', false, 'mio', true) order by s.creato desc), '[]'::jsonb)
    into miei
    from public.scambi s
    left join public.libri l on l.utente = s.a and not l.cancellato and l.dati->>'sx' = s.id::text and coalesce(l.dati->>'xs', '') = ''
    cross join lateral (select coalesce(l.dati, s.libro) as x) d
    where s.da = me and s.a = libreria_di.amico and s.tipo = 'prestito' and s.stato in ('aperto', 'reso');
  select p.libreria into vis from public.profili p where p.id = libreria_di.amico;
  if not coalesce(vis, false) then return jsonb_build_object('visibili', false, 'totale', 0, 'comuni', com, 'libri', miei); end if;
  select count(*) into tot from public.libri l where l.utente = libreria_di.amico and not l.cancellato
    and coalesce(l.dati->>'w', 'false') <> 'true' and coalesce(l.dati->>'xs', '') = '' and coalesce(l.dati->>'sk', '') not in ('p', 'q');
  return jsonb_build_object('visibili', true, 'totale', tot, 'comuni', com, 'libri', miei || coalesce((
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
