create table if not exists roi_calculations (
  id                bigserial primary key,
  contact_id        text,
  location_id       text,
  contact_name      text,
  business_name     text,
  phone             text,
  niche             text,
  missed_calls_day  numeric,
  job_value         numeric,
  monthly_lost      numeric,
  plan_cost         numeric,
  sms_message       text,
  sms_sent          boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists roi_calculations_contact_id_idx on roi_calculations (contact_id);
create index if not exists roi_calculations_created_at_idx on roi_calculations (created_at desc);

alter table roi_calculations enable row level security;

create policy "service role only" on roi_calculations
  using (false)
  with check (false);
