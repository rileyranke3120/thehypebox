create table if not exists email_outreach (
  id            bigserial   primary key,
  contact_id    text        not null,
  location_id   text        not null,
  email         text        not null,
  step          integer     not null default 0,  -- 0=initial, 1=day3, 2=day7
  subject       text,
  contact_name  text,
  business_name text,
  niche         text,
  email_source  text,                             -- hunter, scrape, ghl
  sent_at       timestamptz not null default now(),
  replied       boolean     not null default false,
  unsubscribed  boolean     not null default false,
  error         text,
  created_at    timestamptz not null default now(),
  unique (contact_id, step)
);

create index if not exists email_outreach_contact_idx
  on email_outreach (contact_id);

create index if not exists email_outreach_step_sent_idx
  on email_outreach (step, sent_at);

create index if not exists email_outreach_location_idx
  on email_outreach (location_id, sent_at desc);

alter table email_outreach enable row level security;

drop policy if exists "service role only" on email_outreach;
create policy "service role only" on email_outreach
  using (false)
  with check (false);
