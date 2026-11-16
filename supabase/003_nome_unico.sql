-- Next Libris: il nome nell'app e il nome per gli amici diventano lo stesso (16/11/2026, richiesta di Piero).
-- profili.utente ora è il nome come lo scrivi (maiuscole, accenti, spazi: «Piero R.»), 3-20 caratteri, unico senza badare
-- alle maiuscole (indice su lower). Ricerca e richieste non badano alle maiuscole. Applicato al progetto della prova.
alter table public.profili drop constraint profili_utente_check;
alter table public.profili drop constraint profili_utente_key;
alter table public.profili add constraint profili_utente_check check (
  utente = btrim(utente) and char_length(utente) between 3 and 20 and utente !~ '\s\s'
  and utente ~ '^[0-9A-Za-zÀ-ÖØ-öø-ÿ ._''-]+$');
create unique index profili_utente_lower on public.profili (lower(utente));

create or replace function public.cerca_utenti(q text) returns table (id uuid, utente text, nome text, rel text)
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); s text := lower(btrim(regexp_replace(regexp_replace(coalesce(q, ''), '^\s*@', ''), '\s+', ' ', 'g')));
begin
  if me is null then raise exception 'non autenticato'; end if;
  if char_length(s) < 3 then return; end if;
  return query
    select p.id, p.utente, p.nome,
      coalesce((select case when f.stato = 'amici' then 'amici' when f.da = me then 'inviata' else 'ricevuta' end
                from public.amicizie f where (f.da = me and f.a = p.id) or (f.da = p.id and f.a = me) limit 1), '')
    from public.profili p
    where p.utente is not null and p.id <> me
      and (lower(p.utente) = s or lower(p.utente) like replace(replace(replace(s, '\', '\\'), '_', '\_'), '%', '\%') || '%')
    order by (lower(p.utente) = s) desc, lower(p.utente)
    limit 10;
end $$;

create or replace function public.chiedi_amicizia(utente text) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); altro uuid; st text;
begin
  if me is null then raise exception 'non autenticato'; end if;
  select p.id into altro from public.profili p where lower(p.utente) = lower(btrim(chiedi_amicizia.utente));
  if altro is null then raise exception 'utente non trovato'; end if;
  if altro = me then raise exception 'sei tu'; end if;
  select f.stato into st from public.amicizie f where f.da = me and f.a = altro;
  if st is not null then return st; end if;
  update public.amicizie f set stato = 'amici' where f.da = altro and f.a = me returning f.stato into st;
  if st is not null then return 'amici'; end if;
  if (select count(*) from public.amicizie f where f.da = me and f.stato = 'attesa') >= 100 then raise exception 'troppe richieste in attesa'; end if;
  insert into public.amicizie (da, a) values (me, altro);
  return 'attesa';
end $$;
