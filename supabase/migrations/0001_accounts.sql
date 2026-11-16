-- Stage 3: accounts, characters, resident numbers.
-- Applied to the project on 2026-11-16 and tested there (see docs/DECISIONS.md, decision 33).
--
-- Rules of this schema:
--   * The client never writes tables directly. It calls the functions below.
--   * Every number that is a game rule lives in `settings`, not in code.
--   * Row level security is on for every table.

-- ---------------------------------------------------------------- settings
create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
create policy "settings are readable by everyone" on public.settings for select using (true);

insert into public.settings (key, value) values
  ('min_age', '13'),        -- youngest age allowed to play (decision 11)
  ('adult_age', '18'),      -- below this: restricted chat (decision 6)
  ('name_min', '3'),
  ('name_max', '16');

-- ---------------------------------------------------------------- profiles
-- One row per player. `resident_no` is the permanent arrival number ("Resident #0047").
create sequence public.resident_no_seq start 1;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  birth_year smallint not null,
  locale text not null default 'tr' check (locale in ('tr', 'en')),
  resident_no integer not null unique,
  instagram text,
  arrived_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
-- A player reads their own full row. Other players are seen through `public_profiles`.
create policy "own profile is readable" on public.profiles for select using (auth.uid() = id);

-- What everyone may see about a player: no birth year.
create view public.public_profiles with (security_invoker = off) as
  select id, display_name, resident_no, arrived_at from public.profiles;
grant select on public.public_profiles to anon, authenticated;

-- ---------------------------------------------------------------- characters
-- The look is a handful of small indexes (see src/world/looks.ts).
create table public.characters (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  look jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.characters enable row level security;
create policy "characters are readable by everyone" on public.characters for select using (true);

-- ---------------------------------------------------------------- helpers
create function public.setting_int(p_key text) returns integer
language sql stable as $$
  select (value #>> '{}')::integer from public.settings where key = p_key;
$$;

-- Keeps only the known fields of a look, each as a small non-negative integer.
-- The client decides what an index means; the server only refuses nonsense.
create function public.clean_look(p_look jsonb) returns jsonb
language plpgsql immutable as $$
declare
  field text;
  result jsonb := '{}'::jsonb;
  n integer;
begin
  foreach field in array array['skin', 'hair', 'hairStyle', 'top', 'bottom', 'shoes', 'accessory'] loop
    if jsonb_typeof(p_look -> field) = 'number' then
      n := (p_look ->> field)::integer;
      if n between 0 and 63 then
        result := result || jsonb_build_object(field, n);
        continue;
      end if;
    end if;
    result := result || jsonb_build_object(field, 0);
  end loop;
  return result;
end;
$$;

create function public.clean_name(p_name text) returns text
language plpgsql stable as $$
declare
  cleaned text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if char_length(cleaned) < public.setting_int('name_min')
     or char_length(cleaned) > public.setting_int('name_max')
     or cleaned !~ '^[[:alnum:] ._-]+$' then
    raise exception 'invalid_name';
  end if;
  return cleaned;
end;
$$;

-- ---------------------------------------------------------------- arrive
-- Called once, right after sign-up: creates the profile, hands out the next
-- resident number and stores the character. Calling it again returns the existing number.
create function public.arrive(p_name text, p_birth_year integer, p_locale text, p_look jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  existing integer;
  new_no integer;
begin
  if me is null then
    raise exception 'not_signed_in';
  end if;
  select resident_no into existing from profiles where id = me;
  if existing is not null then
    return existing;
  end if;
  if p_birth_year is null
     or extract(year from now())::integer - p_birth_year < setting_int('min_age')
     or p_birth_year < 1900 then
    raise exception 'too_young';
  end if;

  new_no := nextval('resident_no_seq');
  insert into profiles (id, display_name, birth_year, locale, resident_no)
  values (me, clean_name(p_name), p_birth_year, case when p_locale in ('tr', 'en') then p_locale else 'tr' end, new_no);
  insert into characters (profile_id, look) values (me, clean_look(p_look));
  return new_no;
end;
$$;

-- ---------------------------------------------------------------- save_character
create function public.save_character(p_name text, p_look jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not_signed_in';
  end if;
  update profiles set display_name = clean_name(p_name) where id = me;
  if not found then
    raise exception 'no_profile';
  end if;
  update characters set look = clean_look(p_look), updated_at = now() where profile_id = me;
end;
$$;

revoke all on function public.arrive(text, integer, text, jsonb) from public, anon;
revoke all on function public.save_character(text, jsonb) from public, anon;
grant execute on function public.arrive(text, integer, text, jsonb) to authenticated;
grant execute on function public.save_character(text, jsonb) to authenticated;
