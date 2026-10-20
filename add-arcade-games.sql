-- Aplicar una vez en el proyecto existente antes de publicar Tatetí y Vivorita.
-- Conserva los perfiles, resultados y logros actuales.
begin;

do $$
begin
  if to_regclass('public.game_results') is null
     or to_regclass('public.earned_badges') is null then
    raise exception 'Primero hay que crear o migrar el esquema de Nuestro Rincón';
  end if;
end;
$$;

alter table public.game_results drop constraint if exists game_results_game_check;
alter table public.game_results add constraint game_results_game_check
  check (game in ('puzzle','misterio','memotest','caja','wordle','conex','tateti','snake'));

alter table public.earned_badges drop constraint if exists earned_badges_badge_code_check;
alter table public.earned_badges add constraint earned_badges_badge_code_check
  check (badge_code in ('primera_carta','primer_plan','primer_juego','puzzle',
    'wordle','conex','memotest','misterio','tateti','snake','caja','tres_juegos'));

create or replace function private.keep_best_score() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
  if new.user_id<>old.user_id or new.pair_id<>old.pair_id or new.game<>old.game
     or new.played_day<>old.played_day then
    raise exception 'No se puede cambiar la identidad de la partida';
  end if;
  if old.score is not null and (new.score is null or
     (new.game='snake' and new.score<old.score) or
     (new.game<>'snake' and new.score>old.score)) then new.score=old.score; end if;
  new.created_at=old.created_at;
  return new;
end;
$$;

create or replace function private.on_game_won() returns trigger language plpgsql
security definer set search_path = '' as $$
declare earned integer;
begin
  if not new.won then return new; end if;
  earned:=case new.game
    when 'puzzle' then 30 when 'wordle' then 20 when 'conex' then 20
    when 'memotest' then 15 when 'misterio' then 10
    when 'tateti' then 10 when 'snake' then 10 when 'caja' then 5 else 0 end;
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

revoke execute on function private.keep_best_score(),private.on_game_won()
  from public,anon,authenticated;

commit;
