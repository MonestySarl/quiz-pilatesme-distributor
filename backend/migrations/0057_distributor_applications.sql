-- 0057_distributor_applications.sql
-- Table pour stocker les candidatures du quiz distributeur (quiz.pilatesme.com/distributor)
--
-- Le quiz submit via edge fn `distributor-submit` qui insère ici.
-- Onglet CRM "Distributeurs" (admin-only) lit + affiche.

create extension if not exists "pgcrypto";

create table if not exists public.distributor_applications (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Lien tracking (pmd_visitor_id du localStorage)
  visitor_id            text,

  -- Réponses du quiz
  countries             text[] not null default '{}',
  business_types        text[] not null default '{}',
  product_interest      text,           -- 'machines' | 'accessories' | 'both'
  business_model        text,           -- 'stock' | 'dropship' | 'hybrid' | 'not_sure'
  volume_machines       text,           -- '5' | '10' | '25' | '50' | '100+'
  volume_accessories    text,           -- '50' | '100' | '500' | '1000' | '1000+'
  annual_revenue        text,           -- 'lt_100k' | '100k_500k' | '500k_2m' | 'gt_2m'
  timeline              text,           -- 'ready' | '1_3mo' | '3_6mo' | 'exploring'

  -- Contact
  first_name            text not null,
  last_name             text not null,
  email                 text not null,
  phone                 text,
  company               text not null,
  website               text,

  -- Meta
  landing_page          text,
  referrer              text,
  user_agent            text,

  -- Calendly (rempli quand le rdv est booké — via webhook Calendly plus tard, ou manuellement)
  calendly_event_id     text,
  calendly_event_uri    text,
  calendly_scheduled_at timestamptz,

  -- Workflow
  status                text not null default 'new',
  -- 'new' | 'contacted' | 'qualified' | 'in_discussion' | 'signed' | 'declined' | 'lost'
  notes                 text,
  assigned_to           uuid references public.profiles(id) on delete set null
);

create index if not exists idx_distributor_applications_created_at
  on public.distributor_applications (created_at desc);
create index if not exists idx_distributor_applications_status
  on public.distributor_applications (status);
create index if not exists idx_distributor_applications_email
  on public.distributor_applications (email);

create or replace function public.set_distributor_applications_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_distributor_applications_updated_at on public.distributor_applications;
create trigger trg_distributor_applications_updated_at
  before update on public.distributor_applications
  for each row execute function public.set_distributor_applications_updated_at();

-- RLS : lecture réservée aux admins (via profiles.role = 'admin'),
-- écriture uniquement via service_role (edge fn `distributor-submit`).
alter table public.distributor_applications enable row level security;

drop policy if exists "admins read distributor apps" on public.distributor_applications;
create policy "admins read distributor apps"
  on public.distributor_applications for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "admins update distributor apps" on public.distributor_applications;
create policy "admins update distributor apps"
  on public.distributor_applications for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "admins delete distributor apps" on public.distributor_applications;
create policy "admins delete distributor apps"
  on public.distributor_applications for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

comment on table public.distributor_applications is
  'Candidatures reçues via quiz.pilatesme.com/distributor. Un submit du form quiz insère 1 row.';
