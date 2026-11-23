import { supabase } from './supabase';
import { Availability, Exam, generatePlan, isValidDateKey, PlannedSession } from '../planner';
import { ReviewState } from '../review';

export type SubjectRecord = {
  id: string;
  name: string;
  color: string;
  created_at: string;
};

export type ExamRecord = {
  id: string;
  subject_id: string | null;
  title: string;
  exam_date: string;
  coefficient: number | null;
};

export type ChapterRecord = {
  id: string;
  exam_id: string;
  title: string;
  difficulty: 1 | 2 | 3;
  status: string;
};

export type SessionRecord = {
  id: string;
  chapter_id: string | null;
  deck_id: string | null;
  session_date: string;
  duration: number;
  status: string;
  type: string;
};

export type SessionView = SessionRecord & {
  chapterTitle: string;
  examTitle: string;
  subjectName: string;
  subjectColor: string;
  deckTitle: string | null;
};

export type DeckRecord = {
  id: string;
  title: string;
  subject_id: string | null;
  chapter_id: string | null;
  created_at: string;
};

export type CardRecord = {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  created_at: string;
};

function todayDateKey(): string {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
}

function getClient() {
  if (!supabase) {
    throw new Error('Supabase n’est pas configuré.');
  }
  return supabase;
}

async function getUserId() {
  const client = getClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Connecte-toi pour accéder à tes données.');
  return data.user.id;
}

export async function listSubjects(): Promise<SubjectRecord[]> {
  const client = getClient();
  const userId = await getUserId();
  const { data, error } = await client
    .from('subjects')
    .select('id,name,color,created_at')
    .eq('user_id', userId)
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function createSubject(name: string, color = '#6657F4'): Promise<SubjectRecord> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('Indique le nom du cours.');
  if (trimmedName.length > 60) throw new Error('Le nom du cours ne peut pas dépasser 60 caractères.');
  const client = getClient();
  const userId = await getUserId();
  const { data, error } = await client
    .from('subjects')
    .insert({ user_id: userId, name: trimmedName, color })
    .select('id,name,color,created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSubject(subjectId: string): Promise<void> {
  const client = getClient();
  const userId = await getUserId();
  const { error } = await client
    .from('subjects')
    .delete()
    .eq('user_id', userId)
    .eq('id', subjectId);
  if (error) throw error;
}

export async function renameSubject(subjectId: string, name: string): Promise<void> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('Indique le nom du cours.');
  if (trimmedName.length > 60) throw new Error('Le nom du cours ne peut pas dépasser 60 caractères.');
  const userId = await getUserId();
  const { error } = await getClient()
    .from('subjects')
    .update({ name: trimmedName })
    .eq('user_id', userId)
    .eq('id', subjectId);
  if (error) throw error;
}

export async function listExams(): Promise<ExamRecord[]> {
  const client = getClient();
  const userId = await getUserId();
  const { data, error } = await client
    .from('exams')
    .select('id,subject_id,title,exam_date,coefficient')
    .eq('user_id', userId)
    .order('exam_date');
  if (error) throw error;
  return data ?? [];
}

export async function createExam(
  subjectId: string,
  title: string,
  examDate: string
): Promise<ExamRecord> {
  const trimmedTitle = title.trim();
  if (!subjectId) throw new Error('Choisis un cours pour ce contrôle.');
  if (!trimmedTitle) throw new Error('Indique le nom du contrôle.');
  if (trimmedTitle.length > 120) throw new Error('Le nom du contrôle ne peut pas dépasser 120 caractères.');
  if (!isValidDateKey(examDate)) throw new Error('La date doit respecter le format AAAA-MM-JJ.');
  if (examDate < todayDateKey()) {
    throw new Error('La date du contrôle ne peut pas être passée.');
  }
  const client = getClient();
  const userId = await getUserId();
  const { data, error } = await client
    .from('exams')
    .insert({
      user_id: userId,
      subject_id: subjectId,
      title: trimmedTitle,
      exam_date: examDate,
    })
    .select('id,subject_id,title,exam_date,coefficient')
    .single();
  if (error) throw error;
  return data;
}

export async function updateExam(
  examId: string,
  subjectId: string,
  title: string,
  examDate: string
): Promise<void> {
  if (!subjectId) throw new Error('Choisis un cours pour ce contrôle.');
  const trimmedTitle = title.trim();
  if (!trimmedTitle) throw new Error('Indique le nom du contrôle.');
  if (trimmedTitle.length > 120) throw new Error('Le nom du contrôle ne peut pas dépasser 120 caractères.');
  if (!isValidDateKey(examDate)) throw new Error('La date doit respecter le format AAAA-MM-JJ.');
  if (examDate < todayDateKey()) throw new Error('La date du contrôle ne peut pas être passée.');
  const userId = await getUserId();
  const { error } = await getClient()
    .from('exams')
    .update({ subject_id: subjectId, title: trimmedTitle, exam_date: examDate })
    .eq('user_id', userId)
    .eq('id', examId);
  if (error) throw error;
}

export async function deleteExam(examId: string): Promise<void> {
  const userId = await getUserId();
  const { error } = await getClient()
    .from('exams')
    .delete()
    .eq('user_id', userId)
    .eq('id', examId);
  if (error) throw error;
}

export async function listChapters(examIds: string[]): Promise<ChapterRecord[]> {
  if (examIds.length === 0) return [];
  const { data, error } = await getClient()
    .from('chapters')
    .select('id,exam_id,title,difficulty,status')
    .in('exam_id', examIds)
    .order('title');
  if (error) throw error;
  return data ?? [];
}

export async function createChapter(
  examId: string,
  title: string,
  difficulty: 1 | 2 | 3
): Promise<ChapterRecord> {
  const trimmedTitle = title.trim();
  if (!examId) throw new Error('Choisis un contrôle pour ce chapitre.');
  if (!trimmedTitle) throw new Error('Indique le nom du chapitre.');
  if (trimmedTitle.length > 120) throw new Error('Le nom du chapitre ne peut pas dépasser 120 caractères.');
  if (![1, 2, 3].includes(difficulty)) throw new Error('Choisis un niveau de difficulté valide.');
  const { data, error } = await getClient()
    .from('chapters')
    .insert({ exam_id: examId, title: trimmedTitle, difficulty })
    .select('id,exam_id,title,difficulty,status')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteChapter(chapterId: string): Promise<void> {
  const { error } = await getClient()
    .from('chapters')
    .delete()
    .eq('id', chapterId);
  if (error) throw error;
}

export async function listAvailability(): Promise<Availability> {
  const userId = await getUserId();
  const { data, error } = await getClient()
    .from('availabilities')
    .select('weekday,minutes')
    .eq('user_id', userId);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map(({ weekday, minutes }) => [weekday, minutes]));
}

export async function saveAvailability(availability: Availability): Promise<void> {
  const userId = await getUserId();
  const rows = Array.from({ length: 7 }, (_, weekday) => ({
    user_id: userId,
    weekday,
    minutes: Math.min(1440, Math.max(0, Math.floor(availability[weekday] ?? 0))),
  }));
  const { error } = await getClient()
    .from('availabilities')
    .upsert(rows, { onConflict: 'user_id,weekday' });
  if (error) throw error;
}

export async function listBlockedDays(): Promise<string[]> {
  const userId = await getUserId();
  const { data, error } = await getClient()
    .from('blocked_days')
    .select('blocked_date')
    .eq('user_id', userId)
    .order('blocked_date');
  if (error) throw error;
  return (data ?? []).map(({ blocked_date }) => blocked_date);
}

export async function setBlockedDay(date: string, blocked: boolean): Promise<void> {
  if (!isValidDateKey(date)) throw new Error('La date bloquée doit respecter le format AAAA-MM-JJ.');
  const userId = await getUserId();
  const query = getClient().from('blocked_days');
  const result = blocked
    ? await query.upsert({ user_id: userId, blocked_date: date }, { onConflict: 'user_id,blocked_date' })
    : await query.delete().eq('user_id', userId).eq('blocked_date', date);
  if (result.error) throw result.error;
}

export async function generateAndSavePlan(): Promise<PlannedSession[]> {
  const client = getClient();
  const userId = await getUserId();
  const [exams, availability, blockedDays] = await Promise.all([
    listExams(),
    listAvailability(),
    listBlockedDays(),
  ]);
  const chapters = await listChapters(exams.map((exam) => exam.id));
  const decks = await listDecks();
  const decksForChapters = decks.filter(
    (deck): deck is DeckRecord & { chapter_id: string } => deck.chapter_id !== null
  );
  const deckByChapter = new Map<string, string>(
    decksForChapters.map((deck): [string, string] => [deck.chapter_id, deck.id])
  );
  const planInput: Exam[] = exams.map((exam) => ({
    id: exam.id,
    date: exam.exam_date,
    chapters: chapters
      .filter((chapter) => chapter.exam_id === exam.id)
      .map((chapter) => ({ id: chapter.id, difficulty: chapter.difficulty })),
  }));
  const plan = generatePlan(planInput, availability, blockedDays);

  let newIds: string[] = [];
  if (plan.length > 0) {
    const { data, error } = await client
      .from('sessions')
      .insert(plan.map((session) => ({
        user_id: userId,
        chapter_id: session.chapterId,
        deck_id: deckByChapter.get(session.chapterId) ?? null,
        session_date: session.date,
        duration: session.duration,
        status: 'planned',
        type: 'review',
      })))
      .select('id');
    if (error) throw error;

    newIds = (data ?? []).map(({ id }) => id);
    if (newIds.length !== plan.length) {
      throw new Error('Le planning a été généré, mais les sessions enregistrées sont incomplètes.');
    }
  }

  const cleanupQuery = client
    .from('sessions')
    .delete()
    .eq('user_id', userId)
    .eq('status', 'planned');
  const { error: cleanupError } = newIds.length > 0
    ? await cleanupQuery.not('id', 'in', `(${newIds.join(',')})`)
    : await cleanupQuery;
  if (cleanupError) throw cleanupError;

  return plan;
}

export async function listSessions(): Promise<SessionRecord[]> {
  const userId = await getUserId();
  const { data, error } = await getClient()
    .from('sessions')
    .select('id,chapter_id,deck_id,session_date,duration,status,type')
    .eq('user_id', userId)
    .order('session_date');
  if (error) throw error;
  return data ?? [];
}

export async function listSessionViews(): Promise<SessionView[]> {
  const [sessions, exams, subjects, decks] = await Promise.all([
    listSessions(),
    listExams(),
    listSubjects(),
    listDecks(),
  ]);
  const chapters = await listChapters(
    Array.from(new Set(exams.map((exam) => exam.id)))
  );
  const examById = new Map(exams.map((exam) => [exam.id, exam]));
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const deckById = new Map(decks.map((deck) => [deck.id, deck]));

  return sessions.map((session) => {
    const chapter = session.chapter_id ? chapterById.get(session.chapter_id) : undefined;
    const exam = chapter ? examById.get(chapter.exam_id) : undefined;
    const subject = exam?.subject_id ? subjectById.get(exam.subject_id) : undefined;
    return {
      ...session,
      deck_id: session.deck_id && deckById.has(session.deck_id) ? session.deck_id : null,
      chapterTitle: chapter?.title ?? 'Révision',
      examTitle: exam?.title ?? '',
      subjectName: subject?.name ?? 'Révision',
      subjectColor: subject?.color ?? '#6657F4',
      deckTitle: session.deck_id ? deckById.get(session.deck_id)?.title ?? null : null,
    };
  });
}

export async function updateSessionStatus(
  sessionId: string,
  status: 'done' | 'postponed' | 'missed' | 'planned'
): Promise<void> {
  const userId = await getUserId();
  const { error } = await getClient()
    .from('sessions')
    .update({ status })
    .eq('id', sessionId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function listDecks(): Promise<DeckRecord[]> {
  const userId = await getUserId();
  const { data, error } = await getClient()
    .from('decks')
    .select('id,title,subject_id,chapter_id,created_at')
    .eq('user_id', userId)
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function createDeck(title: string, subjectId?: string, chapterId?: string): Promise<DeckRecord> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) throw new Error('Indique le nom du paquet.');
  if (trimmedTitle.length > 80) throw new Error('Le nom du paquet ne peut pas dépasser 80 caractères.');
  const userId = await getUserId();
  const { data, error } = await getClient()
    .from('decks')
    .insert({
      user_id: userId,
      title: trimmedTitle,
      subject_id: subjectId ?? null,
      chapter_id: chapterId ?? null,
    })
    .select('id,title,subject_id,chapter_id,created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function renameDeck(deckId: string, title: string): Promise<void> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) throw new Error('Indique le nom du paquet.');
  if (trimmedTitle.length > 80) throw new Error('Le nom du paquet ne peut pas dépasser 80 caractères.');
  const userId = await getUserId();
  const { error } = await getClient()
    .from('decks')
    .update({ title: trimmedTitle })
    .eq('id', deckId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deleteDeck(deckId: string): Promise<void> {
  const userId = await getUserId();
  const { error: sessionError } = await getClient()
    .from('sessions')
    .update({ deck_id: null })
    .eq('user_id', userId)
    .eq('deck_id', deckId);
  if (sessionError) throw sessionError;
  const { error } = await getClient()
    .from('decks')
    .delete()
    .eq('id', deckId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function listCards(deckId: string): Promise<CardRecord[]> {
  const { data, error } = await getClient()
    .from('cards')
    .select('id,deck_id,front,back,created_at')
    .eq('deck_id', deckId)
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function deleteCard(cardId: string): Promise<void> {
  const { error } = await getClient()
    .from('cards')
    .delete()
    .eq('id', cardId);
  if (error) throw error;
}

export async function addCards(
  deckId: string,
  cards: { front: string; back: string }[]
): Promise<CardRecord[]> {
  if (cards.length === 0) return [];
  if (!deckId) throw new Error('Choisis un paquet avant d’ajouter des cartes.');
  if (cards.some((card) => !card.front.trim() || !card.back.trim())) {
    throw new Error('Chaque carte doit avoir un recto et un verso.');
  }
  if (cards.some((card) => card.front.trim().length > 2000 || card.back.trim().length > 2000)) {
    throw new Error('Le recto et le verso sont limités à 2 000 caractères.');
  }
  const { data, error } = await getClient()
    .from('cards')
    .insert(cards.map((card) => ({
      deck_id: deckId,
      front: card.front.trim(),
      back: card.back.trim(),
    })))
    .select('id,deck_id,front,back,created_at');
  if (error) throw error;
  return data ?? [];
}

export async function getCardProgress(cardId: string): Promise<ReviewState> {
  const { data, error } = await getClient()
    .from('card_progress')
    .select('ease_factor,interval,repetitions,next_review_at')
    .eq('card_id', cardId)
    .maybeSingle();
  if (error) throw error;
  return {
    easeFactor: data?.ease_factor ?? 2.5,
    interval: data?.interval ?? 0,
    repetitions: data?.repetitions ?? 0,
    nextReviewAt: data?.next_review_at ?? new Date().toISOString().slice(0, 10),
  };
}

export async function saveCardProgress(
  cardId: string,
  state: {
    easeFactor: number;
    interval: number;
    repetitions: number;
    nextReviewAt: string;
    quality: number;
  }
): Promise<void> {
  const client = getClient();
  const { data: previous, error: previousError } = await client
    .from('card_progress')
    .select('successes,failures')
    .eq('card_id', cardId)
    .maybeSingle();
  if (previousError) throw previousError;

  const { error } = await client
    .from('card_progress')
    .upsert({
      card_id: cardId,
      ease_factor: state.easeFactor,
      interval: state.interval,
      repetitions: state.repetitions,
      next_review_at: state.nextReviewAt,
      successes: (previous?.successes ?? 0) + (state.quality >= 3 ? 1 : 0),
      failures: (previous?.failures ?? 0) + (state.quality < 3 ? 1 : 0),
    }, { onConflict: 'card_id' });
  if (error) throw error;
}

export async function saveQuizResult(
  deckId: string,
  questionCount: number,
  score: number,
  missedCardIds: string[]
): Promise<void> {
  const userId = await getUserId();
  const { error } = await getClient()
    .from('quiz_results')
    .insert({
      user_id: userId,
      deck_id: deckId,
      question_count: questionCount,
      score,
      missed_card_ids: missedCardIds,
    });
  if (error) throw error;
}

export async function deleteAccount(): Promise<void> {
  const { error } = await getClient().functions.invoke('delete-account', {
    method: 'POST',
  });
  if (error) throw error;
}
