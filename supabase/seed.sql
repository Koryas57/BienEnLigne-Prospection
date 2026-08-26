-- Démo facultative. Exécutée uniquement si un utilisateur Auth existe déjà.
do $$
declare demo_owner uuid; demo_campaign uuid := gen_random_uuid(); demo_prospect uuid := gen_random_uuid();
begin
  select id into demo_owner from auth.users order by created_at limit 1;
  if demo_owner is null then raise notice 'Seed ignoré : créez d’abord un utilisateur Supabase Auth.'; return; end if;
  insert into public.campaigns(id, owner_id, name, country, state, city, timezone, sector, price, currency, notes)
  values (demo_campaign, demo_owner, '[DEMO] Little Rock Restaurants 350', 'USA', 'Arkansas', 'Little Rock', 'America/Chicago', 'Restaurants indépendants', 350, 'USD', 'Donnée de démonstration');
  insert into public.prospects(id, owner_id, campaign_id, business_name, category, city, state, country, timezone, instagram_url, facebook_url, google_maps_url, rating, review_count, source, status, lead_score, qualification_reason, has_website, instagram_active, facebook_active, google_presence, independent_business, likely_franchise)
  values (demo_prospect, demo_owner, demo_campaign, '[DEMO] El Alamo Mexican Grill', 'Restaurant', 'Little Rock', 'Arkansas', 'USA', 'America/Chicago', 'https://instagram.com/', 'https://facebook.com/', 'https://maps.google.com/', 4.7, 199, 'demo_seed', 'QUALIFIED', 87, 'Restaurant actif avec forte présence Google, Facebook et Instagram mais sans site dédié.', false, true, true, true, true, false);
  insert into public.activities(owner_id, prospect_id, campaign_id, event_type, label, metadata)
  values (demo_owner, demo_prospect, demo_campaign, 'CREATED', 'Prospect de démonstration créé', '{"demo":true}'::jsonb);
end $$;
