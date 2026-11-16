-- Next Libris: gli amici dell'amico (17/11/2026, richiesta di Piero).
-- profili.amici: «Gli amici vedono i miei amici», ACCESA di partenza (scelta di Piero), insieme a libreria e desideri.
-- amici_di(amico): solo a chi è suo amico. Se lui la tiene accesa: tutti i suoi amici, quelli in comune in cima;
-- se spenta: solo quelli in comune (sono già amici tuoi). Passa SOLO id, nome (utente), «comune» e la relazione con te
-- ('amici', 'inviata', 'ricevuta' o ''), mai email, libri o altro. Al massimo 500. Applicato al progetto della prova.
alter table public.profili add column amici boolean not null default true;

create function public.amici_di(amico uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
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
        and (coalesce(vis, false) or public.sono_amici(me, o.oid))
      order by public.sono_amici(me, o.oid) desc, lower(p.utente)
      limit 500
    ) x;
  return jsonb_build_object('visibili', coalesce(vis, false), 'amici', res);
end $$;
revoke all on function public.amici_di(uuid) from public, anon;
grant execute on function public.amici_di(uuid) to authenticated;
