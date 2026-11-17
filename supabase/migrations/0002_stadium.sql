-- The stadium: entry by ticket code, seats by arrival order, chat.
--
-- How it works:
--   * The owner makes ticket codes (make_tickets) and sends one to each person.
--   * A visitor opens the game; the game signs them in anonymously (no e-mail, no password).
--   * They enter their code (check_ticket), pick a birth year and make a character,
--     then redeem() claims the code and gives them the next fan number. Fan number N sits
--     in the N-th best seat; the seat order is fixed in the game (src/stadium/layout.ts).
--   * Only fans can chat. Under-18s may only send the ready-made phrases.
--
-- Additive: nothing from 0001 is removed. The old arrive() is closed, since a seat now needs a code.

-- ---------------------------------------------------------------- settings
insert into public.settings (key, value) values
  ('capacity', '50000'),
  ('chat_max_length', '200'),
  ('chat_min_seconds', '2'),
  ('chat_per_minute', '15'),
  ('ticket_attempts_per_10min', '10')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- tickets
create table public.tickets (
  code text primary key,
  created_at timestamptz not null default now(),
  -- For the owner's own bookkeeping, e.g. who the code was sent to. Never shown in the game.
  note text,
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz
);
alter table public.tickets enable row level security;
-- No policies: tickets are never readable or writable through the API, only through the functions below.

create table public.ticket_attempts (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index ticket_attempts_by_user on public.ticket_attempts (user_id, at);
alter table public.ticket_attempts enable row level security;

-- Codes look like K7MQ-2PXA: 8 characters from an alphabet without look-alikes (no 0/O, 1/I/L).
create function public.normalize_code(p_code text) returns text
language sql immutable as $$
  select case when char_length(c) = 8 then substr(c, 1, 4) || '-' || substr(c, 5, 4) else c end
  from (select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) as c) s;
$$;

-- For the owner, in the SQL editor: select * from make_tickets(100);
create function public.make_tickets(p_count integer, p_note text default null) returns setof text
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea;
  raw text;
  i integer;
  k integer;
begin
  for i in 1..p_count loop
    loop
      bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
      raw := '';
      for k in 0..7 loop
        raw := raw || substr(alphabet, 1 + (get_byte(bytes, k) % char_length(alphabet)), 1);
      end loop;
      begin
        insert into tickets (code, note) values (normalize_code(raw), p_note);
        exit;
      exception when unique_violation then
        -- astronomically rare; just draw again
      end;
    end loop;
    return next normalize_code(raw);
  end loop;
end;
$$;
revoke all on function public.make_tickets(integer, text) from public, anon, authenticated;

-- Counts this attempt and says whether the caller has tried too often lately.
create function public.too_many_attempts(p_user uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  recent integer;
begin
  select count(*) into recent from ticket_attempts where user_id = p_user and at > now() - interval '10 minutes';
  insert into ticket_attempts (user_id) values (p_user);
  return recent >= setting_int('ticket_attempts_per_10min');
end;
$$;
revoke all on function public.too_many_attempts(uuid) from public, anon, authenticated;

-- 'ok', 'invalid', 'used', 'too_many', 'full' or 'not_signed_in'. Does not claim anything.
create function public.check_ticket(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  owner uuid;
  found_code boolean;
begin
  if me is null then
    return 'not_signed_in';
  end if;
  if too_many_attempts(me) then
    return 'too_many';
  end if;
  select true, claimed_by into found_code, owner from tickets where code = normalize_code(p_code);
  if not coalesce(found_code, false) then
    return 'invalid';
  end if;
  if owner is not null and owner <> me then
    return 'used';
  end if;
  if (select count(*) from profiles) >= setting_int('capacity') then
    return 'full';
  end if;
  return 'ok';
end;
$$;
revoke all on function public.check_ticket(text) from public, anon;
grant execute on function public.check_ticket(text) to authenticated;

-- ---------------------------------------------------------------- fans
-- What everyone may see about a fan: number (= seat), name and look. Never the birth year.
create table public.fans (
  fan_no integer primary key,
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  display_name text not null,
  look jsonb not null,
  joined_at timestamptz not null default now()
);
alter table public.fans enable row level security;
create policy "fans are readable by everyone" on public.fans for select using (true);

-- Takes the seat: claims the code and gives the next fan number. Returns a small JSON answer:
-- {"ok": true, "fan_no": 47} or {"ok": false, "error": "..."}.
create function public.redeem(p_code text, p_name text, p_birth_year integer, p_locale text, p_look jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  existing integer;
  owner uuid;
  found_code boolean;
  next_no integer;
  clean text;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;
  select fan_no into existing from fans where profile_id = me;
  if existing is not null then
    return jsonb_build_object('ok', true, 'fan_no', existing);
  end if;
  if too_many_attempts(me) then
    return jsonb_build_object('ok', false, 'error', 'too_many');
  end if;
  if p_birth_year is null or p_birth_year < 1900
     or extract(year from now())::integer - p_birth_year < setting_int('min_age') then
    return jsonb_build_object('ok', false, 'error', 'too_young');
  end if;
  begin
    clean := clean_name(p_name);
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'invalid_name');
  end;

  -- One arrival at a time, so fan numbers have no gaps and no two people get the same seat.
  perform pg_advisory_xact_lock(4747);
  select true, claimed_by into found_code, owner from tickets where code = normalize_code(p_code) for update;
  if not coalesce(found_code, false) then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if owner is not null and owner <> me then
    return jsonb_build_object('ok', false, 'error', 'used');
  end if;
  select coalesce(max(fan_no), 0) + 1 into next_no from fans;
  if next_no > setting_int('capacity') then
    return jsonb_build_object('ok', false, 'error', 'full');
  end if;

  update tickets set claimed_by = me, claimed_at = now() where code = normalize_code(p_code);
  insert into profiles (id, display_name, birth_year, locale, resident_no)
  values (me, clean, p_birth_year, case when p_locale in ('tr', 'en') then p_locale else 'tr' end, next_no);
  insert into fans (fan_no, profile_id, display_name, look) values (next_no, me, clean, clean_look(p_look));
  return jsonb_build_object('ok', true, 'fan_no', next_no);
end;
$$;
revoke all on function public.redeem(text, text, integer, text, jsonb) from public, anon;
grant execute on function public.redeem(text, text, integer, text, jsonb) to authenticated;

-- A seat now needs a code: the open arrival from 0001 is closed.
revoke execute on function public.arrive(text, integer, text, jsonb) from authenticated;

-- Changing name or look keeps the seat.
create or replace function public.save_character(p_name text, p_look jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  clean text;
begin
  if me is null then
    raise exception 'not_signed_in';
  end if;
  clean := clean_name(p_name);
  update profiles set display_name = clean where id = me;
  if not found then
    raise exception 'no_profile';
  end if;
  update fans set display_name = clean, look = clean_look(p_look) where profile_id = me;
end;
$$;

-- ---------------------------------------------------------------- chat
create table public.chat_presets (key text primary key);
alter table public.chat_presets enable row level security;
create policy "presets are readable by everyone" on public.chat_presets for select using (true);
insert into public.chat_presets (key) values
  ('hello'), ('goal'), ('letsgo'), ('welcome'), ('great'), ('thanks'),
  ('ball'), ('party'), ('clap'), ('fire'), ('heart'), ('laugh'), ('wave');

-- Words replaced with *** in free text. Extend this table to tighten the filter; no code change needed.
create table public.word_filters (word text primary key);
alter table public.word_filters enable row level security;
insert into public.word_filters (word) values
  ('amk'), ('aq'), ('amına'), ('orospu'), ('piç'), ('siktir'), ('sikerim'), ('yarrak'), ('göt'), ('ibne'), ('pezevenk'),
  ('fuck'), ('fucking'), ('shit'), ('bitch'), ('cunt'), ('dick'), ('whore'), ('slut');

create table public.chat_messages (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  fan_no integer not null,
  display_name text not null,
  body text not null,
  -- True when body is a preset key (shown in each reader's language).
  is_preset boolean not null default false,
  created_at timestamptz not null default now()
);
create index chat_messages_recent on public.chat_messages (created_at desc);
create index chat_messages_by_author on public.chat_messages (profile_id, created_at desc);
alter table public.chat_messages enable row level security;
create policy "chat is readable by everyone" on public.chat_messages for select using (true);

-- 'ok', 'not_a_fan', 'too_fast', 'empty', 'not_allowed' (free text from an under-18).
create function public.send_message(p_body text, p_preset text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  fan record;
  age integer;
  last_at timestamptz;
  per_minute integer;
  body text;
  w text;
begin
  select f.fan_no, f.display_name, p.birth_year into fan
  from fans f join profiles p on p.id = f.profile_id where f.profile_id = me;
  if fan.fan_no is null then
    return 'not_a_fan';
  end if;

  select max(created_at), count(*) filter (where created_at > now() - interval '1 minute')
  into last_at, per_minute from chat_messages where profile_id = me and created_at > now() - interval '1 minute';
  if (last_at is not null and last_at > now() - make_interval(secs => setting_int('chat_min_seconds')))
     or per_minute >= setting_int('chat_per_minute') then
    return 'too_fast';
  end if;

  if p_preset is not null then
    if not exists (select 1 from chat_presets where key = p_preset) then
      return 'empty';
    end if;
    insert into chat_messages (profile_id, fan_no, display_name, body, is_preset)
    values (me, fan.fan_no, fan.display_name, p_preset, true);
    return 'ok';
  end if;

  age := extract(year from now())::integer - fan.birth_year;
  if age < setting_int('adult_age') then
    return 'not_allowed';
  end if;
  body := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  if body = '' then
    return 'empty';
  end if;
  body := left(body, setting_int('chat_max_length'));
  for w in select word from word_filters loop
    body := regexp_replace(body, '\m' || w || '\M', '***', 'gi');
  end loop;
  insert into chat_messages (profile_id, fan_no, display_name, body) values (me, fan.fan_no, fan.display_name, body);
  return 'ok';
end;
$$;
revoke all on function public.send_message(text, text) from public, anon;
grant execute on function public.send_message(text, text) to authenticated;

-- ---------------------------------------------------------------- live updates
alter publication supabase_realtime add table public.fans, public.chat_messages;
