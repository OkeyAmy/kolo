-- Kolo schema. Apply with: pnpm db:migrate
--
-- Entities are stored as jsonb payloads with the columns we actually query on
-- lifted out and indexed. The domain types in ../types.ts are the source of
-- truth for the payload shape; this file only has to know how to find things.

create table if not exists profiles (
  address     text primary key,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create table if not exists circles (
  id          text primary key,
  code        text not null unique,
  status      text not null,
  visibility  text not null,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists circles_visibility_idx on circles (visibility, status);

create table if not exists members (
  circle_id   text not null references circles(id) on delete cascade,
  address     text not null,
  position    integer not null,
  data        jsonb not null,
  primary key (circle_id, address)
);
create index if not exists members_address_idx on members (address);

create table if not exists rounds (
  circle_id   text not null references circles(id) on delete cascade,
  idx         integer not null,
  status      text not null,
  data        jsonb not null,
  primary key (circle_id, idx)
);

create table if not exists contributions (
  id            text primary key,
  circle_id     text references circles(id) on delete cascade,
  box_id        text,
  from_address  text not null,
  status        text not null,
  data          jsonb not null,
  created_at    timestamptz not null default now()
);
create index if not exists contributions_circle_idx on contributions (circle_id);
create index if not exists contributions_box_idx on contributions (box_id);
create index if not exists contributions_status_idx on contributions (status);
create index if not exists contributions_from_idx on contributions (from_address);

create table if not exists swaps (
  id          text primary key,
  circle_id   text not null references circles(id) on delete cascade,
  status      text not null,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists swaps_circle_idx on swaps (circle_id);

create table if not exists boxes (
  id            text primary key,
  code          text not null unique,
  owner_address text not null,
  data          jsonb not null,
  created_at    timestamptz not null default now()
);
create index if not exists boxes_owner_idx on boxes (owner_address);
