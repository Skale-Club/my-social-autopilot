-- Add landing background variant selector
alter table public.landing_content
  add column if not exists background_variant text not null default 'solid';

alter table public.landing_content
  drop constraint if exists landing_content_background_variant_check;

alter table public.landing_content
  add constraint landing_content_background_variant_check
  check (background_variant in ('solid', 'alternative'));

comment on column public.landing_content.background_variant is 'Controls the active landing background style variant';
