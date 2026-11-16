-- Next Libris: relazioni e pulizia (16/11/2026). APPLICATO alla prova (migrazione «relazioni_e_pulizia», confermata da Piero); prova: tutto bene.
revoke all on function public.sono_amici(uuid, uuid) from public, anon, authenticated;   -- non deve dire a chiunque chi è amico di chi
create index if not exists chiavi_a on public.chiavi (a);
create index if not exists consigli_da on public.consigli (da);
create index if not exists prenotazioni_da on public.prenotazioni (da);
delete from public.prenotazioni p where not exists (select 1 from public.libri l where l.utente = p.proprietario and l.id = p.libro);
delete from public.richieste r where not exists (select 1 from public.libri l where l.utente = r.a and l.id = r.libro_id);
alter table public.prenotazioni add constraint prenotazioni_libro_fkey foreign key (proprietario, libro) references public.libri (utente, id) on delete cascade;
alter table public.richieste add constraint richieste_libro_fkey foreign key (a, libro_id) references public.libri (utente, id) on delete cascade;
create index if not exists richieste_a_libro on public.richieste (a, libro_id);
create or replace function public.togli_amicizia(altro uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'non autenticato'; end if;
  delete from public.amicizie f where (f.da = me and f.a = altro) or (f.da = altro and f.a = me);
  delete from public.prenotazioni p where (p.proprietario = me and p.da = altro) or (p.proprietario = altro and p.da = me);
  delete from public.richieste r where r.stato = 'attesa' and ((r.da = me and r.a = altro) or (r.da = altro and r.a = me));
  delete from public.consigli c where (c.da = me and c.a = altro) or (c.da = altro and c.a = me);
  delete from public.chiavi k where (k.da = me and k.a = altro) or (k.da = altro and k.a = me);
end $$;
