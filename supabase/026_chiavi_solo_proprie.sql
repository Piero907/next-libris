-- 026 (18/11/2026 sera, Piero): chiave e worker prestati restano sul server, e nessuno presta quelli ricevuti da un altro.
-- Prima del giro 8 chi riceveva la chiave (e sempre il worker) la aveva sul telefono e l'app la credeva sua: Serena B. ha prestato
-- a Next Libris la chiave e il worker di Piero R. Da qui:
--  1) presta_chiavi e chiavi_aggiorna rifiutano chiavi e worker prestati da un altro ('non tua'), e valori non validi;
--  2) chiavi_mie a chi riceve il worker dà un indirizzo finto (https://worker-prestato.invalid/<id>): l'app manda la ricerca alla
--     funzione «libri», che chiede l'indirizzo vero a worker_prestato() (solo service_role);
--  3) chiavi_controlla(valori): l'app chiede se le chiavi e i worker che ha sul telefono sono di qualcun altro, per toglierli.

create or replace function public.chiave_altrui(v text) returns boolean
language sql stable security definer set search_path = '' as $$
  select v is not null and v <> '' and exists (select 1 from public.chiavi c where c.da <> auth.uid() and (c.gb_key = v or c.sbn = v));
$$;
revoke all on function public.chiave_altrui(text) from public, anon, authenticated;

create or replace function public.presta_chiavi(a uuid, gb_key text, sbn text)
returns void language plpgsql security definer set search_path = '' as $$
declare g text := coalesce(presta_chiavi.gb_key, ''); s text := coalesce(presta_chiavi.sbn, '');
begin
  if auth.uid() is null then raise exception 'non autenticato'; end if;
  if not public.sono_amici(auth.uid(), presta_chiavi.a) then raise exception 'non amici'; end if;
  if g <> '' and g !~ '^[A-Za-z0-9_-]{20,100}$' then raise exception 'chiave non valida'; end if;
  if s <> '' and (s !~ '^https://[^[:space:]]+$' or length(s) > 300 or s ~* 'worker-prestato\.invalid') then raise exception 'worker non valido'; end if;
  if g = '' and s = '' then raise exception 'niente da prestare'; end if;
  if public.chiave_altrui(g) or public.chiave_altrui(s) then raise exception 'non tua'; end if;
  insert into public.chiavi (da, a, gb_key, sbn) values (auth.uid(), presta_chiavi.a, g, s)
    on conflict on constraint chiavi_pkey do update set gb_key = excluded.gb_key, sbn = excluded.sbn, creato = now();
end $$;
revoke all on function public.presta_chiavi(uuid, text, text) from public, anon;
grant execute on function public.presta_chiavi(uuid, text, text) to authenticated;

create or replace function public.chiavi_aggiorna(gb_key text) returns integer
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare n integer;
begin
  if auth.uid() is null then raise exception 'non autenticato'; end if;
  if chiavi_aggiorna.gb_key is null or chiavi_aggiorna.gb_key !~ '^[A-Za-z0-9_-]{20,100}$' then raise exception 'chiave non valida'; end if;
  if public.chiave_altrui(chiavi_aggiorna.gb_key) then raise exception 'non tua'; end if;
  update public.chiavi c set gb_key = chiavi_aggiorna.gb_key
    where c.da = auth.uid() and c.gb_key <> '' and c.gb_key <> chiavi_aggiorna.gb_key;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.chiavi_aggiorna(text) from public, anon;
grant execute on function public.chiavi_aggiorna(text) to authenticated;

create or replace function public.chiavi_mie()
 returns table(da uuid, a uuid, nome text, gb_key text, sbn text, creato timestamp with time zone)
 language sql stable security definer set search_path to ''
as $function$
  select c.da, c.a, p.utente,
         case when c.gb_key <> '' then 'si' else '' end,
         case when c.sbn <> '' then 'si' else '' end,
         c.creato
    from public.chiavi c join public.profili p on p.id = c.a where c.da = auth.uid()
  union all
  select c.da, c.a, p.utente,
         case when c.gb_key <> '' then 'prestata:' || c.da::text else '' end,     -- mai la chiave vera (020)
         case when c.sbn <> '' then 'https://worker-prestato.invalid/' || c.da::text else '' end,   -- mai l'indirizzo vero del worker (026)
         c.creato
    from public.chiavi c join public.profili p on p.id = c.da
    where c.a = auth.uid() and public.sono_amici(c.da, c.a);
$function$;
revoke all on function public.chiavi_mie() from public, anon;
grant execute on function public.chiavi_mie() to authenticated;

create or replace function public.worker_prestato(utente uuid, da uuid) returns text
language sql stable security definer set search_path = '' as $$
  select c.sbn from public.chiavi c
   where c.da = worker_prestato.da and c.a = worker_prestato.utente and c.sbn <> '' and public.sono_amici(c.da, c.a);
$$;
revoke all on function public.worker_prestato(uuid, uuid) from public, anon, authenticated;
grant execute on function public.worker_prestato(uuid, uuid) to service_role;

-- quali dei valori che ho sul telefono sono di un altro: da = chi me li presta (se me li presta), altrimenti null
create or replace function public.chiavi_controlla(valori text[]) returns table(v text, da uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'non autenticato'; end if;
  if valori is null or array_length(valori, 1) > 20 then raise exception 'troppi valori'; end if;
  return query
    select x.v, (select c2.da from public.chiavi c2 where c2.a = auth.uid() and c2.da <> auth.uid() and (c2.gb_key = x.v or c2.sbn = x.v) and public.sono_amici(c2.da, c2.a) limit 1)
      from (select distinct unnest(valori) as v) x
     where x.v <> '' and exists (select 1 from public.chiavi c where c.da <> auth.uid() and (c.gb_key = x.v or c.sbn = x.v))
       and not exists (select 1 from public.chiavi c where c.da = auth.uid() and (c.gb_key = x.v or c.sbn = x.v) and c.creato < (select min(c3.creato) from public.chiavi c3 where c3.da <> auth.uid() and (c3.gb_key = x.v or c3.sbn = x.v)));
end $$;
revoke all on function public.chiavi_controlla(text[]) from public, anon;
grant execute on function public.chiavi_controlla(text[]) to authenticated;
