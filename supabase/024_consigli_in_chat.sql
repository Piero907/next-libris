-- Next Libris: i consigli finiscono solo in chat (giro 9d, 18/11/2026, scelta di Piero).
-- * I consigli ancora in sospeso nella tabella `consigli` diventano messaggi «consiglio» nella chat a due
--   tra chi li ha mandati e chi li riceve (solo se sono ancora amici e nessuno ha bloccato l'altro), poi la tabella si svuota.
-- * `consiglia(a, libro)` (usata dalle app vecchie ancora in cache) ora scrive anche lei in chat.
-- La tabella `consigli` e le funzioni `miei_consigli` / `togli_consiglio` restano (vuote) per le app non aggiornate.

do $$
declare r record; c uuid; l jsonb; me uuid; altro uuid;
begin
  for r in select * from public.consigli order by creato loop
    if not public.sono_amici(r.da, r.a) or public.bloccati(r.da, r.a) then continue; end if;
    l := public.chat_libro(r.libro);
    if l is null then continue; end if;
    me := least(r.da, r.a); altro := greatest(r.da, r.a);
    select x.id into c from public.chat x where x.tipo = 'due' and x.a = me and x.b = altro;
    if c is null then
      insert into public.chat (tipo, a, b, stato) values ('due', me, altro, 'attiva') returning id into c;
      insert into public.chat_membri (chat, utente) values (c, r.da), (c, r.a);
    else
      update public.chat x set stato = 'attiva' where x.id = c and x.stato <> 'attiva';
      insert into public.chat_membri (chat, utente) values (c, r.da), (c, r.a) on conflict do nothing;
    end if;
    insert into public.messaggi (chat, da, tipo, testo, libro, creato) values (c, r.da, 'consiglio', '', l, r.creato);
    update public.chat x set ultimo = greatest(coalesce(x.ultimo, r.creato), r.creato) where x.id = c;
  end loop;
  delete from public.consigli;                       -- il trigger segna come lette le notifiche «consiglio»
end $$;

create or replace function public.consiglia(a uuid, libro jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r jsonb;
begin
  if me is null then raise exception 'non autenticato'; end if;
  if not public.sono_amici(me, consiglia.a) then raise exception 'non amici'; end if;
  r := public.chat_scrivi_a(consiglia.a, '', consiglia.libro, 'consiglio');
  return (r ->> 'chat')::uuid;
end $$;
revoke execute on function public.consiglia(uuid, jsonb) from public, anon;
grant execute on function public.consiglia(uuid, jsonb) to authenticated;
