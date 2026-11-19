-- 028 (19/11/2026, giro 11E): avvisi della chat SUBITO, uno per ogni giro di messaggi non letti.
--  · Chat a due: arriva un messaggio e tu avevi già letto tutto quello che ti era stato avvisato → avviso subito.
--    Altri messaggi prima che tu legga → niente avviso in più. Letta la chat, il giro riparte.
--  · Gruppi: come sopra, ma con avvisi già in attesa ne riparte uno dopo 30 minuti (per gruppo) finché non leggi.
--  · Niente avviso se hai quella chat aperta (chat_leggi l'ha guardata negli ultimi 40 s), se è silenziata,
--    se chi scrive è bloccato, per le richieste fatte da te. Ore di silenzio: come sempre (push in attesa).
--  · L'avviso nella campanella resta UNO solo per persona («3 messaggi nuovi da Bruno»), rifatto a ogni avviso.
--  · Via il giro ogni 15 minuti (chat-riassunto): la funzione resta per le app vecchie, ma non parte più da sola.

alter table public.chat_membri add column if not exists avvisato_il timestamptz;
alter table public.chat_membri add column if not exists visto_il timestamptz;

-- chat_leggi segna anche «la sto guardando adesso» (il giro ogni 15 s con la chat aperta)
do $$
declare f oid; d text;
begin
  select p.oid into f from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'chat_leggi';
  d := pg_get_functiondef(f);
  if position('visto_il' in d) = 0 then
    d := replace(d, '    if top > m.letto then',
      '    update public.chat_membri z set visto_il = now() where z.chat = c.id and z.utente = me;' || chr(10) || '    if top > m.letto then');
    execute d;
  end if;
end $$;

-- rifà l'avviso «messaggi» di una persona con tutti i suoi messaggi non letti
create or replace function public.chat_avvisa(p_utente uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  with nuovi as (
    select m.chat, y.da, (c.tipo = 'due' and c.stato = 'richiesta') as rich
    from public.chat_membri m
    join public.chat c on c.id = m.chat
    join public.messaggi y on y.chat = m.chat and y.id > greatest(m.letto, m.da_id)
    where m.utente = p_utente and not m.silenziata and y.da is not null and y.da <> m.utente
      and y.creato > now() - interval '2 days'
      and (c.tipo = 'gruppo' or c.stato = 'attiva' or (c.stato = 'richiesta' and c.richiesta_da is distinct from m.utente))
      and not public.bloccati(m.utente, y.da))
  select count(*) as n, count(distinct x.chat) as chat, count(distinct x.chat) filter (where x.rich) as rich,
         count(distinct x.da) as quanti, (min(x.da::text))::uuid as uno,
         (select string_agg(q.nome, ', ') from (select distinct coalesce(p.utente, '') as nome
            from nuovi z join public.profili p on p.id = z.da limit 3) q) as nomi
    into r from nuovi x;
  if coalesce(r.n, 0) = 0 then return; end if;
  delete from public.notifiche n where n.utente = p_utente and n.tipo = 'messaggi' and not n.letta;
  perform public.notifica_nuova(p_utente, case when r.quanti = 1 then r.uno end, 'messaggi',
    r.n::text || ':' || r.chat::text || ':' || r.rich::text, left(coalesce(r.nomi, ''), 100));
end $$;

create or replace function public.chat_messaggio_avviso() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.chat%rowtype; m record;
begin
  if new.da is null then return null; end if;                       -- messaggi di sistema: niente avviso
  select x.* into c from public.chat x where x.id = new.chat;
  if c.id is null then return null; end if;
  for m in select z.* from public.chat_membri z where z.chat = new.chat and z.utente <> new.da loop
    continue when m.silenziata or new.id <= m.da_id;
    continue when not (c.tipo = 'gruppo' or c.stato = 'attiva' or (c.stato = 'richiesta' and c.richiesta_da is distinct from m.utente));
    continue when public.bloccati(m.utente, new.da);
    continue when m.visto_il > now() - interval '40 seconds';     -- ha la chat aperta: lo vede già
    continue when m.avvisato > greatest(m.letto, m.da_id)          -- c'è già un avviso che aspetta di essere letto
      and not (c.tipo = 'gruppo' and coalesce(m.avvisato_il, '-infinity') < now() - interval '30 minutes');
    update public.chat_membri z set avvisato = new.id, avvisato_il = now() where z.chat = m.chat and z.utente = m.utente;
    perform public.chat_avvisa(m.utente);
  end loop;
  return null;
end $$;

drop trigger if exists chat_messaggio_avviso on public.messaggi;
create trigger chat_messaggio_avviso after insert on public.messaggi for each row execute function public.chat_messaggio_avviso();

revoke all on function public.chat_avvisa(uuid), public.chat_messaggio_avviso() from public, anon, authenticated;

do $$ begin perform cron.unschedule('chat-riassunto'); exception when others then null; end $$;
