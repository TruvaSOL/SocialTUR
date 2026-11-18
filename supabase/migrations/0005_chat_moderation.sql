-- Applied to the project on 2026-11-18 (tested there first, rolled back: 43/43 sample messages right).
-- Chat moderation (decision #52).
--
-- Before: words in word_filters were replaced with *** only when written exactly
-- ("amk" yes, "a.m.k", "s1ktir", "gotunuzu", "siktirin" no), and nothing could be removed.
-- Now:
--   * chat_is_bad() looks through common disguises (dots, spaces between letters, 1/3/4/0/@/$,
--     doubled letters, dotless I) and through suffixes. A message that contains a bad word is
--     not posted at all ('blocked'); the sender sees why. Nothing is starred any more.
--   * Every blocked attempt is kept in chat_flags for the owner. 3 flags in 30 minutes
--     mute the sender for 30 minutes ('muted'). Numbers are in settings.
--   * Fans can report a message (report_message). When 3 different fans report it, it is taken
--     down for everyone and counts as a flag against its author.
--   * The owner removes any message by deleting its row in Table Editor -> chat_messages
--     (or chat_remove(id) in the SQL editor, which also keeps a copy). Screens update live.
--   * The word list is the table word_filters; add rows to tighten it, no code change.
--     mode 'exact'    = the whole word only        ("amk", not "tamkapı")
--          'prefix'   = a word that starts with it ("ibne" -> "ibneler")
--          'anywhere' = inside text even with the spaces removed ("o r o s p u")
--     Write words lower case, Turkish letters allowed, doubled letters written once ("yarak").

insert into public.settings (key, value) values
  ('chat_report_hide', '3'),
  ('chat_flag_limit', '3'),
  ('chat_mute_minutes', '30')
on conflict (key) do nothing;

alter table public.word_filters add column mode text not null default 'prefix'
  check (mode in ('exact', 'prefix', 'anywhere'));

-- The old words stay (as 'prefix', which also catches them as whole words); the list below adds
-- words and sets the right mode for each.
insert into public.word_filters (word, mode) values
  -- abbreviations: whole word only
  ('amk', 'exact'), ('amq', 'exact'), ('aq', 'exact'), ('mk', 'exact'), ('sg', 'exact'), ('oç', 'exact'),
  ('oc', 'exact'), ('skm', 'exact'), ('sktr', 'exact'), ('pic', 'exact'), ('göt', 'exact'), ('got', 'exact'),
  ('dick', 'exact'), ('fuk', 'exact'),
  -- forms of göt/got (not "götür", "gotik")
  ('götün', 'prefix'), ('götüne', 'prefix'), ('götüm', 'prefix'), ('götveren', 'anywhere'),
  ('gotun', 'prefix'), ('gotune', 'prefix'), ('gotum', 'prefix'), ('gotveren', 'anywhere'),
  -- starts of words
  ('amına', 'prefix'), ('amina', 'prefix'), ('amını', 'prefix'), ('amini', 'prefix'), ('amcık', 'prefix'),
  ('amcik', 'prefix'), ('piç', 'prefix'), ('ibne', 'prefix'), ('ipne', 'prefix'), ('ananı', 'prefix'),
  ('anani', 'prefix'), ('ananızı', 'prefix'), ('bacını', 'prefix'), ('bacini', 'prefix'), ('şerefsiz', 'prefix'),
  ('serefsiz', 'prefix'), ('yavşak', 'prefix'), ('yavsak', 'prefix'), ('kaltak', 'prefix'), ('sürtük', 'prefix'),
  ('surtuk', 'prefix'), ('gavat', 'prefix'), ('yarak', 'prefix'), ('yarağ', 'prefix'), ('yarag', 'prefix'), ('dalyarak', 'prefix'), ('sikik', 'prefix'), ('sikiş', 'prefix'),
  ('shit', 'prefix'), ('bitch', 'prefix'), ('whore', 'prefix'), ('slut', 'prefix'),
  -- anywhere, even spelled out with spaces or dots
  ('orospu', 'anywhere'), ('orosbu', 'anywhere'), ('siktir', 'anywhere'), ('sikerim', 'anywhere'),
  ('sikeyim', 'anywhere'), ('sikiyim', 'anywhere'), ('sikim', 'anywhere'), ('siktim', 'anywhere'),
  ('sikecek', 'anywhere'), ('sikicem', 'anywhere'), ('sikecem', 'anywhere'), ('pezevenk', 'anywhere'), ('kahpe', 'anywhere'), ('fuck', 'anywhere'),
  ('cunt', 'anywhere'), ('ashole', 'anywhere')
on conflict (word) do update set mode = excluded.mode;

-- True when the text contains a word from word_filters, looking through common disguises.
create function public.chat_is_bad(p text)
returns boolean
language plpgsql stable set search_path = public as $$
declare
  v text;
  tok text;
  buf text;
  merged text[];
  words text;
  compact text;
  w record;
begin
  -- Two readings of capital I: Turkish (I = ı) and English (I = i), since people type both.
  foreach v in array array[translate(coalesce(p, ''), 'İI', 'iı'), translate(coalesce(p, ''), 'İI', 'ii')] loop
    v := lower(v);
    v := translate(v, '0134578@$€', 'oieastbase');
    v := regexp_replace(v, '[^[:alpha:][:space:]]', '', 'g');   -- "a.m.k" -> "amk"
    v := regexp_replace(v, '([[:alpha:]])\1+', '\1', 'g');      -- "siiiktir" -> "siktir"
    -- Runs of single letters become one word: "a m k" -> "amk".
    merged := '{}';
    buf := '';
    foreach tok in array regexp_split_to_array(btrim(v), '\s+') loop
      if char_length(tok) = 1 then
        buf := buf || tok;
      else
        if buf <> '' then merged := merged || buf; buf := ''; end if;
        if tok <> '' then merged := merged || tok; end if;
      end if;
    end loop;
    if buf <> '' then merged := merged || buf; end if;
    words := ' ' || array_to_string(merged, ' ') || ' ';
    compact := replace(words, ' ', '');
    for w in select word, mode from word_filters loop
      if (w.mode = 'exact' and words like '% ' || w.word || ' %')
         or (w.mode = 'prefix' and words like '% ' || w.word || '%')
         or (w.mode = 'anywhere' and compact like '%' || w.word || '%') then
        return true;
      end if;
    end loop;
  end loop;
  return false;
end;
$$;

-- Blocked attempts and taken-down messages, for the owner (Table Editor -> chat_flags).
create table public.chat_flags (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  reason text not null check (reason in ('blocked', 'reported', 'owner')),
  created_at timestamptz not null default now()
);
create index chat_flags_by_author on public.chat_flags (profile_id, created_at desc);
alter table public.chat_flags enable row level security;

create table public.chat_reports (
  message_id bigint not null references public.chat_messages (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, reporter_id)
);
alter table public.chat_reports enable row level security;

-- Is this person muted right now?
create function public.chat_is_muted(p_profile uuid)
returns boolean
language sql stable set search_path = public as $$
  select count(*) >= setting_int('chat_flag_limit')
  from chat_flags
  where profile_id = p_profile
    and created_at > now() - make_interval(mins => setting_int('chat_mute_minutes'));
$$;

-- Takes a message down for everyone, keeps a copy in chat_flags.
create function public.chat_take_down(p_id bigint, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into chat_flags (profile_id, body, reason)
  select profile_id, body, p_reason from chat_messages where id = p_id and not is_preset;
  delete from chat_messages where id = p_id;
end;
$$;
revoke all on function public.chat_take_down(bigint, text) from public, anon, authenticated;

-- For the owner in the SQL editor: select chat_remove(123);
create function public.chat_remove(p_id bigint)
returns void
language sql security definer set search_path = public as $$
  select chat_take_down(p_id, 'owner');
$$;
revoke all on function public.chat_remove(bigint) from public, anon, authenticated;

-- 'ok', 'not_a_fan', 'self', 'gone' (already removed), 'removed' (this report took it down).
create function public.report_message(p_id bigint)
returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  author uuid;
  n integer;
begin
  if not exists (select 1 from fans where profile_id = me) then
    return 'not_a_fan';
  end if;
  select profile_id into author from chat_messages where id = p_id;
  if author is null then
    return 'gone';
  end if;
  if author = me then
    return 'self';
  end if;
  insert into chat_reports (message_id, reporter_id) values (p_id, me) on conflict do nothing;
  select count(*) into n from chat_reports where message_id = p_id;
  if n >= setting_int('chat_report_hide') then
    perform chat_take_down(p_id, 'reported');
    return 'removed';
  end if;
  return 'ok';
end;
$$;
revoke all on function public.report_message(bigint) from public, anon;
grant execute on function public.report_message(bigint) to authenticated;

-- send_message: same rules as before, plus mute and the new check. Bad text is not posted.
-- Results: 'ok', 'not_a_fan', 'too_fast', 'empty', 'not_allowed', 'blocked', 'muted'.
create or replace function public.send_message(p_body text, p_preset text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  fan record;
  age integer;
  last_at timestamptz;
  per_minute integer;
  body text;
begin
  select f.fan_no, f.display_name, p.birth_year into fan
  from fans f join profiles p on p.id = f.profile_id where f.profile_id = me;
  if fan.fan_no is null then
    return 'not_a_fan';
  end if;

  if chat_is_muted(me) then
    return 'muted';
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
  if chat_is_bad(body) then
    insert into chat_flags (profile_id, body, reason) values (me, body, 'blocked');
    return 'blocked';
  end if;
  insert into chat_messages (profile_id, fan_no, display_name, body) values (me, fan.fan_no, fan.display_name, body);
  return 'ok';
end;
$$;
revoke all on function public.send_message(text, text) from public, anon;
grant execute on function public.send_message(text, text) to authenticated;
