-- Prova di 018_profilo_seguiti.sql. Finisce con un errore voluto che mostra l'esito e ANNULLA tutto.
-- A e B amici, A e C amici, B e C no. B nasconde la libreria ma mostra i desideri; A gli ha prestato un libro; A e C seguono B.
begin;
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'prova-a@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'prova-b@invalid.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'prova-c@invalid.test', 'authenticated', 'authenticated');
insert into public.profili (id, nome, utente, desideri, libreria) values
  ('00000000-0000-0000-0000-0000000000a1', 'Anna', 'Anna prova', false, true),
  ('00000000-0000-0000-0000-0000000000b2', 'Bruno', 'Bruno prova', true, false),
  ('00000000-0000-0000-0000-0000000000c3', 'Carla', 'Carla prova', false, false);
insert into public.amicizie (da, a, stato) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'amici'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c3', 'amici');
insert into public.scambi (id, da, a, tipo, libro, libro_id) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'prestito', '{"t":"Prestato","a":"Autore"}', 'x1'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'prestito', '{"t":"Non ancora preso"}', 'x2');
insert into public.libri (utente, id, dati) values
  ('00000000-0000-0000-0000-0000000000b2', 'l1', '{"t":"Suo","qs":[{"x":"Una frase","pg":"12","d":5},{"x":"","d":6}],"n":"appunto segreto"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'l2', '{"t":"Prestato","sk":"p","sx":"11111111-1111-1111-1111-111111111111","rs":"in","pp":"40"}');
create temp table esito (n serial, prova text, risultato text) on commit drop;
grant all on esito to anon, authenticated; grant usage on sequence esito_n_seq to anon, authenticated;

-- A: libreria nascosta di B con i due prestiti; segue B; C (non amico di B) non può
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ declare r jsonb; n int; begin
  r := public.libreria_di('00000000-0000-0000-0000-0000000000b2');
  insert into esito (prova, risultato) values ('nascosta + prestiti', (r->>'visibili') || ' ' || jsonb_array_length(r->'libri') || ' ' ||
    (select string_agg((x->>'id') || ':' || coalesce(x->>'rs', '-') || ':' || (x->>'mio'), ',' order by x->>'t') from jsonb_array_elements(r->'libri') x) || ' (false 2 ps-2222…:-:true,l2:in:true)');
  perform public.segui('00000000-0000-0000-0000-0000000000b2', true); perform public.segui('00000000-0000-0000-0000-0000000000b2', true);
  insert into esito (prova, risultato) select 'miei_amici segue', string_agg(utente || '=' || segue, ',' order by utente) || ' (Bruno=true,Carla=false)' from public.miei_amici();
  begin select count(*) into n from public.seguiti; insert into esito (prova, risultato) values ('A legge seguiti', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito (prova, risultato) values ('A legge seguiti', 'negato (bene)'); end;
  begin perform public.desideri_riassunto(); insert into esito (prova, risultato) values ('A lancia il riassunto', 'PERMESSO (male)');
  exception when insufficient_privilege then insert into esito (prova, risultato) values ('A lancia il riassunto', 'negato (bene)'); end;
  begin update public.profili set foto = 'https://esempio.it/x.jpg' where id = auth.uid(); insert into esito (prova, risultato) values ('foto da un sito qualunque', 'PERMESSA (male)');
  exception when check_violation then insert into esito (prova, risultato) values ('foto da un sito qualunque', 'negata (bene)'); end;
  update public.profili set foto = 'data:image/jpeg;base64,AAAA', foto_il = '2000-01-01' where id = auth.uid();
  insert into esito (prova, risultato) select 'foto_il deciso dal server', (foto_il > now() - interval '1 minute')::text || ' (true)' from public.profili where id = auth.uid();
end $$;
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
do $$ begin
  begin perform public.segui('00000000-0000-0000-0000-0000000000b2', true); insert into esito (prova, risultato) values ('C segue B senza amicizia', 'PERMESSO (male)');
  exception when others then insert into esito (prova, risultato) values ('C segue B senza amicizia', 'negato: ' || sqlerrm || ' (bene)'); end;
  begin perform public.profilo_di('00000000-0000-0000-0000-0000000000b2'); insert into esito (prova, risultato) values ('C profilo di B', 'PERMESSO (male)');
  exception when others then insert into esito (prova, risultato) values ('C profilo di B', 'negato: ' || sqlerrm || ' (bene)'); end;
  insert into esito (prova, risultato) select 'C foto di A e B', coalesce(string_agg(left(foto, 10), ','), '') || ' / ' || count(*) || ' (data:image / 1)' from public.foto_amici(array['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2']::uuid[]);
  insert into esito (prova, risultato) values ('C chiede amicizia a B e lo segue', public.chiedi_amicizia('Bruno prova', true) || ' (attesa)');
end $$;
reset role;

-- B aggiunge due desideri (uno poi lo toglie) e ne modifica uno vecchio: il riassunto conta solo quelli nuovi ancora presenti
insert into public.libri (utente, id, dati) values ('00000000-0000-0000-0000-0000000000b2', 'w0', '{"t":"Vecchio","w":true}');
delete from public.desideri_nuovi;
insert into public.libri (utente, id, dati) values ('00000000-0000-0000-0000-0000000000b2', 'w1', '{"t":"Desiderio uno","w":true}'), ('00000000-0000-0000-0000-0000000000b2', 'w2', '{"t":"Desiderio due","w":true}');
update public.libri set dati = dati || '{"n":"x"}' where utente = '00000000-0000-0000-0000-0000000000b2' and id = 'w0';
update public.libri set cancellato = true where utente = '00000000-0000-0000-0000-0000000000b2' and id = 'w2';
update public.libri set dati = dati || '{"w":true}' where utente = '00000000-0000-0000-0000-0000000000b2' and id = 'l1';
insert into public.libri (utente, id, dati) values ('00000000-0000-0000-0000-0000000000a1', 'wa', '{"t":"Di Anna","w":true}');
insert into esito (prova, risultato) select 'annotati', string_agg(libro, ',' order by libro) || ' (l1,w1,w2: non w0, non Anna che nessuno segue)' from public.desideri_nuovi;
select public.desideri_riassunto();
insert into esito (prova, risultato) select 'riassunto', coalesce(string_agg(p.utente || ':' || n.rif || ':' || n.titolo, ' | ' order by p.utente), 'nessuna') || ' (solo Anna, 2, «Suo», «Desiderio uno»: Carla è in attesa)'
  from public.notifiche n join public.profili p on p.id = n.utente where n.tipo = 'desideri';
insert into esito (prova, risultato) select 'svuotato', count(*) || ' (0)' from public.desideri_nuovi;
-- desideri nascosti: niente
update public.profili set desideri = false where id = '00000000-0000-0000-0000-0000000000b2';
insert into public.libri (utente, id, dati) values ('00000000-0000-0000-0000-0000000000b2', 'w3', '{"t":"Nascosto","w":true}');
select public.desideri_riassunto();
insert into esito (prova, risultato) select 'desideri nascosti', count(*) || ' (ancora 1)' from public.notifiche where tipo = 'desideri';

-- profilo di B visto da A: prima niente, poi con gli interruttori (statistiche solo con libreria visibile; mai gli appunti)
update public.profili set cit = '{"x":"La preferita","t":"Suo"}', stat = '{"l":3}' where id = '00000000-0000-0000-0000-0000000000b2';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ declare r jsonb; begin
  r := public.profilo_di('00000000-0000-0000-0000-0000000000b2');
  insert into esito (prova, risultato) values ('profilo, tutto spento', (r->>'utente') || ' segue=' || (r->>'segue') || ' cit=' || (r ? 'cit') || ' stat=' || (r ? 'stat') || ' cits=' || (r ? 'cits') || ' (Bruno prova segue=true, tre false)');
end $$;
reset role;
update public.profili set p_cit = true, p_stat = true, p_cits = true where id = '00000000-0000-0000-0000-0000000000b2';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
do $$ declare r jsonb; begin
  r := public.profilo_di('00000000-0000-0000-0000-0000000000b2');
  insert into esito (prova, risultato) values ('profilo, acceso ma libreria nascosta', (r->'cit'->>'x') || ' stat=' || (r ? 'stat') || ' cits=' || jsonb_array_length(r->'cits') || ':' || (r->'cits'->0->>'x') || ':' || (r->'cits'->0->>'t') ||
    ' appunti=' || (r::text like '%segreto%') || ' (La preferita stat=false cits=1:Una frase:Suo appunti=false)');
  perform public.togli_amicizia('00000000-0000-0000-0000-0000000000b2');
end $$;
reset role;
insert into esito (prova, risultato) select 'dopo togli amicizia', count(*) || ' (1: resta solo Carla in attesa)' from public.seguiti;
do $$ begin raise exception E'ESITO (annullato tutto):\n%', (select string_agg(n || '. ' || prova || ': ' || risultato, E'\n' order by n) from esito); end $$;
