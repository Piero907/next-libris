-- Next Libris · 014: notifiche push con l'app chiusa (Web Push). 16/11/2026, prima nella prova.
-- Scelte di Piero: push per tutti gli avvisi della campanella tranne «limite»; interruttore in Impostazioni (acceso di
-- partenza) e scelta dei tipi; orari di silenzio personalizzabili (di partenza 22-8): le notifiche di quelle ore restano
-- in attesa e partono quando l'orario torna buono (non partono se nel frattempo sono state lette); dopo il silenzio,
-- da 3 in su un solo riepilogo (lo decide la Edge Function «push»).
--
-- Come funziona: ogni telefono iscritto ha una riga in push_iscrizioni (indirizzo push del browser, mai l'email).
-- Una notifica nuova parte in «attesa»; il trigger push_notifiche chiama push_sveglia(), che, se c'è qualcosa da
-- mandare adesso, chiama la Edge Function «push» con pg_net (dopo il commit). La funzione prende il lavoro con
-- push_lavoro() (solo service_role) e manda i push; le iscrizioni scadute le toglie con push_scadute().
-- pg_cron richiama push_sveglia() ogni 15 minuti per le notifiche trattenute dal silenzio.
--
-- Valori del progetto, nel Vault (non stanno nel file; si mettono una volta per progetto con execute_sql):
--   push_url = https://<ref>.supabase.co/functions/v1/push · push_segreto = 64 caratteri a caso (lo stesso che la funzione
--   riceve nell'intestazione x-push) · push_vapid_pub, push_vapid_priv (chiavi VAPID generate con web-push) ·
--   push_vapid_subject = mailto:nextlibris.app@gmail.com. La chiave VAPID pubblica va anche in push.js (VAPID, per progetto).
--   Funzione: supabase/funzioni/push/index.ts, pubblicata con verify_jwt = false (controlla il segreto da sola).

create extension if not exists pg_net with schema extensions;   -- le funzioni restano in net.*
create extension if not exists pg_cron;

-- telefoni (browser) iscritti ai push
create table public.push_iscrizioni (
  endpoint text primary key check (char_length(endpoint) between 20 and 1000 and endpoint like 'https://%'),
  utente uuid not null references auth.users (id) on delete cascade,
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  creata timestamptz not null default now()
);
create index push_iscrizioni_utente on public.push_iscrizioni (utente);
alter table public.push_iscrizioni enable row level security;
revoke all on table public.push_iscrizioni from anon, authenticated;

-- preferenze (uguali su tutti i telefoni dell'utente); senza riga valgono quelle di partenza
create table public.push_preferenze (
  utente uuid primary key references auth.users (id) on delete cascade,
  tipi text[] not null default '{amicizie,prestiti,richieste,consigli,chiavi}'
    check (tipi <@ '{amicizie,prestiti,richieste,consigli,chiavi}'::text[]),
  silenzio_da smallint not null default 22 check (silenzio_da between 0 and 23),
  silenzio_a smallint not null default 8 check (silenzio_a between 0 and 23),   -- uguali = nessun silenzio
  fuso text not null default 'Europe/Rome' check (char_length(fuso) between 1 and 60),
  aggiornata timestamptz not null default now()
);
alter table public.push_preferenze enable row level security;
revoke all on table public.push_preferenze from anon, authenticated;

-- stato del push di ogni notifica: attesa → inviata, oppure no (letta, tipo escluso, nessun telefono, troppo vecchia)
alter table public.notifiche add column push text not null default 'attesa' check (push in ('attesa', 'inviata', 'no'));
update public.notifiche set push = 'no';
create index notifiche_push_attesa on public.notifiche (utente) where push = 'attesa';

-- gruppo di un tipo di notifica (null = mai push, per esempio «limite»)
create function public.push_gruppo(tipo text) returns text
language sql immutable set search_path = '' as $$
  select case
    when tipo in ('amicizia', 'amico') then 'amicizie'
    when tipo in ('prestito', 'regalo', 'reso', 'reso_ok', 'reso_no', 'chiuso') then 'prestiti'
    when tipo in ('richiesta', 'richiesta_si', 'richiesta_no') then 'richieste'
    when tipo = 'consiglio' then 'consigli'
    when tipo = 'chiavi' then 'chiavi'
  end;
$$;

-- vero se adesso, nel fuso dell'utente, è ora di silenzio
create function public.push_silenzio(da smallint, a smallint, fuso text) returns boolean
language sql stable set search_path = '' as $$
  select case when da = a then false when da < a then h >= da and h < a else h >= da or h < a end
  from (select extract(hour from now() at time zone fuso)::int as h) x;
$$;

-- notifiche da mandare adesso (in attesa, tipo scelto, telefono iscritto, fuori dal silenzio)
create function public.push_pronte() returns setof public.notifiche
language sql stable security definer set search_path = '' as $$
  select n.* from public.notifiche n
  left join public.push_preferenze p on p.utente = n.utente
  where n.push = 'attesa' and not n.letta and n.creata > now() - interval '24 hours'
    and public.push_gruppo(n.tipo) = any (coalesce(p.tipi, '{amicizie,prestiti,richieste,consigli,chiavi}'::text[]))
    and exists (select 1 from public.push_iscrizioni i where i.utente = n.utente)
    and not public.push_silenzio(coalesce(p.silenzio_da, 22::smallint), coalesce(p.silenzio_a, 8::smallint), coalesce(p.fuso, 'Europe/Rome'));
$$;

-- chiama la Edge Function «push» se c'è qualcosa da mandare (dal trigger e da pg_cron)
create function public.push_sveglia() returns void
language plpgsql security definer set search_path = '' as $$
declare u text; s text;
begin
  if not exists (select 1 from public.push_pronte()) then return; end if;
  select decrypted_secret into u from vault.decrypted_secrets where name = 'push_url';
  select decrypted_secret into s from vault.decrypted_secrets where name = 'push_segreto';
  if u is null or s is null then return; end if;
  perform net.http_post(url := u, body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push', s), timeout_milliseconds := 8000);
end $$;

create function public.push_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.push_sveglia();
  return null;
end $$;
create trigger push_notifiche after insert on public.notifiche for each statement execute function public.push_trigger();

-- lavoro per la Edge Function (solo service_role, e solo con il segreto giusto): chiude ciò che non partirà più,
-- segna «inviata» ciò che parte adesso e lo restituisce raggruppato per utente, con le iscrizioni e il numero delle
-- non lette (per il numero sull'icona), più le chiavi VAPID dal Vault (così non servono segreti della funzione)
create function public.push_lavoro(segreto text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb; s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'push_segreto';
  if s is null or push_lavoro.segreto is distinct from s then return null; end if;
  update public.notifiche n set push = 'no'
  where n.push = 'attesa' and (n.letta or n.creata <= now() - interval '24 hours' or public.push_gruppo(n.tipo) is null
    or not exists (select 1 from public.push_iscrizioni i where i.utente = n.utente)
    or public.push_gruppo(n.tipo) <> all (coalesce((select p.tipi from public.push_preferenze p where p.utente = n.utente),
                                                   '{amicizie,prestiti,richieste,consigli,chiavi}'::text[])));
  with prese as (
    update public.notifiche n set push = 'inviata'
    where n.id in (select x.id from public.push_pronte() x)
    returning n.id, n.utente, n.da, n.tipo, n.titolo, n.rif, n.creata
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'utente', u.utente,
      'nuove', u.nuove,
      'non_lette', (select count(*) from public.notifiche n where n.utente = u.utente and not n.letta),
      'iscrizioni', (select coalesce(jsonb_agg(jsonb_build_object('endpoint', i.endpoint, 'keys', jsonb_build_object('p256dh', i.p256dh, 'auth', i.auth))), '[]'::jsonb)
                     from public.push_iscrizioni i where i.utente = u.utente))), '[]'::jsonb)
  into r
  from (select p.utente, jsonb_agg(jsonb_build_object('id', p.id, 'tipo', p.tipo, 'titolo', p.titolo, 'rif', p.rif,
                                   'nome', coalesce(pr.utente, pr.nome, '')) order by p.creata) as nuove
        from prese p left join public.profili pr on pr.id = p.da group by p.utente) u;
  return jsonb_build_object('lavori', r, 'vapid', jsonb_build_object(
    'pub', (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_pub'),
    'priv', (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_priv'),
    'subject', (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_subject')));
end $$;

-- iscrizioni che il servizio push dice scadute (404/410): si tolgono (solo service_role)
create function public.push_scadute(endpoints text[]) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_iscrizioni i where i.endpoint = any (push_scadute.endpoints);
$$;

-- dall'app: iscrive questo telefono (se l'indirizzo era di un altro account sullo stesso telefono, passa a questo)
create function public.push_iscrivi(endpoint text, p256dh text, auth text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'non autenticato'; end if;
  insert into public.push_iscrizioni (endpoint, utente, p256dh, auth)
    values (push_iscrivi.endpoint, me, push_iscrivi.p256dh, push_iscrivi.auth)
    on conflict on constraint push_iscrizioni_pkey do update set utente = me, p256dh = excluded.p256dh, auth = excluded.auth, creata = now();
  delete from public.push_iscrizioni i where i.utente = me and i.endpoint in (   -- al massimo 10 telefoni per account
    select x.endpoint from public.push_iscrizioni x where x.utente = me order by x.creata desc offset 10);
end $$;

-- dall'app: toglie questo telefono
create function public.push_cancella(endpoint text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'non autenticato'; end if;
  delete from public.push_iscrizioni i where i.endpoint = push_cancella.endpoint and i.utente = auth.uid();
end $$;

-- dall'app: le mie preferenze (con quelle di partenza se non le ho mai salvate)
create function public.push_mie_preferenze() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('tipi', coalesce(p.tipi, '{amicizie,prestiti,richieste,consigli,chiavi}'::text[]),
    'silenzio_da', coalesce(p.silenzio_da, 22), 'silenzio_a', coalesce(p.silenzio_a, 8), 'fuso', coalesce(p.fuso, 'Europe/Rome'))
  from (select auth.uid() as me) m left join public.push_preferenze p on p.utente = m.me
  where m.me is not null;
$$;

-- dall'app: salva le preferenze
create function public.push_salva_preferenze(tipi text[], silenzio_da int, silenzio_a int, fuso text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); f text := coalesce(nullif(push_salva_preferenze.fuso, ''), 'Europe/Rome');
begin
  if me is null then raise exception 'non autenticato'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = f) then f := 'Europe/Rome'; end if;
  insert into public.push_preferenze (utente, tipi, silenzio_da, silenzio_a, fuso, aggiornata)
    values (me, coalesce(push_salva_preferenze.tipi, '{}'), push_salva_preferenze.silenzio_da, push_salva_preferenze.silenzio_a, f, now())
    on conflict (utente) do update set tipi = excluded.tipi, silenzio_da = excluded.silenzio_da,
      silenzio_a = excluded.silenzio_a, fuso = excluded.fuso, aggiornata = now();
end $$;

revoke all on function public.push_gruppo(text), public.push_silenzio(smallint, smallint, text), public.push_pronte(),
  public.push_sveglia(), public.push_trigger(), public.push_lavoro(text), public.push_scadute(text[]) from public, anon, authenticated;
grant execute on function public.push_lavoro(text), public.push_scadute(text[]) to service_role;
revoke all on function public.push_iscrivi(text, text, text), public.push_cancella(text), public.push_mie_preferenze(),
  public.push_salva_preferenze(text[], int, int, text) from public, anon;
grant execute on function public.push_iscrivi(text, text, text), public.push_cancella(text), public.push_mie_preferenze(),
  public.push_salva_preferenze(text[], int, int, text) to authenticated;

-- ogni 15 minuti: notifiche trattenute dal silenzio
select cron.schedule('push-attese', '*/15 * * * *', 'select public.push_sveglia()');
