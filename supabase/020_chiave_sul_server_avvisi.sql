-- Next Libris · 020: chiave Google prestata che resta sul server (R1) e avvisi importanti. 18/11/2026 (giro 8), prima nella prova.
-- Scelte di Piero: la chiave prestata non arriva più al telefono dell'amico; 300 ricerche al giorno per amico; stop immediato;
-- «Manda con un link» tolto (si presta solo dentro l'app); avvisi importanti solo a chi ha l'account (campanella + push).
--
-- 1) chiavi_mie(): a chi la riceve non torna più la chiave ma il segno «prestata:<id di chi presta>». Il telefono lo mette al posto
--    della chiave e le ricerche passano dalla Edge Function «libri» (supabase/funzioni/libri), che chiede la chiave vera a
--    chiave_prestata() (solo service_role). Il worker SBN prestato resta com'era (limite al worker: in sospeso, R5).
-- 2) chiave_prestata(utente, da): controlla prestito e amicizia, conta la ricerca (righe «p:» = per coppia chi presta/amico,
--    righe «g:» = totale della chiave, lo stesso conto di conta_ricerche) e restituisce la chiave. Si ferma a 300 al giorno per
--    amico e a 950 sul totale della chiave (giorno di Google = ora del Pacifico). Togliendo il prestito si ferma subito.
-- 3) chiavi_aggiorna(gb_key): chi presta e cambia chiave (per esempio dopo «La mia chiave è finita in giro») la aggiorna per
--    tutti gli amici in un colpo; gli amici non devono fare niente e non ricevono un'altra notifica.
-- 4) avviso_importante(titolo, testo): solo postgres/service_role (lo manda Claude quando lo chiede Piero). Una notifica «avviso»
--    a ogni profilo (rif = titolo, fino a 80 caratteri; titolo = testo, fino a 300). Push sempre, qualunque tipo abbia scelto
--    l'utente (gruppo «avvisi»), ma nel rispetto delle ore di silenzio.

alter table public.ricerche drop constraint ricerche_chiave_check;
alter table public.ricerche add constraint ricerche_chiave_check check (chiave ~ '^[gsap]:[0-9a-f]{64}$');

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
         c.sbn, c.creato
    from public.chiavi c join public.profili p on p.id = c.da
    where c.a = auth.uid() and public.sono_amici(c.da, c.a);
$function$;
revoke all on function public.chiavi_mie() from public, anon;
grant execute on function public.chiavi_mie() to authenticated;

create function public.chiave_prestata(utente uuid, da uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  k text; kg text; kp text; tot integer; mio integer; nome text;
  g date := (now() at time zone 'America/Los_Angeles')::date;
  per_amico constant integer := 300;      -- scelta di Piero (18/11/2026)
  totale constant integer := 950;         -- come la soglia dell'app
begin
  if chiave_prestata.utente is null or chiave_prestata.da is null then return jsonb_build_object('e', 'no'); end if;
  select c.gb_key into k from public.chiavi c
    where c.da = chiave_prestata.da and c.a = chiave_prestata.utente and c.gb_key <> '';
  if k is null or not public.sono_amici(chiave_prestata.da, chiave_prestata.utente) then return jsonb_build_object('e', 'no'); end if;
  kg := 'g:' || encode(sha256(convert_to(k, 'UTF8')), 'hex');
  kp := 'p:' || encode(sha256(convert_to(chiave_prestata.da::text || ':' || chiave_prestata.utente::text, 'UTF8')), 'hex');
  select r.n into tot from public.ricerche r where r.chiave = kg and r.giorno = g;
  select r.n into mio from public.ricerche r where r.chiave = kp and r.giorno = g;
  tot := coalesce(tot, 0); mio := coalesce(mio, 0);
  if mio >= per_amico then return jsonb_build_object('e', 'mio', 'tot', tot, 'mio', mio); end if;
  if tot >= totale then return jsonb_build_object('e', 'pieno', 'tot', tot, 'mio', mio); end if;
  insert into public.ricerche as r (chiave, giorno, n) values (kp, g, 1)
    on conflict (chiave, giorno) do update set n = r.n + 1 returning r.n into mio;
  insert into public.ricerche as r (chiave, giorno, n) values (kg, g, 1)
    on conflict (chiave, giorno) do update set n = r.n + 1 returning r.n into tot;
  if tot >= totale and not exists (select 1 from public.notifiche x where x.utente = chiave_prestata.utente and x.tipo = 'limite' and x.rif = kg || ':' || g) then
    select p.utente into nome from public.profili p where p.id = chiave_prestata.da;
    perform public.notifica_nuova(chiave_prestata.utente, null, 'limite', kg || ':' || g, left(coalesce(nome, ''), 40));
  end if;
  return jsonb_build_object('k', k, 'tot', tot, 'mio', mio);
end $$;
revoke all on function public.chiave_prestata(uuid, uuid) from public, anon, authenticated;
grant execute on function public.chiave_prestata(uuid, uuid) to service_role;

create function public.chiavi_aggiorna(gb_key text) returns integer
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare n integer;
begin
  if auth.uid() is null then raise exception 'non autenticato'; end if;
  if chiavi_aggiorna.gb_key is null or chiavi_aggiorna.gb_key !~ '^[A-Za-z0-9_-]{20,100}$' then raise exception 'chiave non valida'; end if;
  update public.chiavi c set gb_key = chiavi_aggiorna.gb_key
    where c.da = auth.uid() and c.gb_key <> '' and c.gb_key <> chiavi_aggiorna.gb_key;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.chiavi_aggiorna(text) from public, anon;
grant execute on function public.chiavi_aggiorna(text) to authenticated;

-- notifica «chiavi» solo quando cambia COSA si presta (chiave sì/no, worker), non quando la chiave viene sostituita con una nuova
create or replace function public.notifica_trigger() returns trigger
language plpgsql security definer set search_path to '' as $function$
declare me uuid := auth.uid();
begin
  if tg_table_name = 'amicizie' then
    if tg_op = 'INSERT' and new.stato = 'attesa' then
      perform public.notifica_nuova(new.a, new.da, 'amicizia', '', '');
    elsif tg_op = 'UPDATE' and old.stato = 'attesa' and new.stato = 'amici' then
      update public.notifiche n set letta = true where n.utente = new.a and n.da = new.da and n.tipo = 'amicizia';
      perform public.notifica_nuova(new.da, new.a, 'amico', '', '');
    elsif tg_op = 'DELETE' then                                   -- rifiutata o tolta: via le notifiche tra i due
      delete from public.notifiche n where (n.utente = old.da and n.da = old.a) or (n.utente = old.a and n.da = old.da);
    end if;
  elsif tg_table_name = 'scambi' then
    if tg_op = 'INSERT' then
      perform public.notifica_nuova(new.a, new.da, new.tipo, new.id::text, new.libro->>'t');
    elsif tg_op = 'UPDATE' and old.stato is distinct from new.stato then
      if old.stato = 'aperto' and new.stato = 'reso' then
        perform public.notifica_nuova(new.da, new.a, 'reso', new.id::text, new.libro->>'t');
      elsif old.stato = 'reso' then
        update public.notifiche n set letta = true where n.utente = new.da and n.tipo = 'reso' and n.rif = new.id::text;
        perform public.notifica_nuova(new.a, new.da, case when new.stato = 'chiuso' then 'reso_ok' else 'reso_no' end, new.id::text, new.libro->>'t');
      elsif old.stato = 'aperto' and new.stato = 'chiuso' and new.tipo = 'prestito' and me is not null then   -- chi presta lo segna restituito
        perform public.notifica_nuova(case when me = new.da then new.a else new.da end, me, 'chiuso', new.id::text, new.libro->>'t');
      end if;
    end if;
  elsif tg_table_name = 'richieste' then
    if tg_op = 'INSERT' then
      perform public.notifica_nuova(new.a, new.da, 'richiesta', new.id::text, new.libro->>'t');
    elsif tg_op = 'UPDATE' and old.stato = 'attesa' and new.stato <> 'attesa' then
      update public.notifiche n set letta = true where n.utente = new.a and n.tipo = 'richiesta' and n.rif = new.id::text;
      perform public.notifica_nuova(new.da, new.a, case when new.stato = 'accettata' then 'richiesta_si' else 'richiesta_no' end, new.id::text, new.libro->>'t');
    elsif tg_op = 'DELETE' then                                   -- annullata (o libro tolto): la richiesta non c'è più
      delete from public.notifiche n where n.utente = old.a and n.tipo = 'richiesta' and n.rif = old.id::text;
    end if;
  elsif tg_table_name = 'consigli' then
    if tg_op = 'INSERT' then
      perform public.notifica_nuova(new.a, new.da, 'consiglio', new.id::text, new.libro->>'t');
    elsif tg_op = 'DELETE' then
      update public.notifiche n set letta = true where n.utente = old.a and n.tipo = 'consiglio' and n.rif = old.id::text;
    end if;
  elsif tg_table_name = 'chiavi' then
    if tg_op = 'INSERT' or (tg_op = 'UPDATE' and (old.gb_key <> '', old.sbn) is distinct from (new.gb_key <> '', new.sbn)) then
      delete from public.notifiche n where n.utente = new.a and n.da = new.da and n.tipo = 'chiavi' and not n.letta;
      perform public.notifica_nuova(new.a, new.da, 'chiavi', '', '');
    end if;
  end if;
  return null;
end $function$;

-- ---------- avvisi importanti ----------
alter table public.notifiche drop constraint notifiche_tipo_check;
alter table public.notifiche add constraint notifiche_tipo_check check (tipo = any (array['amicizia', 'amico', 'prestito', 'regalo', 'reso', 'reso_ok', 'reso_no',
  'chiuso', 'richiesta', 'richiesta_si', 'richiesta_no', 'consiglio', 'chiavi', 'limite', 'desideri', 'trovato', 'avviso']));

create or replace function public.push_gruppo(tipo text) returns text
language sql immutable set search_path = '' as $$
  select case
    when tipo in ('amicizia', 'amico') then 'amicizie'
    when tipo in ('prestito', 'regalo', 'reso', 'reso_ok', 'reso_no', 'chiuso', 'richiesta', 'richiesta_si', 'richiesta_no') then 'prestiti'
    when tipo in ('consiglio', 'desideri', 'trovato') then 'consigli'
    when tipo = 'chiavi' then 'chiavi'
    when tipo = 'avviso' then 'avvisi'          -- sempre, qualunque tipo abbia scelto l'utente
  end;
$$;

create or replace function public.push_pronte() returns setof public.notifiche
language sql stable security definer set search_path = '' as $$
  select n.* from public.notifiche n
  left join public.push_preferenze p on p.utente = n.utente
  where n.push = 'attesa' and not n.letta and n.creata > now() - interval '24 hours'
    and (public.push_gruppo(n.tipo) = 'avvisi'
      or public.push_gruppo(n.tipo) = any (coalesce(p.tipi, '{amicizie,prestiti,consigli,chiavi}'::text[])))
    and exists (select 1 from public.push_iscrizioni i where i.utente = n.utente)
    and not public.push_silenzio(coalesce(p.silenzio_da, 22::smallint), coalesce(p.silenzio_a, 8::smallint), coalesce(p.fuso, 'Europe/Rome'));
$$;

create or replace function public.push_lavoro(segreto text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb; s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'push_segreto';
  if s is null or push_lavoro.segreto is distinct from s then return null; end if;
  update public.notifiche n set push = 'no'
  where n.push = 'attesa' and (n.letta or n.creata <= now() - interval '24 hours' or public.push_gruppo(n.tipo) is null
    or not exists (select 1 from public.push_iscrizioni i where i.utente = n.utente)
    or (public.push_gruppo(n.tipo) <> 'avvisi'
      and public.push_gruppo(n.tipo) <> all (coalesce((select p.tipi from public.push_preferenze p where p.utente = n.utente),
                                                   '{amicizie,prestiti,consigli,chiavi}'::text[]))));
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

-- un avviso a tutti quelli che hanno l'account; restituisce a quanti è arrivato
create function public.avviso_importante(titolo text, testo text) returns integer
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare n integer; t text := btrim(coalesce(avviso_importante.titolo, '')); x text := btrim(coalesce(avviso_importante.testo, ''));
begin
  if t = '' or char_length(t) > 80 then raise exception 'titolo: da 1 a 80 caratteri'; end if;
  if x = '' or char_length(x) > 300 then raise exception 'testo: da 1 a 300 caratteri'; end if;
  insert into public.notifiche (utente, da, tipo, rif, titolo)
    select p.id, null, 'avviso', t, x from public.profili p;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.avviso_importante(text, text) from public, anon, authenticated;
