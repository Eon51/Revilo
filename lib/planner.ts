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

  for (const exam of exams) {
    const examDate = new Date(`${exam.date}T00:00:00`);
    if (Number.isNaN(examDate.getTime()) || examDate < now) continue;

    for (const chapter of exam.chapters) {
      const totalWeight = exam.chapters.reduce(
        (sum, item) => sum + item.difficulty,
        0
      );
      const targetMinutes = Math.round(
        180 * (chapter.difficulty / Math.max(1, totalWeight))
      );

      let remaining = targetMinutes;
      const cursor = new Date(now);
      while (cursor <= examDate && remaining > 0) {
        const dateKey = [
          cursor.getFullYear(),
          String(cursor.getMonth() + 1).padStart(2, '0'),
          String(cursor.getDate()).padStart(2, '0'),
        ].join('-');
        const dayMinutes = availability[cursor.getDay()] ?? 0;
        const usedMinutes = usedByDate.get(dateKey) ?? 0;
        const availableMinutes = Math.max(0, dayMinutes - usedMinutes);

        if (!blocked.has(dateKey) && availableMinutes > 0) {
          const duration = Math.min(remaining, availableMinutes);
          sessions.push({
            chapterId: chapter.id,
            examId: exam.id,
            date: dateKey,
            duration,
          });
          usedByDate.set(dateKey, usedMinutes + duration);
          remaining -= duration;
        }

        cursor.setDate(cursor.getDate() + 1);
      }
    }
  }

  return sessions.sort((a, b) => a.date.localeCompare(b.date));
}
