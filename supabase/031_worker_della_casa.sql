-- 031 · Worker SBN della casa (20/11/2026, scelte di Piero; prima nella prova).
-- Un solo worker SBN per tutti, nascosto dietro la funzione «libri» (versione 4): l'indirizzo e la chiave di firma stanno nel
-- Vault (sbn_worker, sbn_firma: messi a mano, vedi in fondo) e non arrivano mai al telefono. Tra amici si presta solo l'API.
-- Limiti (giorno UTC, come Cloudflare): 500 ricerche al giorno per utente con l'account; 3.000 al giorno in tutto per chi non ha
-- l'account (i 50 al giorno per telefono li conta l'app: si aggirano, il tetto no).
--  1) sbn_conta(utente) (solo service_role): conta la ricerca e restituisce {w, f, mio} oppure {e: 'mio' | 'tetto' | 'no', mio}.
--  2) Via il prestito del worker: worker_conta e worker_prestato tolte; presta_chiavi presta solo l'API; chiavi_mie non dà più
--     worker; «ho un worker mio» sempre no; gli indirizzi dei worker prestati tolti dalla tabella chiavi (senza avvisi agli amici).

-- 1) contatore: righe «c:» nella tabella ricerche (c = casa)
alter table public.ricerche drop constraint ricerche_chiave_check;
alter table public.ricerche add constraint ricerche_chiave_check check (chiave ~ '^[gsapwc]:[0-9a-f]{64}$');

create function public.sbn_conta(utente uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  g date := (now() at time zone 'UTC')::date;
  k text; n integer; lim integer; w text; f text;
  per_utente constant integer := 500;      -- scelta di Piero (20/11/2026)
  senza_account constant integer := 3000;  -- tetto di tutti quelli senza account insieme (20/11/2026)
begin
  if sbn_conta.utente is not null then
    k := 'c:' || encode(sha256(convert_to(sbn_conta.utente::text, 'UTF8')), 'hex'); lim := per_utente;
  else
    k := 'c:' || encode(sha256(convert_to('senza-account', 'UTF8')), 'hex'); lim := senza_account;
  end if;
  select r.n into n from public.ricerche r where r.chiave = k and r.giorno = g;
  if coalesce(n, 0) >= lim then
    return jsonb_build_object('e', case when sbn_conta.utente is null then 'tetto' else 'mio' end, 'mio', n);
  end if;
  select s.decrypted_secret into w from vault.decrypted_secrets s where s.name = 'sbn_worker';
  select s.decrypted_secret into f from vault.decrypted_secrets s where s.name = 'sbn_firma';
  if w is null or f is null or w !~ '^https://' then return jsonb_build_object('e', 'no'); end if;
  insert into public.ricerche as r (chiave, giorno, n) values (k, g, 1)
    on conflict (chiave, giorno) do update set n = r.n + 1 returning r.n into n;
  return jsonb_build_object('w', w, 'f', f, 'mio', n);
end $$;
revoke all on function public.sbn_conta(uuid) from public, anon, authenticated;
grant execute on function public.sbn_conta(uuid) to service_role;

-- 2) via il prestito del worker
drop function public.worker_conta(uuid, uuid);
drop function public.worker_prestato(uuid, uuid);

alter table public.chiavi disable trigger user;           -- niente avviso «condivide con te…» agli amici per questo cambio
update public.chiavi set sbn = '' where sbn <> '';
alter table public.chiavi enable trigger user;
alter table public.chiavi add constraint chiavi_senza_worker check (sbn = '');
update public.chiavi_ho set sbn = false where sbn;

-- l'argomento sbn resta (le app non ancora aggiornate lo mandano) ma non si usa più
create or replace function public.presta_chiavi(a uuid, gb_key text, sbn text)
returns void language plpgsql security definer set search_path = '' as $$
declare g text := coalesce(presta_chiavi.gb_key, '');
begin
  if auth.uid() is null then raise exception 'non autenticato'; end if;
  if not public.sono_amici(auth.uid(), presta_chiavi.a) then raise exception 'non amici'; end if;
  if g = '' then raise exception 'niente da prestare'; end if;
  if g !~ '^[A-Za-z0-9_-]{20,100}$' then raise exception 'chiave non valida'; end if;
  if public.chiave_altrui(g) then raise exception 'non tua'; end if;
  insert into public.chiavi (da, a, gb_key, sbn) values (auth.uid(), presta_chiavi.a, g, '')
    on conflict on constraint chiavi_pkey do update set gb_key = excluded.gb_key, sbn = '', creato = now();
end $$;

create or replace function public.chiavi_mie()
 returns table(da uuid, a uuid, nome text, gb_key text, sbn text, creato timestamp with time zone)
 language sql stable security definer set search_path to ''
as $function$
  select c.da, c.a, p.utente, 'si', '', c.creato
    from public.chiavi c join public.profili p on p.id = c.a where c.da = auth.uid() and c.gb_key <> ''
  union all
  select c.da, c.a, p.utente, 'prestata:' || c.da::text, '', c.creato      -- mai la chiave vera (020)
    from public.chiavi c join public.profili p on p.id = c.da
    where c.a = auth.uid() and c.gb_key <> '' and public.sono_amici(c.da, c.a);
$function$;

create or replace function public.chiavi_dichiara(gb boolean, sbn boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare g boolean := coalesce(chiavi_dichiara.gb, false);
begin
  if auth.uid() is null then raise exception 'non autenticato'; end if;
  insert into public.chiavi_ho as h (utente, gb, sbn) values (auth.uid(), g, false)
    on conflict (utente) do update set gb = excluded.gb, sbn = false, aggiornato = now()
    where (h.gb, h.sbn) is distinct from (excluded.gb, false);
end $$;

create or replace function public.amici_chiavi() returns table (id uuid, gb boolean, sbn boolean, chiesta timestamptz)
language sql stable security definer set search_path = '' as $$
  select x.id,
         coalesce(h.gb, false) or exists (select 1 from public.chiavi c where c.da = x.id and c.gb_key <> ''),
         false,
         r.creata
    from (select case when f.da = auth.uid() then f.a else f.da end as id
            from public.amicizie f where f.stato = 'amici' and auth.uid() in (f.da, f.a)) x
    left join public.chiavi_ho h on h.utente = x.id
    left join public.chiavi_richieste r on r.da = auth.uid() and r.a = x.id;
$$;

create or replace function public.chiedi_chiavi(a uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'non autenticato'; end if;
  if chiedi_chiavi.a is null or not public.sono_amici(me, chiedi_chiavi.a) then raise exception 'non amici'; end if;
  if exists (select 1 from public.chiavi c where c.da = chiedi_chiavi.a and c.a = me and c.gb_key <> '') then return 'gia'; end if;
  if not exists (select 1 from public.chiavi_ho h where h.utente = chiedi_chiavi.a and h.gb)
     and not exists (select 1 from public.chiavi c where c.da = chiedi_chiavi.a and c.gb_key <> '') then return 'no'; end if;
  if exists (select 1 from public.chiavi_richieste r where r.da = me and r.a = chiedi_chiavi.a and r.creata > now() - interval '7 days') then return 'presto'; end if;
  if (select count(*) from public.chiavi_richieste r where r.da = me and r.creata > now() - interval '1 day') >= 10 then return 'troppe'; end if;
  delete from public.chiavi_richieste r where r.creata < now() - interval '60 days';
  insert into public.chiavi_richieste as r (da, a) values (me, chiedi_chiavi.a)
    on conflict on constraint chiavi_richieste_pkey do update set creata = now();
  delete from public.notifiche n where n.utente = chiedi_chiavi.a and n.da = me and n.tipo = 'chiedi_chiavi';
  perform public.notifica_nuova(chiedi_chiavi.a, me, 'chiedi_chiavi', '', '');
  return 'ok';
end $$;

-- Prima di questa migrazione, a mano (i valori non stanno nei file):
--   vault.create_secret(<indirizzo del worker di Piero, preso da chiavi.sbn>, 'sbn_worker', …)
--   vault.create_secret(<chiave privata P-256 in PKCS8 base64, una per copia>, 'sbn_firma', …)
-- La chiave pubblica corrispondente sta nel codice del worker (cloudflare-sbn-worker.js, CHIAVI).
