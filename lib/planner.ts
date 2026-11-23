export type ExamChapter = {
  id: string;
  difficulty: 1 | 2 | 3;
};

export type Exam = {
  id: string;
  date: string;
  chapters: ExamChapter[];
};

export type Availability = Record<number, number>;

export type PlannedSession = {
  chapterId: string;
  examId: string;
  date: string;
  duration: number;
};

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function generatePlan(
  exams: Exam[],
  availability: Availability,
  blockedDates: string[] = []
): PlannedSession[] {
  const blocked = new Set(blockedDates);
  const sessions: PlannedSession[] = [];
  const usedByDate = new Map<string, number>();
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const sortedExams = [...exams].sort((left, right) => left.date.localeCompare(right.date));
  for (const exam of sortedExams) {
    if (!isValidDateKey(exam.date)) continue;
    const examDate = new Date(`${exam.date}T00:00:00`);
    if (Number.isNaN(examDate.getTime()) || examDate < now) continue;
    const daysUntilExam = Math.round((examDate.getTime() - now.getTime()) / 86_400_000);
    if (daysUntilExam < 1 || exam.chapters.length === 0) continue;

    const totalWeight = exam.chapters.reduce((sum, item) => sum + item.difficulty, 0);
    const reviewCount = daysUntilExam >= 7 ? 3 : daysUntilExam >= 3 ? 2 : 1;
    const chapters = [...exam.chapters].sort((left, right) =>
      right.difficulty - left.difficulty || left.id.localeCompare(right.id)
    );

    for (const chapter of chapters) {
      const targetMinutes = Math.round(180 * (chapter.difficulty / Math.max(1, totalWeight)));
      const baseDuration = Math.floor(targetMinutes / reviewCount);
      let extraMinutes = targetMinutes % reviewCount;

      for (let reviewIndex = 0; reviewIndex < reviewCount; reviewIndex += 1) {
        const preferredOffset = reviewCount === 1
          ? 0
          : Math.floor((daysUntilExam - 1) * reviewIndex / (reviewCount - 1));
        const preferredDate = new Date(now);
        preferredDate.setDate(preferredDate.getDate() + preferredOffset);
        let remaining = baseDuration + (extraMinutes > 0 ? 1 : 0);
        extraMinutes -= extraMinutes > 0 ? 1 : 0;
        const cursor = new Date(preferredDate);

        while (cursor < examDate && remaining > 0) {
          const date = [
            cursor.getFullYear(),
            String(cursor.getMonth() + 1).padStart(2, '0'),
            String(cursor.getDate()).padStart(2, '0'),
          ].join('-');
          const dayMinutes = availability[cursor.getDay()] ?? 0;
          const usedMinutes = usedByDate.get(date) ?? 0;
          const availableMinutes = Math.max(0, dayMinutes - usedMinutes);

          if (!blocked.has(date) && availableMinutes > 0) {
            const duration = Math.min(remaining, availableMinutes);
            sessions.push({ chapterId: chapter.id, examId: exam.id, date, duration });
            usedByDate.set(date, usedMinutes + duration);
            remaining -= duration;
          }
          cursor.setDate(cursor.getDate() + 1);
        }
      }
    }
  }

  return sessions.sort((left, right) =>
    left.date.localeCompare(right.date)
    || left.examId.localeCompare(right.examId)
    || left.chapterId.localeCompare(right.chapterId)
  );
}
