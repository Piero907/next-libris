-- Next Libris: giro 6 (18/11/2026, scelte di Piero). Prima nella prova; nella vera con la versione, quando lo dice Piero.
-- 1. Profilo dell'amico: «In lettura», «Preferiti» e «Consigliati» (segno nuovo «Lo consiglio»: dati->>'lc'), ognuno con il
--    suo interruttore (accesi di partenza, ma si vedono solo se l'amico mostra anche la libreria, come i numeri).
-- 2. Citazioni in evidenza: fino a 3, scelte con la puntina (qs[].pin dentro il libro), al posto della citazione preferita;
--    stesso interruttore p_cit (spento di partenza). Chi aveva già una preferita la tiene finché non mette una puntina.
-- 3. Prestiti tra voi due (da te a lui, da lui a te): li vede solo chi guarda, sono dati suoi.
-- 4. Avviso «un tuo desiderio è nella libreria di un amico»: si annota quando il libro entra nella libreria di un amico che
--    la mostra, e arriva nel riassunto del giorno (pg_cron delle 17 UTC), campanella e push (gruppo «consigli»).
-- 5. chi_ha(titolo, autore, isbn): «Ce l'ha già Marta» quando si aggiunge un desiderio.
-- Stesso libro = stesso ISBN, oppure stesso titolo e stesso autore (maiuscole, accenti, punteggiatura e ordine nome/cognome non contano).

-- ---------- aiuti interni ----------
create function public.libro_chiave(t text, a text) returns text
language sql immutable set search_path = '' as $$
  select case when x.tk = '' then '' else x.tk || '|' || coalesce((
      select string_agg(w, ' ' order by w)
      from (select distinct w from regexp_split_to_table(x.ak, ' +') w where char_length(w) > 1) s), '') end
  from (select
      regexp_replace(translate(lower(coalesce(t, '')), 'àáâãäåèéêëìíîïòóôõöùúûüçñ', 'aaaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', '', 'g') as tk,
      btrim(regexp_replace(translate(lower(coalesce(a, '')), 'àáâãäåèéêëìíîïòóôõöùúûüçñ', 'aaaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', ' ', 'g')) as ak) x;
$$;
revoke all on function public.libro_chiave(text, text) from public, anon, authenticated;

-- un libro che sta davvero in libreria: non desiderio, non uscito, non preso in prestito
create function public.libro_in_libreria(cancellato boolean, dati jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select not coalesce(cancellato, false) and coalesce(dati->>'w', 'false') <> 'true' and coalesce(dati->>'xs', '') = '' and coalesce(dati->>'sk', '') not in ('p', 'q');
$$;
revoke all on function public.libro_in_libreria(boolean, jsonb) from public, anon, authenticated;

-- ---------- 1: interruttori nuovi del profilo ----------
alter table public.profili
  add column p_let boolean not null default true,
  add column p_pref boolean not null default true,
  add column p_cons boolean not null default true;

-- le file di copertine del profilo: in lettura, preferiti, consigliati (al massimo 30, le più recenti)
create function public.profilo_libri(amico uuid, quale text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', q.id, 't', q.dati->>'t', 'a', q.dati->>'a', 'img', q.dati->>'img', 'i', q.dati->>'i')) order by q.quando desc, q.id), '[]'::jsonb)
  from (select l.id, l.dati, case when l.dati->>'ts' ~ '^[0-9]{1,15}(\.[0-9]+)?$' then (l.dati->>'ts')::numeric else 0 end as quando
        from public.libri l
        where l.utente = profilo_libri.amico and public.libro_in_libreria(l.cancellato, l.dati)
          and case profilo_libri.quale when 'let' then l.dati->>'rs' = 'in' when 'pref' then l.dati->>'fav' = 'true' when 'cons' then l.dati->>'lc' = 'true' else false end
        order by quando desc, l.id limit 30) q;
$$;
revoke all on function public.profilo_libri(uuid, text) from public, anon, authenticated;

create or replace function public.profilo_di(amico uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); p public.profili; r jsonb; ev jsonb;
begin
  if me is null then raise exception 'non autenticato'; end if;
  if not public.sono_amici(me, profilo_di.amico) then raise exception 'non amici'; end if;
  select * into p from public.profili x where x.id = profilo_di.amico;
  r := jsonb_build_object('utente', coalesce(p.utente, p.nome, ''), 'creato', p.creato, 'foto', coalesce(p.foto, ''),
    'desideri', coalesce(p.desideri, false), 'libreria', coalesce(p.libreria, false),
    'segue', exists (select 1 from public.seguiti s where s.chi = me and s.amico = profilo_di.amico),
    'tra', jsonb_build_object(
      'dati', (select count(*) from public.scambi s where s.tipo = 'prestito' and s.da = me and s.a = profilo_di.amico),
      'avuti', (select count(*) from public.scambi s where s.tipo = 'prestito' and s.da = profilo_di.amico and s.a = me)));
  if p.libreria then
    if p.p_let then r := r || jsonb_build_object('let', public.profilo_libri(profilo_di.amico, 'let')); end if;
    if p.p_pref then r := r || jsonb_build_object('pref', public.profilo_libri(profilo_di.amico, 'pref')); end if;
    if p.p_cons then r := r || jsonb_build_object('cons', public.profilo_libri(profilo_di.amico, 'cons')); end if;
  end if;
  if p.p_cit then                                           -- citazioni in evidenza (puntina), al massimo 3; senza puntine vale la vecchia preferita
    select jsonb_agg(jsonb_build_object('x', q.x, 'pg', q.pg, 'd', q.d, 't', q.t, 'a', q.a) order by q.d desc) into ev
    from (select left(c->>'x', 600) as x, c->>'pg' as pg, case when c->>'d' ~ '^[0-9]{1,15}$' then (c->>'d')::numeric else 0 end as d, left(l.dati->>'t', 120) as t, left(l.dati->>'a', 120) as a
          from public.libri l cross join lateral jsonb_array_elements(case when jsonb_typeof(l.dati->'qs') = 'array' then l.dati->'qs' else '[]'::jsonb end) c
          where l.utente = profilo_di.amico and not l.cancellato and coalesce(c->>'x', '') <> '' and c->>'pin' in ('1', 'true')
          order by d desc limit 3) q;
    if ev is null and p.cit is not null and coalesce(p.cit->>'x', '') <> '' then ev := jsonb_build_array(p.cit); end if;
    if ev is not null then r := r || jsonb_build_object('evid', ev); end if;
  end if;
  if p.p_stat and p.libreria and p.stat is not null then r := r || jsonb_build_object('stat', p.stat); end if;
  if p.p_cits then
    r := r || jsonb_build_object('cits', coalesce((
      select jsonb_agg(jsonb_build_object('x', q.x, 'pg', q.pg, 'd', q.d, 't', q.t, 'a', q.a) order by q.d desc)
      from (select c->>'x' as x, c->>'pg' as pg, case when c->>'d' ~ '^[0-9]{1,15}$' then (c->>'d')::numeric else 0 end as d, l.dati->>'t' as t, l.dati->>'a' as a
            from public.libri l cross join lateral jsonb_array_elements(case when jsonb_typeof(l.dati->'qs') = 'array' then l.dati->'qs' else '[]'::jsonb end) c
            where l.utente = profilo_di.amico and not l.cancellato and coalesce(c->>'x', '') <> ''
            order by d desc limit 300) q), '[]'::jsonb));
  end if;
  return r;
end $$;

-- ---------- 4: un tuo desiderio è nella libreria di un amico ----------
create table public.desideri_trovati (                                  -- in attesa del riassunto del giorno
  chi uuid not null references auth.users (id) on delete cascade,       -- chi ha il desiderio (riceve l'avviso)
  amico uuid not null references auth.users (id) on delete cascade,     -- chi ha messo il libro in libreria
  libro text not null,                                                  -- id del libro dell'amico
  quando timestamptz not null default now(),
  primary key (chi, amico, libro),
  check (chi <> amico)
);
create index desideri_trovati_amico on public.desideri_trovati (amico);
alter table public.desideri_trovati enable row level security;
revoke all on table public.desideri_trovati from anon, authenticated;   -- solo con le funzioni

-- si annota solo quando il libro ENTRA in libreria (riga nuova, o prima era un desiderio, cancellato, uscito o in prestito)
-- e solo se chi lo aggiunge mostra la libreria agli amici
create function public.trovati_annota() returns trigger
language plpgsql security definer set search_path = '' as $$
declare k text; i text;
begin
  if not public.libro_in_libreria(new.cancellato, new.dati) then return null; end if;
  if tg_op = 'UPDATE' and public.libro_in_libreria(old.cancellato, old.dati) then return null; end if;
  if not coalesce((select p.libreria from public.profili p where p.id = new.utente), false) then return null; end if;
  i := coalesce(new.dati->>'i', ''); k := public.libro_chiave(new.dati->>'t', new.dati->>'a');
  if i = '' and k = '' then return null; end if;
  insert into public.desideri_trovati (chi, amico, libro)
    select distinct w.utente, new.utente, new.id
    from public.amicizie f
    join public.libri w on w.utente = case when f.da = new.utente then f.a else f.da end
    where f.stato = 'amici' and new.utente in (f.da, f.a)
      and not w.cancellato and w.dati->>'w' = 'true'
      and ((i <> '' and w.dati->>'i' = i) or (k <> '' and public.libro_chiave(w.dati->>'t', w.dati->>'a') = k))
  on conflict do nothing;
  return null;
end $$;
revoke all on function public.trovati_annota() from public, anon, authenticated;
create trigger trovati_annota after insert or update on public.libri for each row execute function public.trovati_annota();

-- tolta o rifiutata un'amicizia: via anche gli avvisi in attesa tra i due
create or replace function public.amicizie_pulizia() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.seguiti s where (s.chi = old.da and s.amico = old.a) or (s.chi = old.a and s.amico = old.da);
  delete from public.desideri_trovati d where (d.chi = old.da and d.amico = old.a) or (d.chi = old.a and d.amico = old.da);
  return null;
end $$;

alter table public.notifiche drop constraint notifiche_tipo_check;
alter table public.notifiche add constraint notifiche_tipo_check check (tipo = any (array['amicizia', 'amico', 'prestito', 'regalo', 'reso', 'reso_ok', 'reso_no',
  'chiuso', 'richiesta', 'richiesta_si', 'richiesta_no', 'consiglio', 'chiavi', 'limite', 'desideri', 'trovato']));

create or replace function public.push_gruppo(tipo text) returns text
language sql immutable set search_path = '' as $$
  select case
    when tipo in ('amicizia', 'amico') then 'amicizie'
    when tipo in ('prestito', 'regalo', 'reso', 'reso_ok', 'reso_no', 'chiuso', 'richiesta', 'richiesta_si', 'richiesta_no') then 'prestiti'
    when tipo in ('consiglio', 'desideri', 'trovato') then 'consigli'
    when tipo = 'chiavi' then 'chiavi'
  end;
$$;

-- il riassunto del giorno: i desideri nuovi di chi segui (come prima) e, in più, i tuoi desideri entrati nella libreria di un
-- amico: una notifica «trovato» per amico (rif = quanti:id del primo libro dell'amico, titolo = i primi tre titoli), poi si svuota
create or replace function public.desideri_riassunto() returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in
    select x.utente, count(*) as n, string_agg('«' || left(x.t, 70) || '»', ', ' order by x.rn) filter (where x.rn <= 3) as titoli
    from (select d.utente, coalesce(nullif(btrim(l.dati->>'t'), ''), 'un libro') as t, row_number() over (partition by d.utente order by d.quando, d.libro) as rn
          from public.desideri_nuovi d
          join public.libri l on l.utente = d.utente and l.id = d.libro and not l.cancellato and l.dati->>'w' = 'true'
          join public.profili p on p.id = d.utente and p.desideri) x
    group by x.utente
  loop
    perform public.notifica_nuova(s.chi, r.utente, 'desideri', r.n::text, r.titoli)
      from public.seguiti s where s.amico = r.utente and public.sono_amici(s.chi, r.utente);
  end loop;
  delete from public.desideri_nuovi d where d.quando <= now();

  for r in
    select x.chi, x.amico, count(*) as n, string_agg('«' || left(x.t, 70) || '»', ', ' order by x.rn) filter (where x.rn <= 3) as titoli,
           (array_agg(x.libro order by x.rn))[1] as primo
    from (select d.chi, d.amico, d.libro, coalesce(nullif(btrim(l.dati->>'t'), ''), 'un libro') as t,
                 row_number() over (partition by d.chi, d.amico order by d.quando, d.libro) as rn
          from public.desideri_trovati d
          join public.libri l on l.utente = d.amico and l.id = d.libro and public.libro_in_libreria(l.cancellato, l.dati)
          join public.profili p on p.id = d.amico and p.libreria
          where public.sono_amici(d.chi, d.amico)
            and exists (select 1 from public.libri w                     -- il desiderio c'è ancora
                        where w.utente = d.chi and not w.cancellato and w.dati->>'w' = 'true'
                          and ((coalesce(l.dati->>'i', '') <> '' and w.dati->>'i' = l.dati->>'i')
                            or (public.libro_chiave(l.dati->>'t', l.dati->>'a') <> '' and public.libro_chiave(w.dati->>'t', w.dati->>'a') = public.libro_chiave(l.dati->>'t', l.dati->>'a'))))) x
    group by x.chi, x.amico
  loop
    perform public.notifica_nuova(r.chi, r.amico, 'trovato', r.n::text || ':' || left(r.primo, 60), r.titoli);
  end loop;
  delete from public.desideri_trovati d where d.quando <= now();
end $$;

-- ---------- 5: quali amici (con la libreria visibile) hanno già questo libro ----------
create function public.chi_ha(titolo text, autore text, isbn text) returns table (amico uuid, utente text, libro_id text, fuori boolean)
language sql stable security definer set search_path = '' as $$
  select l.utente, p.utente, l.id, coalesce(l.dati->>'p', '') <> ''
  from public.amicizie f
  join public.profili p on p.id = case when f.da = auth.uid() then f.a else f.da end and p.libreria
  join public.libri l on l.utente = p.id
  cross join (select coalesce(nullif(regexp_replace(upper(coalesce(chi_ha.isbn, '')), '[^0-9X]', '', 'g'), ''), '-') as i, public.libro_chiave(left(chi_ha.titolo, 300), left(chi_ha.autore, 300)) as k) c
  where auth.uid() is not null and f.stato = 'amici' and auth.uid() in (f.da, f.a)
    and public.libro_in_libreria(l.cancellato, l.dati)
    and (l.dati->>'i' = c.i or (c.k <> '' and public.libro_chiave(l.dati->>'t', l.dati->>'a') = c.k))
  order by p.utente, l.id
  limit 20;
$$;
revoke all on function public.chi_ha(text, text, text) from public, anon;
grant execute on function public.chi_ha(text, text, text) to authenticated;
