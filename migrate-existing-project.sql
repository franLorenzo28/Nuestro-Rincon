-- Migra el proyecto Supabase de la versión individual a la versión compartida.
-- Conserva app_entries y game_results_legacy como archivo; no borra usuarios ni datos.
-- Ejecutar una vez en el SQL Editor del proyecto que ya tiene profiles/app_entries.

begin;

do $$
begin
  if to_regclass('public.app_entries') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.game_results') is null
     or to_regclass('public.earned_badges') is null then
    raise exception 'No se encontró el esquema individual esperado';
  end if;
  if to_regclass('public.pairs') is not null
     or to_regclass('public.pair_members') is not null
     or to_regclass('public.game_results_legacy') is not null then
    raise exception 'La migración ya se inició o el esquema no coincide';
  end if;
  if (select count(*) from auth.users) not between 1 and 2 then
    raise exception 'Se esperaba uno o dos usuarios existentes';
  end if;
  if (select count(*) from public.profiles) <> (select count(*) from auth.users) then
    raise exception 'Faltan perfiles para usuarios existentes';
  end if;
end;
$$;

create schema if not exists private;

create table public.pairs (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique check (length(invite_code) = 12),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.pair_members (
  pair_id uuid not null references public.pairs(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (pair_id,user_id)
);
create table public.shared_entries (
  pair_id uuid not null references public.pairs(id) on delete cascade,
  key text not null check (key ~ '^[a-zA-Z0-9_-]{1,100}$'),
  value jsonb not null,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (pair_id,key)
);
create table public.user_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (key ~ '^[a-zA-Z0-9_-]{1,100}$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id,key)
);

-- Los perfiles existentes son los dos integrantes del mismo rincón.
with created as (
  insert into public.pairs (invite_code,created_by)
  select upper(left(replace(gen_random_uuid()::text,'-',''),12)), id
  from public.profiles order by created_at,id limit 1
  returning id
)
insert into public.pair_members (pair_id,user_id)
select created.id, u.id from created cross join auth.users u;

-- Contenido compartido: conserva todos los elementos de las listas de ambos.
-- Las preferencias y resultados diarios siguen siendo individuales.
insert into public.shared_entries (pair_id,key,value,updated_by,updated_at)
select m.pair_id, items.key,
       jsonb_agg(items.element order by items.updated_at,items.user_id,items.ordinality),
       (array_agg(items.user_id order by items.updated_at desc))[1],
       max(items.updated_at)
from (
  select e.user_id,e.key,e.updated_at,x.element,x.ordinality
  from public.app_entries e
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(e.value)='array' then e.value else '[]'::jsonb end
  ) with ordinality as x(element,ordinality)
  where e.key ~ '^(todo|ver|metas|canciones|playlist|notas|caja|vis-[a-z]+)$'
    and jsonb_typeof(e.value)='array'
) items
join public.pair_members m on m.user_id=items.user_id
group by m.pair_id,items.key;

insert into public.user_entries (user_id,key,value,updated_at)
select user_id,key,value,updated_at from public.app_entries
where key !~ '^(todo|ver|metas|canciones|playlist|notas|caja|vis-[a-z]+)$'
  and key ~ '^[a-zA-Z0-9_-]{1,100}$';

-- Se archiva la tabla antigua entera antes de crear el formato nuevo.
alter table public.game_results rename to game_results_legacy;
alter table public.game_results_legacy rename constraint game_results_pkey to game_results_legacy_pkey;
revoke all on public.game_results_legacy from public,anon,authenticated;

create table public.game_results (
  pair_id uuid not null references public.pairs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null check (game in ('puzzle','misterio','memotest','caja','wordle','conex')),
  played_day date not null default (timezone('America/Montevideo', now())::date),
  score integer check (score is null or score between 0 and 100000),
  won boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (pair_id,user_id,game,played_day),
  foreign key (pair_id,user_id) references public.pair_members(pair_id,user_id) on delete cascade
);
create index nr_results_pair_game on public.game_results (pair_id,game,created_at desc);

insert into public.game_results (pair_id,user_id,game,played_day,score,won,created_at)
select m.pair_id,g.user_id,g.game,
       case when g.event_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            then g.event_key::date
            else timezone('America/Montevideo',g.created_at)::date end,
       g.score,g.won,g.created_at
from public.game_results_legacy g
join public.pair_members m on m.user_id=g.user_id;

create function private.my_pair_id() returns uuid language sql stable security definer
set search_path = '' as $$
  select m.pair_id from public.pair_members m where m.user_id=(select auth.uid()) limit 1
$$;
create function public.nr_create_pair() returns table(pair_id uuid,invite_code text)
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=auth.uid(); v_id uuid; v_code text;
begin
  if v_uid is null then raise exception 'Necesitás iniciar sesión'; end if;
  if exists(select 1 from public.pair_members where user_id=v_uid) then
    raise exception 'Ya pertenecés a un rincón';
  end if;
  v_code:=upper(left(replace(gen_random_uuid()::text,'-',''),12));
  insert into public.pairs(invite_code,created_by) values(v_code,v_uid) returning id into v_id;
  insert into public.pair_members(pair_id,user_id) values(v_id,v_uid);
  return query select v_id,v_code;
end;
$$;
create or replace function public.nr_join_pair(p_invite_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=auth.uid(); v_pair uuid;
begin
  if v_uid is null then raise exception 'Necesitás iniciar sesión'; end if;
  if exists(select 1 from public.pair_members where user_id=v_uid) then
    raise exception 'Ya pertenecés a un rincón';
  end if;
  select id into v_pair from public.pairs where invite_code=upper(btrim(p_invite_code)) for update;
  if v_pair is null then raise exception 'Código de invitación incorrecto'; end if;
  if (select count(*) from public.pair_members where pair_id=v_pair)>=2 then
    raise exception 'Este rincón ya tiene dos integrantes';
  end if;
  insert into public.pair_members(pair_id,user_id) values(v_pair,v_uid);
  return v_pair;
end;
$$;

create function private.award_badge(p_uid uuid,p_badge text) returns void
language plpgsql security definer set search_path = '' as $$
declare added integer;
begin
  insert into public.earned_badges(user_id,badge_code) values(p_uid,p_badge) on conflict do nothing;
  get diagnostics added=row_count;
  if added>0 then update public.profiles set points=points+10 where id=p_uid; end if;
end;
$$;
create function private.shared_change() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
  new.updated_at=now();
  if new.key='notas' and jsonb_typeof(new.value)='array' and jsonb_array_length(new.value)>0 then
    perform private.award_badge(new.updated_by,'primera_carta');
  end if;
  if (new.key='todo' or new.key like 'vis-%') and jsonb_typeof(new.value)='array'
     and jsonb_array_length(new.value)>0 then
    perform private.award_badge(new.updated_by,'primer_plan');
  end if;
  return new;
end;
$$;
create trigger nr_shared_saved before insert or update on public.shared_entries
for each row execute function private.shared_change();

create function private.keep_best_score() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
  if new.user_id<>old.user_id or new.pair_id<>old.pair_id or new.game<>old.game
     or new.played_day<>old.played_day then
    raise exception 'No se puede cambiar la identidad de la partida';
  end if;
  if old.score is not null and (new.score is null or new.score>old.score) then new.score=old.score; end if;
  new.created_at=old.created_at;
  return new;
end;
$$;
create trigger nr_best_result before update on public.game_results
for each row execute function private.keep_best_score();
create function private.on_game_won() returns trigger language plpgsql
security definer set search_path = '' as $$
declare earned integer;
begin
  if not new.won then return new; end if;
  earned:=case new.game
    when 'puzzle' then 30 when 'wordle' then 20 when 'conex' then 20
    when 'memotest' then 15 when 'misterio' then 10 when 'caja' then 5 else 0 end;
  update public.profiles set points=points+earned where id=new.user_id;
  perform private.award_badge(new.user_id,'primer_juego');
  perform private.award_badge(new.user_id,new.game);
  if (select count(distinct game) from public.game_results
      where user_id=new.user_id and won)>=3 then
    perform private.award_badge(new.user_id,'tres_juegos');
  end if;
  return new;
end;
$$;
create trigger nr_won after insert on public.game_results
for each row execute function private.on_game_won();

alter table public.pairs enable row level security;
alter table public.pair_members enable row level security;
alter table public.shared_entries enable row level security;
alter table public.user_entries enable row level security;
alter table public.game_results enable row level security;

drop policy if exists "Ver mi perfil" on public.profiles;
drop policy if exists "Ver mis logros" on public.earned_badges;
create policy "Perfiles solo de la pareja" on public.profiles for select to authenticated using (
  id=(select auth.uid()) or id in (
    select m.user_id from public.pair_members m where m.pair_id=(select private.my_pair_id()))
);
create policy "Ver insignias de la pareja" on public.earned_badges for select to authenticated using (
  user_id=(select auth.uid()) or user_id in (
    select m.user_id from public.pair_members m where m.pair_id=(select private.my_pair_id()))
);
create policy "Solo mi pareja" on public.pairs for select to authenticated
  using (id=(select private.my_pair_id()));
create policy "Solo miembros de mi rincón" on public.pair_members for select to authenticated
  using (pair_id=(select private.my_pair_id()));
create policy "Leer contenido compartido" on public.shared_entries for select to authenticated
  using (pair_id=(select private.my_pair_id()));
create policy "Añadir contenido compartido" on public.shared_entries for insert to authenticated
  with check (pair_id=(select private.my_pair_id()) and updated_by=(select auth.uid()));
create policy "Actualizar contenido compartido" on public.shared_entries for update to authenticated
  using (pair_id=(select private.my_pair_id()))
  with check (pair_id=(select private.my_pair_id()) and updated_by=(select auth.uid()));
create policy "Ver mis preferencias" on public.user_entries for select to authenticated
  using (user_id=(select auth.uid()));
create policy "Crear mis preferencias" on public.user_entries for insert to authenticated
  with check (user_id=(select auth.uid()));
create policy "Cambiar mis preferencias" on public.user_entries for update to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy "Ver resultados de la pareja" on public.game_results for select to authenticated
  using (pair_id=(select private.my_pair_id()));
create policy "Registrar mis resultados" on public.game_results for insert to authenticated
  with check (pair_id=(select private.my_pair_id()) and user_id=(select auth.uid()) and won=true);
create policy "Mejorar mi marca" on public.game_results for update to authenticated
  using (pair_id=(select private.my_pair_id()) and user_id=(select auth.uid()))
  with check (pair_id=(select private.my_pair_id()) and user_id=(select auth.uid()) and won=true);

revoke all on public.profiles,public.pairs,public.pair_members,public.shared_entries,
  public.user_entries,public.game_results,public.earned_badges from public,anon,authenticated;
grant select on public.pairs,public.pair_members,public.profiles,public.shared_entries,
  public.user_entries,public.game_results,public.earned_badges to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant insert,update on public.shared_entries,public.user_entries,public.game_results to authenticated;

revoke all on function private.my_pair_id(),private.award_badge(uuid,text),
  private.shared_change(),private.keep_best_score(),private.on_game_won()
  from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.my_pair_id() to authenticated;
revoke execute on function public.nr_create_pair(),public.nr_join_pair(text)
  from public,anon,authenticated;
grant execute on function public.nr_create_pair(),public.nr_join_pair(text) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['shared_entries','profiles','game_results','earned_badges'] loop
    if not exists(select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
