-- 033 (21/11/2026): suggerimenti dagli amici per la pagina Suggerimenti (prima fase).
-- Una sola chiamata, solo lettura. Per ogni amico che ti mostra la libreria:
--   comuni = libri in comune con te (ISBN distinti, stesso conto di amici_numeri e del profilo),
--   libri  = i suoi libri con 4-5 libricini, o con «Lo consiglio» se lo mostra (p_cons), che tu non hai
--            (né in libreria né nei Desideri: stesso ISBN o stesso titolo e autore, come chi_ha).
-- Mai appunti, citazioni, prezzi o note. Al massimo 30 libri per amico e 300 in tutto.
create or replace function public.suggerimenti_amici()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare me uuid := auth.uid(); r jsonb;
begin
  if me is null then raise exception 'non autenticato'; end if;
  with amici as (
    select p.id, coalesce(p.utente, p.nome, '') as utente, coalesce(p.p_cons, false) as cons
    from public.amicizie f
    join public.profili p on p.id = case when f.da = me then f.a else f.da end
    where f.stato = 'amici' and me in (f.da, f.a) and coalesce(p.libreria, false)
  ), miei as (
    select l.dati->>'i' as i, public.libro_chiave(l.dati->>'t', l.dati->>'a') as k,
           coalesce(l.dati->>'w', 'false') <> 'true' and coalesce(l.dati->>'xs', '') = '' as lib
    from public.libri l where l.utente = me and not l.cancellato
  ), mi as (select distinct i from miei where lib and coalesce(i, '') <> ''),
  loro as (
    select a.id as amico, l.id, l.dati, a.cons,
           case when l.dati->>'rt' ~ '^[0-9]+(\.[0-9]+)?$' then (l.dati->>'rt')::numeric else 0 end as rt,
           case when l.dati->>'ts' ~ '^[0-9]{1,15}(\.[0-9]+)?$' then (l.dati->>'ts')::numeric else 0 end as quando
    from amici a join public.libri l on l.utente = a.id
    where public.libro_in_libreria(l.cancellato, l.dati)
  ), scelti as (
    select x.*, row_number() over (partition by x.amico order by x.rt desc, x.quando desc, x.id) as n
    from loro x
    where (x.rt >= 4 or (x.cons and x.dati->>'lc' = 'true'))
      and coalesce(x.dati->>'t', '') <> ''
      and not exists (select 1 from miei m where (coalesce(x.dati->>'i', '') <> '' and m.i = x.dati->>'i')
                        or (m.k <> '' and m.k = public.libro_chiave(x.dati->>'t', x.dati->>'a')))
  )
  select jsonb_build_object(
    'amici', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'utente', a.utente,
        'comuni', (select count(distinct l.dati->>'i') from public.libri l where l.utente = a.id and not l.cancellato   -- come amici_numeri
            and coalesce(l.dati->>'w', 'false') <> 'true' and coalesce(l.dati->>'xs', '') = '' and l.dati->>'i' in (select i from mi))))
      from amici a), '[]'::jsonb),
    'libri', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('amico', s.amico, 'id', s.id,
        't', left(s.dati->>'t', 300), 'a', left(s.dati->>'a', 300), 'i', s.dati->>'i', 'img', left(s.dati->>'img', 600),
        'e', left(s.dati->>'e', 200), 'y', left(s.dati->>'y', 20), 'gen', left(s.dati->>'gen', 120), 'pg', s.dati->>'pg',
        'se', left(s.dati->>'se', 200), 'sn', left(s.dati->>'sn', 20),
        'rt', case when s.rt > 0 then s.rt end, 'lc', case when s.cons and s.dati->>'lc' = 'true' then true end,
        'fuori', coalesce(s.dati->>'p', '') <> '')) order by s.rt desc, s.quando desc)
      from (select * from scelti where n <= 30 order by rt desc, quando desc limit 300) s), '[]'::jsonb))
  into r;
  return r;
end $$;
revoke all on function public.suggerimenti_amici() from public, anon;
grant execute on function public.suggerimenti_amici() to authenticated;
