-- Next Libris · 023: chat (giro 9a, database e sicurezza). 18/11/2026, prima nella prova.
-- Scelte di Piero (documento del progetto claude/giro-9-chat-scelte.md):
--  · chat a due anche con chi non è amico: il primo messaggio è una «richiesta» (Accetta / Rifiuta); finché non è accettata
--    chi l'ha mandata non può scriverne altri. Rifiuto: chi ha scritto non lo sa (vede «in attesa»), può riprovare dopo
--    30 giorni; dopo il secondo rifiuto non può più. Al massimo 15 richieste nuove al giorno.
--  · «Possono scrivermi» (profili.scrivermi): tutti / amici degli amici (di partenza) / solo amici.
--  · Blocco completo: toglie l'amicizia, niente ricerca per nome, niente richieste d'amicizia, niente gruppi insieme a te;
--    nei gruppi comuni i messaggi sono nascosti in tutti e due i versi. L'altro non viene avvisato.
--  · Segnala (con «Blocca anche»): copia del messaggio e dei 10 prima per l'amministratore; 3 persone diverse in 30 giorni
--    = stop automatico alle richieste nuove verso chi non è amico. Chi è segnalato non lo sa.
--  · Gruppi fino a 30: ognuno aggiunge solo i propri amici; solo chi l'ha creato toglie le persone e cambia il nome.
--  · Messaggi fino a 1.000 caratteri, niente foto, tenuti 6 mesi; il proprio messaggio si cancella per tutti entro 1 ora;
--    nessun segno «letto» per gli altri; «Elimina chat» vale solo per sé; ogni chat si può silenziare.
--  · Niente Realtime: l'app chiede chat_leggi(chat, dopo) ogni 10-20 secondi con la chat aperta.
--  · Riassunto nella campanella e push al massimo ogni 2 ore (tipo «messaggi», gruppo push «chat», ore di silenzio rispettate).
--  · Amministratore: tabella «amministratori», cambiata solo dal pannello di Supabase o da Claude, MAI dall'app.
--    Ogni funzione admin_* controlla per prima auth.uid() in quella tabella. Non si può segnalare, si può bloccare.
-- Nella prova è stata applicata in due parti (023_chat e 023_chat_b); nella vera si applica questo file intero.
-- Tutte le tabelle nuove: RLS accesa SENZA regole e permessi tolti ad anon/authenticated: si passa solo dalle funzioni.

-- ---------- tabelle ----------
alter table public.profili add column scrivermi text not null default 'amici_amici'
  constraint profili_scrivermi_check check (scrivermi in ('tutti', 'amici_amici', 'amici'));

create table public.amministratori (
  utente uuid primary key references auth.users(id) on delete cascade,
  creato timestamptz not null default now());

create table public.blocchi (
  chi uuid not null references auth.users(id) on delete cascade,
  altro uuid not null references auth.users(id) on delete cascade,
  creato timestamptz not null default now(),
  primary key (chi, altro), check (chi <> altro));
create index blocchi_altro on public.blocchi (altro);

create table public.sospesi (                          -- fermo = niente richieste nuove a chi non è amico; sospeso = non scrive a nessuno
  utente uuid primary key references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('fermo', 'sospeso')),
  dal timestamptz not null default now(),
  da_chi uuid references auth.users(id) on delete set null);   -- null = stop automatico

create table public.chat (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('due', 'gruppo')),
  nome text not null default '' check (char_length(nome) <= 40),
  creatore uuid references auth.users(id) on delete set null,
  a uuid references auth.users(id) on delete cascade,          -- chat a due: la coppia, in ordine (a < b)
  b uuid references auth.users(id) on delete cascade,
  stato text not null default 'attiva' check (stato in ('attiva', 'richiesta', 'rifiutata', 'chiusa')),
  richiesta_da uuid references auth.users(id) on delete set null,
  richiesta_il timestamptz,
  rifiuti smallint not null default 0,
  rifiutata_il timestamptz,
  creata timestamptz not null default now(),
  ultimo timestamptz not null default now(),
  constraint chat_coppia_check check ((tipo = 'due' and a is not null and b is not null and a < b) or (tipo = 'gruppo' and a is null and b is null)));
create unique index chat_coppia on public.chat (a, b) where tipo = 'due';
create index chat_b on public.chat (b) where tipo = 'due';
create index chat_richiesta_da on public.chat (richiesta_da, richiesta_il) where richiesta_da is not null;
create index chat_creatore on public.chat (creatore) where creatore is not null;

create table public.chat_membri (
  chat uuid not null references public.chat(id) on delete cascade,
  utente uuid not null references auth.users(id) on delete cascade,
  entrato timestamptz not null default now(),
  da_id bigint not null default 0,          -- vede solo i messaggi con id più grande (entrata nel gruppo, «Elimina chat»)
  letto bigint not null default 0,          -- ultimo messaggio letto (lo sa solo lui: niente «letto» per gli altri)
  avvisato bigint not null default 0,       -- ultimo messaggio già finito in un riassunto
  silenziata boolean not null default false,
  primary key (chat, utente));
create index chat_membri_utente on public.chat_membri (utente);

create table public.messaggi (
  id bigint generated always as identity primary key,
  chat uuid not null references public.chat(id) on delete cascade,
  da uuid references auth.users(id) on delete set null,
  tipo text not null default 'testo' check (tipo in ('testo', 'libro', 'consiglio', 'sistema')),
  testo text not null default '' check (char_length(testo) <= 1000),
  libro jsonb check (libro is null or (jsonb_typeof(libro) = 'object' and pg_column_size(libro) < 20000)),
  su uuid references auth.users(id) on delete set null,        -- messaggi di sistema: la persona aggiunta o tolta
  creato timestamptz not null default now(),
  eliminato boolean not null default false);
create index messaggi_chat on public.messaggi (chat, id);
create index messaggi_da on public.messaggi (da, creato);
create index messaggi_creato on public.messaggi (creato);
create index messaggi_su on public.messaggi (su) where su is not null;

create table public.segnalazioni (
  id uuid primary key default gen_random_uuid(),
  da uuid references auth.users(id) on delete set null,
  su uuid not null references auth.users(id) on delete cascade,
  chat uuid,
  messaggio bigint,
  motivo text not null default '' check (char_length(motivo) <= 300),
  copia jsonb not null default '[]'::jsonb,                    -- il messaggio segnalato e i 10 prima, com'erano quel giorno
  stato text not null default 'aperta' check (stato in ('aperta', 'bene', 'ferma', 'sospesa')),
  creata timestamptz not null default now(),
  chiusa_il timestamptz,
  chiusa_da uuid references auth.users(id) on delete set null,
  unique (da, messaggio));
create index segnalazioni_su on public.segnalazioni (su, creata);
create index segnalazioni_stato on public.segnalazioni (stato, creata);
create index segnalazioni_chiusa_da on public.segnalazioni (chiusa_da) where chiusa_da is not null;
create index sospesi_da_chi on public.sospesi (da_chi) where da_chi is not null;

alter table public.amministratori enable row level security;
alter table public.blocchi enable row level security;
alter table public.sospesi enable row level security;
alter table public.chat enable row level security;
alter table public.chat_membri enable row level security;
alter table public.messaggi enable row level security;
alter table public.segnalazioni enable row level security;
revoke all on public.amministratori, public.blocchi, public.sospesi, public.chat, public.chat_membri, public.messaggi, public.segnalazioni
  from public, anon, authenticated;

-- ---------- aiuti interni (mai chiamabili dall'app) ----------
create function public.e_admin(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select u is not null and exists (select 1 from public.amministratori a where a.utente = u);
$$;

create function public.bloccati(x uuid, y uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocchi k where (k.chi = x and k.altro = y) or (k.chi = y and k.altro = x));
$$;

create function public.amici_di_amici(x uuid, y uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.amicizie f
    where f.stato = 'amici' and (f.da = x or f.a = x)
      and public.sono_amici(case when f.da = x then f.a else f.da end, y));
$$;

create function public.chat_ultimo_id() returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(max(m.id), 0) from public.messaggi m;
$$;

-- lo stato come lo vede «me»: attiva · richiesta (per me, da accettare) · attesa (la mia richiesta: anche se rifiutata) · chiusa · rifiutata (da me)
create function public.chat_stato(tipo text, stato text, richiesta_da uuid, me uuid) returns text
language sql immutable set search_path = '' as $$
  select case
    when tipo = 'gruppo' then 'attiva'
    when stato in ('richiesta', 'rifiutata') and richiesta_da = me then 'attesa'
    else stato end;
$$;

-- solo i campi che servono per mostrare un libro; copertine solo dai siti noti (come l'archivio)
create function public.chat_libro(l jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare d jsonb := '{}'::jsonb; k text; v text;
  campi constant text[] := array['t', 'a', 'i', 'e', 'y', 'pg', 'img', 'gen', 'se', 'sn'];
  massimi constant integer[] := array[300, 300, 20, 200, 10, 6, 600, 60, 200, 10];
  copertine constant text := '^https://(books\.google\.[a-z.]{2,8}|[a-z0-9-]+\.googleusercontent\.com|covers\.openlibrary\.org|([a-z0-9-]+\.)?archive\.org)/';
begin
  if l is null or jsonb_typeof(l) <> 'object' then return null; end if;
  for i in 1 .. array_length(campi, 1) loop
    k := campi[i];
    if jsonb_typeof(l -> k) in ('string', 'number') then
      v := btrim(l ->> k);
      if v <> '' and char_length(v) <= massimi[i] and (k <> 'img' or v ~* copertine) then d := d || jsonb_build_object(k, v); end if;
    end if;
  end loop;
  if coalesce(d ->> 't', '') = '' then return null; end if;
  return d;
end $$;

-- può «me» scrivere ad «altro» (chat a due)? si · richiesta (partirebbe una richiesta nuova) · attesa · no · sospeso · fermo
create function public.chat_permesso(me uuid, altro uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare c public.chat%rowtype; sc text;
begin
  if me is null or altro is null or me = altro then return 'no'; end if;
  if exists (select 1 from public.sospesi s where s.utente = me and s.tipo = 'sospeso') then return 'sospeso'; end if;
  select p.scrivermi into sc from public.profili p where p.id = altro and p.utente is not null;
  if sc is null or public.bloccati(me, altro) then return 'no'; end if;
  if public.sono_amici(me, altro) then return 'si'; end if;
  select * into c from public.chat x where x.tipo = 'due' and x.a = least(me, altro) and x.b = greatest(me, altro);
  if c.id is not null then
    if c.stato = 'attiva' then return 'si'; end if;                                  -- richiesta già accettata
    if c.stato = 'richiesta' then return case when c.richiesta_da = me then 'attesa' else 'si' end; end if;
    if c.stato = 'rifiutata' then
      if c.richiesta_da is distinct from me then return 'si'; end if;               -- ho rifiutato io: se scrivo, riapro
      if c.rifiuti >= 2 or c.rifiutata_il > now() - interval '30 days' then return 'attesa'; end if;
    end if;
  end if;
  if exists (select 1 from public.sospesi s where s.utente = me) then return 'fermo'; end if;
  if sc = 'amici' or (sc = 'amici_amici' and not public.amici_di_amici(me, altro)) then return 'no'; end if;
  return 'richiesta';
end $$;

-- scrive davvero il messaggio (controlli sul testo e limiti); i permessi li ha già guardati chi la chiama
create function public.chat_invia(me uuid, c uuid, p_testo text, p_libro jsonb, p_tipo text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare t text := btrim(coalesce(p_testo, '')); k text := coalesce(nullif(p_tipo, ''), 'testo'); l jsonb; n bigint;
begin
  if k not in ('testo', 'libro', 'consiglio') then raise exception 'tipo non valido'; end if;
  if char_length(t) > 1000 then raise exception 'messaggio troppo lungo'; end if;
  if k = 'testo' then
    if t = '' then raise exception 'messaggio vuoto'; end if;
  else
    l := public.chat_libro(p_libro);
    if l is null then raise exception 'libro non valido'; end if;
  end if;
  if (select count(*) from public.messaggi m where m.da = me and m.creato > now() - interval '1 minute') >= 30 then
    raise exception 'troppi messaggi: aspetta un momento'; end if;
  if (select count(*) from public.messaggi m where m.da = me and m.creato > now() - interval '1 day') >= 2000 then
    raise exception 'troppi messaggi oggi'; end if;
  insert into public.messaggi (chat, da, tipo, testo, libro) values (c, me, k, t, l) returning id into n;
  update public.chat x set ultimo = now() where x.id = c;
  update public.chat_membri m set letto = n where m.chat = c and m.utente = me;
  return n;
end $$;

create function public.chat_sistema(c uuid, chi uuid, cosa text, p_su uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.messaggi (chat, da, tipo, testo, su) values (c, chi, 'sistema', cosa, p_su);
  update public.chat x set ultimo = now() where x.id = c;
$$;

-- chi comanda nel gruppo: chi l'ha creato se c'è ancora, altrimenti il membro più vecchio
create function public.gruppo_capo(c uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select x.creatore from public.chat x join public.chat_membri m on m.chat = x.id and m.utente = x.creatore where x.id = c),
    (select m.utente from public.chat_membri m where m.chat = c order by m.entrato, m.utente limit 1));
$$;

create function public.blocca_interno(p_me uuid, p_altro uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.blocchi (chi, altro) values (p_me, p_altro) on conflict do nothing;
  delete from public.amicizie f where (f.da = p_me and f.a = p_altro) or (f.da = p_altro and f.a = p_me);     -- anche le richieste in attesa
  delete from public.prenotazioni p where (p.proprietario = p_me and p.da = p_altro) or (p.proprietario = p_altro and p.da = p_me);
  delete from public.richieste r where r.stato = 'attesa' and ((r.da = p_me and r.a = p_altro) or (r.da = p_altro and r.a = p_me));
  delete from public.consigli c where (c.da = p_me and c.a = p_altro) or (c.da = p_altro and c.a = p_me);
  delete from public.chiavi k where (k.da = p_me and k.a = p_altro) or (k.da = p_altro and k.a = p_me);
  delete from public.notifiche n where (n.utente = p_me and n.da = p_altro) or (n.utente = p_altro and n.da = p_me);
end $$;

-- ---------- chat a due ----------
create function public.chat_posso(altro uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then 'no' else public.chat_permesso(auth.uid(), altro) end;
$$;

create function public.chat_scrivi_a(a uuid, testo text, libro jsonb default null, tipo text default 'testo') returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := auth.uid(); altro uuid := chat_scrivi_a.a; p text; c public.chat%rowtype; n bigint;
begin
  if me is null then raise exception 'non autenticato'; end if;
  p := public.chat_permesso(me, altro);
  if p = 'sospeso' then raise exception 'sospeso'; end if;
  if p = 'fermo' then raise exception 'fermo'; end if;
  if p = 'attesa' then raise exception 'in attesa'; end if;
  if p = 'no' then raise exception 'non disponibile'; end if;
  select * into c from public.chat x where x.tipo = 'due' and x.a = least(me, altro) and x.b = greatest(me, altro) for update;
  if p = 'richiesta' and (select count(*) from public.chat x where x.richiesta_da = me and x.richiesta_il > now() - interval '1 day') >= 15 then
    raise exception 'troppe richieste oggi';
  end if;
  if c.id is null then
    insert into public.chat (tipo, a, b, stato, richiesta_da, richiesta_il)
      values ('due', least(me, altro), greatest(me, altro), case when p = 'richiesta' then 'richiesta' else 'attiva' end,
              case when p = 'richiesta' then me end, case when p = 'richiesta' then now() end)
      returning * into c;
    insert into public.chat_membri (chat, utente) values (c.id, me), (c.id, altro);
  elsif p = 'richiesta' then
    update public.chat x set stato = 'richiesta', richiesta_da = me, richiesta_il = now() where x.id = c.id;
  elsif c.stato <> 'attiva' or (c.rifiuti > 0 and public.sono_amici(me, altro)) then
    update public.chat x set stato = 'attiva', rifiuti = case when public.sono_amici(me, altro) then 0 else x.rifiuti end where x.id = c.id;
  end if;
  n := public.chat_invia(me, c.id, chat_scrivi_a.testo, chat_scrivi_a.libro, chat_scrivi_a.tipo);
  return jsonb_build_object('chat', c.id, 'id', n, 'stato', case when p = 'richiesta' then 'attesa' else 'attiva' end);
end $$;

create function public.chat_scrivi(chat uuid, testo text, libro jsonb default null, tipo text default 'testo') returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := auth.uid(); c public.chat%rowtype; n bigint;
begin
  if me is null then raise exception 'non autenticato'; end if;
  select x.* into c from public.chat x join public.chat_membri m on m.chat = x.id and m.utente = me where x.id = chat_scrivi.chat;
  if c.id is null then raise exception 'non disponibile'; end if;
  if c.tipo = 'due' then
    return public.chat_scrivi_a(case when c.a = me then c.b else c.a end, chat_scrivi.testo, chat_scrivi.libro, chat_scrivi.tipo);
  end if;
  if exists (select 1 from public.sospesi s where s.utente = me and s.tipo = 'sospeso') then raise exception 'sospeso'; end if;
  n := public.chat_invia(me, c.id, chat_scrivi.testo, chat_scrivi.libro, chat_scrivi.tipo);
  return jsonb_build_object('chat', c.id, 'id', n, 'stato', 'attiva');
end $$;

-- risposta a una richiesta di messaggio: solo chi l'ha ricevuta
create function public.chat_rispondi(chat uuid, accetta boolean) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := auth.uid(); n integer;
begin
  if me is null then raise exception 'non autenticato'; end if;
  update public.chat x set
      stato = case when chat_rispondi.accetta then 'attiva' else 'rifiutata' end,
      rifiuti = x.rifiuti + case when chat_rispondi.accetta then 0 else 1 end,
      rifiutata_il = case when chat_rispondi.accetta then x.rifiutata_il else now() end
    where x.id = chat_rispondi.chat and x.tipo = 'due' and x.stato = 'richiesta'
      and me in (x.a, x.b) and x.richiesta_da is distinct from me
      and not public.bloccati(x.a, x.b);
  get diagnostics n = row_count;
  if n = 0 then raise exception 'richiesta non trovata'; end if;
end $$;

-- le mie chat (elenco): ultima riga, quante da leggere, stato
create function public.chat_mie() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(r) - 'ord' order by r.ord desc), '[]'::jsonb)
  from (
    select c.id, c.tipo,
      case when c.tipo = 'gruppo' then c.nome else coalesce(p.utente, '') end as nome,
      o.altro,
      public.chat_stato(c.tipo, c.stato, c.richiesta_da, me.id) as stato,
      m.silenziata,
      case when c.tipo = 'gruppo' then (select count(*) from public.chat_membri z where z.chat = c.id) end as membri,
      case when c.tipo = 'due' then public.e_admin(o.altro) else false end as nl,
      case when c.tipo = 'due' then public.bloccati(me.id, o.altro) else false end as bloccato,
      (select count(*) from (select 1 from public.messaggi y
          where y.chat = c.id and y.id > greatest(m.letto, m.da_id) and y.da is distinct from me.id
            and (c.tipo = 'due' or y.da is null or not public.bloccati(me.id, y.da)) limit 100) q) as nuovi,
      u.ultimo, coalesce(u.quando, c.ultimo) as ord
    from (select auth.uid() as id) me
    join public.chat_membri m on m.utente = me.id
    join public.chat c on c.id = m.chat
    cross join lateral (select case when c.tipo = 'due' then case when c.a = me.id then c.b else c.a end end as altro) o
    left join public.profili p on p.id = o.altro
    left join lateral (
      select y.creato as quando, jsonb_build_object('id', y.id, 'da', y.da, 'nome', coalesce(py.utente, ''), 'tipo', y.tipo,
               'testo', left(y.testo, 80), 'libro', y.libro ->> 't', 'su', y.su, 'creato', y.creato, 'el', y.eliminato) as ultimo
      from public.messaggi y left join public.profili py on py.id = y.da
      where y.chat = c.id and y.id > m.da_id and (c.tipo = 'due' or y.da is null or not public.bloccati(me.id, y.da))
      order by y.id desc limit 1) u on true
    where me.id is not null
      and (c.tipo = 'gruppo' or u.ultimo is not null)                                   -- «Elimina chat»: torna solo con un messaggio nuovo
      and not (c.tipo = 'due' and c.stato = 'rifiutata' and c.richiesta_da is distinct from me.id)   -- rifiutate da me
      and not (c.tipo = 'due' and c.stato = 'richiesta' and c.richiesta_da is distinct from me.id and public.bloccati(me.id, o.altro))
    order by coalesce(u.quando, c.ultimo) desc
    limit 200) r;
$$;

-- controllo leggero per il giro di ogni 3 minuti: quante chat hanno messaggi nuovi e quante richieste aspettano
create function public.chat_numeri() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'nuovi', count(*) filter (where not x.rich and x.n), 'richieste', count(*) filter (where x.rich and x.n))
  from (
    select (c.tipo = 'due' and c.stato = 'richiesta') as rich,
      exists (select 1 from public.messaggi y where y.chat = c.id and y.id > greatest(m.letto, m.da_id) and y.da is distinct from me.id
                and (c.tipo = 'due' or y.da is null or not public.bloccati(me.id, y.da))) as n
    from (select auth.uid() as id) me
    join public.chat_membri m on m.utente = me.id
    join public.chat c on c.id = m.chat
    where me.id is not null
      and (c.tipo = 'gruppo' or c.stato = 'attiva'
        or (c.stato = 'richiesta' and c.richiesta_da is distinct from me.id
            and not public.bloccati(me.id, case when c.a = me.id then c.b else c.a end)))) x;
$$;

-- i messaggi di una chat: gli ultimi 50, oppure quelli dopo «dopo» (giro ogni 10-20 s), oppure i 50 prima di «prima»
create function public.chat_leggi(chat uuid, dopo bigint default 0, prima bigint default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := auth.uid(); c public.chat%rowtype; m public.chat_membri%rowtype; altro uuid; r jsonb; top bigint; n integer;
begin
  if me is null then raise exception 'non autenticato'; end if;
  select x.* into c from public.chat x where x.id = chat_leggi.chat;
  select z.* into m from public.chat_membri z where z.chat = chat_leggi.chat and z.utente = me;
  if c.id is null or m.chat is null then raise exception 'non disponibile'; end if;
  if c.tipo = 'due' then altro := case when c.a = me then c.b else c.a end; end if;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.id), '[]'::jsonb), count(*) into r, n
  from (
    select y.id, y.da, coalesce(p.utente, '') as nome, y.tipo, y.creato, y.eliminato as el, y.su, coalesce(ps.utente, '') as su_nome,
      public.e_admin(y.da) as nl,
      (c.tipo = 'gruppo' and y.da is not null and y.da <> me and public.bloccati(me, y.da)) as nasc,
      case when c.tipo = 'gruppo' and y.da is not null and y.da <> me and public.bloccati(me, y.da) then '' else y.testo end as testo,
      case when c.tipo = 'gruppo' and y.da is not null and y.da <> me and public.bloccati(me, y.da) then null else y.libro end as libro
    from public.messaggi y
    left join public.profili p on p.id = y.da
    left join public.profili ps on ps.id = y.su
    where y.chat = c.id and y.id > m.da_id and y.id > coalesce(chat_leggi.dopo, 0)
      and (chat_leggi.prima is null or y.id < chat_leggi.prima)
    order by y.id desc limit 50) q;
  if chat_leggi.prima is null then
    select coalesce(max(y.id), 0) into top from public.messaggi y where y.chat = c.id;
    if top > m.letto then
      update public.chat_membri z set letto = top where z.chat = c.id and z.utente = me;
      update public.notifiche x set letta = true where x.utente = me and x.tipo = 'messaggi' and not x.letta;
    end if;
  end if;
  return jsonb_build_object(
    'chat', c.id, 'tipo', c.tipo, 'stato', public.chat_stato(c.tipo, c.stato, c.richiesta_da, me),
    'scrivibile', case when c.tipo = 'gruppo' then not exists (select 1 from public.sospesi s where s.utente = me and s.tipo = 'sospeso')
                       else public.chat_permesso(me, altro) = 'si' end,
    'altri', n = 50, 'messaggi', r);
end $$;

-- cancellare un proprio messaggio per tutti: solo entro 1 ora
create function public.chat_elimina_messaggio(id bigint) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := auth.uid(); n integer;
begin
  if me is null then raise exception 'non autenticato'; end if;
  update public.messaggi y set eliminato = true, testo = '', libro = null
    where y.id = chat_elimina_messaggio.id and y.da = me and y.tipo <> 'sistema' and not y.eliminato
      and y.creato > now() - interval '1 hour';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'non si può più eliminare'; end if;
end $$;

-- «Elimina chat»: solo per me (gli altri la tengono fino ai 6 mesi)
create function public.chat_elimina(chat uuid) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := auth.uid(); t bigint := public.chat_ultimo_id();
begin
  if me is null then raise exception 'non autenticato'; end if;
  update public.chat_membri z set da_id = t, letto = t, avvisato = t where z.chat = chat_elimina.chat and z.utente = me;
end $$;

create function public.chat_silenzia(chat uuid, si boolean) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'non autenticato'; end if;
  update public.chat_membri z set silenziata = coalesce(chat_silenzia.si, true) where z.chat = chat_silenzia.chat and z.utente = auth.uid();
end $$;

-- ---------- gruppi ----------
create function public.gruppo_crea(nome text, membri uuid[]) returns uuid
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := auth.uid(); t text := btrim(regexp_replace(coalesce(gruppo_crea.nome, ''), '\s+', ' ', 'g')); ids uuid[]; c uuid; top bigint;
begin
  if me is null then raise exception 'non autenticato'; end if;
  if exists (select 1 from public.sospesi s where s.utente = me and s.tipo = 'sospeso') then raise exception 'sospeso'; end if;
  if t = '' or char_length(t) > 40 then raise exception 'nome: da 1 a 40 caratteri'; end if;
  ids := array(select distinct x from unnest(coalesce(gruppo_crea.membri, '{}')) x where x is not null and x <> me);
  if coalesce(array_length(ids, 1), 0) < 1 then raise exception 'scegli almeno un amico'; end if;
  if array_length(ids, 1) > 29 then raise exception 'al massimo 30 persone'; end if;
  if exists (select 1 from unnest(ids) x where not public.sono_amici(me, x)) then raise exception 'non amici'; end if;
  if (select count(*) from public.chat x where x.creatore = me and x.tipo = 'gruppo' and x.creata > now() - interval '1 day') >= 10 then
    raise exception 'troppi gruppi oggi'; end if;
  top := public.chat_ultimo_id();
  insert into public.chat (tipo, nome, creatore) values ('gruppo', t, me) returning id into c;
  insert into public.chat_membri (chat, utente, da_id, letto, avvisato) values (c, me, top, top, top);
  insert into public.chat_membri (chat, utente, da_id, letto, avvisato) select c, x, top, top, top from unnest(ids) x;
  perform public.chat_sistema(c, me, 'creato', null);
  return c;
end $$;

create function public.gruppo_aggiungi(chat uuid, utente uuid) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := auth.uid(); c uuid := gruppo_aggiungi.chat; u uuid := gruppo_aggiungi.utente; top bigint;
begin
  if me is null then raise exception 'non autenticato'; end if;
  if exists (select 1 from public.sospesi s where s.utente = me and s.tipo = 'sospeso') then raise exception 'sospeso'; end if;
  perform 1 from public.chat x where x.id = c and x.tipo = 'gruppo' for update;
  if not found or not exists (select 1 from public.chat_membri z where z.chat = c and z.utente = me) then raise exception 'non disponibile'; end if;
  if not public.sono_amici(me, u) then raise exception 'non amici'; end if;
  if exists (select 1 from public.chat_membri z where z.chat = c and z.utente = u) then return; end if;
  if (select count(*) from public.chat_membri z where z.chat = c) >= 30 then raise exception 'al massimo 30 persone'; end if;
  top := public.chat_ultimo_id();
  insert into public.chat_membri (chat, utente, da_id, letto, avvisato) values (c, u, top, top, top);
  perform public.chat_sistema(c, me, 'aggiunto', u);
end $$;

create function public.gruppo_togli(chat uuid, utente uuid) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := auth.uid(); c uuid := gruppo_togli.chat; u uuid := gruppo_togli.utente; n integer;
begin
  if me is null then raise exception 'non autenticato'; end if;
  if not exists (select 1 from public.chat x where x.id = c and x.tipo = 'gruppo') or public.gruppo_capo(c) is distinct from me then
    raise exception 'solo chi ha creato il gruppo'; end if;
  if u = me then raise exception 'per uscire usa gruppo_esci'; end if;
  delete from public.chat_membri z where z.chat = c and z.utente = u;
  get diagnostics n = row_count;
  if n > 0 then perform public.chat_sistema(c, me, 'tolto', u); end if;
end $$;

create function public.gruppo_esci(chat uuid) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := auth.uid(); c uuid := gruppo_esci.chat; n integer;
begin
  if me is null then raise exception 'non autenticato'; end if;
  if not exists (select 1 from public.chat x where x.id = c and x.tipo = 'gruppo') then raise exception 'non disponibile'; end if;
  delete from public.chat_membri z where z.chat = c and z.utente = me;
  get diagnostics n = row_count;
  if n = 0 then return; end if;
  if not exists (select 1 from public.chat_membri z where z.chat = c) then delete from public.chat x where x.id = c; return; end if;
  update public.chat x set creatore = null where x.id = c and x.creatore = me;       -- passa al membro più vecchio (gruppo_capo)
  perform public.chat_sistema(c, me, 'uscito', null);
end $$;

create function public.gruppo_nome(chat uuid, nome text) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := auth.uid(); c uuid := gruppo_nome.chat; t text := btrim(regexp_replace(coalesce(gruppo_nome.nome, ''), '\s+', ' ', 'g'));
begin
  if me is null then raise exception 'non autenticato'; end if;
  if not exists (select 1 from public.chat x where x.id = c and x.tipo = 'gruppo') or public.gruppo_capo(c) is distinct from me then
    raise exception 'solo chi ha creato il gruppo'; end if;
  if t = '' or char_length(t) > 40 then raise exception 'nome: da 1 a 40 caratteri'; end if;
  update public.chat x set nome = t where x.id = c and x.nome <> t;
  if found then perform public.chat_sistema(c, me, 'nome', null); end if;
end $$;

create function public.gruppo_membri(chat uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := auth.uid(); c uuid := gruppo_membri.chat; capo uuid;
begin
  if me is null then raise exception 'non autenticato'; end if;
  if not exists (select 1 from public.chat_membri z join public.chat x on x.id = z.chat and x.tipo = 'gruppo' where z.chat = c and z.utente = me) then
    raise exception 'non disponibile'; end if;
  capo := public.gruppo_capo(c);
  return (select coalesce(jsonb_agg(jsonb_build_object('id', z.utente, 'utente', coalesce(p.utente, ''), 'capo', z.utente = capo,
              'amico', public.sono_amici(me, z.utente), 'nl', public.e_admin(z.utente), 'bloccato', public.bloccati(me, z.utente))
            order by (z.utente = capo) desc, lower(coalesce(p.utente, ''))), '[]'::jsonb)
          from public.chat_membri z left join public.profili p on p.id = z.utente where z.chat = c);
end $$;

-- ---------- blocchi ----------
create function public.blocca(altro uuid, si boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'non autenticato'; end if;
  if blocca.altro is null or blocca.altro = me then raise exception 'non disponibile'; end if;
  if not coalesce(blocca.si, true) then
    delete from public.blocchi k where k.chi = me and k.altro = blocca.altro;
    return;
  end if;
  if not exists (select 1 from public.profili p where p.id = blocca.altro) then raise exception 'non disponibile'; end if;
  if (select count(*) from public.blocchi k where k.chi = me) >= 500 then raise exception 'troppe persone bloccate'; end if;
  perform public.blocca_interno(me, blocca.altro);
end $$;

create function public.bloccati_miei() returns table (id uuid, utente text, creato timestamptz)
language sql stable security definer set search_path = '' as $$
  select k.altro, coalesce(p.utente, ''), k.creato
  from public.blocchi k left join public.profili p on p.id = k.altro
  where k.chi = auth.uid() order by lower(coalesce(p.utente, ''));
$$;

-- chi tra questi ha il segno «Next Libris» (è pubblico: serve per mostrarlo accanto al nome)
create function public.next_libris(ids uuid[]) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array(select a.utente from public.amministratori a where auth.uid() is not null and a.utente = any (ids[1:200])), '{}');
$$;

-- il blocco vale anche per la ricerca per nome, le richieste d'amicizia e gli «amici di»
create or replace function public.cerca_utenti(q text)
 returns table(id uuid, utente text, nome text, rel text)
 language plpgsql stable security definer set search_path to ''
as $function$
declare me uuid := auth.uid(); s text := lower(btrim(regexp_replace(regexp_replace(coalesce(q, ''), '^\s*@', ''), '\s+', ' ', 'g')));
begin
  if me is null then raise exception 'non autenticato'; end if;
  if char_length(s) < 3 then return; end if;
  return query
    select p.id, p.utente, p.nome,
      coalesce((select case when f.stato = 'amici' then 'amici' when f.da = me then 'inviata' else 'ricevuta' end
                from public.amicizie f where (f.da = me and f.a = p.id) or (f.da = p.id and f.a = me) limit 1), '')
    from public.profili p
    where p.utente is not null and p.id <> me
      and not public.bloccati(me, p.id)                                               -- 023
      and (lower(p.utente) = s or lower(p.utente) like replace(replace(replace(s, '\', '\\'), '_', '\_'), '%', '\%') || '%')
    order by (lower(p.utente) = s) desc, lower(p.utente)
    limit 10;
end $function$;

create or replace function public.chiedi_amicizia(utente text, segui boolean default false)
 returns text
 language plpgsql security definer set search_path to ''
as $function$
declare me uuid := auth.uid(); altro uuid; st text;
begin
  if me is null then raise exception 'non autenticato'; end if;
  select p.id into altro from public.profili p where lower(p.utente) = lower(btrim(chiedi_amicizia.utente));
  if altro is null or public.bloccati(me, altro) then raise exception 'utente non trovato'; end if;     -- 023: bloccati
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
end $function$;

create or replace function public.amici_di(amico uuid)
 returns jsonb
 language plpgsql stable security definer set search_path to ''
as $function$
declare me uuid := auth.uid(); vis boolean; res jsonb;
begin
  if me is null then raise exception 'non autenticato'; end if;
  if not public.sono_amici(me, amici_di.amico) then raise exception 'non amici'; end if;
  select p.amici into vis from public.profili p where p.id = amici_di.amico;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.oid, 'utente', x.utente, 'comune', x.comune, 'rel', x.rel)
           order by x.comune desc, lower(x.utente)), '[]'::jsonb)
    into res
    from (
      select o.oid, p.utente, public.sono_amici(me, o.oid) as comune,
        coalesce((select case when f.stato = 'amici' then 'amici' when f.da = me then 'inviata' else 'ricevuta' end
                  from public.amicizie f where (f.da = me and f.a = o.oid) or (f.da = o.oid and f.a = me) limit 1), '') as rel
      from (select case when f.da = amici_di.amico then f.a else f.da end as oid
              from public.amicizie f
             where f.stato = 'amici' and (f.da = amici_di.amico or f.a = amici_di.amico)) o
      join public.profili p on p.id = o.oid
      where o.oid <> me and p.utente is not null
        and not public.bloccati(me, o.oid)                                            -- 023
        and (coalesce(vis, false) or public.sono_amici(me, o.oid))
      order by public.sono_amici(me, o.oid) desc, lower(p.utente)
      limit 500
    ) x;
  return jsonb_build_object('visibili', coalesce(vis, false), 'amici', res);
end $function$;

-- amicizia tolta: la chat a due resta da leggere ma non si scrive più (stato «chiusa»)
create or replace function public.amicizie_pulizia() returns trigger
language plpgsql security definer set search_path to '' as $function$
begin
  delete from public.seguiti s where (s.chi = old.da and s.amico = old.a) or (s.chi = old.a and s.amico = old.da);
  delete from public.desideri_trovati d where (d.chi = old.da and d.amico = old.a) or (d.chi = old.a and d.amico = old.da);
  if old.stato = 'amici' then
    update public.chat x set stato = 'chiusa'
      where x.tipo = 'due' and x.a = least(old.da, old.a) and x.b = greatest(old.da, old.a) and x.stato = 'attiva';
  end if;
  return null;
end $function$;

-- ---------- segnalazioni ----------
create function public.segnala(messaggio bigint, motivo text default '', blocca boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := auth.uid(); y public.messaggi%rowtype; m public.chat_membri%rowtype; s uuid; cp jsonb; nome text;
begin
  if me is null then raise exception 'non autenticato'; end if;
  select * into y from public.messaggi x where x.id = segnala.messaggio;
  select * into m from public.chat_membri z where z.chat = y.chat and z.utente = me;
  if y.id is null or m.chat is null or y.id <= m.da_id or y.da is null or y.da = me or y.tipo = 'sistema' then raise exception 'non disponibile'; end if;
  if public.e_admin(y.da) then raise exception 'non segnalabile'; end if;
  if (select count(*) from public.segnalazioni g where g.da = me and g.creata > now() - interval '1 day') >= 10 then
    raise exception 'troppe segnalazioni oggi'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'da', q.da, 'nome', coalesce(p.utente, ''), 'tipo', q.tipo, 'testo', q.testo,
           'libro', q.libro ->> 't', 'creato', q.creato, 'el', q.eliminato) order by q.id), '[]'::jsonb) into cp
    from (select * from public.messaggi x where x.chat = y.chat and x.id <= y.id and x.id > m.da_id and x.tipo <> 'sistema'
          order by x.id desc limit 11) q
    left join public.profili p on p.id = q.da;
  insert into public.segnalazioni (da, su, chat, messaggio, motivo, copia)
    values (me, y.da, y.chat, y.id, left(btrim(coalesce(segnala.motivo, '')), 300), cp)
    on conflict (da, messaggio) do nothing returning id into s;
  if s is not null then
    select coalesce(p.utente, '') into nome from public.profili p where p.id = y.da;
    perform public.notifica_nuova(a.utente, null, 'segnalazione', s::text, left(coalesce(nome, ''), 40)) from public.amministratori a;
    if not exists (select 1 from public.sospesi x where x.utente = y.da)
       and (select count(distinct g.da) from public.segnalazioni g
            where g.su = y.da and g.da is not null and g.stato <> 'bene' and g.creata > now() - interval '30 days') >= 3 then
      insert into public.sospesi (utente, tipo) values (y.da, 'fermo') on conflict do nothing;       -- stop automatico
    end if;
  end if;
  if coalesce(segnala.blocca, true) then perform public.blocca_interno(me, y.da); end if;
end $$;

-- ---------- amministratore: ogni funzione controlla PER PRIMA la tabella amministratori ----------
create function public.admin_controllo() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.e_admin(auth.uid()) then raise exception 'non autorizzato' using errcode = '42501'; end if;
end $$;

create function public.admin_sono() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.e_admin(auth.uid());
$$;

create function public.admin_segnalazioni(stato text default 'aperta') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.admin_controllo();
  return (select coalesce(jsonb_agg(to_jsonb(r) order by r.creata desc), '[]'::jsonb) from (
    select g.id, g.creata, g.stato, g.motivo, g.messaggio, g.copia, g.chiusa_il,
      g.da as da_id, coalesce(pd.utente, '') as da_nome, g.su as su_id, coalesce(ps.utente, '') as su_nome,
      (select count(distinct z.da) from public.segnalazioni z
        where z.su = g.su and z.da is not null and z.stato <> 'bene' and z.creata > now() - interval '30 days') as persone,
      coalesce((select x.tipo from public.sospesi x where x.utente = g.su), '') as fermo
    from public.segnalazioni g
    left join public.profili pd on pd.id = g.da
    left join public.profili ps on ps.id = g.su
    where case when coalesce(admin_segnalazioni.stato, 'aperta') = 'aperta' then g.stato = 'aperta' else g.stato <> 'aperta' end
    order by g.creata desc limit 100) r);
end $$;

-- esito: bene (chiude il caso e toglie lo stop) · ferma (resta lo stop) · sospendi (non scrive più a nessuno)
create function public.admin_decidi(id uuid, esito text) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := auth.uid(); chi uuid;
begin
  perform public.admin_controllo();
  if admin_decidi.esito is null or admin_decidi.esito not in ('bene', 'ferma', 'sospendi') then raise exception 'esito non valido'; end if;
  update public.segnalazioni g
    set stato = case admin_decidi.esito when 'bene' then 'bene' when 'ferma' then 'ferma' else 'sospesa' end, chiusa_il = now(), chiusa_da = me
    where g.id = admin_decidi.id returning g.su into chi;
  if chi is null then raise exception 'segnalazione non trovata'; end if;
  if admin_decidi.esito = 'bene' then
    delete from public.sospesi x where x.utente = chi and x.tipo = 'fermo';
  elsif public.e_admin(chi) then
    raise exception 'un amministratore non si può fermare';
  elsif admin_decidi.esito = 'ferma' then
    insert into public.sospesi (utente, tipo, da_chi) values (chi, 'fermo', me) on conflict (utente) do nothing;
  else
    insert into public.sospesi (utente, tipo, da_chi) values (chi, 'sospeso', me)
      on conflict (utente) do update set tipo = 'sospeso', dal = now(), da_chi = me;
  end if;
end $$;

create function public.admin_sospesi() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_controllo();
  return (select coalesce(jsonb_agg(jsonb_build_object('id', x.utente, 'nome', coalesce(p.utente, ''), 'tipo', x.tipo, 'dal', x.dal,
                   'automatico', x.da_chi is null) order by x.dal desc), '[]'::jsonb)
          from public.sospesi x left join public.profili p on p.id = x.utente);
end $$;

create function public.admin_riattiva(utente uuid) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.admin_controllo();
  delete from public.sospesi x where x.utente = admin_riattiva.utente;
end $$;

create function public.admin_avviso(titolo text, testo text) returns integer
language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_controllo();
  return public.avviso_importante(admin_avviso.titolo, admin_avviso.testo);
end $$;

-- i numeri dell'app, in una sola chiamata (solo quando si apre il pannello)
create function public.admin_numeri() returns jsonb
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

-- pulizia dell'archivio comune
create function public.admin_archivio_cerca(q text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s text := btrim(coalesce(q, '')); cod text := regexp_replace(coalesce(q, ''), '[^0-9]', '', 'g'); pat text;
begin
  perform public.admin_controllo();
  if char_length(s) < 3 then return '[]'::jsonb; end if;
  pat := '%' || replace(replace(replace(s, '\', '\\'), '_', '\_'), '%', '\%') || '%';
  return (select coalesce(jsonb_agg(jsonb_build_object('isbn', r.isbn, 'dati', r.dati, 'aggiornato', r.aggiornato)), '[]'::jsonb) from (
    select a.isbn, a.dati, a.aggiornato from public.archivio a
    where (cod ~ '^97[89][0-9]{10}$' and a.isbn = cod) or a.dati ->> 't' ilike pat or a.dati ->> 'a' ilike pat
    order by a.aggiornato desc limit 20) r);
end $$;

create function public.admin_archivio_salva(isbn text, dati jsonb) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare d jsonb := admin_archivio_salva.dati; k text;
  copertine constant text := '^https://(books\.google\.[a-z.]{2,8}|[a-z0-9-]+\.googleusercontent\.com|covers\.openlibrary\.org|([a-z0-9-]+\.)?archive\.org)/';
begin
  perform public.admin_controllo();
  if d is null or jsonb_typeof(d) <> 'object' or btrim(coalesce(d ->> 't', '')) = '' or pg_column_size(d) >= 20000 then raise exception 'dati non validi'; end if;
  foreach k in array array['img', 'imgL'] loop
    if d ? k and coalesce(d ->> k, '') !~* copertine then d := d - k; end if;
  end loop;
  update public.archivio a set dati = d, aggiornato = now() where a.isbn = admin_archivio_salva.isbn;
  if not found then raise exception 'libro non trovato'; end if;
end $$;

create function public.admin_archivio_togli(isbn text) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.admin_controllo();
  delete from public.archivio a where a.isbn = admin_archivio_togli.isbn;
end $$;

-- ---------- notifiche e push ----------
alter table public.notifiche drop constraint notifiche_tipo_check;
alter table public.notifiche add constraint notifiche_tipo_check check (tipo = any (array['amicizia', 'amico', 'prestito', 'regalo', 'reso', 'reso_ok', 'reso_no',
  'chiuso', 'richiesta', 'richiesta_si', 'richiesta_no', 'consiglio', 'chiavi', 'limite', 'desideri', 'trovato', 'avviso', 'messaggi', 'segnalazione']));

create or replace function public.push_gruppo(tipo text) returns text
language sql immutable set search_path = '' as $$
  select case
    when tipo in ('amicizia', 'amico') then 'amicizie'
    when tipo in ('prestito', 'regalo', 'reso', 'reso_ok', 'reso_no', 'chiuso', 'richiesta', 'richiesta_si', 'richiesta_no') then 'prestiti'
    when tipo in ('consiglio', 'desideri', 'trovato') then 'consigli'
    when tipo = 'chiavi' then 'chiavi'
    when tipo = 'messaggi' then 'chat'                    -- riassunto della chat (023)
    when tipo in ('avviso', 'segnalazione') then 'avvisi' -- sempre, qualunque tipo abbia scelto l'utente
  end;
$$;

-- gruppo push nuovo «chat», acceso di partenza: nelle quattro funzioni che hanno l'elenco dei gruppi e in chi ha già scelto
-- (chi ha spento tutto resta con tutto spento)
do $$ declare f record;
begin
  for f in select p.oid from pg_proc p where p.pronamespace = 'public'::regnamespace
           and p.proname in ('push_pronte', 'push_lavoro', 'push_mie_preferenze', 'push_salva_preferenze') loop
    execute replace(pg_get_functiondef(f.oid), '{amicizie,prestiti,consigli,chiavi}', '{amicizie,prestiti,consigli,chiavi,chat}');
  end loop;
end $$;
alter table public.push_preferenze drop constraint push_preferenze_tipi_check;
alter table public.push_preferenze add constraint push_preferenze_tipi_check check (tipi <@ '{amicizie,prestiti,consigli,chiavi,chat}'::text[]);
alter table public.push_preferenze alter column tipi set default '{amicizie,prestiti,consigli,chiavi,chat}'::text[];
update public.push_preferenze p set tipi = array_append(p.tipi, 'chat') where p.tipi <> '{}' and not ('chat' = any (p.tipi));

-- riassunto dei messaggi nuovi: al massimo uno ogni 2 ore per persona, solo se c'è qualcosa di nuovo; mai per le chat silenziate.
-- rif = «messaggi:chat:richieste», titolo = i primi tre nomi di chi ha scritto; da = chi ha scritto, se è uno solo
create function public.chat_riassunto() returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in
    with nuovi as (
      select m.utente, m.chat, y.da, (c.tipo = 'due' and c.stato = 'richiesta') as rich
      from public.chat_membri m
      join public.chat c on c.id = m.chat
      join public.messaggi y on y.chat = m.chat and y.id > greatest(m.letto, m.avvisato, m.da_id)
      where not m.silenziata and y.da is not null and y.da <> m.utente and y.creato > now() - interval '2 days'
        and (c.tipo = 'gruppo' or c.stato = 'attiva' or (c.stato = 'richiesta' and c.richiesta_da is distinct from m.utente))
        and not public.bloccati(m.utente, y.da)),
    per as (
      select x.utente, count(*) as n, count(distinct x.chat) as chat, count(distinct x.chat) filter (where x.rich) as rich,
             count(distinct x.da) as quanti, (min(x.da::text))::uuid as uno
      from nuovi x group by x.utente)
    select per.*,
      (select string_agg(q.nome, ', ') from (select distinct coalesce(p.utente, '') as nome
         from nuovi z join public.profili p on p.id = z.da where z.utente = per.utente limit 3) q) as nomi
    from per
    where not exists (select 1 from public.notifiche n where n.utente = per.utente and n.tipo = 'messaggi' and n.creata > now() - interval '2 hours')
  loop
    delete from public.notifiche n where n.utente = r.utente and n.tipo = 'messaggi' and not n.letta;
    perform public.notifica_nuova(r.utente, case when r.quanti = 1 then r.uno end, 'messaggi',
      r.n::text || ':' || r.chat::text || ':' || r.rich::text, left(coalesce(r.nomi, ''), 100));
    update public.chat_membri m set avvisato = t.top
      from (select y.chat, max(y.id) as top from public.messaggi y
            where y.chat in (select z.chat from public.chat_membri z where z.utente = r.utente) group by y.chat) t
      where m.utente = r.utente and t.chat = m.chat and t.top > m.avvisato;
  end loop;
end $$;

-- pulizia di ogni notte: messaggi più vecchi di 6 mesi, chat a due rimaste vuote, gruppi senza nessuno, casi chiusi da 6 mesi
create function public.chat_pulizia() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.messaggi y where y.creato < now() - interval '6 months';
  delete from public.chat c where c.tipo = 'due' and c.ultimo < now() - interval '6 months'
    and not exists (select 1 from public.messaggi y where y.chat = c.id);
  delete from public.chat c where c.tipo = 'gruppo' and not exists (select 1 from public.chat_membri z where z.chat = c.id);
  delete from public.segnalazioni g where g.stato <> 'aperta' and g.chiusa_il < now() - interval '6 months';
end $$;

select cron.schedule('chat-riassunto', '*/15 * * * *', 'select public.chat_riassunto()');
select cron.schedule('chat-pulizia', '20 3 * * *', 'select public.chat_pulizia()');

-- ---------- permessi: niente a public/anon; all'app solo le funzioni dell'elenco ----------
do $$ declare f record;
  app constant text[] := array['chat_posso', 'chat_scrivi_a', 'chat_scrivi', 'chat_rispondi', 'chat_mie', 'chat_numeri', 'chat_leggi',
    'chat_elimina_messaggio', 'chat_elimina', 'chat_silenzia', 'gruppo_crea', 'gruppo_aggiungi', 'gruppo_togli', 'gruppo_esci',
    'gruppo_nome', 'gruppo_membri', 'blocca', 'bloccati_miei', 'next_libris', 'segnala',
    'admin_sono', 'admin_segnalazioni', 'admin_decidi', 'admin_sospesi', 'admin_riattiva', 'admin_avviso', 'admin_numeri',
    'admin_archivio_cerca', 'admin_archivio_salva', 'admin_archivio_togli'];
  interne constant text[] := array['e_admin', 'bloccati', 'amici_di_amici', 'chat_ultimo_id', 'chat_stato', 'chat_libro', 'chat_permesso',
    'chat_invia', 'chat_sistema', 'gruppo_capo', 'blocca_interno', 'admin_controllo', 'chat_riassunto', 'chat_pulizia'];
begin
  for f in select p.oid::regprocedure as firma, p.proname from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.proname = any (app || interne) loop
    execute format('revoke all on function %s from public, anon, authenticated', f.firma);
    if f.proname = any (app) then execute format('grant execute on function %s to authenticated', f.firma); end if;
  end loop;
end $$;
