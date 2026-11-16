-- Next Libris, copia social: profili e libri sincronizzati (applicato il 16/11/2026 al progetto Supabase
-- «next-libris-social», regione eu-central-1 Francoforte, ref amkrkvkylprjasccxmzo).
-- Regola: ognuno vede e modifica solo i propri dati (RLS). La chiave pubblica (anon) non vede niente.
-- Prova delle regole: prova_sicurezza.sql (da eseguire nell'editor SQL; alla fine annulla tutto).

create table public.profili (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '' check (char_length(nome) <= 30),
  creato timestamptz not null default now()
);

create table public.libri (
  utente uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
  dati jsonb not null default '{}'::jsonb check (pg_column_size(dati) < 100000),
  cancellato boolean not null default false,
  aggiornato timestamptz not null default now(),
  primary key (utente, id)
);
create index libri_utente_aggiornato on public.libri (utente, aggiornato);

-- l'ora di aggiornamento la decide il server (serve alla sincronizzazione: «cosa e' cambiato da allora»)
create function public.libri_aggiornato() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.aggiornato := now();
  return new;
end $$;
create trigger libri_aggiornato before insert or update on public.libri
  for each row execute function public.libri_aggiornato();

alter table public.profili enable row level security;
alter table public.libri enable row level security;

-- permessi: niente alla chiave pubblica; agli utenti entrati solo cio' che serve
revoke all on table public.profili, public.libri from anon, authenticated;
grant select, insert, update, delete on table public.profili to authenticated;
grant select, insert, update, delete on table public.libri to authenticated;

create policy "profili: il proprio" on public.profili for select to authenticated using ((select auth.uid()) = id);
create policy "profili: crea il proprio" on public.profili for insert to authenticated with check ((select auth.uid()) = id);
create policy "profili: modifica il proprio" on public.profili for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profili: cancella il proprio" on public.profili for delete to authenticated using ((select auth.uid()) = id);

create policy "libri: i propri" on public.libri for select to authenticated using ((select auth.uid()) = utente);
create policy "libri: aggiunge i propri" on public.libri for insert to authenticated with check ((select auth.uid()) = utente);
create policy "libri: modifica i propri" on public.libri for update to authenticated using ((select auth.uid()) = utente) with check ((select auth.uid()) = utente);
create policy "libri: cancella i propri" on public.libri for delete to authenticated using ((select auth.uid()) = utente);

-- eliminare l'account (dal Menu dell'app): cancella l'utente, e con lui profilo e libri (on delete cascade).
-- L'avviso di Supabase «SECURITY DEFINER eseguibile dagli utenti» e' voluto: la funzione cancella solo l'utente che la chiama.
create function public.elimina_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'non autenticato'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.elimina_account() from public, anon;
grant execute on function public.elimina_account() to authenticated;
revoke all on function public.libri_aggiornato() from public, anon, authenticated;
