-- Next Libris · 011: notifiche (campanella). 16/11/2026, prima nella prova.
-- Le notifiche le scrivono solo i trigger sulle tabelle che ci sono già (amicizie, scambi, richieste, consigli, chiavi):
-- le funzioni esistenti non cambiano e valgono i loro limiti al giorno. Chi le riceve le legge con mie_notifiche()
-- e le segna lette con notifiche_lette(). Si tengono 30 giorni (pulizia a ogni notifica nuova per quell'utente).

create table public.notifiche (
  id uuid primary key default gen_random_uuid(),
  utente uuid not null references auth.users (id) on delete cascade,          -- chi la riceve
  da uuid references auth.users (id) on delete cascade,                       -- chi l'ha causata
  tipo text not null check (tipo in ('amicizia', 'amico', 'prestito', 'regalo', 'reso', 'reso_ok', 'reso_no', 'chiuso',
                                     'richiesta', 'richiesta_si', 'richiesta_no', 'consiglio', 'chiavi')),
  rif text not null default '' check (char_length(rif) <= 80),               -- id di scambio, richiesta o consiglio
  titolo text not null default '' check (char_length(titolo) <= 300),        -- titolo del libro, se c'è
  creata timestamptz not null default now(),
  letta boolean not null default false,
  check (da is null or da <> utente)
);
create index notifiche_utente on public.notifiche (utente, creata desc);
create index notifiche_da on public.notifiche (da);
alter table public.notifiche enable row level security;
revoke all on table public.notifiche from anon, authenticated;
grant select on table public.notifiche to authenticated;
create policy "notifiche: le proprie" on public.notifiche for select to authenticated using ((select auth.uid()) = utente);

-- scrive una notifica (solo dai trigger)
create function public.notifica_nuova(utente uuid, da uuid, tipo text, rif text, titolo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if utente is null or utente = da then return; end if;
  delete from public.notifiche n where n.utente = notifica_nuova.utente and n.creata < now() - interval '30 days';
  insert into public.notifiche (utente, da, tipo, rif, titolo)
    values (notifica_nuova.utente, notifica_nuova.da, notifica_nuova.tipo, coalesce(notifica_nuova.rif, ''), left(coalesce(notifica_nuova.titolo, ''), 300));
end $$;

create function public.notifica_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if tg_table_name = 'amicizie' then
    if tg_op = 'INSERT' and new.stato = 'attesa' then
      perform public.notifica_nuova(new.a, new.da, 'amicizia', '', '');
    elsif tg_op = 'UPDATE' and old.stato = 'attesa' and new.stato = 'amici' then
      update public.notifiche n set letta = true where n.utente = new.a and n.da = new.da and n.tipo = 'amicizia';
      perform public.notifica_nuova(new.da, new.a, 'amico', '', '');
    elsif tg_op = 'DELETE' then                                   -- rifiutata o tolta: via le notifiche tra i due
      delete from public.notifiche n where (n.utente = old.da and n.da = old.a) or (n.utente = old.a and n.da = old.da);
    end if;
  elsif tg_table_name = 'scambi' then
    if tg_op = 'INSERT' then
      perform public.notifica_nuova(new.a, new.da, new.tipo, new.id::text, new.libro->>'t');
    elsif tg_op = 'UPDATE' and old.stato is distinct from new.stato then
      if old.stato = 'aperto' and new.stato = 'reso' then
        perform public.notifica_nuova(new.da, new.a, 'reso', new.id::text, new.libro->>'t');
      elsif old.stato = 'reso' then
        update public.notifiche n set letta = true where n.utente = new.da and n.tipo = 'reso' and n.rif = new.id::text;
        perform public.notifica_nuova(new.a, new.da, case when new.stato = 'chiuso' then 'reso_ok' else 'reso_no' end, new.id::text, new.libro->>'t');
      elsif old.stato = 'aperto' and new.stato = 'chiuso' and new.tipo = 'prestito' and me is not null then   -- chi presta lo segna restituito
        perform public.notifica_nuova(case when me = new.da then new.a else new.da end, me, 'chiuso', new.id::text, new.libro->>'t');
      end if;
    end if;
  elsif tg_table_name = 'richieste' then
    if tg_op = 'INSERT' then
      perform public.notifica_nuova(new.a, new.da, 'richiesta', new.id::text, new.libro->>'t');
    elsif tg_op = 'UPDATE' and old.stato = 'attesa' and new.stato <> 'attesa' then
      update public.notifiche n set letta = true where n.utente = new.a and n.tipo = 'richiesta' and n.rif = new.id::text;
      perform public.notifica_nuova(new.da, new.a, case when new.stato = 'accettata' then 'richiesta_si' else 'richiesta_no' end, new.id::text, new.libro->>'t');
    elsif tg_op = 'DELETE' then                                   -- annullata (o libro tolto): la richiesta non c'è più
      delete from public.notifiche n where n.utente = old.a and n.tipo = 'richiesta' and n.rif = old.id::text;
    end if;
  elsif tg_table_name = 'consigli' then
    if tg_op = 'INSERT' then
      perform public.notifica_nuova(new.a, new.da, 'consiglio', new.id::text, new.libro->>'t');
    elsif tg_op = 'DELETE' then
      update public.notifiche n set letta = true where n.utente = old.a and n.tipo = 'consiglio' and n.rif = old.id::text;
    end if;
  elsif tg_table_name = 'chiavi' then
    if tg_op = 'INSERT' or (tg_op = 'UPDATE' and (old.gb_key, old.sbn) is distinct from (new.gb_key, new.sbn)) then
      delete from public.notifiche n where n.utente = new.a and n.da = new.da and n.tipo = 'chiavi' and not n.letta;
      perform public.notifica_nuova(new.a, new.da, 'chiavi', '', '');
    end if;
  end if;
  return null;
end $$;

create trigger notifiche_amicizie after insert or update or delete on public.amicizie for each row execute function public.notifica_trigger();
create trigger notifiche_scambi after insert or update on public.scambi for each row execute function public.notifica_trigger();
create trigger notifiche_richieste after insert or update or delete on public.richieste for each row execute function public.notifica_trigger();
create trigger notifiche_consigli after insert or delete on public.consigli for each row execute function public.notifica_trigger();
create trigger notifiche_chiavi after insert or update on public.chiavi for each row execute function public.notifica_trigger();

-- le mie notifiche, le più recenti prima (con il nome di chi le ha causate)
create function public.mie_notifiche() returns table (id uuid, da uuid, nome text, tipo text, rif text, titolo text, creata timestamptz, letta boolean)
language sql stable security definer set search_path = '' as $$
  select n.id, n.da, p.utente, n.tipo, n.rif, n.titolo, n.creata, n.letta
  from public.notifiche n left join public.profili p on p.id = n.da
  where n.utente = auth.uid() and n.creata > now() - interval '30 days'
  order by n.creata desc
  limit 100;
$$;

-- segna lette: quelle indicate, oppure tutte (ids null)
create function public.notifiche_lette(ids uuid[] default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'non autenticato'; end if;
  update public.notifiche n set letta = true
    where n.utente = auth.uid() and not n.letta and (notifiche_lette.ids is null or n.id = any (notifiche_lette.ids));
end $$;

revoke all on function public.notifica_nuova(uuid, uuid, text, text, text), public.notifica_trigger() from public, anon, authenticated;
revoke all on function public.mie_notifiche(), public.notifiche_lette(uuid[]) from public, anon;
grant execute on function public.mie_notifiche(), public.notifiche_lette(uuid[]) to authenticated;
