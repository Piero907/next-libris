-- Next Libris: chi regala sceglie se gli altri amici vedono il suo nome (17/11/2026, richiesta di Piero).
-- profili.regali: «Gli amici vedono i regali che prenoto», ACCESA di partenza (scelta di Piero), in Impostazioni › Amici e privacy
-- insieme a libreria, desideri e amici. Vale per tutte le prenotazioni di chi regala (anche quelle già fatte).
-- desideri_di: 'prenotato' = 'io' (la tua), il nome di chi regala solo se lui la tiene accesa, altrimenti ''; 'preso' = c'è una prenotazione
-- (l'app mostra «Regalo prenotato»). Il festeggiato, come prima, non vede niente (non può chiamare desideri_di su sé stesso:
-- non è amico di sé). Applicato al progetto della prova.
alter table public.profili add column regali boolean not null default true;

create or replace function public.desideri_di(amico uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); vis boolean;
begin
  if me is null then raise exception 'non autenticato'; end if;
  if not public.sono_amici(me, desideri_di.amico) then raise exception 'non amici'; end if;
  select p.desideri into vis from public.profili p where p.id = desideri_di.amico;
  if not coalesce(vis, false) then return jsonb_build_object('visibili', false, 'libri', '[]'::jsonb); end if;
  return jsonb_build_object('visibili', true, 'libri', coalesce((
    select jsonb_agg(jsonb_build_object('id', l.id, 't', l.dati->>'t', 'a', l.dati->>'a', 'e', l.dati->>'e', 'y', l.dati->>'y', 'i', l.dati->>'i',
             'img', l.dati->>'img', 'pg', l.dati->>'pg', 'gen', l.dati->>'gen', 'se', l.dati->>'se', 'sn', l.dati->>'sn', 'ts', l.dati->'ts',
             'prenotato', case when pr.da is null then '' when pr.da = me then 'io'
                               else coalesce((select q.utente from public.profili q where q.id = pr.da and q.regali), '') end,
             'preso', pr.da is not null)
           order by l.aggiornato desc)
    from (select * from public.libri l0 where l0.utente = desideri_di.amico and not l0.cancellato and l0.dati->>'w' = 'true' order by l0.aggiornato desc limit 300) l
    left join public.prenotazioni pr on pr.proprietario = desideri_di.amico and pr.libro = l.id), '[]'::jsonb));
end $$;
