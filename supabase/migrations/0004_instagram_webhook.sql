-- Not applied yet.
-- Our own Instagram comment-to-ticket service (decision #48), replacing a paid messaging tool.
--
-- Meta sends every new comment to the Edge Function `instagram-webhook`. The function asks
-- ig_handle_comment() what to do; the database decides (keyword, one reply per comment,
-- the ticket, the message text) and the function only sends the private reply.
-- Only the Edge Function (service role) can call these functions or read the tables below.

-- Every comment Meta has told us about, so a repeated delivery never sends a second message.
create table public.ig_comments (
  comment_id text primary key,
  ig_user_id text not null,
  status text not null check (status in ('pending', 'sent', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.ig_comments enable row level security;

-- Values the owner fills in by hand in the dashboard (Table Editor -> private_config):
--   ig_app_secret  the app secret from the Meta app dashboard (checks that a call really comes from Meta)
--   ig_token       the Instagram access token (sends the messages); renewed by the function itself
-- The verify token is made here and copied from the table into the Meta app dashboard.
insert into public.private_config (key, value) values
  ('ig_verify_token', replace(gen_random_uuid()::text, '-', '')),
  ('ig_app_secret', ''),
  ('ig_token', ''),
  ('ig_token_refreshed_at', '')
on conflict (key) do nothing;

-- Words in a comment that ask for a ticket (lower case, matched anywhere in the comment),
-- and the private replies. {url} is replaced with the ticket link.
insert into public.settings (key, value) values
  ('ig_keywords', '["stadyum", "stadium"]'),
  ('ig_reply_new', to_jsonb('Biletin hazır! 🎟️' || chr(10) || 'Buradan gir: {url}' || chr(10) ||
                            'Karakterini yap ve yerine geç. İlk gelen en iyi koltuğu alır!'::text)),
  ('ig_reply_used', to_jsonb('Sen zaten stadyumdasın! 🏟️ Yerine buradan dönebilirsin: {url}'::text)),
  ('ig_reply_full', to_jsonb('Stadyum doldu! 🏟️ Yeni koltuklar açılınca haber vereceğiz.'::text)),
  ('ig_token_refresh_days', '7')
on conflict (key) do nothing;

-- Decides what to answer a comment. Returns {"reply": "<text>"} or {"reply": null} (send nothing).
create function public.ig_handle_comment(p_comment_id text, p_ig_user_id text, p_username text, p_text text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  previous text;
  body text := lower(coalesce(p_text, ''));
  asks boolean;
  secret text;
  ticket jsonb;
  reply text;
begin
  if coalesce(p_comment_id, '') = '' or coalesce(p_ig_user_id, '') = '' then
    return jsonb_build_object('reply', null);
  end if;

  -- One message per comment: Meta allows no more, and repeated deliveries must not resend.
  -- A failed send may be tried again when Meta delivers the comment again.
  select status into previous from ig_comments where comment_id = p_comment_id for update;
  if previous is not null and previous <> 'failed' then
    return jsonb_build_object('reply', null);
  end if;

  select exists (
    select 1 from jsonb_array_elements_text((select value from settings where key = 'ig_keywords')) as k
    where position(lower(k) in body) > 0
  ) into asks;
  if not coalesce(asks, false) then
    insert into ig_comments (comment_id, ig_user_id, status) values (p_comment_id, p_ig_user_id, 'skipped')
    on conflict (comment_id) do update set status = 'skipped';
    return jsonb_build_object('reply', null);
  end if;

  select value into secret from private_config where key = 'ticket_issuer';
  ticket := issue_ticket(secret, p_ig_user_id, p_username);
  if coalesce((ticket ->> 'ok')::boolean, false) then
    select value #>> '{}' into reply from settings
    where key = case when (ticket ->> 'used')::boolean then 'ig_reply_used' else 'ig_reply_new' end;
    reply := replace(reply, '{url}', ticket ->> 'url');
  elsif ticket ->> 'error' = 'full' then
    select value #>> '{}' into reply from settings where key = 'ig_reply_full';
  else
    -- Nothing sensible to say (bad id). Note it and stay quiet.
    insert into ig_comments (comment_id, ig_user_id, status, error)
    values (p_comment_id, p_ig_user_id, 'failed', ticket ->> 'error')
    on conflict (comment_id) do update set status = 'failed', error = excluded.error;
    return jsonb_build_object('reply', null);
  end if;

  insert into ig_comments (comment_id, ig_user_id, status) values (p_comment_id, p_ig_user_id, 'pending')
  on conflict (comment_id) do update set status = 'pending', error = null;
  return jsonb_build_object('reply', reply);
end;
$$;

-- The function reports back whether Instagram accepted the message.
create function public.ig_comment_done(p_comment_id text, p_sent boolean, p_error text default null)
returns void
language sql security definer set search_path = public as $$
  update ig_comments
  set status = case when p_sent then 'sent' else 'failed' end,
      error = case when p_sent then null else left(p_error, 500) end,
      sent_at = case when p_sent then now() else null end
  where comment_id = p_comment_id;
$$;

revoke all on function public.ig_handle_comment(text, text, text, text) from public, anon, authenticated;
revoke all on function public.ig_comment_done(text, boolean, text) from public, anon, authenticated;
grant execute on function public.ig_handle_comment(text, text, text, text) to service_role;
grant execute on function public.ig_comment_done(text, boolean, text) to service_role;
