drop policy if exists "exams own rows" on public.exams;
create policy "exams own rows" on public.exams
for all
using (
  auth.uid() = user_id
  and (
    subject_id is null
    or exists (
      select 1 from public.subjects s
      where s.id = exams.subject_id and s.user_id = auth.uid()
    )
  )
)
with check (
  auth.uid() = user_id
  and (
    subject_id is null
    or exists (
      select 1 from public.subjects s
      where s.id = exams.subject_id and s.user_id = auth.uid()
    )
  )
);

drop policy if exists "decks own rows" on public.decks;
create policy "decks own rows" on public.decks
for all
using (
  auth.uid() = user_id
  and (
    subject_id is null
    or exists (
      select 1 from public.subjects s
      where s.id = decks.subject_id and s.user_id = auth.uid()
    )
  )
  and (
    chapter_id is null
    or exists (
      select 1
      from public.chapters c
      join public.exams e on e.id = c.exam_id
      where c.id = decks.chapter_id and e.user_id = auth.uid()
    )
  )
)
with check (
  auth.uid() = user_id
  and (
    subject_id is null
    or exists (
      select 1 from public.subjects s
      where s.id = decks.subject_id and s.user_id = auth.uid()
    )
  )
  and (
    chapter_id is null
    or exists (
      select 1
      from public.chapters c
      join public.exams e on e.id = c.exam_id
      where c.id = decks.chapter_id and e.user_id = auth.uid()
    )
  )
);

drop policy if exists "sessions own rows" on public.sessions;
create policy "sessions own rows" on public.sessions
for all
using (
  auth.uid() = user_id
  and (
    chapter_id is null
    or exists (
      select 1
      from public.chapters c
      join public.exams e on e.id = c.exam_id
      where c.id = sessions.chapter_id and e.user_id = auth.uid()
    )
  )
  and (
    deck_id is null
    or exists (
      select 1 from public.decks d
      where d.id = sessions.deck_id and d.user_id = auth.uid()
    )
  )
)
with check (
  auth.uid() = user_id
  and (
    chapter_id is null
    or exists (
      select 1
      from public.chapters c
      join public.exams e on e.id = c.exam_id
      where c.id = sessions.chapter_id and e.user_id = auth.uid()
    )
  )
  and (
    deck_id is null
    or exists (
      select 1 from public.decks d
      where d.id = sessions.deck_id and d.user_id = auth.uid()
    )
  )
);

drop policy if exists "quiz results own rows" on public.quiz_results;
create policy "quiz results own rows" on public.quiz_results
for all
using (
  auth.uid() = user_id
  and (
    deck_id is null
    or exists (
      select 1 from public.decks d
      where d.id = quiz_results.deck_id and d.user_id = auth.uid()
    )
  )
)
with check (
  auth.uid() = user_id
  and (
    deck_id is null
    or exists (
      select 1 from public.decks d
      where d.id = quiz_results.deck_id and d.user_id = auth.uid()
    )
  )
);
