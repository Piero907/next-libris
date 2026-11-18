-- 027 · Giro 11A (18/11/2026, scelta di Piero): limite di 3.000 ricerche al giorno per amico con il worker SBN prestato.
-- worker_conta(utente, da) (solo service_role, la chiama la funzione «libri» versione 3): controlla prestito e amicizia come
-- worker_prestato(), conta la ricerca (righe «w:» = per coppia chi presta/amico) e restituisce {w} oppure {e:'mio'|'no'}.
-- Giorno = UTC, come quello di Cloudflare e del contatore dell'app. worker_prestato() resta per la funzione versione 2.
alter table public.ricerche drop constraint ricerche_chiave_check;
alter table public.ricerche add constraint ricerche_chiave_check check (chiave ~ '^[gsapw]:[0-9a-f]{64}$');

create function public.worker_conta(utente uuid, da uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  w text; kw text; mio integer;
  g date := (now() at time zone 'UTC')::date;
  per_amico constant integer := 3000;     -- scelta di Piero (18/11/2026)
begin
  if worker_conta.utente is null or worker_conta.da is null then return jsonb_build_object('e', 'no'); end if;
  select c.sbn into w from public.chiavi c
    where c.da = worker_conta.da and c.a = worker_conta.utente and c.sbn <> '';
  if w is null or not public.sono_amici(worker_conta.da, worker_conta.utente) then return jsonb_build_object('e', 'no'); end if;
  kw := 'w:' || encode(sha256(convert_to(worker_conta.da::text || ':' || worker_conta.utente::text, 'UTF8')), 'hex');
  select r.n into mio from public.ricerche r where r.chiave = kw and r.giorno = g;
  if coalesce(mio, 0) >= per_amico then return jsonb_build_object('e', 'mio', 'mio', mio); end if;
  insert into public.ricerche as r (chiave, giorno, n) values (kw, g, 1)
    on conflict (chiave, giorno) do update set n = r.n + 1 returning r.n into mio;
  return jsonb_build_object('w', w, 'mio', mio);
end $$;
revoke all on function public.worker_conta(uuid, uuid) from public, anon, authenticated;
grant execute on function public.worker_conta(uuid, uuid) to service_role;
