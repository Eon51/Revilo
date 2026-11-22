create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  subscription_status text not null default 'free',
  created_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#6657F4',
  created_at timestamptz not null default now()
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  title text not null,
  exam_date date not null,
  coefficient numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  title text not null,
  difficulty smallint not null check (difficulty between 1 and 3),
  status text not null default 'todo'
);

create table if not exists public.availabilities (
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  minutes integer not null check (minutes >= 0),
  primary key (user_id, weekday)
);

create table if not exists public.blocked_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  blocked_date date not null,
  primary key (user_id, blocked_date)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete cascade,
  deck_id uuid,
  session_date date not null,
  duration integer not null,
  status text not null default 'planned',
  type text not null default 'review'
);

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject_id uuid references public.subjects(id) on delete set null,
  chapter_id uuid references public.chapters(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  front text not null,
  back text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.card_progress (
  card_id uuid primary key references public.cards(id) on delete cascade,
  ease_factor numeric not null default 2.5,
  interval integer not null default 0,
  repetitions integer not null default 0,
  next_review_at date not null default current_date,
  successes integer not null default 0,
  failures integer not null default 0
);

create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid references public.decks(id) on delete cascade,
  question_count integer not null,
  score integer not null,
  missed_card_ids uuid[],
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.exams enable row level security;
alter table public.chapters enable row level security;
alter table public.availabilities enable row level security;
alter table public.blocked_days enable row level security;
alter table public.sessions enable row level security;
alter table public.decks enable row level security;
alter table public.cards enable row level security;
alter table public.card_progress enable row level security;
alter table public.quiz_results enable row level security;

create policy "profiles own row" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "subjects own rows" on public.subjects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exams own rows" on public.exams for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "availabilities own rows" on public.availabilities for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "blocked days own rows" on public.blocked_days for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sessions own rows" on public.sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "decks own rows" on public.decks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "quiz results own rows" on public.quiz_results for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "chapters through exam" on public.chapters for all using (
  exists (select 1 from public.exams e where e.id = exam_id and e.user_id = auth.uid())
) with check (
  exists (select 1 from public.exams e where e.id = exam_id and e.user_id = auth.uid())
);

create policy "cards through deck" on public.cards for all using (
  exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid())
) with check (
  exists (select 1 from public.decks d where d.id = deck_id and d.user_id = auth.uid())
);

create policy "progress through card" on public.card_progress for all using (
  exists (
    select 1 from public.cards c
    join public.decks d on d.id = c.deck_id
    where c.id = card_id and d.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.cards c
    join public.decks d on d.id = c.deck_id
    where c.id = card_id and d.user_id = auth.uid()
  )
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
