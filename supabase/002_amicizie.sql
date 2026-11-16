-- Next Libris: nome utente e amicizie (16/11/2026). Applicato al progetto della prova («next-libris-social», ref amkrkvkylprjasccxmzo);
-- per la vera («next-libris», ref fttdbqotjocjfjfcoyfv) si applica quando l'amicizia passa nella versione vera.
-- Amicizia reciproca: A chiede, B accetta (o rifiuta). Ci si trova con il nome utente (ricerca: uguale o che comincia così, da 3 lettere)
-- o con il link d'invito (…/?amico=nomeutente). La tabella si legge solo con le proprie righe; si scrive solo con le funzioni qui sotto.

alter table public.profili add column utente text unique check (utente ~ '^[a-z0-9._]{3,20}$');

create table public.amicizie (
  da uuid not null references auth.users (id) on delete cascade,   -- chi ha chiesto
  a uuid not null references auth.users (id) on delete cascade,    -- chi riceve
  stato text not null default 'attesa' check (stato in ('attesa', 'amici')),
  creato timestamptz not null default now(),
  primary key (da, a),
  check (da <> a)
);
create index amicizie_a on public.amicizie (a);
alter table public.amicizie enable row level security;
revoke all on table public.amicizie from anon, authenticated;
grant select on table public.amicizie to authenticated;
create policy "amicizie: le proprie" on public.amicizie for select to authenticated using ((select auth.uid()) in (da, a));

-- ricerca per nome utente: solo nome utente e nome, mai email
create function public.cerca_utenti(q text) returns table (id uuid, utente text, nome text, rel text)
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); s text := lower(regexp_replace(coalesce(q, ''), '^\s*@|\s+', '', 'g'));
begin
  if me is null then raise exception 'non autenticato'; end if;
  if char_length(s) < 3 then return; end if;
  return query
    select p.id, p.utente, p.nome,
      coalesce((select case when f.stato = 'amici' then 'amici' when f.da = me then 'inviata' else 'ricevuta' end
                from public.amicizie f where (f.da = me and f.a = p.id) or (f.da = p.id and f.a = me) limit 1), '')
    from public.profili p
    where p.utente is not null and p.id <> me and (p.utente = s or p.utente like replace(replace(s, '_', '\_'), '%', '\%') || '%')
    order by (p.utente = s) desc, p.utente
    limit 10;
end $$;

-- chiede l'amicizia (se l'altro l'aveva già chiesta a me, diventiamo amici)
create function public.chiedi_amicizia(utente text) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); altro uuid; st text;
begin
  if me is null then raise exception 'non autenticato'; end if;
  select p.id into altro from public.profili p where p.utente = lower(trim(chiedi_amicizia.utente));
  if altro is null then raise exception 'utente non trovato'; end if;
  if altro = me then raise exception 'sei tu'; end if;
  select f.stato into st from public.amicizie f where f.da = me and f.a = altro;
  if st is not null then return st; end if;
  update public.amicizie f set stato = 'amici' where f.da = altro and f.a = me returning f.stato into st;
  if st is not null then return 'amici'; end if;
  if (select count(*) from public.amicizie f where f.da = me and f.stato = 'attesa') >= 100 then raise exception 'troppe richieste in attesa'; end if;
  insert into public.amicizie (da, a) values (me, altro);
  return 'attesa';
end $$;

-- risponde a una richiesta ricevuta: accetta o rifiuta
create function public.rispondi_amicizia(da uuid, accetta boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'non autenticato'; end if;
  if accetta then update public.amicizie f set stato = 'amici' where f.da = rispondi_amicizia.da and f.a = me and f.stato = 'attesa';
  else delete from public.amicizie f where f.da = rispondi_amicizia.da and f.a = me and f.stato = 'attesa'; end if;
end $$;

-- toglie un amico, annulla una richiesta inviata
create function public.togli_amicizia(altro uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'non autenticato'; end if;
  delete from public.amicizie f where (f.da = me and f.a = altro) or (f.da = altro and f.a = me);
end $$;

-- amici e richieste, con nome utente e nome
create function public.miei_amici() returns table (id uuid, utente text, nome text, stato text, verso text, creato timestamptz)
language sql stable security definer set search_path = '' as $$
  select case when f.da = auth.uid() then f.a else f.da end, p.utente, p.nome, f.stato,
         case when f.da = auth.uid() then 'inviata' else 'ricevuta' end, f.creato
  from public.amicizie f
  left join public.profili p on p.id = case when f.da = auth.uid() then f.a else f.da end
  where auth.uid() in (f.da, f.a)
  order by f.creato desc;
$$;

revoke all on function public.cerca_utenti(text), public.chiedi_amicizia(text), public.rispondi_amicizia(uuid, boolean),
  public.togli_amicizia(uuid), public.miei_amici() from public, anon;
grant execute on function public.cerca_utenti(text), public.chiedi_amicizia(text), public.rispondi_amicizia(uuid, boolean),
  public.togli_amicizia(uuid), public.miei_amici() to authenticated;
