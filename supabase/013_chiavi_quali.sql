-- 013 (16/11/2026): chiavi_mie dice anche QUALI chiavi presto a un amico, per la finestra «Presta chiave API e worker»
-- (si sceglie se prestare tutte e due o una sola). Per le righe «da me» restituisce solo il segno 'si' / '', mai le chiavi:
-- chi le presta le ha già nel telefono e il server non le rimanda indietro. Le righe «a me» restano come prima.
-- Applicato al progetto della prova; da applicare alla vera insieme a 011 e 012 (l'app regge anche senza: se non ci sono
-- i segni, considera prestate tutte e due).
create or replace function public.chiavi_mie()
 returns table(da uuid, a uuid, nome text, gb_key text, sbn text, creato timestamp with time zone)
 language sql
 stable security definer
 set search_path to ''
as $function$
  select c.da, c.a, p.utente,
         case when c.gb_key <> '' then 'si' else '' end,
         case when c.sbn <> '' then 'si' else '' end,
         c.creato
    from public.chiavi c join public.profili p on p.id = c.a where c.da = auth.uid()
  union all
  select c.da, c.a, p.utente, c.gb_key, c.sbn, c.creato from public.chiavi c join public.profili p on p.id = c.da
    where c.a = auth.uid() and public.sono_amici(c.da, c.a);
$function$;
revoke all on function public.chiavi_mie() from public, anon;
grant execute on function public.chiavi_mie() to authenticated;
