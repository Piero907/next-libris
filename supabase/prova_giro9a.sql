-- Prova di 023_chat.sql (giro 9a). Nota: una funzione che legge (stable) non vede quello che ha scritto un'altra funzione
-- nella STESSA istruzione: per questo scrittura e controllo stanno in righe separate. Finisce con un errore voluto che mostra l'esito («ESITO n/n») e ANNULLA tutto.
-- Persone: A-B amici, B-C amici, B-E amici, C-F amici; D e 01…20 non sono amici di nessuno; Z (99) è l'amministratore.
begin;
create function pg_temp.u(x text) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-0000000000' || x)::uuid $$;
insert into auth.users (id, email, aud, role)
  select pg_temp.u(x), 'prova-' || x || '@invalid.test', 'authenticated', 'authenticated'
  from unnest(array['a1', 'b2', 'c3', 'd4', 'e5', 'f6', '99'] || array(select lpad(g::text, 2, '0') from generate_series(1, 20) g)) x;
insert into public.profili (id, nome, utente)
  select pg_temp.u(x), n, n || ' prova' from (values ('a1', 'Anna'), ('b2', 'Bruno'), ('c3', 'Carla'), ('d4', 'Dino'), ('e5', 'Elsa'), ('f6', 'Febo'), ('99', 'Zeta')) v(x, n);
insert into public.profili (id, nome, utente, scrivermi)
  select pg_temp.u(lpad(g::text, 2, '0')), 'U' || g, 'Utente ' || lpad(g::text, 2, '0'), 'tutti' from generate_series(1, 20) g;
insert into public.amicizie (da, a, stato) values
  (pg_temp.u('a1'), pg_temp.u('b2'), 'amici'), (pg_temp.u('b2'), pg_temp.u('c3'), 'amici'),
  (pg_temp.u('b2'), pg_temp.u('e5'), 'amici'), (pg_temp.u('c3'), pg_temp.u('f6'), 'amici');
insert into public.amministratori (utente) values (pg_temp.u('99'));
insert into public.archivio (isbn, dati) values ('9780000000002', '{"t":"Libro di prova zzqq","a":"Autore"}');

create temp table esito (n serial, prova text, avuto text, atteso text) on commit drop;
grant all on esito to anon, authenticated; grant usage on sequence esito_n_seq to anon, authenticated;
create function pg_temp.io(x text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(x), 'role', 'authenticated')::text, true); $$;
create function pg_temp.p(nome text, comando text, atteso text) returns void language plpgsql as $$
declare r text;
begin
  begin
    if comando ~* '^\s*with\s' then execute comando into r;       -- le scritture dirette vanno al primo livello
    else execute 'select (' || comando || ')::text' into r; end if;
  exception when others then r := 'ERR ' || sqlerrm; end;
  insert into esito (prova, avuto, atteso) values (nome, coalesce(r, 'NULL'), atteso);
end $$;
create function pg_temp.v(x text) returns boolean language sql immutable as $$ select coalesce(x, '') = '' $$;   -- funzione senza risultato andata a buon fine
create function pg_temp.chat_di(x text, y text) returns uuid language sql security definer as $$
  select c.id from public.chat c where c.tipo = 'due' and c.a = least(pg_temp.u(x), pg_temp.u(y)) and c.b = greatest(pg_temp.u(x), pg_temp.u(y)); $$;
create temp table memo (k text primary key, v text) on commit drop;
grant all on memo to authenticated;

-- ===== 1. sicurezza: tabelle chiuse, funzioni interne e dell'amministratore negate =====
set local role anon;
select pg_temp.p('1 anon legge messaggi', $q$ select count(*) from public.messaggi $q$, 'ERR permission denied for table messaggi');
select pg_temp.p('2 anon chiama chat_mie', $q$ public.chat_mie() $q$, 'ERR permission denied for function chat_mie');
reset role;
set local role authenticated;
select pg_temp.io('a1');
select pg_temp.p('3 utente legge messaggi', $q$ select count(*) from public.messaggi $q$, 'ERR permission denied for table messaggi');
select pg_temp.p('4 utente legge chat', $q$ select count(*) from public.chat $q$, 'ERR permission denied for table chat');
select pg_temp.p('5 utente legge blocchi', $q$ select count(*) from public.blocchi $q$, 'ERR permission denied for table blocchi');
select pg_temp.p('6 utente legge segnalazioni', $q$ select count(*) from public.segnalazioni $q$, 'ERR permission denied for table segnalazioni');
select pg_temp.p('7 utente legge amministratori', $q$ select count(*) from public.amministratori $q$, 'ERR permission denied for table amministratori');
do $$ declare c text; r text; male text := ''; n int := 0;
begin
  -- un utente normale chiama OGNI funzione dell'amministratore: tutte devono rispondere «non autorizzato»
  foreach c in array array[
    $q$ public.admin_segnalazioni() $q$, $q$ public.admin_segnalazioni('chiuse') $q$,
    $q$ public.admin_decidi(gen_random_uuid(), 'sospendi') $q$, $q$ public.admin_sospesi() $q$,
    $q$ public.admin_riattiva(pg_temp.u('a1')) $q$, $q$ public.admin_avviso('Titolo', 'Testo') $q$, $q$ public.admin_numeri() $q$,
    $q$ public.admin_archivio_cerca('zzqq') $q$, $q$ public.admin_archivio_salva('9780000000002', '{"t":"rovinato"}') $q$,
    $q$ public.admin_archivio_togli('9780000000002') $q$] loop
    begin execute 'select (' || c || ')::text' into r; male := male || c || ' RIUSCITA; ';
    exception when others then if sqlerrm = 'non autorizzato' and sqlstate = '42501' then n := n + 1; else male := male || c || ' ' || sqlerrm || '; '; end if; end;
  end loop;
  insert into esito (prova, avuto, atteso) values ('8 funzioni admin_* da utente normale', n || ' negate ' || male, '10 negate ');
  n := 0; male := '';
  foreach c in array array[
    $q$ public.e_admin(pg_temp.u('a1')) $q$, $q$ public.bloccati(pg_temp.u('a1'), pg_temp.u('b2')) $q$,
    $q$ public.chat_permesso(pg_temp.u('99'), pg_temp.u('b2')) $q$, $q$ public.chat_invia(pg_temp.u('99'), gen_random_uuid(), 'x', null, 'testo') $q$,
    $q$ public.chat_sistema(gen_random_uuid(), pg_temp.u('a1'), 'creato', null) $q$, $q$ public.blocca_interno(pg_temp.u('b2'), pg_temp.u('c3')) $q$,
    $q$ public.gruppo_capo(gen_random_uuid()) $q$, $q$ public.chat_riassunto() $q$, $q$ public.chat_pulizia() $q$,
    $q$ public.admin_controllo() $q$, $q$ public.avviso_importante('x', 'y') $q$, $q$ public.amici_di_amici(pg_temp.u('a1'), pg_temp.u('c3')) $q$] loop
    begin execute 'select (' || c || ')::text' into r; male := male || c || ' RIUSCITA; ';
    exception when insufficient_privilege then n := n + 1; when others then male := male || c || ' ' || sqlerrm || '; '; end;
  end loop;
  insert into esito (prova, avuto, atteso) values ('9 funzioni interne da utente normale', n || ' negate ' || male, '12 negate ');
end $$;
select pg_temp.p('10 utente si nomina amministratore', $q$ with x as (insert into public.amministratori (utente) values (pg_temp.u('a1')) returning 1) select count(*) from x $q$, 'ERR permission denied for table amministratori');
select pg_temp.p('11 admin_sono da utente normale', $q$ public.admin_sono() $q$, 'false');
select pg_temp.p('12 archivio intatto', $q$ public.da_archivio('9780000000002') ->> 't' $q$, 'Libro di prova zzqq');

-- ===== 2. chat tra amici =====
select pg_temp.p('13 A scrive a B (amici)', $q$ public.chat_scrivi_a(pg_temp.u('b2'), '  Ciao Bruno  ') ->> 'stato' $q$, 'attiva');
select pg_temp.p('14 messaggio vuoto', $q$ public.chat_scrivi_a(pg_temp.u('b2'), '   ') $q$, 'ERR messaggio vuoto');
select pg_temp.p('15 messaggio di 1001 caratteri', $q$ public.chat_scrivi_a(pg_temp.u('b2'), repeat('x', 1001)) $q$, 'ERR messaggio troppo lungo');
select pg_temp.p('16 A scrive a se stesso', $q$ public.chat_scrivi_a(pg_temp.u('a1'), 'eco') $q$, 'ERR non disponibile');
select pg_temp.p('17 libro: copertina da sito sconosciuto tolta', $q$ (select (m.libro ->> 't') || '/' || coalesce(m.libro ->> 'img', 'niente') || '/' || coalesce(m.libro ->> 'altro', 'niente')
    from jsonb_to_recordset(public.chat_leggi((public.chat_scrivi_a(pg_temp.u('b2'), 'leggilo', '{"t":"Il Gattopardo","img":"https://cattivo.example/x.png","altro":"x"}', 'libro') ->> 'chat')::uuid) -> 'messaggi') m(tipo text, libro jsonb) where m.tipo = 'libro') $q$, 'Il Gattopardo/niente/niente');
select pg_temp.io('b2');
select pg_temp.p('18 B: elenco e messaggi nuovi', $q$ (select string_agg(x.nome || ' ' || x.stato || ' nuovi=' || x.nuovi, ',') from jsonb_to_recordset(public.chat_mie()) x(nome text, stato text, nuovi int)) $q$, 'Anna prova attiva nuovi=2');
select pg_temp.p('19 B: chat_numeri', $q$ public.chat_numeri() $q$, '{"nuovi": 1, "richieste": 0}');
select pg_temp.p('20 B legge', $q$ (select jsonb_array_length(r -> 'messaggi') || ' ' || (r ->> 'scrivibile') || ' ' || (r -> 'messaggi' -> 0 ->> 'testo') from public.chat_leggi(pg_temp.chat_di('a1', 'b2')) r) $q$, '2 true Ciao Bruno');
select pg_temp.p('21 B: dopo la lettura niente di nuovo', $q$ public.chat_numeri() $q$, '{"nuovi": 0, "richieste": 0}');
select pg_temp.p('22 B cancella un messaggio di A', $q$ public.chat_elimina_messaggio((select min(id) from jsonb_to_recordset(public.chat_leggi(pg_temp.chat_di('a1', 'b2')) -> 'messaggi') m(id bigint))) $q$, 'ERR non si può più eliminare');
select pg_temp.io('c3');
select pg_temp.p('23 C legge la chat di A e B', $q$ public.chat_leggi(pg_temp.chat_di('a1', 'b2')) $q$, 'ERR non disponibile');
select pg_temp.io('a1');
select pg_temp.p('24 A cancella il suo (entro 1 ora)', $q$ (select pg_temp.v((public.chat_elimina_messaggio(min(m.id)))::text) from jsonb_to_recordset(public.chat_leggi(pg_temp.chat_di('a1', 'b2')) -> 'messaggi') m(id bigint)) $q$, 'true');
select pg_temp.p('25 al suo posto resta il segno, senza testo', $q$ (select (m.el) || '/' || m.testo || '/' from jsonb_to_recordset(public.chat_leggi(pg_temp.chat_di('a1', 'b2')) -> 'messaggi') m(id bigint, el boolean, testo text) order by m.id limit 1) $q$, 'true//');
reset role;
update public.messaggi set creato = now() - interval '2 hours' where chat = pg_temp.chat_di('a1', 'b2');
set local role authenticated;
select pg_temp.io('a1');
select pg_temp.p('26 dopo 1 ora non si cancella più', $q$ (select pg_temp.v((public.chat_elimina_messaggio(max(m.id)))::text) from jsonb_to_recordset(public.chat_leggi(pg_temp.chat_di('a1', 'b2')) -> 'messaggi') m(id bigint)) $q$, 'ERR non si può più eliminare');

-- ===== 3. richieste di messaggio a chi non è amico =====
select pg_temp.p('27 A → D (nessun amico in comune)', $q$ public.chat_posso(pg_temp.u('d4')) $q$, 'no');
select pg_temp.p('28 A scrive lo stesso a D', $q$ public.chat_scrivi_a(pg_temp.u('d4'), 'ciao') $q$, 'ERR non disponibile');
select pg_temp.p('29 A → C (amico di un amico)', $q$ public.chat_posso(pg_temp.u('c3')) $q$, 'richiesta');
select pg_temp.p('30 A manda la richiesta a C', $q$ public.chat_scrivi_a(pg_temp.u('c3'), 'Ciao Carla, sono amica di Bruno') ->> 'stato' $q$, 'attesa');
select pg_temp.p('31 secondo messaggio prima della risposta', $q$ public.chat_scrivi_a(pg_temp.u('c3'), 'ci sei?') $q$, 'ERR in attesa');
select pg_temp.p('32 A non può accettarsela da sola', $q$ public.chat_rispondi(pg_temp.chat_di('a1', 'c3'), true) $q$, 'ERR richiesta non trovata');
select pg_temp.io('c3');
select pg_temp.p('33 C vede la richiesta', $q$ (select string_agg(x.nome || ' ' || x.stato, ',') from jsonb_to_recordset(public.chat_mie()) x(nome text, stato text)) || ' ' || public.chat_numeri()::text $q$, 'Anna prova richiesta {"nuovi": 0, "richieste": 1}');
select pg_temp.p('34 C rifiuta', $q$ pg_temp.v((public.chat_rispondi(pg_temp.chat_di('a1', 'c3'), false))::text) $q$, 'true');
select pg_temp.p('35 C non la vede più', $q$ jsonb_array_length(public.chat_mie()) $q$, '0');
select pg_temp.io('a1');
select pg_temp.p('36 A non sa del rifiuto', $q$ (select string_agg(x.stato, ',') from jsonb_to_recordset(public.chat_mie()) x(nome text, stato text) where x.nome = 'Carla prova') || ' ' || public.chat_posso(pg_temp.u('c3')) $q$, 'attesa attesa');
reset role;
update public.chat set rifiutata_il = now() - interval '31 days' where id = pg_temp.chat_di('a1', 'c3');
set local role authenticated;
select pg_temp.io('a1');
select pg_temp.p('37 dopo 30 giorni A può riprovare', $q$ public.chat_posso(pg_temp.u('c3')) || ' ' || (public.chat_scrivi_a(pg_temp.u('c3'), 'Riprovo') ->> 'stato') $q$, 'richiesta attesa');
select pg_temp.io('c3');
select pg_temp.p('38 C rifiuta la seconda volta', $q$ pg_temp.v((public.chat_rispondi(pg_temp.chat_di('a1', 'c3'), false))::text) $q$, 'true');
reset role;
update public.chat set rifiutata_il = now() - interval '31 days' where id = pg_temp.chat_di('a1', 'c3');
set local role authenticated;
select pg_temp.io('a1');
select pg_temp.p('39 dopo il secondo rifiuto mai più', $q$ public.chat_posso(pg_temp.u('c3')) $q$, 'attesa');
select pg_temp.p('40 … e non può scrivere', $q$ public.chat_scrivi_a(pg_temp.u('c3'), 'ancora io') $q$, 'ERR in attesa');
select pg_temp.io('c3');
select pg_temp.p('41 C però può riaprire scrivendo lei', $q$ public.chat_scrivi_a(pg_temp.u('a1'), 'Ho cambiato idea') ->> 'stato' $q$, 'attiva');
select pg_temp.io('d4');
select pg_temp.p('42 D sceglie un valore non ammesso', $q$ with x as (update public.profili set scrivermi = 'nessuno' where id = pg_temp.u('d4') returning 1) select count(*) from x $q$, 'ERR new row for relation "profili" violates check constraint "profili_scrivermi_check"');
select pg_temp.p('43 D sceglie «tutti»', $q$ with x as (update public.profili set scrivermi = 'tutti' where id = pg_temp.u('d4') returning 1) select count(*) from x $q$, '1');
select pg_temp.io('a1');
select pg_temp.p('44 ora A può mandare la richiesta a D', $q$ public.chat_posso(pg_temp.u('d4')) || ' ' || (public.chat_scrivi_a(pg_temp.u('d4'), 'Ciao Dino') ->> 'stato') $q$, 'richiesta attesa');
select pg_temp.io('d4');
select pg_temp.p('45 D accetta', $q$ pg_temp.v((public.chat_rispondi(pg_temp.chat_di('a1', 'd4'), true))::text) $q$, 'true');
select pg_temp.io('a1');
select pg_temp.p('46 A e D si scrivono', $q$ (public.chat_scrivi_a(pg_temp.u('d4'), 'Grazie!') ->> 'stato') || ' ' || public.chat_posso(pg_temp.u('d4')) $q$, 'attiva si');
select pg_temp.io('e5');
do $$ declare i int; r text := ''; begin
  for i in 1 .. 16 loop
    begin perform public.chat_scrivi_a(pg_temp.u(lpad(i::text, 2, '0')), 'Ciao, ti va di parlare di libri?');
    exception when others then r := r || i || ': ' || sqlerrm; end;
  end loop;
  insert into esito (prova, avuto, atteso) values ('47 al massimo 15 richieste al giorno', r, '16: troppe richieste oggi');
end $$;
select pg_temp.io('01');
select pg_temp.p('48 chi riceve la richiesta risponde scrivendo: accettata', $q$ (public.chat_scrivi_a(pg_temp.u('e5'), 'Volentieri') ->> 'stato') $q$, 'attiva');

-- ===== 4. blocco completo =====
select pg_temp.io('b2');
select pg_temp.p('49 B blocca A', $q$ pg_temp.v((public.blocca(pg_temp.u('a1')))::text) $q$, 'true');
select pg_temp.p('50 B: elenco dei bloccati', $q$ (select string_agg(utente, ',') from public.bloccati_miei()) $q$, 'Anna prova');
select pg_temp.p('51 B non trova più A', $q$ (select count(*) from public.cerca_utenti('Anna')) $q$, '0');
select pg_temp.io('a1');
select pg_temp.p('52 A non trova più B', $q$ (select count(*) from public.cerca_utenti('Bruno')) $q$, '0');
select pg_temp.p('53 A chiede l''amicizia a B', $q$ public.chiedi_amicizia('Bruno prova') $q$, 'ERR utente non trovato');
select pg_temp.p('54 A non può scrivere a B', $q$ public.chat_posso(pg_temp.u('b2')) $q$, 'no');
select pg_temp.p('54b … e se ci prova', $q$ public.chat_scrivi_a(pg_temp.u('b2'), 'perché?') $q$, 'ERR non disponibile');
select pg_temp.p('55 la chat resta da leggere, non si scrive', $q$ (select jsonb_array_length(r -> 'messaggi') || ' ' || (r ->> 'stato') || ' ' || (r ->> 'scrivibile') from public.chat_leggi(pg_temp.chat_di('a1', 'b2')) r) $q$, '2 chiusa false');
select pg_temp.p('56 A non crea un gruppo con B', $q$ public.gruppo_crea('Trappola', array[pg_temp.u('b2')]) $q$, 'ERR non amici');
reset role;
select pg_temp.p('57 amicizia tolta, nessun avviso a nessuno', $q$ (select count(*) from public.amicizie f where pg_temp.u('a1') in (f.da, f.a)) || ' ' || (select count(*) from public.notifiche n where n.utente = pg_temp.u('a1') and n.da = pg_temp.u('b2')) $q$, '0 0');
set local role authenticated;
select pg_temp.io('b2');
select pg_temp.p('58 B toglie il blocco', $q$ pg_temp.v((public.blocca(pg_temp.u('a1'), false))::text) $q$, 'true');
select pg_temp.p('58b … e l''elenco è vuoto', $q$ (select count(*) from public.bloccati_miei()) $q$, '0');

-- ===== 5. gruppi =====
select pg_temp.p('59 B crea un gruppo con un non amico', $q$ public.gruppo_crea('Lettori', array[pg_temp.u('c3'), pg_temp.u('d4')]) $q$, 'ERR non amici');
select pg_temp.p('60 gruppo con più di 30 persone', $q$ public.gruppo_crea('Folla', array(select pg_temp.u(lpad(g::text, 2, '0')) from generate_series(1, 20) g) || array(select gen_random_uuid() from generate_series(1, 10))) $q$, 'ERR al massimo 30 persone');
select pg_temp.p('61 nome vuoto', $q$ public.gruppo_crea('   ', array[pg_temp.u('c3')]) $q$, 'ERR nome: da 1 a 40 caratteri');
do $$ declare g uuid; begin
  g := public.gruppo_crea('  Lettori   del lunedì ', array[pg_temp.u('c3'), pg_temp.u('e5'), pg_temp.u('c3')]);
  insert into memo values ('g', g::text);
end $$;
select pg_temp.p('62 B crea il gruppo con C ed E', $q$ (select count(*) || ' ' || string_agg(m.utente || case when m.capo then '*' else '' end, ',' order by m.utente) from jsonb_to_recordset(public.gruppo_membri((select v from memo where k = 'g')::uuid)) m(utente text, capo boolean)) $q$, '3 Bruno prova*,Carla prova,Elsa prova');
select pg_temp.io('c3');
select pg_temp.p('63 C scrive nel gruppo', $q$ public.chat_scrivi((select v from memo where k = 'g')::uuid, 'Che cosa leggiamo?') ->> 'stato' $q$, 'attiva');
select pg_temp.p('64 C aggiunge chi non è suo amico', $q$ public.gruppo_aggiungi((select v from memo where k = 'g')::uuid, pg_temp.u('d4')) $q$, 'ERR non amici');
select pg_temp.p('65 C aggiunge il suo amico F', $q$ pg_temp.v((public.gruppo_aggiungi((select v from memo where k = 'g')::uuid, pg_temp.u('f6')))::text) $q$, 'true');
select pg_temp.p('66 C toglie E (non è il creatore)', $q$ public.gruppo_togli((select v from memo where k = 'g')::uuid, pg_temp.u('e5')) $q$, 'ERR solo chi ha creato il gruppo');
select pg_temp.p('67 C cambia il nome (non è il creatore)', $q$ public.gruppo_nome((select v from memo where k = 'g')::uuid, 'Mio') $q$, 'ERR solo chi ha creato il gruppo');
select pg_temp.io('d4');
select pg_temp.p('68 D (fuori dal gruppo) legge', $q$ public.chat_leggi((select v from memo where k = 'g')::uuid) $q$, 'ERR non disponibile');
select pg_temp.p('69 D (fuori dal gruppo) scrive', $q$ public.chat_scrivi((select v from memo where k = 'g')::uuid, 'ci sono anch''io') $q$, 'ERR non disponibile');
select pg_temp.p('70 D (fuori dal gruppo) guarda i membri', $q$ public.gruppo_membri((select v from memo where k = 'g')::uuid) $q$, 'ERR non disponibile');
select pg_temp.io('e5');
select pg_temp.p('71 E vede il gruppo con i messaggi', $q$ (select string_agg(x.nome || ' membri=' || x.membri || ' nuovi=' || x.nuovi, ',') from jsonb_to_recordset(public.chat_mie()) x(tipo text, nome text, membri int, nuovi int) where x.tipo = 'gruppo') $q$, 'Lettori del lunedì membri=4 nuovi=3');
select pg_temp.io('f6');
select pg_temp.p('72 F vede solo da quando è entrato', $q$ (select string_agg(m.tipo || ':' || m.testo || ':' || m.su_nome, ',' order by m.id) from jsonb_to_recordset(public.chat_leggi((select v from memo where k = 'g')::uuid) -> 'messaggi') m(id bigint, tipo text, testo text, su_nome text)) $q$, 'sistema:aggiunto:Febo prova');
select pg_temp.p('73 F scrive', $q$ public.chat_scrivi((select v from memo where k = 'g')::uuid, 'Eccomi') ->> 'stato' $q$, 'attiva');
select pg_temp.p('74 F blocca C (suo amico)', $q$ pg_temp.v((public.blocca(pg_temp.u('c3')))::text) $q$, 'true');
select pg_temp.io('c3');
select pg_temp.p('75 C scrive ancora nel gruppo', $q$ public.chat_scrivi((select v from memo where k = 'g')::uuid, 'Propongo Calvino') ->> 'stato' $q$, 'attiva');
select pg_temp.p('76 C non vede il messaggio di F', $q$ (select m.nasc || '/' || m.testo || '/' from jsonb_to_recordset(public.chat_leggi((select v from memo where k = 'g')::uuid) -> 'messaggi') m(tipo text, nome text, nasc boolean, testo text) where m.nome = 'Febo prova' and m.tipo = 'testo') $q$, 'true//');
select pg_temp.io('f6');
select pg_temp.p('77 F non vede quello di C', $q$ (select string_agg(m.nasc || '/' || m.testo || '/', ',') from jsonb_to_recordset(public.chat_leggi((select v from memo where k = 'g')::uuid) -> 'messaggi') m(tipo text, nome text, nasc boolean, testo text) where m.nome = 'Carla prova' and m.tipo = 'testo') $q$, 'true//');
select pg_temp.p('78 F: nell''elenco l''ultimo visibile è il suo', $q$ (select string_agg(x.ultimo ->> 'testo', ',') from jsonb_to_recordset(public.chat_mie()) x(tipo text, ultimo jsonb) where x.tipo = 'gruppo') $q$, 'Eccomi');
select pg_temp.io('b2');
select pg_temp.p('79 B (creatore) toglie E e cambia il nome', $q$ (pg_temp.v((public.gruppo_togli((select v from memo where k = 'g')::uuid, pg_temp.u('e5')))::text)) || ' ' || (pg_temp.v((public.gruppo_nome((select v from memo where k = 'g')::uuid, 'Lettori'))::text)) $q$, 'true true');
select pg_temp.io('e5');
select pg_temp.p('80 E, tolta, non legge più', $q$ public.chat_leggi((select v from memo where k = 'g')::uuid) $q$, 'ERR non disponibile');
select pg_temp.io('b2');
select pg_temp.p('81 B esce', $q$ pg_temp.v((public.gruppo_esci((select v from memo where k = 'g')::uuid))::text) $q$, 'true');
select pg_temp.io('c3');
select pg_temp.p('82 il gruppo passa al più vecchio (C)', $q$ (select string_agg(m.utente || case when m.capo then '*' else '' end, ',' order by m.utente) from jsonb_to_recordset(public.gruppo_membri((select v from memo where k = 'g')::uuid)) m(utente text, capo boolean)) || ' ' || (pg_temp.v((public.gruppo_nome((select v from memo where k = 'g')::uuid, 'Lettori di Carla'))::text)) $q$, 'Carla prova*,Febo prova true');
select pg_temp.p('83 silenziare e «Elimina chat» (solo per sé)', $q$ (pg_temp.v((public.chat_silenzia((select v from memo where k = 'g')::uuid, true))::text)) || ' ' || (pg_temp.v((public.chat_elimina((select v from memo where k = 'g')::uuid))::text)) || ' ' || jsonb_array_length(public.chat_leggi((select v from memo where k = 'g')::uuid) -> 'messaggi') $q$, 'true true 0');
select pg_temp.io('f6');
select pg_temp.p('84 per F i messaggi ci sono ancora', $q$ jsonb_array_length(public.chat_leggi((select v from memo where k = 'g')::uuid) -> 'messaggi') > 3 $q$, 'true');

-- ===== 6. segnalazioni, stop automatico, amministratore =====
select pg_temp.io('99');
select pg_temp.p('85 Z (amministratore) scrive a D', $q$ public.chat_scrivi_a(pg_temp.u('d4'), 'Benvenuto in Next Libris') ->> 'stato' $q$, 'attesa');
select pg_temp.io('a1');
select pg_temp.p('86 A manda richieste a 02 e 03', $q$ (public.chat_scrivi_a(pg_temp.u('02'), 'messaggio sgradito') ->> 'stato') || ' ' || (public.chat_scrivi_a(pg_temp.u('03'), 'messaggio sgradito') ->> 'stato') $q$, 'attesa attesa');
select pg_temp.io('d4');
select pg_temp.p('87 D: l''amministratore non si segnala', $q$ (select pg_temp.v((public.segnala(max(m.id)))::text) from jsonb_to_recordset(public.chat_leggi(pg_temp.chat_di('99', 'd4')) -> 'messaggi') m(id bigint)) $q$, 'ERR non segnalabile');
select pg_temp.p('88 … ma ha il segno e si può bloccare', $q$ (select string_agg(x.nl::text, ',') from jsonb_to_recordset(public.chat_mie()) x(nome text, nl boolean) where x.nome = 'Zeta prova') || ' ' || public.next_libris(array[pg_temp.u('99'), pg_temp.u('a1')])::text || ' ' || (pg_temp.v((public.blocca(pg_temp.u('99')))::text)) $q$, 'true {00000000-0000-0000-0000-000000000099} true');
select pg_temp.p('89 D segnala un messaggio di A (con «Blocca anche»)', $q$ (select pg_temp.v((public.segnala(max(m.id), 'insistente'))::text) from jsonb_to_recordset(public.chat_leggi(pg_temp.chat_di('a1', 'd4')) -> 'messaggi') m(id bigint, nome text) where m.nome = 'Anna prova') $q$, 'true');
select pg_temp.p('90 D ha bloccato A', $q$ (select string_agg(utente, ',' order by utente) from public.bloccati_miei()) $q$, 'Anna prova,Zeta prova');
select pg_temp.p('91 D segnala un messaggio suo', $q$ (select pg_temp.v((public.segnala(max(m.id)))::text) from jsonb_to_recordset(public.chat_leggi(pg_temp.chat_di('a1', 'd4')) -> 'messaggi') m(id bigint, nome text) where m.nome = 'Dino prova') $q$, 'ERR non disponibile');
reset role;
insert into memo select 'mAD', max(m.id)::text from public.messaggi m where m.chat = pg_temp.chat_di('a1', 'd4') and m.da = pg_temp.u('a1');
set local role authenticated;
select pg_temp.io('c3');
select pg_temp.p('93 C segnala un messaggio di una chat non sua', $q$ public.segnala((select (v)::bigint from memo where k = 'mAD')) $q$, 'ERR non disponibile');
reset role;
select pg_temp.p('94 dopo 1 segnalazione nessuno stop; avviso all''amministratore', $q$ (select count(*) from public.sospesi) || ' ' || (select count(*) || ' ' || max(n.titolo) from public.notifiche n where n.utente = pg_temp.u('99') and n.tipo = 'segnalazione') $q$, '0 1 Anna prova');
set local role authenticated;
select pg_temp.io('02');
select pg_temp.p('95 02 segnala A senza bloccare', $q$ (select pg_temp.v((public.segnala(max(m.id), '', false))::text) from jsonb_to_recordset(public.chat_leggi(pg_temp.chat_di('a1', '02')) -> 'messaggi') m(id bigint)) || ' ' || (select count(*) from public.bloccati_miei()) $q$, 'true 0');
select pg_temp.p('96 la stessa segnalazione due volte non conta doppio', $q$ (select pg_temp.v((public.segnala(max(m.id), '', false))::text) from jsonb_to_recordset(public.chat_leggi(pg_temp.chat_di('a1', '02')) -> 'messaggi') m(id bigint)) $q$, 'true');
select pg_temp.io('03');
select pg_temp.p('97 03 segnala A: terza persona', $q$ (select pg_temp.v((public.segnala(max(m.id)))::text) from jsonb_to_recordset(public.chat_leggi(pg_temp.chat_di('a1', '03')) -> 'messaggi') m(id bigint)) $q$, 'true');
select pg_temp.io('a1');
select pg_temp.p('98 stop automatico: A non manda richieste nuove', $q$ public.chat_posso(pg_temp.u('04')) $q$, 'fermo');
select pg_temp.p('99 … e scrivendo riceve «fermo»', $q$ public.chat_scrivi_a(pg_temp.u('04'), 'ciao') $q$, 'ERR fermo');
select pg_temp.p('100 … ma le chat già accettate continuano', $q$ public.chat_scrivi_a(pg_temp.u('c3'), 'Grazie di aver risposto') ->> 'stato' $q$, 'attiva');
select pg_temp.p('101 A non sa di essere stata segnalata', $q$ (select count(*) from public.mie_notifiche() n where n.tipo = 'segnalazione') $q$, '0');
select pg_temp.io('99');
select pg_temp.p('102 Z: è amministratore, vede 3 casi con 3 persone e lo stop', $q$ public.admin_sono() || ' ' || (select count(*) || ' ' || max(s.persone) || ' ' || max(s.fermo) || ' ' || max(s.su_nome) || ' ' || max(jsonb_array_length(s.copia)) from jsonb_to_recordset(public.admin_segnalazioni()) s(id uuid, persone int, fermo text, su_nome text, copia jsonb)) $q$, 'true 3 3 fermo Anna prova 2');
select pg_temp.p('103 Z: «Va tutto bene» su un caso toglie lo stop', $q$ (select pg_temp.v((public.admin_decidi(s.id, 'bene'))::text) from jsonb_to_recordset(public.admin_segnalazioni()) s(id uuid, da_nome text) where s.da_nome = 'Utente 02') $q$, 'true');
select pg_temp.p('103b … nessuno più fermo', $q$ jsonb_array_length(public.admin_sospesi()) $q$, '0');
select pg_temp.io('a1');
select pg_temp.p('104 A può di nuovo mandare richieste', $q$ public.chat_posso(pg_temp.u('04')) $q$, 'richiesta');
select pg_temp.io('99');
select pg_temp.p('105 Z: «Tieni fermo»', $q$ (select pg_temp.v((public.admin_decidi(s.id, 'ferma'))::text) from jsonb_to_recordset(public.admin_segnalazioni()) s(id uuid, da_nome text) where s.da_nome = 'Utente 03') $q$, 'true');
select pg_temp.p('105b … A è ferma', $q$ public.admin_sospesi() -> 0 ->> 'tipo' $q$, 'fermo');
select pg_temp.p('106 Z: «Sospendi»', $q$ (select pg_temp.v((public.admin_decidi(s.id, 'sospendi'))::text) from jsonb_to_recordset(public.admin_segnalazioni()) s(id uuid, da_nome text) where s.da_nome = 'Dino prova') $q$, 'true');
select pg_temp.p('106b … A è sospesa; casi aperti 0, chiusi 3', $q$ (public.admin_sospesi() -> 0 ->> 'tipo') || ' ' || jsonb_array_length(public.admin_segnalazioni()) || ' ' || jsonb_array_length(public.admin_segnalazioni('chiuse')) $q$, 'sospeso 0 3');
select pg_temp.p('107 Z: esito inventato', $q$ public.admin_decidi(gen_random_uuid(), 'elimina') $q$, 'ERR esito non valido');
select pg_temp.io('a1');
select pg_temp.p('108 A sospesa: non scrive a nessuno', $q$ public.chat_posso(pg_temp.u('c3')) || ' ' || (public.chat_leggi(pg_temp.chat_di('a1', 'c3')) ->> 'scrivibile') $q$, 'sospeso false');
select pg_temp.p('109 … nemmeno nelle chat accettate', $q$ public.chat_scrivi_a(pg_temp.u('c3'), 'ci sei?') $q$, 'ERR sospeso');
select pg_temp.io('99');
select pg_temp.p('110 Z: «Riattiva»', $q$ pg_temp.v((public.admin_riattiva(pg_temp.u('a1')))::text) $q$, 'true');
select pg_temp.p('110b … nessun sospeso', $q$ jsonb_array_length(public.admin_sospesi()) $q$, '0');
select pg_temp.p('111 Z: numeri dell''app', $q$ (select (n ->> 'utenti')::int >= 27 and (n ->> 'spazio')::bigint > 0 and (n ->> 'segnalazioni') = '0' and (n ->> 'messaggi')::int > 10 and n ? 'attivi_mese' and n ? 'ricerche_oggi' from public.admin_numeri() n) $q$, 'true');
select pg_temp.p('112 Z: avviso importante a tutti', $q$ public.admin_avviso('Novità', 'Da oggi c''è la chat.') >= 27 $q$, 'true');
select pg_temp.p('113 Z: archivio, cerca', $q$ jsonb_array_length(public.admin_archivio_cerca('zzqq')) $q$, '1');
select pg_temp.p('113b Z: archivio, correggi (copertina da sito sconosciuto tolta)', $q$ pg_temp.v((public.admin_archivio_salva('9780000000002', '{"t":"Titolo giusto","img":"https://cattivo.example/x.png"}'))::text) $q$, 'true');
select pg_temp.p('113c … corretto', $q$ public.admin_archivio_cerca('9780000000002') -> 0 ->> 'dati' $q$, '{"t": "Titolo giusto"}');
select pg_temp.p('113d Z: archivio, togli', $q$ pg_temp.v((public.admin_archivio_togli('9780000000002'))::text) $q$, 'true');
select pg_temp.p('113e … tolto', $q$ jsonb_array_length(public.admin_archivio_cerca('9780000000002')) $q$, '0');
select pg_temp.io('a1');
select pg_temp.p('114 l''avviso dell''amministratore è arrivato', $q$ (select count(*) from public.mie_notifiche() n where n.tipo = 'avviso' and n.rif = 'Novità') $q$, '1');

-- ===== 7. riassunto, pulizia, push, account eliminato =====
select pg_temp.io('05');
select pg_temp.p('115 05 silenzia la chat con E', $q$ pg_temp.v((public.chat_silenzia(pg_temp.chat_di('e5', '05'), true))::text) $q$, 'true');
reset role;
delete from public.notifiche where tipo = 'messaggi';
select public.chat_riassunto();
select pg_temp.p('116 riassunto: uno per persona, con i numeri', $q$ (select count(*) || ' ' || max(n.rif) || ' ' || max(n.titolo) from public.notifiche n where n.utente = pg_temp.u('04') and n.tipo = 'messaggi') $q$, '1 1:1:1 Elsa prova');
select pg_temp.p('117 chat silenziata: niente', $q$ (select count(*) from public.notifiche n where n.utente = pg_temp.u('05') and n.tipo = 'messaggi') $q$, '0');
select pg_temp.p('118 chi ha già letto: niente', $q$ (select count(*) from public.notifiche n where n.utente = pg_temp.u('b2') and n.tipo = 'messaggi') $q$, '0');
select public.chat_riassunto();
select pg_temp.p('119 entro 2 ore non ne arriva un altro', $q$ (select max(c) from (select count(*) c from public.notifiche n where n.tipo = 'messaggi' group by n.utente) x) $q$, '1');
select pg_temp.p('120 gruppo push «chat», acceso di partenza', $q$ public.push_gruppo('messaggi') || ' ' || public.push_gruppo('segnalazione') || ' ' || (select column_default from information_schema.columns where table_name = 'push_preferenze' and column_name = 'tipi') $q$, 'chat avvisi ''{amicizie,prestiti,consigli,chiavi,chat}''::text[]');
set local role authenticated;
select pg_temp.io('04');
select pg_temp.p('121 04: preferenze push con la chat; legge la richiesta', $q$ (public.push_mie_preferenze() -> 'tipi')::text || ' ' || (public.chat_leggi(pg_temp.chat_di('e5', '04')) ->> 'stato') $q$, '["amicizie", "prestiti", "consigli", "chiavi", "chat"] richiesta');
select pg_temp.p('121b … l''avviso dei messaggi è spento', $q$ (select count(*) from public.mie_notifiche() n where n.tipo = 'messaggi' and not n.letta) $q$, '0');
reset role;
update public.messaggi set creato = now() - interval '7 months' where chat = pg_temp.chat_di('a1', 'b2');
update public.chat set ultimo = now() - interval '7 months' where id = pg_temp.chat_di('a1', 'b2');
select public.chat_pulizia();
select pg_temp.p('122 pulizia: via i messaggi di 6 mesi e la chat vuota', $q$ (select count(*) from public.messaggi m where m.creato < now() - interval '6 months') || ' ' || coalesce(pg_temp.chat_di('a1', 'b2')::text, 'tolta') $q$, '0 tolta');
delete from auth.users where id = pg_temp.u('d4');
select pg_temp.p('123 account eliminato: via le sue chat, blocchi e segnalazioni fatte restano senza nome', $q$ coalesce(pg_temp.chat_di('a1', 'd4')::text, 'tolta') || ' ' || (select count(*) from public.blocchi k where pg_temp.u('d4') in (k.chi, k.altro)) || ' ' || (select count(*) from public.segnalazioni g where g.su = pg_temp.u('a1') and g.da is null) $q$, 'tolta 0 1');
delete from auth.users where id = pg_temp.u('f6');
select pg_temp.p('124 account eliminato: nel gruppo i suoi messaggi restano senza nome', $q$ (select count(*) from public.messaggi m where m.chat = (select v from memo where k = 'g')::uuid and m.da is null and m.testo = 'Eccomi') || ' ' || (select count(*) from public.chat_membri z where z.chat = (select v from memo where k = 'g')::uuid) $q$, '1 1');

do $$ declare ok int; tot int; male text;
begin
  select count(*) filter (where avuto = atteso), count(*), coalesce(string_agg(n || ' ' || prova || ' → «' || avuto || '» (atteso «' || atteso || '»)', E'\n' order by n) filter (where avuto <> atteso), 'tutto bene')
    into ok, tot, male from esito;
  raise exception E'ESITO %/%\n%', ok, tot, male;
end $$;
rollback;
