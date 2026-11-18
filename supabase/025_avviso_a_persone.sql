-- giro 10 (Piero, 18/11/2026): l'amministratore manda un avviso a tutti o a persone scelte (al massimo 50).
-- Applicata alla prova il 18/11/2026. Prova a mano: un utente normale è respinto da admin_cerca, admin_avviso e avviso_importante.
create or replace function public.avviso_importante(titolo text, testo text, persone uuid[] default null)
returns integer language plpgsql security definer set search_path to '' as $function$
#variable_conflict use_column
declare n integer; t text := btrim(coalesce(avviso_importante.titolo, '')); x text := btrim(coalesce(avviso_importante.testo, ''));
begin
  if t = '' or char_length(t) > 80 then raise exception 'titolo: da 1 a 80 caratteri'; end if;
  if x = '' or char_length(x) > 300 then raise exception 'testo: da 1 a 300 caratteri'; end if;
  if avviso_importante.persone is not null and (cardinality(avviso_importante.persone) = 0 or cardinality(avviso_importante.persone) > 50) then
    raise exception 'persone: da 1 a 50'; end if;
  insert into public.notifiche (utente, da, tipo, rif, titolo)
    select p.id, null, 'avviso', t, x from public.profili p
    where avviso_importante.persone is null or p.id = any(avviso_importante.persone);
  get diagnostics n = row_count;
  return n;
end $function$;
drop function if exists public.avviso_importante(text, text);
revoke all on function public.avviso_importante(text, text, uuid[]) from public, anon, authenticated;

drop function if exists public.admin_avviso(text, text);
create function public.admin_avviso(titolo text, testo text, persone uuid[] default null)
returns integer language plpgsql security definer set search_path to '' as $function$
begin
  perform public.admin_controllo();
  return public.avviso_importante(admin_avviso.titolo, admin_avviso.testo, admin_avviso.persone);
end $function$;
revoke all on function public.admin_avviso(text, text, uuid[]) from public, anon;
grant execute on function public.admin_avviso(text, text, uuid[]) to authenticated;

create or replace function public.admin_cerca(q text)
returns table (id uuid, utente text) language plpgsql stable security definer set search_path to '' as $function$
declare s text := btrim(coalesce(admin_cerca.q, ''));
begin
  perform public.admin_controllo();
  if char_length(s) < 2 or char_length(s) > 40 then return; end if;
  return query select p.id, p.utente from public.profili p
    where p.utente ilike '%' || replace(replace(replace(s, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    order by p.utente limit 20;
end $function$;
revoke all on function public.admin_cerca(text) from public, anon;
grant execute on function public.admin_cerca(text) to authenticated;
