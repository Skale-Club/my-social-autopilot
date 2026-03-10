-- Add background_variant and hero_badge_text columns to landing_content table

alter table public.landing_content
  add column if not exists background_variant text not null default 'solid',
  add column if not exists hero_badge_text text not null default 'AI-Powered Social Media Content';

-- Add constraint for background_variant if it doesn't exist
do $$ begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'landing_content_background_variant_check'
  ) then
    alter table public.landing_content
      add constraint landing_content_background_variant_check
      check (background_variant in ('solid', 'alternative'));
  end if;
end $$;
