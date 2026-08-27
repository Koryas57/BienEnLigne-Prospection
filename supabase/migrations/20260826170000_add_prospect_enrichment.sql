alter table public.prospects
  add column website_type text check (website_type in ('dedicated','link_in_bio','social_profile','marketplace','booking_platform','unknown')),
  add column enrichment jsonb,
  add column score_breakdown jsonb not null default '[]'::jsonb;

comment on column public.prospects.enrichment is 'Versioned public-fact provenance. Never store provider credentials or raw provider errors.';
comment on column public.prospects.score_breakdown is 'Deterministic scoring rules applied to this prospect.';
