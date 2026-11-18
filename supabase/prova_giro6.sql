-- Prova di 019_profilo_amico_trovati.sql. Finisce con un errore voluto che mostra l'esito e ANNULLA tutto.
-- A e B amici, A e C amici, B e C no. B mostra la libreria. A e C hanno dei desideri; B mette in libreria gli stessi libri.
begin;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'prova-a@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'prova-b@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'prova-c@invalid.test', 'authenticated', 'authenticated');
insert into public.profili (id, nome, utente, desideri, libreria) values
  ('00000000-0000-0000-0000-0000000000a1', 'Anna', 'Anna prova', true, true),
  ('00000000-0000-0000-0000-0000000000b2', 'Bruno', 'Bruno prova', true, true),
  ('00000000-0000-0000-0000-0000000000c3', 'Carla', 'Carla prova', true, true);
insert into public.amicizie (da, a, stato) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'amici'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c3', 'amici');
insert into public.scambi (id, da, a, tipo, libro, libro_id) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'prestito', '{"t":"Prestato"}', 'x1'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'prestito', '{"t":"Prestato 2"}', 'x2'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'prestito', '{"t":"Avuto"}', 'y1'),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'regalo', '{"t":"Regalo"}', 'y2');
create temp table esito (n serial, prova text, risultato text) on commit drop;
grant all on esito to anon, authenticated; grant usage on sequence esito_n_seq to anon, authenticated;

-- stesso libro: maiuscole, accenti, punteggiatura, «Cognome, Nome»
insert into esito (prova, risultato) values ('chiave uguale', (public.libro_chiave('Il Gattopardo', 'Giuseppe Tomasi di Lampedusa') = public.libro_chiave('IL GATTOPARDO!', 'Tomasi di Lampedusa, Giuseppe'))::text
  || ' ' || (public.libro_chiave('Città invisibili', 'Italo Calvino') = public.libro_chiave('citta invisibili', 'CALVINO Italo'))::text
  || ' ' || (public.libro_chiave('Il Gattopardo', 'Un Altro') = public.libro_chiave('Il Gattopardo', 'Giuseppe Tomasi di Lampedusa'))::text
  || ' [' || public.libro_chiave('  ', 'Qualcuno') || '] (true true false [])');

-- desideri di A (uno con ISBN, uno solo titolo e autore, uno che poi toglie) e di C (non amica di B)
insert into public.libri (utente, id, dati) values
  ('00000000-0000-0000-0000-0000000000a1', 'wa1', '{"t":"Il Gattopardo","a":"Tomasi di Lampedusa, Giuseppe","i":"9788807900001","w":true}'),
  ('00000000-0000-0000-0000-0000000000a1', 'wa2', '{"t":"Le città invisibili","a":"Italo Calvino","w":true}'),
  ('00000000-0000-0000-0000-0000000000a1', 'wa3', '{"t":"Poi tolto","a":"Autore","i":"9788807900003","w":true}'),
  ('00000000-0000-0000-0000-0000000000c3', 'wc1', '{"t":"Il Gattopardo","a":"Giuseppe Tomasi di Lampedusa","w":true}');
-- libreria di B: in lettura, preferito, consigliato con citazioni (una con la puntina), un desiderio, un libro preso in prestito
insert into public.libri (utente, id, dati) values
  ('00000000-0000-0000-0000-0000000000b2', 'l1', '{"t":"In lettura","rs":"in","ts":3}'),
  ('00000000-0000-0000-0000-0000000000b2', 'l2', '{"t":"Preferito","fav":true,"ts":2,"n":"appunto segreto"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'l3', '{"t":"Consigliato","a":"Chi","lc":true,"fav":true,"ts":1,"qs":[{"x":"Con la puntina","pg":"7","d":5,"pin":1},{"x":"Senza","d":6}]}'),
  ('00000000-0000-0000-0000-0000000000b2', 'l4', '{"t":"Desiderio consigliato","lc":true,"w":true}'),
  ('00000000-0000-0000-0000-0000000000b2', 'l5', '{"t":"Preso in prestito","rs":"in","sk":"p"}');
insert into esito (prova, risultato) select 'libri già di B: niente avvisi', count(*) || ' (0)' from public.desideri_trovati;
-- B mette in libreria i libri che A e C desiderano
insert into public.libri (utente, id, dati) values
  ('00000000-0000-0000-0000-0000000000b2', 'n1', '{"t":"Il gattopardo","a":"Giuseppe Tomasi di Lampedusa","i":"9788807900001"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'n2', '{"t":"Le Città Invisibili","a":"Calvino, Italo","i":"9788804000002"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'n3', '{"t":"Un altro titolo","a":"Autore","i":"9788807900003"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'n4', '{"t":"Il Gattopardo","a":"Giuseppe Tomasi di Lampedusa","w":true}');
insert into esito (prova, risultato) select 'annotati', coalesce(string_agg(right(chi::text, 2) || '<' || right(amico::text, 2) || ':' || libro, ',' order by libro), '-') || ' (a1<b2:n1,a1<b2:n2,a1<b2:n3: C non è amica di B, n4 è un desiderio)' from public.desideri_trovati;
update public.libri set dati = dati || '{"rs":"ok"}' where utente = '00000000-0000-0000-0000-0000000000b2' and id = 'n1';   -- una modifica non riannota
update public.libri set dati = dati - 'w' where utente = '00000000-0000-0000-0000-0000000000b2' and id = 'n4';              -- il desiderio diventa libro: stessa coppia, altro libro
insert into esito (prova, risultato) select 'desiderio passato in libreria', count(*) || ' (4)' from public.desideri_trovati;
update public.libri set cancellato = true where utente = '00000000-0000-0000-0000-0000000000a1' and id = 'wa3';             -- A toglie un desiderio prima del riassunto
update public.libri set cancellato = true where utente = '00000000-0000-0000-0000-0000000000b2' and id = 'n4';
select public.desideri_riassunto();
insert into esito (prova, risultato) select 'riassunto', coalesce(string_agg(right(utente::text, 2) || '<' || right(da::text, 2) || ' ' || tipo || ' ' || rif || ' ' || titolo, ' | '), '-') || ' (a1<b2 trovato 2:n1 «Il gattopardo», «Le Città Invisibili»)' from public.notifiche where tipo = 'trovato';
insert into esito (prova, risultato) select 'svuotato, gruppo push', count(*) || ' ' || public.push_gruppo('trovato') || ' (0 consigli)' from public.desideri_trovati;
-- libreria nascosta: niente
update public.profili set libreria = false where id = '00000000-0000-0000-0000-0000000000b2';
insert into public.libri (utente, id, dati) values ('00000000-0000-0000-0000-0000000000b2', 'n5', '{"t":"Le città invisibili","a":"Italo Calvino"}');
insert into esito (prova, risultato) select 'libreria nascosta', count(*) || ' (0)' from public.desideri_trovati;
update public.profili set libreria = true where id = '00000000-0000-0000-0000-0000000000b2';

-- A guarda il profilo di B
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ declare r jsonb; n int; begin
  r := public.profilo_di('00000000-0000-0000-0000-0000000000b2');
  insert into esito (prova, risultato) values ('profilo: file di libri', 'let=' || (select string_agg(x->>'id', ',') from jsonb_array_elements(r->'let') x) || ' pref=' || (select string_agg(x->>'id', ',') from jsonb_array_elements(r->'pref') x)
    || ' cons=' || (select string_agg(x->>'id', ',') from jsonb_array_elements(r->'cons') x) || ' evid=' || (r ? 'evid') || ' tra=' || (r->'tra'->>'dati') || '/' || (r->'tra'->>'avuti')
    || ' segreto=' || (r::text like '%segreto%') || ' (let=l1 pref=l2,l3 cons=l3 evid=false tra=2/1 segreto=false)');
  insert into esito (prova, risultato) select 'chi_ha per titolo', coalesce(string_agg(utente || ':' || libro_id, ',' order by libro_id), '-') || ' (Bruno prova:n2,Bruno prova:n5)' from public.chi_ha('le citta invisibili', 'CALVINO, Italo', '');
  insert into esito (prova, risultato) select 'chi_ha per ISBN', coalesce(string_agg(utente || ':' || libro_id, ','), '-') || ' (Bruno prova:n3)' from public.chi_ha('Titolo diverso', '', '978-88-07-90000-3');
  insert into esito (prova, risultato) select 'chi_ha: niente', count(*) || ' (0)' from public.chi_ha('', '', '');
  begin select count(*) into n from public.desideri_trovati; insert into esito (prova, risultato) values ('A legge desideri_trovati', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito (prova, risultato) values ('A legge desideri_trovati', 'negato (bene)'); end;
  begin perform public.profilo_libri('00000000-0000-0000-0000-0000000000c3', 'pref'); insert into esito (prova, risultato) values ('A chiama profilo_libri', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito (prova, risultato) values ('A chiama profilo_libri', 'negato (bene)'); end;
  begin perform public.libro_chiave('a', 'b'); insert into esito (prova, risultato) values ('A chiama libro_chiave', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito (prova, risultato) values ('A chiama libro_chiave', 'negato (bene)'); end;
end $$;
reset role;
-- C non è amica di B
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
do $$ begin
  begin perform public.profilo_di('00000000-0000-0000-0000-0000000000b2'); insert into esito (prova, risultato) values ('C guarda B', 'PERMESSO (male)');
  exception when others then insert into esito (prova, risultato) values ('C guarda B', 'negato (bene)'); end;
  insert into esito (prova, risultato) select 'chi_ha di C', count(*) || ' (0: B non è suo amico, A non ce l''ha)' from public.chi_ha('Il Gattopardo', 'Giuseppe Tomasi di Lampedusa', '');
end $$;
reset role;
-- interruttori: citazioni in evidenza accese, preferiti spenti; poi libreria nascosta; poi la vecchia preferita senza puntine
update public.profili set p_cit = true, p_pref = false, cit = '{"x":"La vecchia preferita","t":"Suo"}' where id = '00000000-0000-0000-0000-0000000000b2';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ declare r jsonb; begin
  r := public.profilo_di('00000000-0000-0000-0000-0000000000b2');
  insert into esito (prova, risultato) values ('profilo: puntina, preferiti spenti', 'evid=' || jsonb_array_length(r->'evid') || ':' || (r->'evid'->0->>'x') || ':' || (r->'evid'->0->>'t') || ' pref=' || (r ? 'pref') || ' let=' || (r ? 'let') || ' (evid=1:Con la puntina:Consigliato pref=false let=true)');
end $$;
reset role;
update public.profili set libreria = false where id = '00000000-0000-0000-0000-0000000000b2';
update public.libri set dati = jsonb_set(dati, '{qs}', '[{"x":"Senza","d":6}]') where utente = '00000000-0000-0000-0000-0000000000b2' and id = 'l3';
insert into public.desideri_trovati (chi, amico, libro) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'n2');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ declare r jsonb; begin
  r := public.profilo_di('00000000-0000-0000-0000-0000000000b2');
  insert into esito (prova, risultato) values ('profilo: libreria nascosta', 'let=' || (r ? 'let') || ' cons=' || (r ? 'cons') || ' evid=' || (r->'evid'->0->>'x') || ' (let=false cons=false evid=La vecchia preferita)');
  perform public.togli_amicizia('00000000-0000-0000-0000-0000000000b2');
end $$;
reset role;
insert into esito (prova, risultato) select 'dopo togli amicizia', count(*) || ' (0)' from public.desideri_trovati;
do $$ begin raise exception E'ESITO (annullato tutto):\n%', (select string_agg(n || '. ' || prova || ': ' || risultato, E'\n' order by n) from esito); end $$;
