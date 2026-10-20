-- NUESTRO RINCÓN — versión colaborativa en vivo.
-- Ejecutar UNA VEZ en un proyecto Supabase NUEVO (sin las tablas originales del ZIP previo).
-- Mantener este archivo para referencia; los cambios a tablas existentes requieren migración aparte.

create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Jugador' check (char_length(display_name) between 1 and 30),
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now()
);
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
  primary key(pair_id,user_id)
);
create table public.shared_entries (
  pair_id uuid not null references public.pairs(id) on delete cascade,
  key text not null check (key ~ '^[a-zA-Z0-9_-]{1,100}$'),
  value jsonb not null,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key(pair_id,key)
);
create table public.user_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (key ~ '^[a-zA-Z0-9_-]{1,100}$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key(user_id,key)
);
create table public.game_results (
  pair_id uuid not null references public.pairs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null check (game in ('puzzle','misterio','memotest','caja','wordle','conex','tateti','snake')),
  played_day date not null default (timezone('America/Montevideo', now())::date),
  score integer check (score is null or score between 0 and 100000),
  won boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (pair_id,user_id,game,played_day),
  foreign key(pair_id,user_id) references public.pair_members(pair_id,user_id) on delete cascade
);
create index nr_results_pair_game on public.game_results (pair_id,game,created_at desc);
create table public.earned_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_code text not null check (badge_code in (
    'primera_carta','primer_plan','primer_juego','puzzle','wordle',
    'conex','memotest','misterio','tateti','snake','caja','tres_juegos')),
  created_at timestamptz not null default now(),
  primary key(user_id,badge_code)
);

-- Identifica el rincón propio sin depender de políticas RLS recursivas.
create function private.my_pair_id() returns uuid language sql stable security definer
set search_path = '' as $$
  select m.pair_id from public.pair_members m where m.user_id = (select auth.uid()) limit 1
$$;
revoke all on function private.my_pair_id() from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.my_pair_id() to authenticated;

alter table public.profiles enable row level security;
alter table public.pairs enable row level security;
alter table public.pair_members enable row level security;
alter table public.shared_entries enable row level security;
alter table public.user_entries enable row level security;
alter table public.game_results enable row level security;
alter table public.earned_badges enable row level security;

revoke all on public.profiles,public.pairs,public.pair_members,public.shared_entries,
 public.user_entries,public.game_results,public.earned_badges from public,anon,authenticated;
grant select on public.pairs,public.pair_members,public.profiles,public.shared_entries,
 public.user_entries,public.game_results,public.earned_badges to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant insert,update on public.shared_entries,public.user_entries,public.game_results to authenticated;

create policy "Perfiles solo de la pareja" on public.profiles for select to authenticated using (
 id = (select auth.uid()) or id in (
 select m.user_id from public.pair_members m where m.pair_id = (select private.my_pair_id()))
);
create policy "Editar mi nombre" on public.profiles for update to authenticated
 using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "Solo mi pareja" on public.pairs for select to authenticated
 using (id = (select private.my_pair_id()));
create policy "Solo miembros de mi rincón" on public.pair_members for select to authenticated
 using (pair_id = (select private.my_pair_id()));
create policy "Leer contenido compartido" on public.shared_entries for select to authenticated
 using (pair_id = (select private.my_pair_id()));
create policy "Añadir contenido compartido" on public.shared_entries for insert to authenticated
 with check (pair_id = (select private.my_pair_id()) and updated_by = (select auth.uid()));
create policy "Actualizar contenido compartido" on public.shared_entries for update to authenticated
 using (pair_id = (select private.my_pair_id()))
 with check (pair_id = (select private.my_pair_id()) and updated_by = (select auth.uid()));
create policy "Ver mis preferencias" on public.user_entries for select to authenticated
 using (user_id = (select auth.uid()));
create policy "Crear mis preferencias" on public.user_entries for insert to authenticated
 with check (user_id = (select auth.uid()));
create policy "Cambiar mis preferencias" on public.user_entries for update to authenticated
 using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Ver resultados de la pareja" on public.game_results for select to authenticated
 using (pair_id = (select private.my_pair_id()));
create policy "Registrar mis resultados" on public.game_results for insert to authenticated
 with check (pair_id = (select private.my_pair_id()) and user_id = (select auth.uid()) and won = true);
create policy "Mejorar mi marca" on public.game_results for update to authenticated
 using (pair_id = (select private.my_pair_id()) and user_id = (select auth.uid()))
 with check (pair_id = (select private.my_pair_id()) and user_id = (select auth.uid()) and won = true);
create policy "Ver insignias de la pareja" on public.earned_badges for select to authenticated
 using (user_id = (select auth.uid()) or user_id in (
 select m.user_id from public.pair_members m where m.pair_id = (select private.my_pair_id())));

-- Las RPC en public quedan expuestas al API, pero verifican la identidad y solo
-- permiten crear un rincón propio o entrar con el código secreto de invitación.
create function public.nr_create_pair() returns table(pair_id uuid, invite_code text)
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_code text;
begin
  if v_uid is null then raise exception 'Necesitás iniciar sesión'; end if;
  if exists(select 1 from public.pair_members where user_id = v_uid) then
    raise exception 'Ya pertenecés a un rincón';
  end if;
  v_code := upper(left(replace(gen_random_uuid()::text,'-',''),12));
  insert into public.pairs(invite_code,created_by) values(v_code,v_uid) returning id into v_id;
  insert into public.pair_members(pair_id,user_id) values(v_id,v_uid);
  return query select v_id,v_code;
end;
$$;
create function public.nr_join_pair(p_invite_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_pair uuid;
begin
  if v_uid is null then raise exception 'Necesitás iniciar sesión'; end if;
  if exists(select 1 from public.pair_members where user_id = v_uid) then
    raise exception 'Ya pertenecés a un rincón';
  end if;
  select id into v_pair from public.pairs
    where invite_code = upper(btrim(p_invite_code)) for update;
  if v_pair is null then raise exception 'Código de invitación incorrecto'; end if;
  if (select count(*) from public.pair_members where pair_id=v_pair) >= 2 then
    raise exception 'Este rincón ya tiene dos integrantes';
  end if;
  insert into public.pair_members(pair_id,user_id) values(v_pair,v_uid);
  return v_pair;
end;
$$;
revoke execute on function public.nr_create_pair() from public,anon,authenticated;
revoke execute on function public.nr_join_pair(text) from public,anon,authenticated;
grant execute on function public.nr_create_pair(),public.nr_join_pair(text) to authenticated;

-- Perfil nuevo al registrar la cuenta.
create function private.on_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,display_name) values(
 new.id,left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''),'Jugador'),30));
 return new;
end;
$$;
create trigger nr_user_created after insert on auth.users
 for each row execute function private.on_new_user();

-- Puntos y logros siempre gestionados en SQL, nunca con updates directos del cliente.
create function private.award_badge(p_uid uuid,p_badge text) returns void
language plpgsql security definer set search_path = '' as $$
declare added int;
begin
 insert into public.earned_badges(user_id,badge_code) values(p_uid,p_badge)
 on conflict do nothing;
 get diagnostics added = row_count;
 if added>0 then update public.profiles set points=points+10 where id=p_uid; end if;
end;
$$;
create function private.shared_change() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
 new.updated_at = now();
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

-- No permitir modificar identidad, fecha o puntuación a peor vía UPSERT.
create function private.keep_best_score() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
 if new.user_id<>old.user_id or new.pair_id<>old.pair_id or new.game<>old.game
    or new.played_day<>old.played_day then raise exception 'No se puede cambiar la identidad de la partida'; end if;
 if old.score is not null and (new.score is null or
    (new.game='snake' and new.score<old.score) or
    (new.game<>'snake' and new.score>old.score)) then new.score=old.score; end if;
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
 earned := case new.game
 when 'puzzle' then 30 when 'wordle' then 20 when 'conex' then 20
 when 'memotest' then 15 when 'misterio' then 10
 when 'tateti' then 10 when 'snake' then 10 when 'caja' then 5 else 0 end;
 update public.profiles set points=points+earned where id=new.user_id;
 perform private.award_badge(new.user_id,'primer_juego');
 perform private.award_badge(new.user_id,new.game);
 if (select count(distinct game) from public.game_results
     where user_id=new.user_id and won) >= 3 then
   perform private.award_badge(new.user_id,'tres_juegos');
 end if;
 return new;
end;
$$;
create trigger nr_won after insert on public.game_results
 for each row execute function private.on_game_won();

revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.my_pair_id() to authenticated;

-- Por defecto no todas las tablas emiten cambios; activar Realtime explícitamente.
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
