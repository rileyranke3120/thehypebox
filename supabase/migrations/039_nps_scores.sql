create table if not exists nps_scores (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        references users(id) on delete cascade,
  client_name      text,
  client_phone     text,
  score            integer     check (score >= 1 and score <= 10),
  category         text        check (category in ('detractor', 'passive', 'promoter')),
  survey_month     text        not null,     -- 'YYYY-MM'
  sent_at          timestamptz not null default now(),
  replied_at       timestamptz,
  review_requested boolean     not null default false,
  riley_alerted    boolean     not null default false,
  created_at       timestamptz not null default now(),
  unique(user_id, survey_month)
);

create index if not exists idx_nps_scores_phone_month
  on nps_scores(client_phone, survey_month);

create index if not exists idx_nps_scores_survey_month
  on nps_scores(survey_month);
