-- Next Libris · 022: «Gli amici vedono la mia libreria» e «…i miei desideri» accesi di partenza (Piero, 18/11/2026; prima nella prova).
-- Anche per chi ha già l'account (scelta di Piero), una volta sola. Senza la libreria visibile gli amici non vedono In lettura,
-- Consigliati e i numeri del profilo. Le tue scelte restano in Amici e privacy.
alter table public.profili alter column libreria set default true;
alter table public.profili alter column desideri set default true;
update public.profili set libreria = true, desideri = true where not (libreria and desideri);
