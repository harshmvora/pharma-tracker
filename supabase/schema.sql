-- ============================================================
-- PharmaTrack — Full Schema
-- Run this entire file in Supabase → SQL Editor → New query
-- ============================================================

-- ── Profiles (extends Supabase auth.users) ──────────────────
create table if not exists profiles (
  id         uuid references auth.users on delete cascade primary key,
  name       text,
  email      text unique,
  avatar_url text,
  created_at timestamptz default now()
);

-- Auto-create profile row on every new signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Projects ─────────────────────────────────────────────────
create table if not exists projects (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  type        text not null check (type in ('sourcing', 'development', 'general')),
  status      text not null default 'planning'
              check (status in ('planning', 'active', 'on-hold', 'completed')),
  priority    text not null default 'medium'
              check (priority in ('high', 'medium', 'low')),
  description text,
  due_date    date,
  owner_id    uuid references profiles(id) on delete cascade not null,
  created_at  timestamptz default now()
);

-- ── Project members ───────────────────────────────────────────
create table if not exists project_members (
  project_id uuid references projects(id) on delete cascade,
  user_id    uuid references profiles(id) on delete cascade,
  role       text not null default 'member'
             check (role in ('owner', 'member', 'viewer')),
  primary key (project_id, user_id)
);

-- ── Manufacturers / Suppliers ────────────────────────────────
create table if not exists manufacturers (
  id            uuid default gen_random_uuid() primary key,
  name          text not null,
  country       text,
  contact_name  text,
  contact_email text,
  contact_phone text,
  notes         text,
  created_by    uuid references profiles(id),
  created_at    timestamptz default now()
);

-- ── Products (master catalogue) ──────────────────────────────
-- Each unique combination of generic_name + strength + dosage_form + packing
-- is one product. Prices are tracked against this, not against projects.
create table if not exists products (
  id           uuid default gen_random_uuid() primary key,
  generic_name text not null,
  strength     text,
  dosage_form  text,   -- tablet, capsule, syrup, injection, cream, etc.
  packing      text,   -- e.g. 1x10 alu/alu, 30ml bottle
  category     text,   -- human pharma, veterinary, protein, nutraceutical, etc.
  notes        text,
  created_by   uuid references profiles(id),
  created_at   timestamptz default now()
);

-- ── Sourcing items (products needed within a sourcing project) ─
create table if not exists sourcing_items (
  id          uuid default gen_random_uuid() primary key,
  project_id  uuid references projects(id) on delete cascade,
  product_id  uuid references products(id),
  status      text not null default 'pending'
              check (status in ('pending','in-progress','sampled','approved','sourced','blocked')),
  notes       text,
  target_date date,
  created_at  timestamptz default now()
);

-- ── Price quotes (historical pricing per product per supplier) ─
create table if not exists price_quotes (
  id               uuid default gen_random_uuid() primary key,
  product_id       uuid references products(id) on delete cascade not null,
  manufacturer_id  uuid references manufacturers(id) on delete cascade not null,
  price            numeric(14,4) not null,
  currency         text not null default 'INR',
  pack_size        text,   -- may differ from product packing for bulk quotes
  moq              text,   -- minimum order quantity
  validity_date    date,
  quote_date       date not null default current_date,
  notes            text,
  source_upload_id uuid,   -- links back to the batch upload it came from
  created_by       uuid references profiles(id),
  created_at       timestamptz default now()
);

-- ── Price uploads (batch upload tracking) ────────────────────
create table if not exists price_uploads (
  id              uuid default gen_random_uuid() primary key,
  manufacturer_id uuid references manufacturers(id),
  file_name       text,
  file_url        text,   -- Supabase Storage path
  raw_content     text,   -- pasted WhatsApp text or extracted Excel text
  parsed_data     jsonb,  -- what Claude returned
  status          text not null default 'pending'
                  check (status in ('pending','processing','completed','failed')),
  uploaded_by     uuid references profiles(id),
  created_at      timestamptz default now()
);

-- ── Development phases ────────────────────────────────────────
create table if not exists dev_phases (
  id          uuid default gen_random_uuid() primary key,
  project_id  uuid references projects(id) on delete cascade,
  name        text not null,
  status      text not null default 'planned'
              check (status in ('planned','in-progress','completed','on-hold')),
  start_date  date,
  end_date    date,
  description text,
  order_index integer not null default 0,
  created_at  timestamptz default now()
);

-- ── Tasks (dev phase tasks + general project tasks) ──────────
create table if not exists tasks (
  id          uuid default gen_random_uuid() primary key,
  project_id  uuid references projects(id) on delete cascade,
  phase_id    uuid references dev_phases(id) on delete cascade,
  name        text not null,
  done        boolean not null default false,
  priority    text not null default 'medium'
              check (priority in ('high','medium','low')),
  due_date    date,
  assigned_to uuid references profiles(id),
  notes       text,
  created_at  timestamptz default now()
);

-- ── Communication / email log ─────────────────────────────────
create table if not exists notes (
  id         uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  type       text not null default 'note'
             check (type in ('note','email','call','meeting','action')),
  title      text not null,
  content    text,
  date       date not null default current_date,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ── Quick todos (personal, not tied to projects) ─────────────
create table if not exists todos (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references profiles(id) on delete cascade,
  name       text not null,
  done       boolean not null default false,
  priority   text not null default 'medium'
             check (priority in ('high','medium','low')),
  due_date   date,
  notes      text,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles        enable row level security;
alter table projects        enable row level security;
alter table project_members enable row level security;
alter table manufacturers   enable row level security;
alter table products        enable row level security;
alter table sourcing_items  enable row level security;
alter table price_quotes    enable row level security;
alter table price_uploads   enable row level security;
alter table dev_phases      enable row level security;
alter table tasks           enable row level security;
alter table notes           enable row level security;
alter table todos           enable row level security;

-- Profiles
create policy "Profiles viewable by authenticated" on profiles
  for select using (auth.role() = 'authenticated');
create policy "Users update own profile" on profiles
  for update using (auth.uid() = id);
create policy "Users insert own profile" on profiles
  for insert with check (auth.uid() = id);

-- Helper: is user a member of this project?
create or replace function is_project_member(pid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from projects    where id = pid and owner_id = auth.uid()
    union all
    select 1 from project_members where project_id = pid and user_id = auth.uid()
  );
$$;

-- Projects
create policy "View projects where member" on projects
  for select using (is_project_member(id));
create policy "Create own projects" on projects
  for insert with check (auth.uid() = owner_id);
create policy "Owner updates project" on projects
  for update using (auth.uid() = owner_id);
create policy "Owner deletes project" on projects
  for delete using (auth.uid() = owner_id);

-- Project members
create policy "Members view membership" on project_members
  for select using (is_project_member(project_id));
create policy "Owner manages members" on project_members
  for all using (
    auth.uid() = (select owner_id from projects where id = project_id)
  );

-- Manufacturers (shared across team)
create policy "Auth users view manufacturers" on manufacturers
  for select using (auth.role() = 'authenticated');
create policy "Auth users create manufacturers" on manufacturers
  for insert with check (auth.role() = 'authenticated');
create policy "Creator updates manufacturer" on manufacturers
  for update using (auth.uid() = created_by);
create policy "Creator deletes manufacturer" on manufacturers
  for delete using (auth.uid() = created_by);

-- Products (shared catalogue)
create policy "Auth users view products" on products
  for select using (auth.role() = 'authenticated');
create policy "Auth users create products" on products
  for insert with check (auth.role() = 'authenticated');
create policy "Creator updates product" on products
  for update using (auth.uid() = created_by);

-- Sourcing items
create policy "Members view sourcing items" on sourcing_items
  for select using (is_project_member(project_id));
create policy "Members manage sourcing items" on sourcing_items
  for all using (is_project_member(project_id));

-- Price quotes (shared — any authenticated user can see all quotes)
create policy "Auth users view price quotes" on price_quotes
  for select using (auth.role() = 'authenticated');
create policy "Auth users create price quotes" on price_quotes
  for insert with check (auth.role() = 'authenticated');
create policy "Creator updates price quote" on price_quotes
  for update using (auth.uid() = created_by);
create policy "Creator deletes price quote" on price_quotes
  for delete using (auth.uid() = created_by);

-- Price uploads
create policy "Auth users view uploads" on price_uploads
  for select using (auth.role() = 'authenticated');
create policy "Auth users create uploads" on price_uploads
  for insert with check (auth.role() = 'authenticated');
create policy "Uploader updates upload" on price_uploads
  for update using (auth.uid() = uploaded_by);

-- Dev phases
create policy "Members view dev phases" on dev_phases
  for select using (is_project_member(project_id));
create policy "Members manage dev phases" on dev_phases
  for all using (is_project_member(project_id));

-- Tasks (also visible to assignee even if not a member)
create policy "Members and assignees view tasks" on tasks
  for select using (
    auth.uid() = assigned_to or is_project_member(project_id)
  );
create policy "Members manage tasks" on tasks
  for all using (is_project_member(project_id));

-- Notes
create policy "Members view notes" on notes
  for select using (is_project_member(project_id));
create policy "Members manage notes" on notes
  for all using (is_project_member(project_id));

-- Todos
create policy "Own todos only" on todos
  for all using (auth.uid() = user_id);

-- ============================================================
-- Storage bucket for price list file uploads
-- ============================================================
insert into storage.buckets (id, name, public)
values ('price-uploads', 'price-uploads', false)
on conflict do nothing;

create policy "Auth users upload price files" on storage.objects
  for insert with check (bucket_id = 'price-uploads' and auth.role() = 'authenticated');
create policy "Auth users read price files" on storage.objects
  for select using (bucket_id = 'price-uploads' and auth.role() = 'authenticated');
