create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  customer_name text not null,
  service text not null,
  appointment_date date not null,
  appointment_time text not null,
  phone text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists appointments_user_email_idx on public.appointments(user_email);
create index if not exists appointments_date_idx on public.appointments(appointment_date);

alter table public.appointments enable row level security;
