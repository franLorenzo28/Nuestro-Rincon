-- Nuestro Rincón: ejecutar una sola vez en Supabase > SQL Editor.
-- Crea cuentas/perfiles, sincronización por usuario y premios cosméticos.
-- Pensado para un proyecto NUEVO de Supabase. No pegar sobre un esquema existente
-- que ya tenga tablas llamadas profiles, app_entries, earned_badges o game_results.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Jugador' check (char_length(display_name) between 1 and 30),
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now()
);

create table public.app_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (char_length(key) between 1 and 100),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id,key)
);

create table public.game_results (
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null check (game in ('puzzle','misterio','memotest','caja','wordle','conex')),
  event_key text not null check (
    (game in ('puzzle','misterio','caja') and event_key = 'primera-vez')
    or (game in ('wordle','conex','memotest') and event_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
  ),
  score integer check (score is null or score >= 0),
  won boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id,game,event_key)
);

create table public.earned_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_code text not null check (badge_code in (
    'primera_carta','primer_plan','primer_juego','puzzle','wordle',
    'conex','memotest','misterio','caja','tres_juegos')),
  created_at timestamptz not null default now(),
  primary key (user_id,badge_code)
);

-- Evitar acceso anónimo. Las vistas no se usan; cada tabla tiene RLS.
alter table public.profiles enable row level security;
alter table public.app_entries enable row level security;
alter table public.game_results enable row level security;
alter table public.earned_badges enable row level security;

revoke all on public.profiles, public.app_entries, public.game_results, public.earned_badges from public,anon,authenticated;
grant select on public.profiles to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant select,insert,update,delete on public.app_entries to authenticated;
grant select,insert on public.game_results to authenticated;
grant select on public.earned_badges to authenticated;

create policy "Ver mi perfil" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "Editar mi nombre" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Leer mi contenido" on public.app_entries for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Crear mi contenido" on public.app_entries for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Actualizar mi contenido" on public.app_entries for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Eliminar mi contenido" on public.app_entries for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Ver mis partidas" on public.game_results for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Guardar mis partidas" on public.game_results for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Ver mis logros" on public.earned_badges for select to authenticated
  using (user_id = (select auth.uid()));

-- Un perfil se crea automáticamente al registrarse.
create function public.nr_handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,display_name)
  values (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'),''),'Jugador'),30));
  return new;
end;
$$;
create trigger nr_on_user_created after insert on auth.users
  for each row execute function public.nr_handle_new_user();

-- Función interna: añade una insignia una vez y suma 10 puntos una vez.
create function public.nr_award_badge(p_user uuid, p_badge text)
returns void language plpgsql security definer set search_path = '' as $$
declare inserted_count integer;
begin
  insert into public.earned_badges(user_id,badge_code)
    values (p_user,p_badge) on conflict do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count > 0 then
    update public.profiles set points=points+10 where id=p_user;
  end if;
end;
$$;

-- Primer plan y primera carta: la propia base reconoce los cambios de datos.
create function public.nr_on_entry_saved()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.key = 'notas' and jsonb_typeof(new.value) = 'array' and jsonb_array_length(new.value) > 0 then
    perform public.nr_award_badge(new.user_id,'primera_carta');
  end if;
  if new.key = 'todo' and jsonb_typeof(new.value) = 'array' and jsonb_array_length(new.value) > 0 then
    perform public.nr_award_badge(new.user_id,'primer_plan');
  end if;
  new.updated_at = now();
  return new;
end;
$$;
create trigger nr_saved_entry before insert or update on public.app_entries
  for each row execute function public.nr_on_entry_saved();

-- Puntos por victoria + insignias. Solo la primera inserción de cada partida
-- cuenta; game_results usa PK para evitar dar puntos de nuevo por duplicados.
create function public.nr_on_game_won()
returns trigger language plpgsql security definer set search_path = '' as $$
declare extra_points integer;
begin
  if not new.won then return new; end if;
  extra_points := case new.game
    when 'puzzle' then 30 when 'wordle' then 20 when 'conex' then 20
    when 'memotest' then 15 when 'misterio' then 10 when 'caja' then 5 else 0 end;
  update public.profiles set points=points+extra_points where id=new.user_id;
  perform public.nr_award_badge(new.user_id,'primer_juego');
  perform public.nr_award_badge(new.user_id,new.game);
  if (select count(distinct game) from public.game_results
      where user_id=new.user_id and won) >= 3 then
    perform public.nr_award_badge(new.user_id,'tres_juegos');
  end if;
  return new;
end;
$$;
create trigger nr_game_won after insert on public.game_results
  for each row execute function public.nr_on_game_won();

-- Las funciones de triggers no están disponibles como RPC público.
revoke all on function public.nr_handle_new_user() from public,anon,authenticated;
revoke all on function public.nr_award_badge(uuid,text) from public,anon,authenticated;
revoke all on function public.nr_on_entry_saved() from public,anon,authenticated;
revoke all on function public.nr_on_game_won() from public,anon,authenticated;