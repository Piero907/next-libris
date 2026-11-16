-- Next Libris: la libreria visibile agli amici, su scelta (16/11/2026, richiesta di Piero: «senza citazioni o appunti»).
-- profili.libreria (spento di partenza). libreria_di(amico): solo agli amici, solo se acceso; passa SOLO id, titolo, autore, ISBN,
-- copertina, lettura (rs) e voto (rt). Mai note, citazioni, appunti, prezzi, scaffali, prestiti. Esclusi desideri, libri non più
-- in libreria (xs) e libri ricevuti in prestito (sk p/q). Al massimo 1000, dai più recenti. Applicato al progetto della prova.
alter table public.profili add column libreria boolean not null default false;
create function public.libreria_di(amico uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); vis boolean; tot int;
begin
  if me is null then raise exception 'non autenticato'; end if;
  if not public.sono_amici(me, libreria_di.amico) then raise exception 'non amici'; end if;
  select p.libreria into vis from public.profili p where p.id = libreria_di.amico;
  if not coalesce(vis, false) then return jsonb_build_object('visibili', false, 'totale', 0, 'libri', '[]'::jsonb); end if;
  select count(*) into tot from public.libri l where l.utente = libreria_di.amico and not l.cancellato
    and coalesce(l.dati->>'w', 'false') <> 'true' and coalesce(l.dati->>'xs', '') = '' and coalesce(l.dati->>'sk', '') not in ('p', 'q');
  return jsonb_build_object('visibili', true, 'totale', tot, 'libri', coalesce((
    select jsonb_agg(jsonb_build_object('id', l.id, 't', l.dati->>'t', 'a', l.dati->>'a', 'i', l.dati->>'i', 'img', l.dati->>'img',
             'rs', l.dati->>'rs', 'rt', l.dati->'rt') order by l.quando desc)
    from (select l0.id, l0.dati, case when l0.dati->>'ts' ~ '^[0-9]{1,15}(\.[0-9]+)?$' then (l0.dati->>'ts')::numeric else 0 end as quando
          from public.libri l0
          where l0.utente = libreria_di.amico and not l0.cancellato
            and coalesce(l0.dati->>'w', 'false') <> 'true' and coalesce(l0.dati->>'xs', '') = '' and coalesce(l0.dati->>'sk', '') not in ('p', 'q')
          order by quando desc limit 1000) l), '[]'::jsonb));
end $$;
revoke all on function public.libreria_di(uuid) from public, anon;
grant execute on function public.libreria_di(uuid) to authenticated;
-- Prova (16/11/2026, tutto bene): anon negato; spenta → visibili false; accesa → 2 libri su 5 (no desiderio, venduto, prestito
-- ricevuto), dal più recente; campi solo a,i,id,img,rs,rt,t; nessuna traccia di nota, citazione, prestito, scaffale; non amico negato.
