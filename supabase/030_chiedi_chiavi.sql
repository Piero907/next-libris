-- Next Libris · 030: «Chiedimela» e «chi ha una chiave sua» (giro 12). 19/11/2026, prima nella prova. Scelte di Piero.
-- 1) chiavi_ho: ogni utente dichiara SOLO un sì/no «ho una chiave Google mia» / «ho un worker mio» (la chiave resta sul telefono).
--    Serve a mostrare «Chiedimela» solo accanto agli amici che possono prestare; chi presta davvero si vede già nella tabella chiavi
--    (per eventuali riconoscimenti futuri a chi presta).
-- 2) chiavi_richieste: «Piero ti chiede in prestito la chiave»: una richiesta allo stesso amico ogni 7 giorni, 10 al giorno in tutto.
--    Chi la riceve non deve rifiutare: basta ignorarla. Avviso nella campanella e push (tipo 'chiedi_chiavi', gruppo «chiavi»).

create table public.chiavi_ho (
  utente uuid primary key references auth.users (id) on delete cascade,
  gb boolean not null default false,
  sbn boolean not null default false,
  dal timestamptz not null default now(),
  aggiornato timestamptz not null default now()
);
alter table public.chiavi_ho enable row level security;
revoke all on table public.chiavi_ho from public, anon, authenticated;

create table public.chiavi_richieste (
  da uuid not null references auth.users (id) on delete cascade,
  a uuid not null references auth.users (id) on delete cascade,
  creata timestamptz not null default now(),
  primary key (da, a),
  check (da <> a)
);
create index chiavi_richieste_a on public.chiavi_richieste (a);
alter table public.chiavi_richieste enable row level security;
revoke all on table public.chiavi_richieste from public, anon, authenticated;

-- l'app dichiara se sul telefono c'è una chiave propria o un worker proprio (mai i valori)
create function public.chiavi_dichiara(gb boolean, sbn boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare g boolean := coalesce(chiavi_dichiara.gb, false); s boolean := coalesce(chiavi_dichiara.sbn, false);
begin
  if auth.uid() is null then raise exception 'non autenticato'; end if;
  insert into public.chiavi_ho as h (utente, gb, sbn) values (auth.uid(), g, s)
    on conflict (utente) do update set gb = excluded.gb, sbn = excluded.sbn, aggiornato = now()
    where (h.gb, h.sbn) is distinct from (excluded.gb, excluded.sbn);
end $$;

-- i miei amici: chi ha una chiave o un worker suoi (dichiarati, oppure già prestati a qualcuno) e quando gliel'ho chiesta
create function public.amici_chiavi() returns table (id uuid, gb boolean, sbn boolean, chiesta timestamptz)
language sql stable security definer set search_path = '' as $$
  select x.id,
         coalesce(h.gb, false) or exists (select 1 from public.chiavi c where c.da = x.id and c.gb_key <> ''),
         coalesce(h.sbn, false) or exists (select 1 from public.chiavi c where c.da = x.id and c.sbn <> ''),
         r.creata
    from (select case when f.da = auth.uid() then f.a else f.da end as id
            from public.amicizie f where f.stato = 'amici' and auth.uid() in (f.da, f.a)) x
    left join public.chiavi_ho h on h.utente = x.id
    left join public.chiavi_richieste r on r.da = auth.uid() and r.a = x.id;
$$;

-- «Chiedimela»: 'ok' mandata · 'gia' te la presta già · 'no' non ha niente di suo · 'presto' chiesta da meno di 7 giorni · 'troppe' 10 oggi
create function public.chiedi_chiavi(a uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'non autenticato'; end if;
  if chiedi_chiavi.a is null or not public.sono_amici(me, chiedi_chiavi.a) then raise exception 'non amici'; end if;
  if exists (select 1 from public.chiavi c where c.da = chiedi_chiavi.a and c.a = me) then return 'gia'; end if;
  if not exists (select 1 from public.chiavi_ho h where h.utente = chiedi_chiavi.a and (h.gb or h.sbn))
     and not exists (select 1 from public.chiavi c where c.da = chiedi_chiavi.a) then return 'no'; end if;
  if exists (select 1 from public.chiavi_richieste r where r.da = me and r.a = chiedi_chiavi.a and r.creata > now() - interval '7 days') then return 'presto'; end if;
  if (select count(*) from public.chiavi_richieste r where r.da = me and r.creata > now() - interval '1 day') >= 10 then return 'troppe'; end if;
  delete from public.chiavi_richieste r where r.creata < now() - interval '60 days';
  insert into public.chiavi_richieste as r (da, a) values (me, chiedi_chiavi.a)
    on conflict on constraint chiavi_richieste_pkey do update set creata = now();   -- «(da, a)» si confonderebbe con il parametro a
  delete from public.notifiche n where n.utente = chiedi_chiavi.a and n.da = me and n.tipo = 'chiedi_chiavi';   -- una sola per persona
  perform public.notifica_nuova(chiedi_chiavi.a, me, 'chiedi_chiavi', '', '');
  return 'ok';
end $$;

revoke all on function public.chiavi_dichiara(boolean, boolean), public.amici_chiavi(), public.chiedi_chiavi(uuid) from public, anon;
grant execute on function public.chiavi_dichiara(boolean, boolean), public.amici_chiavi(), public.chiedi_chiavi(uuid) to authenticated;

-- tipo nuovo nella campanella e nelle push (gruppo «chiavi», come «condivide con te la sua chiave»)
alter table public.notifiche drop constraint notifiche_tipo_check;
alter table public.notifiche add constraint notifiche_tipo_check check (tipo = any (array['amicizia', 'amico', 'prestito', 'regalo', 'reso', 'reso_ok', 'reso_no', 'chiuso',
  'richiesta', 'richiesta_si', 'richiesta_no', 'consiglio', 'chiavi', 'chiedi_chiavi', 'limite', 'desideri', 'trovato', 'avviso', 'messaggi', 'segnalazione']));

create or replace function public.push_gruppo(tipo text) returns text
language sql immutable set search_path = '' as $$
  select case
    when tipo in ('amicizia', 'amico') then 'amicizie'
    when tipo in ('prestito', 'regalo', 'reso', 'reso_ok', 'reso_no', 'chiuso', 'richiesta', 'richiesta_si', 'richiesta_no') then 'prestiti'
    when tipo in ('consiglio', 'desideri', 'trovato') then 'consigli'
    when tipo in ('chiavi', 'chiedi_chiavi') then 'chiavi' -- chiedi_chiavi: «Chiedimela» (030)
    when tipo = 'messaggi' then 'chat'                    -- riassunto della chat (023)
    when tipo in ('avviso', 'segnalazione') then 'avvisi' -- sempre, qualunque tipo abbia scelto l'utente
  end;
$$;

-- amicizia tolta: via anche le richieste di chiave tra i due (il resto come nella 023)
create or replace function public.amicizie_pulizia() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.seguiti s where (s.chi = old.da and s.amico = old.a) or (s.chi = old.a and s.amico = old.da);
  delete from public.desideri_trovati d where (d.chi = old.da and d.amico = old.a) or (d.chi = old.a and d.amico = old.da);
  delete from public.chiavi_richieste r where (r.da = old.da and r.a = old.a) or (r.da = old.a and r.a = old.da);
  if old.stato = 'amici' then
    update public.chat x set stato = 'chiusa'
      where x.tipo = 'due' and x.a = least(old.da, old.a) and x.b = greatest(old.da, old.a) and x.stato = 'attiva';
  end if;
  return null;
end $$;
