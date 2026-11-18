-- Next Libris · 021: nel profilo tutto visibile agli amici di partenza, tranne «tutte le citazioni» (Piero, 18/11/2026; prima nella prova).
-- Vale anche per chi ha già l'account (scelta di Piero: oggi ci sono solo account di prova), una volta sola.
-- Le scelte «Gli amici vedono la libreria / i desideri» non cambiano: In lettura, Consigliati e i numeri si vedono solo con la libreria visibile.
alter table public.profili alter column p_cit set default true;
alter table public.profili alter column p_stat set default true;
update public.profili set p_cit = true, p_stat = true, p_let = true, p_cons = true, p_pref = true where not (p_cit and p_stat and p_let and p_cons and p_pref);
