-- Next Libris: desideri visibili agli amici, prestiti e regali tra amici, regali prenotati (16/11/2026). Applicato al progetto della prova.
-- Scelte di Piero: desideri «nessuno / tutti gli amici» (spento di partenza); il prestito compare subito nella Libreria dell'amico
-- («Prestato da …»), senza conferma; il regalo compare nella sua Libreria («Regalato da …»; se era tra i suoi desideri ci passa);
-- sui desideri di un amico «Te lo regalo io»: lui non lo vede, gli altri amici sì.
-- Tabelle leggibili solo con le proprie righe (scambi) o per niente (prenotazioni): si passa dalle funzioni qui sotto.

alter table public.profili add column desideri boolean not null default false;

create table public.scambi (
  id uuid primary key default gen_random_uuid(),
  da uuid not null references auth.users (id) on delete cascade,      -- chi presta o regala
  a uuid not null references auth.users (id) on delete cascade,       -- chi riceve
  tipo text not null check (tipo in ('prestito', 'regalo')),
  libro jsonb not null check (pg_column_size(libro) < 20000),         -- titolo, autore, editore, anno, ISBN, copertina…
  libro_id text not null default '' check (char_length(libro_id) <= 40),
  stato text not null default 'aperto' check (stato in ('aperto', 'chiuso')),
  visto boolean not null default false,                              -- chi riceve l'ha già messo nella sua Libreria
  creato timestamptz not null default now(),
  chiuso timestamptz,
  check (da <> a)
);
create index scambi_a on public.scambi (a);
create index scambi_da on public.scambi (da);
alter table public.scambi enable row level security;
revoke all on table public.scambi from anon, authenticated;
grant select on table public.scambi to authenticated;
create policy "scambi: i propri" on public.scambi for select to authenticated using ((select auth.uid()) in (da, a));

create table public.prenotazioni (
  proprietario uuid not null references auth.users (id) on delete cascade,   -- di chi è il desiderio
  libro text not null,                                                      -- id del libro nei suoi desideri
  da uuid not null references auth.users (id) on delete cascade,            -- chi lo regalerà
  creato timestamptz not null default now(),
  primary key (proprietario, libro)
);
alter table public.prenotazioni enable row level security;
revoke all on table public.prenotazioni from anon, authenticated;            -- nessuno la legge direttamente: il proprietario non deve vederla

create function public.sono_amici(x uuid, y uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.amicizie f where f.stato = 'amici' and ((f.da = x and f.a = y) or (f.da = y and f.a = x)));
$$;

-- presta o regala un libro a un amico
create function public.crea_scambio(a uuid, tipo text, libro jsonb, libro_id text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); nuovo uuid;
begin
  if me is null then raise exception 'non autenticato'; end if;
  if not public.sono_amici(me, crea_scambio.a) then raise exception 'non amici'; end if;
  if (select count(*) from public.scambi s where s.da = me and s.creato > now() - interval '1 day') >= 200 then raise exception 'troppi scambi oggi'; end if;
  insert into public.scambi (da, a, tipo, libro, libro_id) values (me, crea_scambio.a, crea_scambio.tipo, crea_scambio.libro, coalesce(crea_scambio.libro_id, ''))
    returning id into nuovo;
  if crea_scambio.tipo = 'regalo' and coalesce(crea_scambio.libro->>'i', '') <> '' then        -- regalo fatto: via la prenotazione
    delete from public.prenotazioni p where p.proprietario = crea_scambio.a and p.da = me
      and p.libro in (select l.id from public.libri l where l.utente = crea_scambio.a and l.dati->>'i' = crea_scambio.libro->>'i');
  end if;
  return nuovo;
end $$;

-- prestito finito (lo segna chi presta o chi riceve)
create function public.chiudi_scambio(id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'non autenticato'; end if;
  update public.scambi s set stato = 'chiuso', chiuso = now() where s.id = chiudi_scambio.id and me in (s.da, s.a) and s.stato = 'aperto';
end $$;

-- chi riceve l'ha messo nella sua Libreria
create function public.segna_visto(id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'non autenticato'; end if;
  update public.scambi s set visto = true where s.id = segna_visto.id and s.a = auth.uid();
end $$;

-- i miei prestiti e regali (aperti, e quelli chiusi negli ultimi 60 giorni)
create function public.miei_scambi() returns table (id uuid, da uuid, a uuid, nome_da text, nome_a text, tipo text, libro jsonb, libro_id text, stato text, visto boolean, creato timestamptz, chiuso timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.id, s.da, s.a, pd.utente, pa.utente, s.tipo, s.libro, s.libro_id, s.stato, s.visto, s.creato, s.chiuso
  from public.scambi s
  left join public.profili pd on pd.id = s.da
  left join public.profili pa on pa.id = s.a
  where auth.uid() in (s.da, s.a) and (s.stato = 'aperto' or s.chiuso > now() - interval '60 days')
  order by s.creato desc
  limit 500;
$$;

-- i desideri di un amico (se li mostra), con le prenotazioni: mai al proprietario
create function public.desideri_di(amico uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); vis boolean;
begin
  if me is null then raise exception 'non autenticato'; end if;
  if not public.sono_amici(me, desideri_di.amico) then raise exception 'non amici'; end if;
  select p.desideri into vis from public.profili p where p.id = desideri_di.amico;
  if not coalesce(vis, false) then return jsonb_build_object('visibili', false, 'libri', '[]'::jsonb); end if;
  return jsonb_build_object('visibili', true, 'libri', coalesce((
    select jsonb_agg(jsonb_build_object('id', l.id, 't', l.dati->>'t', 'a', l.dati->>'a', 'e', l.dati->>'e', 'y', l.dati->>'y', 'i', l.dati->>'i',
             'img', l.dati->>'img', 'pg', l.dati->>'pg',
             'prenotato', case when pr.da is null then '' when pr.da = me then 'io' else coalesce((select q.utente from public.profili q where q.id = pr.da), 'un amico') end)
           order by l.aggiornato desc)
    from (select * from public.libri l0 where l0.utente = desideri_di.amico and not l0.cancellato and l0.dati->>'w' = 'true' order by l0.aggiornato desc limit 300) l
    left join public.prenotazioni pr on pr.proprietario = desideri_di.amico and pr.libro = l.id), '[]'::jsonb));
end $$;

-- «Te lo regalo io» (si = true) o annulla (si = false)
create function public.prenota_regalo(amico uuid, libro text, si boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); chi uuid;
begin
  if me is null then raise exception 'non autenticato'; end if;
  if not public.sono_amici(me, prenota_regalo.amico) then raise exception 'non amici'; end if;
  if not si then delete from public.prenotazioni p where p.proprietario = prenota_regalo.amico and p.libro = prenota_regalo.libro and p.da = me; return ''; end if;
  if not coalesce((select p.desideri from public.profili p where p.id = prenota_regalo.amico), false)
     or not exists (select 1 from public.libri l where l.utente = prenota_regalo.amico and l.id = prenota_regalo.libro and not l.cancellato and l.dati->>'w' = 'true')
  then raise exception 'desiderio non trovato'; end if;
  insert into public.prenotazioni (proprietario, libro, da) values (prenota_regalo.amico, prenota_regalo.libro, me) on conflict do nothing;
  select p.da into chi from public.prenotazioni p where p.proprietario = prenota_regalo.amico and p.libro = prenota_regalo.libro;
  if chi <> me then raise exception 'già prenotato'; end if;
  return 'io';
end $$;

revoke all on function public.sono_amici(uuid, uuid), public.crea_scambio(uuid, text, jsonb, text), public.chiudi_scambio(uuid), public.segna_visto(uuid),
  public.miei_scambi(), public.desideri_di(uuid), public.prenota_regalo(uuid, text, boolean) from public, anon;
grant execute on function public.crea_scambio(uuid, text, jsonb, text), public.chiudi_scambio(uuid), public.segna_visto(uuid),
  public.miei_scambi(), public.desideri_di(uuid), public.prenota_regalo(uuid, text, boolean) to authenticated;
