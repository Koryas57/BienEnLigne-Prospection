create extension if not exists pgcrypto;

create type public.prospect_status as enum ('NEW','ANALYZED','QUALIFIED','REJECTED','DRAFT_READY','APPROVED','CONTACTED','FOLLOW_UP','REPLIED','INTERESTED','WON','LOST','DO_NOT_CONTACT');
create type public.campaign_status as enum ('ACTIVE','PAUSED','ARCHIVED');
create type public.outreach_channel as enum ('instagram','facebook','email');
create type public.message_status as enum ('DRAFT','APPROVED','REJECTED','SNOOZED','SENT');
create type public.message_kind as enum ('FIRST_CONTACT','FOLLOW_UP_1','FOLLOW_UP_2');
create type public.reply_category as enum ('positive','interested','question','maybe_later','negative','do_not_contact','unknown');
create type public.payment_status as enum ('PENDING','DEPOSIT_PAID','PAID','REFUNDED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  company_name text not null default 'Bien En Ligne',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 2 and 160),
  country text not null, state text not null default '', city text not null,
  timezone text not null, sector text not null, sub_sector text,
  price numeric(12,2) not null check (price >= 0), currency text not null default 'USD' check (char_length(currency) = 3),
  start_date date not null default current_date, status public.campaign_status not null default 'ACTIVE', notes text,
  qualification_criteria jsonb not null default '{}'::jsonb,
  min_reviews integer not null default 30 check (min_reviews >= 0),
  max_prospects integer not null default 100 check (max_prospects > 0),
  allowed_channels public.outreach_channel[] not null default array['instagram','facebook','email']::public.outreach_channel[],
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  business_name text not null check (char_length(business_name) between 1 and 240), contact_name text,
  category text not null, subcategory text, city text not null, state text not null default '', country text not null, timezone text not null,
  address text, phone text, email text, website_url text, instagram_url text, facebook_url text, google_maps_url text,
  rating numeric(2,1) check (rating between 0 and 5), review_count integer check (review_count >= 0), price_range text, notes text,
  source text not null default 'manual', status public.prospect_status not null default 'NEW',
  lead_score integer not null default 0 check (lead_score between 0 and 100), qualification_reason text not null default 'À analyser',
  has_website boolean, website_quality_score integer check (website_quality_score between 0 and 100), website_mobile_friendly boolean,
  website_https boolean, website_notes text, instagram_active boolean, facebook_active boolean, google_presence boolean,
  social_notes text, last_activity_hint text, independent_business boolean, likely_franchise boolean,
  contacted_at timestamptz, next_follow_up_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint do_not_contact_has_no_follow_up check (status <> 'DO_NOT_CONTACT' or next_follow_up_at is null)
);

create table public.prospect_analyses (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  is_real_business text not null check (is_real_business in ('true','false','unknown')),
  independent_business text not null check (independent_business in ('true','false','unknown')),
  likely_franchise text not null check (likely_franchise in ('true','false','unknown')),
  digital_presence text not null check (digital_presence in ('weak','average','strong','unknown')),
  main_problem text not null, relevance text not null, reason_to_contact text not null,
  best_channel text not null check (best_channel in ('instagram','facebook','email','unknown')),
  sales_angle text not null, raw_result jsonb not null default '{}'::jsonb,
  model text, is_demo boolean not null default false, created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  channel public.outreach_channel not null, kind public.message_kind not null default 'FIRST_CONTACT',
  subject text, body text not null check (char_length(body) > 0), status public.message_status not null default 'DRAFT',
  scheduled_for timestamptz, recommended_local_time text, approved_at timestamptz, approved_by uuid references public.profiles(id),
  sent_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint approved_state_is_auditable check (status not in ('APPROVED','SENT') or (approved_at is not null and approved_by is not null)),
  constraint sent_state_has_timestamps check (status <> 'SENT' or (approved_at is not null and sent_at is not null))
);

create table public.activities (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  prospect_id uuid references public.prospects(id) on delete cascade, campaign_id uuid references public.campaigns(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null, event_type text not null, label text not null,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create table public.replies (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade, message_id uuid references public.messages(id) on delete set null,
  category public.reply_category not null default 'unknown', original_text text not null,
  ai_summary text, commercial_sentiment text, suggested_next_action text, reply_draft text,
  received_at timestamptz not null default now(), created_at timestamptz not null default now()
);

create table public.deals (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0), currency text not null default 'USD' check (char_length(currency) = 3),
  won_at timestamptz not null default now(), product text not null default 'Site vitrine', deposit_percent numeric(5,2) not null default 50 check (deposit_percent between 0 and 100),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0), payment_status public.payment_status not null default 'PENDING', notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.settings (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null unique references public.profiles(id) on delete cascade default auth.uid(),
  follow_up_1_days integer not null default 3 check (follow_up_1_days > 0),
  follow_up_2_days integer not null default 8 check (follow_up_2_days > follow_up_1_days),
  default_currency text not null default 'USD', default_price numeric(12,2) not null default 350,
  scoring_rules jsonb not null default '{"no_website":30,"weak_website":20,"reviews_100":15,"reviews_30":10,"active_social":10,"independent":10,"local_business":10,"visual_content":5,"modern_site":-30,"major_franchise":-30,"inactive":-20,"irrelevant":-50}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index campaigns_owner_status_idx on public.campaigns(owner_id, status);
create index prospects_owner_status_idx on public.prospects(owner_id, status);
create index prospects_campaign_score_idx on public.prospects(campaign_id, lead_score desc);
create index prospects_follow_up_idx on public.prospects(owner_id, next_follow_up_at) where next_follow_up_at is not null and status not in ('REPLIED','INTERESTED','WON','LOST','DO_NOT_CONTACT');
create index messages_owner_status_schedule_idx on public.messages(owner_id, status, scheduled_for);
create index messages_prospect_idx on public.messages(prospect_id, created_at desc);
create index activities_prospect_created_idx on public.activities(prospect_id, created_at desc);
create index replies_prospect_created_idx on public.replies(prospect_id, created_at desc);
create index deals_owner_won_idx on public.deals(owner_id, won_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger campaigns_updated before update on public.campaigns for each row execute function public.set_updated_at();
create trigger prospects_updated before update on public.prospects for each row execute function public.set_updated_at();
create trigger messages_updated before update on public.messages for each row execute function public.set_updated_at();
create trigger deals_updated before update on public.deals for each row execute function public.set_updated_at();
create trigger settings_updated before update on public.settings for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  insert into public.settings(owner_id) values (new.id);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.prevent_unapproved_send() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.status = 'SENT' and (old.approved_at is null or old.status <> 'APPROVED') then
    raise exception 'Message must be explicitly approved before it can be sent';
  end if;
  return new;
end; $$;
create trigger messages_require_prior_approval before update of status on public.messages for each row execute function public.prevent_unapproved_send();

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.prospects enable row level security;
alter table public.prospect_analyses enable row level security;
alter table public.messages enable row level security;
alter table public.activities enable row level security;
alter table public.replies enable row level security;
alter table public.deals enable row level security;
alter table public.settings enable row level security;

create policy profiles_select_own on public.profiles for select using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy campaigns_all_own on public.campaigns for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy prospects_all_own on public.prospects for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy analyses_all_own on public.prospect_analyses for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy messages_all_own on public.messages for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy activities_select_own on public.activities for select using (owner_id = (select auth.uid()));
create policy activities_insert_own on public.activities for insert with check (owner_id = (select auth.uid()));
create policy replies_all_own on public.replies for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy deals_all_own on public.deals for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy settings_all_own on public.settings for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.campaigns, public.prospects, public.prospect_analyses, public.messages, public.replies, public.deals, public.settings to authenticated;
grant select, insert on public.activities to authenticated;
