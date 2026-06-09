-- Angi / HomeAdvisor scraped contractor leads
create table if not exists angi_leads (
  id              bigint primary key generated always as identity,
  scraped_at      timestamptz not null default now(),
  source          text not null check (source in ('angi', 'homeadvisor')),
  city            text not null,
  niche           text not null,
  business_name   text not null,
  phone           text,
  website         text,
  rating          numeric(3,1),
  review_count    int,
  ghl_contact_id  text,
  is_new_contact  boolean default true,
  barry_sent      boolean default false,
  barry_sent_at   timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists angi_leads_phone_idx  on angi_leads (phone);
create index if not exists angi_leads_source_idx on angi_leads (source, scraped_at desc);
create index if not exists angi_leads_city_idx   on angi_leads (city, niche, scraped_at desc);
