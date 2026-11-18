-- Rivet public-intake rate gate. PRIVATE dev-project table; no Data API grants.
-- Only the server-side Rivet Edge function may write. This does not turn intake on.
create table if not exists rivet.intake_rate_windows (
  scope text not null check (scope = 'global'),
  window_start timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 120),
  primary key (scope, window_start)
);
alter table rivet.intake_rate_windows enable row level security;
revoke all on rivet.intake_rate_windows from public, anon, authenticated;
comment on table rivet.intake_rate_windows is 'Server-side global intake circuit breaker; contains no customer identity or address.';
