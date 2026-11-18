-- Applied to the project on 2026-11-18 (tested there first, rolled back).
-- Our own Instagram comment-to-ticket service (decisions #48, #50).
--
-- Meta sends every new comment to the Edge Function `instagram-webhook`. The function checks the
-- signature, the target Reel, that it is a top-level comment and that it says the keyword (TRİBÜN),
-- then asks ig_handle_comment() what to answer. The database decides the rest (one reply per
-- comment, the person's own ticket, the message text) and the function sends the private reply.
-- Only the Edge Function (service role) can call these functions or read the tables below.

-- Every comment the function acted on, so a repeated delivery never sends a second message.
-- 'dry_run' = seen while the service was in safe mode (nothing sent, no ticket made).
create table public.ig_comments (
  comment_id text primary key,
  ig_user_id text not null,
  media_id text,
  status text not null check (status in ('dry_run', 'pending', 'sent', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.ig_comments enable row level security;

-- Values the owner fills in by hand in the dashboard (Table Editor -> private_config):
--   ig_app_secret  the app secret from the Meta app dashboard (proves a call really comes from Meta)
--   ig_token       the Instagram access token (sends the messages); renewed by the function itself
-- The verify token is made here and copied from the table into the Meta app dashboard.
insert into public.private_config (key, value) values
  ('ig_verify_token', replace(gen_random_uuid()::text, '-', '')),
  ('ig_app_secret', ''),
  ('ig_token', ''),
  ('ig_token_refreshed_at', '')
on conflict (key) do nothing;

-- Switches and texts, changed in the dashboard without touching code:
--   ig_live          false = safe mode: comments are noted, nothing is sent
--   ig_account_id    our Instagram professional account's id (only its posts count)
--   ig_target_media  the Reel's numeric media id (only comments on it count)
--   ig_keywords      words that ask for a ticket, compared without Turkish accents and case,
--                    as a whole word ("TRİBÜN", "tribun", "Tribün!" yes; "tribünlü" no)
--   ig_reply_*       the private replies; {url} becomes the person's own ticket link
insert into public.settings (key, value) values
  ('ig_live', 'false'),
  ('ig_account_id', '""'),
  ('ig_target_media', '""'),
  ('ig_keywords', '["tribun"]'),
  ('ig_reply_new', to_jsonb('🏟️ Garip Futbol Stadyumu''na hoş geldin! 🎟️' || chr(10) ||
                            'Biletini almak için: {url}' || chr(10) || chr(10) ||
                            'İşlemi siteden tamamlayarak tribündeki yerini al! ⚽'::text)),
  ('ig_reply_used', to_jsonb('🏟️ Sen zaten tribündesin! Yerine buradan dönebilirsin: {url}'::text)),
  ('ig_reply_full', to_jsonb('🏟️ Stadyum doldu! Yeni koltuklar açılınca haber vereceğiz.'::text)),
  ('ig_token_refresh_days', '0')
on conflict (key) do nothing;

-- Decides what to answer one comment that already passed the function's checks.
-- Returns {"reply": "<text>"} or {"reply": null} (send nothing).
create function public.ig_handle_comment(p_comment_id text, p_ig_user_id text, p_username text, p_media_id text, p_dry_run boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  secret text;
  ticket jsonb;
  reply text;
begin
  if coalesce(p_comment_id, '') = '' or coalesce(p_ig_user_id, '') = '' then
    return jsonb_build_object('reply', null);
  end if;

  -- One attempt per comment, ever: Meta allows a single private reply, and an attempt whose
  -- outcome is unknown must not be repeated blindly.
  insert into ig_comments (comment_id, ig_user_id, media_id, status)
  values (p_comment_id, p_ig_user_id, p_media_id, case when p_dry_run then 'dry_run' else 'pending' end)
  on conflict (comment_id) do nothing;
  if not found then
    return jsonb_build_object('reply', null);
  end if;
  if p_dry_run then
    return jsonb_build_object('reply', null, 'dry_run', true);
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
    update ig_comments set status = 'failed', error = ticket ->> 'error' where comment_id = p_comment_id;
    return jsonb_build_object('reply', null);
  end if;
  return jsonb_build_object('reply', reply);
end;
$$;

-- The function reports back whether Instagram accepted the message.
create function public.ig_comment_done(p_comment_id text, p_sent boolean, p_error text default null)
returns void
language sql security definer set search_path = public as $$
  update ig_comments
  set status = case when p_sent then 'sent' else 'failed' end,
      error = case when p_sent then null else left(p_error, 200) end,
      sent_at = case when p_sent then now() else null end
  where comment_id = p_comment_id;
$$;

revoke all on function public.ig_handle_comment(text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.ig_comment_done(text, boolean, text) from public, anon, authenticated;
grant execute on function public.ig_handle_comment(text, text, text, text, boolean) to service_role;
grant execute on function public.ig_comment_done(text, boolean, text) to service_role;
