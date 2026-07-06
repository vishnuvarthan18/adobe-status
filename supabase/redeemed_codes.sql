-- Run this once in the Supabase SQL editor.
-- Tracks which of the 100 hardcoded redeem codes (see app/lib/redeemCodes.js)
-- have already been used, so a code can't be redeemed twice.
create table if not exists redeemed_codes (
  code text primary key,
  redeemed_at timestamptz not null default now()
);

alter table redeemed_codes enable row level security;
-- No public policies: only the service role key (server-side) can read/write this table.
