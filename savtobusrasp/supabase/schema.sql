begin;

create table public.routes (
  id text primary key,
  route_number text not null,
  name text not null,
  locality text not null,
  source_date date,
  source_note text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.stops (
  id text primary key,
  name text not null,
  latitude double precision,
  longitude double precision,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint stops_coordinates_pair check (
    (latitude is null and longitude is null) or
    (latitude between -90 and 90 and longitude between -180 and 180)
  )
);

create table public.route_stops (
  route_id text not null references public.routes(id) on delete cascade,
  direction text not null check (direction in ('forward', 'return')),
  stop_id text not null references public.stops(id) on delete restrict,
  stop_sequence smallint not null check (stop_sequence > 0),
  primary key (route_id, direction, stop_sequence),
  unique (route_id, direction, stop_id)
);

create table public.trips (
  id text primary key,
  route_id text not null references public.routes(id) on delete cascade,
  direction text not null check (direction in ('forward', 'return')),
  label text not null,
  first_timed_stop time not null,
  active boolean not null default true
);

create table public.stop_times (
  trip_id text not null references public.trips(id) on delete cascade,
  stop_id text not null references public.stops(id) on delete restrict,
  stop_sequence smallint not null check (stop_sequence > 0),
  scheduled_time time,
  terminal_status text check (terminal_status in ('стоянка', 'конечная')),
  primary key (trip_id, stop_sequence),
  unique (trip_id, stop_id),
  constraint stop_times_value check (
    (scheduled_time is not null and terminal_status is null) or
    (scheduled_time is null and terminal_status is not null)
  )
);

create index route_stops_stop_id_idx on public.route_stops(stop_id);
create index trips_route_direction_idx on public.trips(route_id, direction) where active;
create index stop_times_stop_id_idx on public.stop_times(stop_id);
create index stop_times_scheduled_time_idx on public.stop_times(scheduled_time) where scheduled_time is not null;

alter table public.routes enable row level security;
alter table public.stops enable row level security;
alter table public.route_stops enable row level security;
alter table public.trips enable row level security;
alter table public.stop_times enable row level security;

revoke all on public.routes, public.stops, public.route_stops, public.trips, public.stop_times from anon, authenticated;
grant select on public.routes, public.stops, public.route_stops, public.trips, public.stop_times to anon, authenticated;

create policy "Public read routes" on public.routes for select to anon, authenticated using (true);
create policy "Public read stops" on public.stops for select to anon, authenticated using (true);
create policy "Public read route stops" on public.route_stops for select to anon, authenticated using (true);
create policy "Public read trips" on public.trips for select to anon, authenticated using (true);
create policy "Public read stop times" on public.stop_times for select to anon, authenticated using (true);

commit;
