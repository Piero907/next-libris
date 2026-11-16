-- Next Libris · 012: contatore condiviso delle ricerche e archivio comune per ISBN. 16/11/2026, prima nella prova. Scelte di Piero.
-- 1) ricerche: un conto al giorno per chiave Google («g:» + sha256 della chiave, giorno di Google = ora del Pacifico) e per worker SBN
--    («s:» + sha256 dell'indirizzo, giorno UTC di Cloudflare). La chiave vera non arriva mai qui. Si legge e scrive solo con conta_ricerche().
--    Quando una chiave Google arriva a 950, chi la sta usando riceve una notifica «limite» (una al giorno per chiave), con il nome di chi
--    l'ha prestata se è di un amico. Le righe «a:» (sha256 dell'utente) contano i salvataggi nell'archivio, per il limite al giorno.
-- 2) archivio: dati pubblici del libro per ISBN (titolo, autore, editore, anno, pagine, copertina, descrizione…), mai chi li ha cercati.
--    Il primo che trova un libro lo salva; dopo si aggiungono solo i dati che mancano (quelli già salvati non si cambiano).

alter table public.notifiche drop constraint notifiche_tipo_check;
alter table public.notifiche add constraint notifiche_tipo_check check (tipo in ('amicizia', 'amico', 'prestito', 'regalo', 'reso', 'reso_ok', 'reso_no', 'chiuso',
  'richiesta', 'richiesta_si', 'richiesta_no', 'consiglio', 'chiavi', 'limite'));

create table public.ricerche (
  chiave text not null check (chiave ~ '^[gsa]:[0-9a-f]{64}$'),
  giorno date not null,
  n integer not null default 0 check (n >= 0),
  primary key (chiave, giorno)
);
alter table public.ricerche enable row level security;
revoke all on table public.ricerche from anon, authenticated;

create table public.archivio (
  isbn text primary key check (isbn ~ '^97[89][0-9]{10}$'),
  dati jsonb not null check (pg_column_size(dati) < 9000),
  creato timestamptz not null default now(),
  aggiornato timestamptz not null default now()
);
alter table public.archivio enable row level security;
revoke all on table public.archivio from anon, authenticated;

-- conta n ricerche fatte con la chiave (o il worker) e restituisce il totale di oggi; n = 0 per leggere soltanto.
-- di: nome di chi ha prestato la chiave ('' se è la tua), per il testo della notifica.
create function public.conta_ricerche(chiave text, n integer, di text default '') returns integer
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := auth.uid(); g date; tot integer; tipo text := left(conta_ricerche.chiave, 1);
begin
  if me is null then raise exception 'non autenticato'; end if;
  if conta_ricerche.chiave !~ '^[gs]:[0-9a-f]{64}$' then raise exception 'chiave non valida'; end if;
  if conta_ricerche.n is null or conta_ricerche.n < 0 or conta_ricerche.n > 200 then raise exception 'numero non valido'; end if;
  g := case when tipo = 'g' then (now() at time zone 'America/Los_Angeles')::date else (now() at time zone 'UTC')::date end;
  insert into public.ricerche as r (chiave, giorno, n) values (conta_ricerche.chiave, g, conta_ricerche.n)
    on conflict (chiave, giorno) do update set n = r.n + excluded.n
    returning r.n into tot;
  if random() < 0.02 then delete from public.ricerche r where r.giorno < current_date - 3; end if;    -- pulizia leggera
  if tipo = 'g' and tot >= 950 and not exists (select 1 from public.notifiche x where x.utente = me and x.tipo = 'limite' and x.rif = conta_ricerche.chiave || ':' || g) then
    perform public.notifica_nuova(me, null, 'limite', conta_ricerche.chiave || ':' || g, left(coalesce(conta_ricerche.di, ''), 40));
  end if;
  return tot;
end $$;

-- dati di un libro dall'archivio comune (null se non c'è)
create function public.da_archivio(isbn text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select a.dati from public.archivio a where auth.uid() is not null and a.isbn = da_archivio.isbn;
$$;

-- salva i dati pubblici di un libro: solo i campi previsti, con lunghezze massime; quelli già salvati non cambiano.
create function public.archivia(isbn text, dati jsonb) returns void
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare me uuid := auth.uid(); d jsonb := '{}'::jsonb; k text; v text; lim integer; tot integer;
  campi constant text[] := array['t', 'a', 'e', 'y', 'pg', 'img', 'imgL', 'ds', 'dsl', 'gen', 'se', 'sn'];
  massimi constant integer[] := array[300, 300, 200, 10, 6, 600, 600, 6000, 2, 60, 200, 10];
begin
  if me is null then raise exception 'non autenticato'; end if;
  if archivia.isbn !~ '^97[89][0-9]{10}$' or jsonb_typeof(archivia.dati) <> 'object' then raise exception 'dati non validi'; end if;
  for i in 1 .. array_length(campi, 1) loop
    k := campi[i]; lim := massimi[i];
    if jsonb_typeof(archivia.dati -> k) in ('string', 'number') then
      v := btrim(archivia.dati ->> k);
      if v <> '' and char_length(v) <= lim and (k not in ('img', 'imgL') or v ~ '^https://') then d := d || jsonb_build_object(k, v); end if;
    end if;
  end loop;
  if coalesce(d ->> 't', '') = '' then return; end if;                                   -- senza titolo non si salva
  insert into public.ricerche as r (chiave, giorno, n)
    values ('a:' || encode(sha256(convert_to(me::text, 'UTF8')), 'hex'), current_date, 1)
    on conflict (chiave, giorno) do update set n = r.n + 1 returning r.n into tot;
  if tot > 300 then raise exception 'troppi libri salvati oggi'; end if;
  insert into public.archivio as a (isbn, dati) values (archivia.isbn, d)
    on conflict (isbn) do update set dati = excluded.dati || a.dati, aggiornato = now()
    where not (excluded.dati - array(select jsonb_object_keys(a.dati))) = '{}'::jsonb;    -- solo se aggiunge qualcosa
end $$;

revoke all on function public.conta_ricerche(text, integer, text), public.da_archivio(text), public.archivia(text, jsonb) from public, anon;
grant execute on function public.conta_ricerche(text, integer, text), public.da_archivio(text), public.archivia(text, jsonb) to authenticated;
