-- STATUS: written 2026-11-17, NOT YET APPLIED to the project (dashboard session expired). Update this line once applied.
-- Tickets handed out automatically to people who comment on Instagram.
--
-- The messaging tool (ManyChat or our own Meta app) calls issue_ticket() once per commenter
-- with a shared secret and the commenter's Instagram id. It gets back a link with the code
-- already in it, which it sends as the private reply. One ticket per Instagram account:
-- asking again returns the same link.
--
-- Called over the normal API:
--   POST https://<project>.supabase.co/rest/v1/rpc/issue_ticket
--   headers: apikey: <publishable key>, Content-Type: application/json
--   body:    {"p_secret": "...", "p_ig_user_id": "...", "p_ig_username": "..."}
--   answer:  {"ok": true, "code": "ABCD-EFGH", "url": "https://.../?kod=ABCD-EFGH", "used": false, "new": true}

alter table public.tickets
  add column ig_user_id text unique,
  add column ig_username text;

-- Values that must never be readable through the API. No policies: only functions can read it.
create table public.private_config (
  key text primary key,
  value text not null
);
alter table public.private_config enable row level security;

-- The shared secret is made here, in the database, so it never passes through a chat or a repository.
-- The owner reads it in the dashboard (Table Editor -> private_config) and pastes it into the messaging tool.
insert into public.private_config (key, value)
values ('ticket_issuer', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''));

insert into public.settings (key, value) values ('site_url', '"https://socialtur.pages.dev"')
on conflict (key) do nothing;

create function public.issue_ticket(p_secret text, p_ig_user_id text, p_ig_username text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  expected text;
  found record;
  new_code text;
  site text;
  ig text := btrim(coalesce(p_ig_user_id, ''));
  uname text := nullif(left(btrim(coalesce(p_ig_username, '')), 64), '');
begin
  select value into expected from private_config where key = 'ticket_issuer';
  if expected is null or p_secret is distinct from expected then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if ig = '' or char_length(ig) > 64 then
    return jsonb_build_object('ok', false, 'error', 'invalid_user');
  end if;
  select value #>> '{}' into site from settings where key = 'site_url';

  select code, claimed_by into found from tickets where ig_user_id = ig;
  if found.code is not null then
    if uname is not null then
      update tickets set ig_username = uname where ig_user_id = ig;
    end if;
    return jsonb_build_object('ok', true, 'code', found.code, 'url', site || '/?kod=' || found.code,
                              'used', found.claimed_by is not null, 'new', false);
  end if;

  if (select count(*) from fans) >= setting_int('capacity') then
    return jsonb_build_object('ok', false, 'error', 'full');
  end if;
  begin
    select c into new_code from make_tickets(1, 'instagram') as c;
    update tickets set ig_user_id = ig, ig_username = uname where code = new_code;
  exception when unique_violation then
    -- The same person commented twice at the same moment: hand back the ticket the other call made.
    select code into new_code from tickets where ig_user_id = ig;
    return jsonb_build_object('ok', true, 'code', new_code, 'url', site || '/?kod=' || new_code, 'used', false, 'new', false);
  end;
  return jsonb_build_object('ok', true, 'code', new_code, 'url', site || '/?kod=' || new_code, 'used', false, 'new', true);
end;
$$;
revoke all on function public.issue_ticket(text, text, text) from public;
grant execute on function public.issue_ticket(text, text, text) to anon, authenticated;

-- Taking the seat now also notes the Instagram name the ticket was issued to (kept private:
-- it is in profiles, which only its owner can read).
create or replace function public.redeem(p_code text, p_name text, p_birth_year integer, p_locale text, p_look jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  existing integer;
  owner uuid;
  found_code boolean;
  ig_name text;
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
  select true, claimed_by, ig_username into found_code, owner, ig_name
  from tickets where code = normalize_code(p_code) for update;
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
  insert into profiles (id, display_name, birth_year, locale, resident_no, instagram)
  values (me, clean, p_birth_year, case when p_locale in ('tr', 'en') then p_locale else 'tr' end, next_no, ig_name);
  insert into fans (fan_no, profile_id, display_name, look) values (next_no, me, clean, clean_look(p_look));
  return jsonb_build_object('ok', true, 'fan_no', next_no);
end;
$$;
